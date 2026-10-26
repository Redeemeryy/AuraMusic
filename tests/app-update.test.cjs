const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('检查更新正确处理 beta、正式版、数字预发布序号与构建元数据', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.request().url().startsWith('https:') ? route.abort() : route.continue());
    for (const [installed, latest, shouldPrompt] of [
      ['1.2.0-beta.3', 'v1.2.0', true],
      ['1.2.0', 'v1.2.0-beta.3', false],
      ['1.2.0-beta.2', 'v1.2.0-beta.10', true],
      ['1.2.0-beta.10', 'v1.2.0-beta.2', false],
      ['1.2.0', 'v1.2.0+build.12', false],
      ['1.2.0', 'v1.2.1', true],
      ['1.1.6', 'v1.2.0', true]
    ]) {
      await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
      await page.evaluate(async ({ installed, latest }) => {
        window.AndroidBridge = { getAppVersion: () => JSON.stringify({ versionName: installed }) };
        window.nativeHttpFetch = async () => ({ status: 200, body: JSON.stringify({ tag_name: latest, name: '灵音更新', body: '测试更新', assets: [] }) });
        await window.checkAppReleaseUpdate(true);
      }, { installed, latest });
      assert.equal(await page.locator('#appUpdateOverlay').evaluate(el => el.classList.contains('opacity-100')), shouldPrompt, `${installed} -> ${latest}`);
      if (shouldPrompt) assert.equal(await page.locator('#appUpdateNewVer').textContent(), latest);
    }
  } finally { await browser.close(); }
});
