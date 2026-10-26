'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');

const MAX_APK_BYTES = 256 * 1024 * 1024;
const MAX_PATCH_BYTES = 272 * 1024 * 1024;
const MAX_COMMANDS = 1000000;
const BLOCK = 4096;
const PAGE = 1024 * 1024;
const MOD = 65521;

// Two cached pages per file keep a rolling window crossing page boundaries cheap.
class FileReader {
  constructor(file) {
    this.fd = fs.openSync(file, 'r');
    this.size = fs.fstatSync(this.fd).size;
    this.pages = new Map();
  }
  slice(position, length) {
    const page = Math.floor(position / PAGE);
    let bytes = this.pages.get(page);
    if (!bytes) {
      bytes = Buffer.allocUnsafe(Math.min(PAGE, this.size - page * PAGE));
      let read = 0;
      while (read < bytes.length) {
        const n = fs.readSync(this.fd, bytes, read, bytes.length - read, page * PAGE + read);
        if (!n) throw new Error('Input changed or was truncated');
        read += n;
      }
      if (this.pages.size === 2) this.pages.delete(this.pages.keys().next().value);
      this.pages.set(page, bytes);
    }
    return bytes.subarray(position % PAGE, Math.min(bytes.length, position % PAGE + length));
  }
  byte(position) { return this.slice(position, 1)[0]; }
  close() { fs.closeSync(this.fd); }
}

function checksum(reader, position) {
  let a = 0, b = 0;
  for (let i = 0; i < BLOCK; i++) { a += reader.byte(position + i); b += (BLOCK - i) * reader.byte(position + i); }
  return { a: a % MOD, b: b % MOD };
}
const key = sum => (sum.b * 65536 + sum.a) >>> 0;

function commonLength(base, target, baseOffset, targetOffset) {
  const limit = Math.min(base.size - baseOffset, target.size - targetOffset);
  let length = 0;
  while (length < limit) {
    const a = base.slice(baseOffset + length, limit - length);
    const b = target.slice(targetOffset + length, a.length);
    const n = Math.min(a.length, b.length);
    if (!a.subarray(0, n).equals(b.subarray(0, n))) {
      for (let i = 0; i < n; i++) if (a[i] !== b[i]) return length + i;
    }
    length += n;
  }
  return length;
}

function sha256File(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const hash = crypto.createHash('sha256'), bytes = Buffer.allocUnsafe(PAGE);
    let n;
    while ((n = fs.readSync(fd, bytes, 0, bytes.length, null)) > 0) hash.update(bytes.subarray(0, n));
    return hash.digest();
  } finally { fs.closeSync(fd); }
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset, bytes.length - offset);
}

