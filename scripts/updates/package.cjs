const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const cp = require('node:child_process');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validPath = name => /^[A-Za-z0-9_.\/-]+$/.test(name) && !name.startsWith('/') && name.split('/').every(part => part && part !== '.' && part !== '..');
function collectWebFiles(root) {
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error('Web bundle cannot contain symlinks');
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        if (!validPath(relative)) throw Error('Unsafe web file path');
        const bytes = fs.readFileSync(file);
        if (bytes.length > 16 * 1024 * 1024) throw Error('Web file too large');
        files.push({ path: relative, size: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  visit(root);
  if (files.length > 512 || files.reduce((n, f) => n + f.size, 0) > 64 * 1024 * 1024) throw Error('Web bundle too large');
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function webMetadata(root, versionCode, minNativeVersionCode, maxNativeVersionCode) {
  if (![versionCode, minNativeVersionCode, maxNativeVersionCode].every(v => Number.isSafeInteger(v) && v > 0) || minNativeVersionCode > maxNativeVersionCode) throw Error('Invalid version codes');
  const files = collectWebFiles(root);
  if (!files.some(f => f.path === 'index.html')) throw Error('Missing index.html');
  return { versionCode, minNativeVersionCode, maxNativeVersionCode, filesHash: sha(JSON.stringify(files)), files };
}
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function writeZip(rows) {
  const body = [], central = [], seen = new Set();
  let offset = 0, centralSize = 0;
  for (const row of rows) {
    if (!validPath(row.path) || seen.has(row.path)) throw Error('Unsafe or duplicate ZIP path');
    seen.add(row.path);
    const name = Buffer.from(row.path, 'utf8'), data = Buffer.from(row.data), compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data), local = Buffer.alloc(30), record = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8); record.writeUInt16LE(8, 10);
    record.writeUInt16LE(0x21, 14); record.writeUInt32LE(crc, 16); record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(data.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    body.push(local, name, compressed); central.push(record, name);
    offset += local.length + name.length + compressed.length; centralSize += record.length + name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(rows.length, 8); end.writeUInt16LE(rows.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...body, ...central, end]);
}
function buildWebBundles(root, out, urlBase, versionCode, min, max, previous) {
  const meta = webMetadata(root, versionCode, min, max);
  fs.mkdirSync(out, { recursive: true });
  function archive(files, name) {
    const bytes = writeZip(files.map(f => ({ path: f.path, data: fs.readFileSync(path.join(root, f.path)) })));
    fs.writeFileSync(path.join(out, name), bytes);
    return { url: `${urlBase}/${name}`, size: bytes.length, sha256: sha(bytes) };
  }
  const full = archive(meta.files, `web-full-${meta.filesHash.slice(0, 12)}.zip`), patches = [];
  if (previous) {
    if (sha(JSON.stringify(previous.files)) !== previous.filesHash) throw Error('Previous web manifest hash mismatch');
    const old = new Map(previous.files.map(f => [f.path, f]));
    const changed = meta.files.filter(f => old.get(f.path)?.sha256 !== f.sha256 || old.get(f.path)?.size !== f.size);
    const patch = archive(changed, `web-${previous.filesHash.slice(0, 12)}-${meta.filesHash.slice(0, 12)}.zip`);
    patches.push({ fromFilesHash: previous.filesHash, ...patch });
  }
  fs.writeFileSync(path.join(out, 'web-base.json'), JSON.stringify(meta) + '\n', 'utf8');
  return { ...meta, full, patches };
}
function verifyEnvelope(envelope, publicKey) {
  const bytes = Buffer.from(envelope.payload, 'base64');
  if (!crypto.verify('RSA-SHA256', bytes, publicKey, Buffer.from(envelope.signature, 'base64'))) throw Error('Manifest signature does not match pinned release key');
  return bytes;
}
function javaExecutable() { return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'; }
function signer(args) { cp.execFileSync(javaExecutable(), [path.join(__dirname, 'SignManifest.java'), ...args], { stdio: 'inherit' }); }
function argsMap(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw Error('Expected --name value arguments');
    flags[args[i].slice(2)] = args[i + 1];
  }
  return flags;
}
async function main() {
  const f = argsMap(process.argv.slice(2));
  const webRoot = path.resolve(f.web || 'app/src/main/assets/web');
  const meta = webMetadata(webRoot, Number(f['web-version'] || 1), Number(f['native-min'] || 14), Number(f['native-max'] || 14));
  if (f.mode === 'base') {
    fs.writeFileSync(f.out || 'app/src/main/assets/update-base.json', JSON.stringify(meta) + '\n', 'utf8');
    console.log(`Web base: ${meta.files.length} files, ${meta.filesHash}`); return;
  }
  if (f.mode === 'key') {
    signer(['--properties', f.properties, '--public-out', 'app/src/main/assets/update-public-key.der', '--certificate-out', 'app/src/main/assets/update-certificate-sha256.txt']); return;
  }
  if (f.mode !== 'release' || !f.apk || !f.out || !f.properties || !f.tag || !f.version || !f.code) throw Error('Use --mode base|key|release; release requires --apk --out --properties --tag --version --code');
  if (!/^v\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*$/.test(f.tag)) throw Error('Invalid release tag');
  const out = path.resolve(f.out); fs.mkdirSync(out, { recursive: true });
  const urlBase = `https://github.com/Redeemeryy/AuraMusic/releases/download/${f.tag}`;
  const apkBytes = fs.readFileSync(f.apk), apkName = `AuraMusic-${f.tag}.apk`;
  if (apkBytes.length > 256 * 1024 * 1024) throw Error('APK too large');
  fs.writeFileSync(path.join(out, apkName), apkBytes);
  const patches = [];
  if (f['base-apk']) {
    const { createDelta } = require('./delta.cjs');
    const baseHash = sha(fs.readFileSync(f['base-apk'])), name = `apk-${baseHash.slice(0, 12)}-${sha(apkBytes).slice(0, 12)}.auradelta`;
    await createDelta(f['base-apk'], f.apk, path.join(out, name));
    const bytes = fs.readFileSync(path.join(out, name));
    if (bytes.length < apkBytes.length) patches.push({ fromSha256: baseHash, format: 'aura-copy-v1', url: `${urlBase}/${name}`, size: bytes.length, sha256: sha(bytes) });
    else fs.unlinkSync(path.join(out, name));
  }
  const web = buildWebBundles(webRoot, out, urlBase, meta.versionCode, meta.minNativeVersionCode, meta.maxNativeVersionCode, f['base-web'] ? JSON.parse(fs.readFileSync(f['base-web'], 'utf8')) : null);
  const payload = { schema: 1, packageName: 'com.salt.music', releaseVersion: f.version, notes: f.notes ? fs.readFileSync(f.notes, 'utf8') : '', apk: { versionCode: Number(f.code), versionName: f.version, url: `${urlBase}/${apkName}`, size: apkBytes.length, sha256: sha(apkBytes), certificateSha256: fs.readFileSync('app/src/main/assets/update-certificate-sha256.txt', 'utf8').trim(), patches }, web };
  const input = path.join(out, 'update-payload.json'), envelopePath = path.join(out, 'update-manifest.json');
  fs.writeFileSync(input, JSON.stringify(payload), 'utf8');
  signer(['--properties', f.properties, '--input', input, '--out', envelopePath]);
  const pinned = crypto.createPublicKey({ key: fs.readFileSync('app/src/main/assets/update-public-key.der'), format: 'der', type: 'spki' });
  verifyEnvelope(JSON.parse(fs.readFileSync(envelopePath, 'utf8')), pinned);
  const sums = fs.readdirSync(out).filter(n => /\.(apk|zip|auradelta)$/.test(n) || n === 'update-manifest.json').sort().map(n => `${sha(fs.readFileSync(path.join(out, n)))}  ${n}`).join('\n');
  fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums + '\n', 'utf8');
  console.log(JSON.stringify({ apkBytes: apkBytes.length, apkPatches: patches.map(p => p.size), webBytes: web.full.size, webPatches: web.patches.map(p => p.size), signedManifest: envelopePath }));
}
module.exports = { collectWebFiles, webMetadata, buildWebBundles, writeZip, verifyEnvelope };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
