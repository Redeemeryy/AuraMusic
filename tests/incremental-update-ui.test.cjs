const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
async function fixture(run, width = 393, height = 852) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(4000);
    await page.route('**/*', r => r.request().url().startsWith('https:') ? r.abort() : r.continue());
    await page.addInitScript(() => {
      window.updateCalls = [];
      window.AuraUpdater = {
        getState: () => JSON.stringify({ status: 'idle' }),
        check: () => updateCalls.push('check'), start: () => updateCalls.push('start'), cancel: () => updateCalls.push('cancel'),
        install: () => updateCalls.push('install'), applyWebUpdate: () => updateCalls.push('apply')
      };
    });
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await run(page);
  } finally { await browser.close(); }
}
const state = (page, value) => page.evaluate(value => window.onAuraUpdateState(value), value);
test('native update uses signed updater, shows progress and retains explicit apply choice', () => fixture(async page => {
  await page.evaluate(() => checkAppReleaseUpdate(true));
  assert.ok(await page.evaluate(() => updateCalls.includes('check')));
  await state(page, { status: 'available', kind: 'web', version: '资源 2', total: 83000, notes: '改善播放页', message: '界面更新' });
  assert.match(await page.locator('#appUpdateNotes').textContent(), /改善播放页/);
  await page.locator('#btnConfirmAppUpdate').click();
  assert.equal(await page.evaluate(() => updateCalls.at(-1)), 'start');
  await state(page, { status: 'downloading', kind: 'web', downloaded: 41000, total: 83000 });
  assert.equal(await page.locator('#appUpdateProgress').getAttribute('aria-valuenow'), '49');
  assert.equal(await page.locator('#btnConfirmAppUpdate').isDisabled(), true);
  await state(page, { status: 'ready_web', kind: 'web', version: '资源 2' });
  assert.equal(await page.evaluate(() => updateCalls.includes('apply')), false);
  await page.locator('#btnConfirmAppUpdate').click();
  assert.equal(await page.evaluate(() => updateCalls.at(-1)), 'apply');
}));
test('cancel, retry and APK installation use the correct native actions', () => fixture(async page => {
  await page.evaluate(() => checkAppReleaseUpdate(true));
  await state(page, { status: 'downloading', kind: 'apk', downloaded: 1024, total: 4096 });
  await page.locator('#btnCancelAppUpdate').click();
  assert.equal(await page.evaluate(() => updateCalls.at(-1)), 'cancel');
  await state(page, { status: 'cancelled', kind: 'apk', canRetry: true, message: '下载已取消，可继续' });
  await page.locator('#btnConfirmAppUpdate').click();
  assert.equal(await page.evaluate(() => updateCalls.at(-1)), 'start');
  await state(page, { status: 'ready_apk', kind: 'apk' });
  await page.locator('#btnConfirmAppUpdate').click();
  assert.equal(await page.evaluate(() => updateCalls.at(-1)), 'install');
}));
test('update dialog stays inside small and landscape screens and returns focus', async () => {
  for (const [width, height] of [[320, 640], [800, 360]]) await fixture(async page => {
    await page.evaluate(() => { switchView('settings'); document.querySelector('#btnCheckAppUpdate').focus(); checkAppReleaseUpdate(true); });
    await state(page, { status: 'available', kind: 'apk', version: 'v1.3.0', total: 1000000, notes: '非常长的更新说明'.repeat(500) });
    const card = await page.locator('#appUpdateCard').boundingBox();
    assert.ok(card.x >= 0 && card.y >= 0 && card.x + card.width <= width + 1 && card.y + card.height <= height + 1);
    await page.locator('#btnConfirmAppUpdate').scrollIntoViewIfNeeded();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#appUpdateOverlay').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'btnCheckAppUpdate');
  }, width, height);
});