/** Resolves after the patch is written. File indexing is bounded-memory synchronous work. */
async function createDelta(basePath, targetPath, patchPath) {
  const baseReal = fs.realpathSync(basePath), targetReal = fs.realpathSync(targetPath);
  const outputReal = fs.existsSync(patchPath) ? fs.realpathSync(patchPath) : path.join(fs.realpathSync(path.dirname(path.resolve(patchPath))), path.basename(patchPath));
  if (outputReal === baseReal || outputReal === targetReal) throw new Error('Output must not overwrite an input');
  for (const input of [baseReal, targetReal]) {
    const stat = fs.statSync(input);
    if (!stat.isFile() || stat.size > MAX_APK_BYTES) throw new Error('Input size exceeds the APK limit');
  }
  const tempDir = fs.mkdtempSync(path.join(path.dirname(outputReal), '.aura-delta-'));
  const rawPath = path.join(tempDir, 'commands'), temporaryPatch = path.join(tempDir, 'patch');
  let base, target, rawFd;
  try {
    base = new FileReader(baseReal); target = new FileReader(targetReal);
    const baseHash = sha256File(baseReal), targetHash = sha256File(targetReal);
    const index = new Map();
    for (let position = 0; position + BLOCK <= base.size; position += BLOCK) {
      const hash = key(checksum(base, position));
      const candidates = index.get(hash);
      if (!candidates) index.set(hash, [position]);
      else if (candidates.length < 8) candidates.push(position);
    }
    rawFd = fs.openSync(rawPath, 'wx');
    let count = 0;
    const emit = (kind, offset, length) => {
      if (++count > MAX_COMMANDS) throw new Error('Command count exceeds limit');
      const header = Buffer.alloc(kind === 1 ? 17 : 9);
      header[0] = kind;
      if (kind === 1) { header.writeBigUInt64BE(BigInt(offset), 1); header.writeBigUInt64BE(BigInt(length), 9); }
      else header.writeBigUInt64BE(BigInt(length), 1);
      writeAll(rawFd, header);
      if (kind === 2) {
        let written = 0;
        while (written < length) {
          const bytes = target.slice(offset + written, length - written);
          writeAll(rawFd, bytes); written += bytes.length;
        }
      }
    };
    let position = 0, literalStart = 0;
    let sum = target.size >= BLOCK ? checksum(target, 0) : null;
    while (position + BLOCK <= target.size) {
      let match = 0, matchOffset = 0;
      for (const offset of index.get(key(sum)) || []) {
        const length = commonLength(base, target, offset, position);
        if (length >= BLOCK) { match = length; matchOffset = offset; break; }
      }
      if (match) {
        if (literalStart < position) emit(2, literalStart, position - literalStart);
        emit(1, matchOffset, match);
        position += match; literalStart = position;
        sum = position + BLOCK <= target.size ? checksum(target, position) : null;
      } else {
        if (position + BLOCK < target.size) {
          const outgoing = target.byte(position), incoming = target.byte(position + BLOCK);
          sum.a = (sum.a - outgoing + incoming + MOD) % MOD;
          sum.b = ((sum.b - BLOCK * outgoing + sum.a) % MOD + MOD) % MOD;
        }
        position++;
      }
    }
    if (literalStart < target.size) emit(2, literalStart, target.size - literalStart);
    fs.closeSync(rawFd); rawFd = undefined;
    fs.writeFileSync(temporaryPatch, Buffer.alloc(100));
    await pipeline(fs.createReadStream(rawPath), zlib.createGzip({ level: 9 }), fs.createWriteStream(temporaryPatch, { flags: 'r+', start: 100 }));
    const size = fs.statSync(temporaryPatch).size;
    if (size > MAX_PATCH_BYTES) throw new Error('Patch size exceeds limit');
    if (!baseHash.equals(sha256File(baseReal)) || !targetHash.equals(sha256File(targetReal))) throw new Error('Inputs changed during delta generation');
    const header = Buffer.alloc(100);
    header.write('AURACPY1'); header.writeBigUInt64BE(BigInt(base.size), 8); header.writeBigUInt64BE(BigInt(target.size), 16);
    baseHash.copy(header, 24); targetHash.copy(header, 56); header.writeUInt32BE(count, 88); header.writeBigUInt64BE(BigInt(size - 100), 92);
    const patchFd = fs.openSync(temporaryPatch, 'r+');
    try { writeAll(patchFd, header); fs.fsyncSync(patchFd); } finally { fs.closeSync(patchFd); }
    const sha256 = sha256File(temporaryPatch).toString('hex');
    fs.renameSync(temporaryPatch, outputReal);
    return { format: 'aura-copy-v1', baseSha256: baseHash.toString('hex'), targetSha256: targetHash.toString('hex'), patchSha256: sha256, sha256, size, commandCount: count };
  } finally {
    if (rawFd !== undefined) fs.closeSync(rawFd);
    if (base) base.close();
    if (target) target.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { createDelta, MAX_APK_BYTES, MAX_PATCH_BYTES };

if (require.main === module) {
  const values = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (!['--base', '--target', '--out'].includes(args[i]) || !args[i + 1] || values[args[i]]) {
      process.stderr.write('Usage: node delta.cjs --base old.apk --target new.apk --out update.delta\n');
      process.exit(1);
    }
    values[args[i]] = args[i + 1];
  }
  if (!values['--base'] || !values['--target'] || !values['--out']) {
    process.stderr.write('Usage: node delta.cjs --base old.apk --target new.apk --out update.delta\n');
    process.exit(1);
  }
  createDelta(values['--base'], values['--target'], values['--out']).then(result => {
    process.stdout.write(JSON.stringify(result) + '\n');
  }).catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
