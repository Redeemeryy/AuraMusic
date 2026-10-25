const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  fs.mkdirSync('artifacts', { recursive: true });
  try {
    for (const [width,height] of [[320,640],[347,754],[393,852],[800,360],[1024,768]]) {
      const page = await browser.newPage({ viewport: { width,height } });
      page.on('pageerror', e => errors.push(e.message));
      await page.route('https://**', r => r.abort());
      await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href, { waitUntil:'domcontentloaded' });
      await page.evaluate(() => { window.applyNativeInsets(38,24,0,0); window.applyNativeInsets(0,0,0,0); });
      assert.equal(await page.locator('html').evaluate(e => e.style.getPropertyValue('--safe-top')), '0px', 'rotation must clear old top inset');
      for (const view of ['discover','search','library','settings']) {
        await page.locator(`[data-view=${view}]`).click();
        await page.waitForTimeout(300);
        const box = await page.locator('#view-'+view).evaluate(e => ({ w:e.clientWidth, sw:e.scrollWidth }));
        assert.ok(box.sw <= box.w + 1, `${view} horizontal overflow at ${width}: ${JSON.stringify(box)}`);
      }
      await page.locator('#settingPlayMode').click();
      assert.equal(await page.evaluate(() => window.handleBackPress()), true, 'Android back dismisses the chooser');
      await page.waitForTimeout(220);
      assert.equal(await page.locator('#playModeDialog').evaluate(e => e.open), false);
      await page.locator('#settingPlayMode').click();
      await page.locator('#playModeDialog [data-mode="shuffle"]').click();
      await page.waitForTimeout(220);
      assert.equal(await page.locator('#playModeIcon').textContent(), 'shuffle');
      await page.locator('#settingReduceMotion').check();
      await page.locator('#settingReduceTransparency').check();
      await page.reload({ waitUntil:'domcontentloaded' });
      assert.equal(await page.locator('#settingPlayMode').evaluate(e => e.value), 'shuffle');
      assert.equal(await page.locator('#settingReduceMotion').isChecked(), true);
      await page.locator('#settingReduceTransparency').uncheck();
      await page.locator('#settingReduceMotion').uncheck();
      await page.locator('#view-settings').evaluate(e => e.scrollTop=0);
      await page.screenshot({ path:`artifacts/settings-${width}.png` });
      await page.locator('#btnCheckAppUpdate').scrollIntoViewIfNeeded();
      const last = await page.locator('#btnCheckAppUpdate').boundingBox();
      const nav = await page.locator('#mainNavBar').boundingBox();
      assert.ok(width >= 700 || last.y+last.height < nav.y, 'update button covered');
      await page.evaluate(() => window.openFullPlayer());
      await page.waitForTimeout(350);
      const play = await page.locator('#btnPlayPause').boundingBox();
      assert.ok(Math.abs(play.width-play.height) < 1, `play button must stay circular at ${width}`);
      const controls = await page.locator('#fullPlayerControlsRow').evaluate(e => ({ w:e.clientWidth, sw:e.scrollWidth }));
      assert.ok(controls.sw <= controls.w + 1, `player controls overflow at ${width}`);
      console.log(`PASS ${width}x${height}: pages, persistent settings, reachable bottom controls`);
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
