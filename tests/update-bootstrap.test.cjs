const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const scriptPath = path.join(__dirname, '../app/src/main/assets/web/update-bootstrap.js');
function boot({ origin = 'https:', initial = {}, backup = {}, mode = 'pending', failKey, corruptKey } = {}) {
  const data = new Map(Object.entries(initial));
  const calls = [];
  const storage = {
    get length() { return data.size; }, key: i => [...data.keys()][i],
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem(key, value) { if (key === failKey) throw new Error('QuotaExceededError'); data.set(key, key === corruptKey ? 'corrupt' : String(value)); },
    removeItem: key => data.delete(key)
  };
  const bridge = {
    getLaunchToken: () => 'boot-1',
    getMigrationState: () => mode,
    saveLegacySnapshot: value => { calls.push(['save', JSON.parse(value)]); return true; },
    getLegacySnapshot: () => JSON.stringify({ schema: 1, entries: Object.entries(backup) }),
    confirmMigration: value => { calls.push(['confirm', JSON.parse(value)]); return true; },
    migrationFailed: reason => calls.push(['failed', reason]),
    markHealthy: () => calls.push(['healthy'])
  };
  const win = { AuraStorage: bridge, localStorage: storage, location: { protocol: origin }, console };
  win.window = win;
  vm.runInNewContext(fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '', win);
  return { win, data, calls };
}

test('legacy origin captures every key before app boot and blocks initialization', () => {
  const { win, calls } = boot({ origin: 'file:', initial: { plugin: '源码', favorites: '[1]', other: '' } });
  assert.equal(win.AuraStorageMigrationPending, true);
  assert.deepEqual(calls[0], ['save', { schema: 1, entries: [['favorites', '[1]'], ['other', ''], ['plugin', '源码']] }]);
});

test('new origin restores all keys and verifies them before confirming migration', () => {
  const { win, data, calls } = boot({ initial: { unrelated: 'keep' }, backup: { plugin: '源码', favorites: '[1]' } });
  assert.equal(data.get('plugin'), '源码');
  assert.equal(data.get('favorites'), '[1]');
  assert.equal(data.get('unrelated'), 'keep');
  assert.equal(calls[0][0], 'confirm');
  assert.equal(win.AuraStorageMigrationPending, false);
});

test('quota failure restores overwritten values and requests usable legacy fallback', () => {
  const { win, data, calls } = boot({ initial: { first: 'old' }, backup: { first: 'new', second: 'large' }, failKey: 'second' });
  assert.equal(data.get('first'), 'old');
  assert.equal(data.has('second'), false);
  assert.equal(calls.some(c => c[0] === 'confirm'), false);
  assert.equal(calls.some(c => c[0] === 'failed'), true);
  assert.equal(win.AuraStorageMigrationPending, true);
});

test('readback mismatch cannot mark migration complete', () => {
  const { calls, win } = boot({ backup: { favorites: '[1]' }, corruptKey: 'favorites' });
  assert.equal(calls.some(c => c[0] === 'confirm'), false);
  assert.equal(calls.some(c => c[0] === 'failed'), true);
  assert.equal(win.AuraStorageMigrationPending, true);
});

test('fallback legacy session starts the old interface without another migration loop', () => {
  const { calls, win } = boot({ origin: 'file:', mode: 'legacy', initial: { favorites: '[1]' } });
  assert.equal(win.AuraStorageMigrationPending, false);
  assert.deepEqual(calls, []);
});

test('empty backup never clears values already present at new origin', () => {
  const { data, win } = boot({ initial: { favorites: '[1]' }, backup: {} });
  assert.equal(data.get('favorites'), '[1]');
  assert.equal(win.AuraStorageMigrationPending, false);
});

test('completed migration still binds health acknowledgement to this document launch', () => {
  const { win } = boot({ mode: 'complete' });
  assert.equal(win.AuraStorageLaunchToken, 'boot-1');
  assert.equal(win.AuraStorageMigrationPending, false);
});
