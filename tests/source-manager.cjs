// All plugin data is synthetic and stays inside an isolated browser profile.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
fs.mkdirSync('artifacts/source-manager', { recursive: true });

const plugin = `exports.manifest = { id: 'source-test', name: '清音 · 测试音源', version: '1.2.3', description: '用于验证音源导入、重载与管理。' }; exports.activate = async function () {};`;
async function fixture(run, viewport = { width: 393, height: 852 }) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith('https:') ? route.abort() : route.continue());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.locator('#headerSourceBadge').click();
    await page.waitForFunction(() => Math.abs(document.getElementById('pluginModalOverlay').getBoundingClientRect().top) < 1);
    await run(page);
    assert.deepEqual(errors, [], '音源流程不应产生脚本异常');
  } finally { await browser.close(); }
}
async function importCode(page) {
  await page.locator('#inputPluginCode').fill(plugin);
  await page.locator('#btnImportFromCode').click();
  await page.waitForFunction(() => window.MusicAPI.initialized);
}

test('音源管理支持 Android 返回、Escape 和焦点返回入口', () => fixture(async page => {
  assert.equal(await page.evaluate(() => window.handleBackPress()), true);
  assert.equal(await page.locator('#pluginModalOverlay').evaluate(e => e.inert), true);
  assert.equal(await page.locator('#headerSourceBadge').evaluate(e => e === document.activeElement), true);
  await page.locator('#headerSourceBadge').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pluginModalOverlay').evaluate(e => e.inert), true);
}));

test('卸载需在玻璃确认框确认；取消、返回和关闭保留音源，确认保留用户歌单', () => fixture(async page => {
  await importCode(page);
  await page.evaluate(() => localStorage.setItem('jelly_fav_playlists', '[{"title":"保留我的歌单"}]'));
  await page.locator('#btnUninstallPlugin').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_custom_plugin_code')), plugin, '点击入口不应立即删除音源');
  assert.equal(await page.locator('#pluginRemoveDialog').evaluate(e => e.open), true);
  await page.locator('#btnCancelPluginRemove').click();
  await page.locator('#btnUninstallPlugin').click();
  assert.equal(await page.evaluate(() => window.handleBackPress()), true);
  assert.equal(await page.locator('#pluginRemoveDialog').evaluate(e => e.open), false);
  assert.equal(await page.locator('#pluginModalOverlay').evaluate(e => e.inert), false);
  await page.locator('#btnUninstallPlugin').click();
  await page.locator('#btnConfirmPluginRemove').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_custom_plugin_code')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_custom_plugin_meta')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_fav_playlists')), '[{"title":"保留我的歌单"}]');
  assert.equal(await page.locator('#pluginActiveActions').isVisible(), false);
}));

test('本地文件与源码导入、重载和更新弹窗保持可用', () => fixture(async page => {
  await page.locator('#inputPluginFile').setInputFiles({ name: 'source-test.js', mimeType: 'text/javascript', buffer: Buffer.from(plugin) });
  await page.waitForFunction(() => window.MusicAPI.initialized);
  assert.equal(await page.locator('#pluginActiveName').textContent(), '清音 · 测试音源');
  await page.locator('.source-manager-scroll').evaluate(e => e.scrollTop = 0);
  await page.screenshot({ path: 'artifacts/source-manager/manager-normal-393.png' });
  await page.locator('#btnImportFromCode').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/source-manager/import-options-393.png' });
  await page.locator('#btnReloadPlugin').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_custom_plugin_code')), plugin);
  await page.evaluate(() => window.showPluginNoticeDialog({ pluginName: '清音', currentVersion: '1.2.3', newVersion: '1.2.4', message: '更新说明' }));
  await page.screenshot({ path: 'artifacts/source-manager/update-dialog-393.png' });
  await page.locator('#btnCancelPluginUpdate').click();
  assert.equal(await page.locator('#pluginNoticeOverlay').evaluate(e => e.inert), true);
  await importCode(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_custom_plugin_code')), plugin);
}));

test('网络导入等待下载时禁止重复提交，完成后恢复按钮并显示音源', () => fixture(async page => {
  let finishDownload;
  const download = new Promise(resolve => { finishDownload = resolve; });
  await page.route('https://source.test/plugin.js', async route => {
    await download;
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: plugin, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.locator('#inputPluginUrl').fill('https://source.test/plugin.js');
  await page.locator('#btnImportFromUrl').click();
  assert.equal(await page.locator('#btnImportFromUrl').isDisabled(), true, '下载过程中不能再次提交');
  finishDownload();
  await page.waitForFunction(() => window.MusicAPI.initialized && !document.getElementById('btnImportFromUrl').disabled);
  assert.equal(await page.locator('#pluginActiveName').textContent(), '清音 · 测试音源');
  assert.equal(await page.locator('#inputPluginUrl').inputValue(), '');
}));

test('小屏、横屏、长音源名称与更新说明没有横向溢出，操作可滚动到达', async () => {
  fs.mkdirSync('artifacts/source-manager', { recursive: true });
  for (const [width, height] of [[320, 640], [393, 852], [800, 360]]) {
    await fixture(async page => {
      await importCode(page);
      await page.evaluate(() => {
        const meta = JSON.parse(localStorage.getItem('jelly_custom_plugin_meta'));
        meta.name = '清音超长名称与版本兼容验证'.repeat(6);
        meta.description = 'Source-description-without-breaks-'.repeat(8);
        localStorage.setItem('jelly_custom_plugin_meta', JSON.stringify(meta));
        window.syncPluginUI();
      });
      const size = await page.locator('#pluginModalOverlay').evaluate(e => ({ client: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(size.scroll <= size.client + 1, `音源页 ${width}px 横向溢出`);
      await page.locator('#btnImportFromUrl').scrollIntoViewIfNeeded();
      const urlButton = await page.locator('#btnImportFromUrl').boundingBox();
      assert.ok(urlButton.x >= 0 && urlButton.x + urlButton.width <= width, '网络导入按钮超出屏幕');
      await page.locator('#inputPluginUrl').fill('https://example.test/source.js');
      await page.locator('#btnImportFromCode').scrollIntoViewIfNeeded();
      assert.ok((await page.locator('#btnImportFromCode').boundingBox()).height >= 44, '触控目标应足够大');
      await page.locator('.source-manager-scroll').evaluate(e => e.scrollTop = 0);
      await page.screenshot({ path: `artifacts/source-manager/manager-${width}.png` });
      await page.evaluate(() => window.showPluginNoticeDialog({ pluginName: '清音'.repeat(50), currentVersion: '1.2.3', newVersion: '1.2.4', message: '更新说明与长链接'.repeat(60) }));
      const card = await page.locator('#pluginNoticeCard').evaluate(e => ({ client: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(card.scroll <= card.client + 1, '更新说明横向溢出');
      await page.locator('#btnCancelPluginUpdate').click();
      await page.evaluate(() => { window.AuraPreferences.set({ reduceTransparency: true, reduceMotion: true }); window.applyAppearancePreferences(); });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.source-active-card')).backdropFilter === 'none', null, { timeout: 2000 });
      assert.equal(await page.locator('.source-active-card').evaluate(e => getComputedStyle(e).backdropFilter), 'none', await page.locator('html').getAttribute('class'));
    }, { width, height });
  }
});
