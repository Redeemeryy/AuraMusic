const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { collectWebFiles, webMetadata, buildWebBundles, writeZip, verifyEnvelope } = require('../scripts/updates/package.cjs');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function fixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-release-test-'));
  try { return run(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// Independently decode local ZIP records with the platform's zlib implementation.
function unzipLocal(buffer) {
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameSize = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameSize).toString('utf8');
    const start = offset + 30 + nameSize + extra;
    files[name] = zlib.inflateRawSync(buffer.subarray(start, start + size));
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'central directory must follow file data');
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
  return files;
}
test('web metadata hashes exact bytes and sorts paths', () => fixture(dir => {
  fs.writeFileSync(path.join(dir, 'index.html'), '灵音');
  fs.mkdirSync(path.join(dir, 'fonts'));
  fs.writeFileSync(path.join(dir, 'fonts/a.woff2'), Buffer.from([0, 1, 255]));
  const files = collectWebFiles(dir);
  assert.deepEqual(files, [
    { path: 'fonts/a.woff2', size: 3, sha256: sha(Buffer.from([0, 1, 255])) },
    { path: 'index.html', size: 6, sha256: sha('灵音') }
  ]);
  const meta = webMetadata(dir, 2, 14, 14);
  assert.equal(meta.filesHash, sha(JSON.stringify(files)));
  assert.equal(meta.versionCode, 2);
}));
test('web delta includes only changed files and removes old paths through target inventory', () => fixture(dir => {
  const web = path.join(dir, 'web'), out = path.join(dir, 'out');
  fs.mkdirSync(web); fs.mkdirSync(out);
  fs.writeFileSync(path.join(web, 'index.html'), 'first');
  fs.writeFileSync(path.join(web, 'same.js'), 'same bytes');
  fs.writeFileSync(path.join(web, 'removed.js'), 'old');
  const old = webMetadata(web, 1, 14, 14);
  fs.writeFileSync(path.join(web, 'index.html'), '新界面');
  fs.unlinkSync(path.join(web, 'removed.js'));
  const result = buildWebBundles(web, out, 'https://github.com/Redeemeryy/AuraMusic/releases/download/v1.3.0', 2, 14, 14, old);
  const patch = result.patches[0];
  assert.equal(patch.fromFilesHash, old.filesHash);
  const zip = fs.readFileSync(path.join(out, path.basename(patch.url)));
  assert.deepEqual(Object.keys(unzipLocal(zip)), ['index.html']);
  assert.equal(unzipLocal(zip)['index.html'].toString('utf8'), '新界面');
  assert.equal(patch.sha256, sha(zip));
  assert.deepEqual(result.files.map(f => f.path), ['index.html', 'same.js']);
  assert.equal(result.filesHash, sha(JSON.stringify(result.files)));
}));
test('ZIP generation is deterministic and rejects paths outside the bundle', () => {
  const rows = [{ path: 'index.html', data: Buffer.from('页面') }, { path: 'a/b.js', data: Buffer.from('ok') }];
  assert.deepEqual(writeZip(rows), writeZip(rows));
  assert.equal(unzipLocal(writeZip(rows))['a/b.js'].toString(), 'ok');
  assert.throws(() => writeZip([{ path: '../escape', data: Buffer.from('x') }]));
  assert.throws(() => writeZip([{ path: '/absolute', data: Buffer.from('x') }]));
});
test('signed envelope authenticates raw payload bytes and rejects a modified payload', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const payload = Buffer.from('{"schema":1,"notes":"界面更新"}');
  const envelope = { payload: payload.toString('base64'), signature: crypto.sign('RSA-SHA256', payload, privateKey).toString('base64') };
  assert.deepEqual(verifyEnvelope(envelope, publicKey), payload);
  assert.throws(() => verifyEnvelope({ ...envelope, payload: Buffer.from('{"schema":2}').toString('base64') }, publicKey));
});
