const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPreferences } = require('../app/src/main/assets/web/preferences.js');
function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,String(v)), removeItem: k => data.delete(k) };
}
test('invalid saved preferences recover without touching the library', () => {
  const s = storage({ aura_preferences: '{bad', jelly_favs: '[1]' });
  const p = createPreferences(s);
  assert.equal(p.get().playMode, 'sequence');
  assert.equal(s.getItem('jelly_favs'), '[1]');
});
test('mode and accessibility choices survive a new session', () => {
  const s = storage();
  createPreferences(s).set({ playMode: 'shuffle', reduceMotion: true, reduceTransparency: true });
  assert.deepEqual(createPreferences(s).get(), { playMode: 'shuffle', reduceMotion: true, reduceTransparency: true });
});
test('unknown modes and incorrectly typed flags cannot enter app state', () => {
  const p = createPreferences(storage());
  p.set({ playMode: 'bad', reduceMotion: 'false', reduceTransparency: 1 });
  assert.deepEqual(p.get(), { playMode: 'sequence', reduceMotion: false, reduceTransparency: false });
});
test('history removal preserves plugin, favorites and queue', () => {
  const s = storage({ jelly_history: '[1]', jelly_favs: '[2]', jelly_queue: '[3]', jelly_custom_plugin_code: 'code' });
  createPreferences(s).clearHistory();
  assert.equal(s.getItem('jelly_history'), null);
  assert.equal(s.getItem('jelly_favs'), '[2]');
  assert.equal(s.getItem('jelly_queue'), '[3]');
  assert.equal(s.getItem('jelly_custom_plugin_code'), 'code');
});
test('blocked storage keeps current-session changes usable', () => {
  const p = createPreferences({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  assert.equal(p.set({ playMode: 'loop' }).playMode, 'loop');
});
