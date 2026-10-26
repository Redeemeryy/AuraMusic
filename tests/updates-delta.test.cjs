'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { createDelta } = require('../scripts/updates/delta.cjs');

const digest = bytes => crypto.createHash('sha256').update(bytes).digest();
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-delta-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { base: path.join(dir, 'base.apk'), target: path.join(dir, 'target.apk'), patch: path.join(dir, 'patch.bin') };
}

// Deliberately independent consumer: catches wrong offsets, endianness and inserted data.
function decode(base, patch) {
  assert.equal(patch.subarray(0, 8).toString(), 'AURACPY1');
  assert.equal(Number(patch.readBigUInt64BE(8)), base.length);
  assert.deepEqual(patch.subarray(24, 56), digest(base));
  assert.equal(Number(patch.readBigUInt64BE(92)), patch.length - 100);
  const raw = zlib.gunzipSync(patch.subarray(100));
  const parts = [];
  let position = 0, copies = 0;
  for (let i = 0; i < patch.readUInt32BE(88); i++) {
    const command = raw[position++];
    if (command === 1) {
      const offset = Number(raw.readBigUInt64BE(position)); position += 8;
      const length = Number(raw.readBigUInt64BE(position)); position += 8;
      assert.ok(length > 0 && offset + length <= base.length);
      parts.push(base.subarray(offset, offset + length)); copies++;
    } else {
      assert.equal(command, 2);
      const length = Number(raw.readBigUInt64BE(position)); position += 8;
      assert.ok(length > 0 && position + length <= raw.length);
      parts.push(raw.subarray(position, position + length)); position += length;
    }
  }
  assert.equal(position, raw.length);
  const output = Buffer.concat(parts);
  assert.equal(output.length, Number(patch.readBigUInt64BE(16)));
  assert.deepEqual(digest(output), patch.subarray(56, 88));
  return { output, copies };
}

test('rebuilds shifted random content and emits a substantially smaller patch', async t => {
  const files = fixture(t);
  const base = crypto.randomBytes(256 * 1024);
  const target = Buffer.concat([Buffer.from('inserted prefix'), base.subarray(0, 50000), Buffer.from('new bytes'), base.subarray(50011), Buffer.from('tail')]);
  fs.writeFileSync(files.base, base); fs.writeFileSync(files.target, target);
  const result = await createDelta(files.base, files.target, files.patch);
  const patch = fs.readFileSync(files.patch);
  const decoded = decode(base, patch);
  assert.deepEqual(decoded.output, target);
  assert.ok(decoded.copies > 0);
  assert.ok(patch.length < target.length / 10);
  assert.equal(result.format, 'aura-copy-v1');
  assert.equal(result.size, patch.length);
  assert.equal(result.sha256, digest(patch).toString('hex'));
});

test('handles empty, short, repeated and unrelated inputs', async t => {
  const files = fixture(t);
  for (const [base, target] of [[Buffer.alloc(0), Buffer.alloc(0)], [Buffer.alloc(0), Buffer.from('abc')], [Buffer.from('abc'), Buffer.alloc(0)], [Buffer.from('abc'), Buffer.from('z')], [Buffer.alloc(100000, 7), Buffer.alloc(125000, 7)], [crypto.randomBytes(30000), crypto.randomBytes(40000)]]) {
    fs.writeFileSync(files.base, base); fs.writeFileSync(files.target, target);
    await createDelta(files.base, files.target, files.patch);
    assert.deepEqual(decode(base, fs.readFileSync(files.patch)).output, target);
  }
});

test('rejects oversized sparse inputs and never overwrites an input', async t => {
  const files = fixture(t);
  fs.writeFileSync(files.base, 'base'); fs.writeFileSync(files.target, 'target');
  await assert.rejects(createDelta(files.base, files.target, files.base));
  assert.equal(fs.readFileSync(files.base, 'utf8'), 'base');
  const fd = fs.openSync(files.target, 'w'); fs.ftruncateSync(fd, 256 * 1024 * 1024 + 1); fs.closeSync(fd);
  await assert.rejects(createDelta(files.base, files.target, files.patch), /size|large|limit/i);
  assert.equal(fs.existsSync(files.patch), false);
});

test('CLI accepts named paths and reports a usable delta', t => {
  const files = fixture(t);
  fs.writeFileSync(files.base, 'abc'); fs.writeFileSync(files.target, 'abc inserted');
  const run = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/updates/delta.cjs'), '--base', files.base, '--target', files.target, '--out', files.patch], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(decode(Buffer.from('abc'), fs.readFileSync(files.patch)).output, Buffer.from('abc inserted'));
  assert.equal(JSON.parse(run.stdout).format, 'aura-copy-v1');
});
