const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');

const webRoot = path.resolve('app/src/main/assets/web');
const stableUrl = 'https://appassets.androidplatform.net/assets/web/index.html';

test('real legacy page snapshots storage and does not initialize the application before migration', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => {
      localStorage.setItem('jelly_favs', '[{"id":"saved"}]');
      localStorage.setItem('opaque-plugin-state', '插件缓存');
      window.AuraStorage = {
        getLaunchToken: () => 'legacy-boot', getMigrationState: () => 'pending',
        saveLegacySnapshot: value => { window.captured = JSON.parse(value); return true; },
        migrationFailed: value => { window.migrationError = value; }
      };
    });
    await page.goto(pathToFileURL(path.join(webRoot, 'index.html')).href);
    assert.equal(await page.evaluate(() => window.AuraStorageMigrationPending), true);
    assert.equal(await page.evaluate(() => typeof window.checkAppReleaseUpdate), 'undefined');
    const snapshot = await page.evaluate(() => window.captured);
    assert.equal(Object.fromEntries(snapshot.entries)['opaque-plugin-state'], '插件缓存');
    assert.equal(Object.fromEntries(snapshot.entries).jelly_favs, '[{"id":"saved"}]');
    assert.equal(await page.evaluate(() => window.migrationError), undefined);
  } finally { await browser.close(); }
});

test('real fixed HTTPS page restores before app boot and acknowledges health despite a hanging plugin', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://appassets.androidplatform.net') return route.abort();
      const name = url.pathname.slice('/assets/web/'.length);
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) return route.abort();
      const body = await fs.readFile(path.join(webRoot, name));
      const type = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'application/octet-stream';
      await route.fulfill({ body, contentType: type });
    });
    await page.addInitScript(() => {
      window.migrationCalls = [];
      const snapshot = { schema: 1, entries: [
        ['aura_preferences', '{"playMode":"shuffle","reduceMotion":true,"bluetoothLyrics":false}'],
        ['opaque-plugin-state', '插件缓存'], ['jelly_favs', '[]'],
        ['jelly_custom_plugin_code', 'exports.manifest = {name:"slow",version:"1"}; exports.activate = async () => new Promise(() => {});']
      ] };
      window.AuraStorage = {
        getLaunchToken: () => 'stable-boot', getMigrationState: () => 'pending',
        getLegacySnapshot: () => JSON.stringify(snapshot),
        confirmMigration: value => { window.migrationCalls.push(['confirm', value]); return true; },
        migrationFailed: value => { window.migrationCalls.push(['failed', value]); },
        markHealthy: token => window.migrationCalls.push(['healthy', token])
      };
    });
    await page.goto(stableUrl);
    await page.waitForFunction(() => window.migrationCalls.some(call => call[0] === 'healthy'), null, { timeout: 2000 });
    assert.equal(await page.evaluate(() => window.AuraPreferences.get().playMode), 'shuffle');
    assert.equal(await page.evaluate(() => localStorage.getItem('opaque-plugin-state')), '插件缓存');
    assert.equal(await page.evaluate(() => window.AuraStorageMigrationPending), false);
    const calls = await page.evaluate(() => window.migrationCalls);
    assert.equal(calls[0][0], 'confirm');
    assert.deepEqual(calls.find(call => call[0] === 'healthy'), ['healthy', 'stable-boot']);
    assert.equal(calls.some(call => call[0] === 'failed'), false);
  } finally { await browser.close(); }
});
