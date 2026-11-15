const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 347, height: 754 } });
    await page.route('https://**', route => route.abort());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href, { waitUntil: 'domcontentloaded' });
    const button = page.locator('[data-view="settings"]');
    const box = await button.boundingBox();
    await button.hover();
    await page.mouse.down();
    await page.waitForFunction(() => {
      const scale = Number(getComputedStyle(document.querySelector('[data-view="settings"]')).scale);
      return scale < 1 && scale >= .96;
    });
    await page.mouse.up();
    assert.ok(await button.evaluate(e => e.getAnimations().length > 0), 'release animates');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-view="settings"]')).scale === 'none');

    const midRetarget = await page.evaluate(async () => {
      const indicator = document.querySelector('.nav-selection');
      const centerX = () => {
        const bounds = indicator.getBoundingClientRect();
        return bounds.left + bounds.width / 2;
      };
      switchView('discover');
      await new Promise(resolve => setTimeout(resolve, 60));
      const before = centerX();
      switchView('library');
      return { distance: Math.abs(centerX() - before), active: document.querySelector('.view-container.active').id };
    });
    assert.ok(midRetarget.distance < 12, 'selecting again mid-motion keeps the current indicator position');
    assert.equal(midRetarget.active, 'view-library', 'destination is interactive while the capsule moves');
    assert.equal(await page.locator('.nav-selection').count(), 1);
    await page.waitForFunction(() => {
      const indicator = document.querySelector('.nav-selection').getBoundingClientRect();
      const button = document.querySelector('[aria-current="page"]').getBoundingClientRect();
      return Math.abs(indicator.left + indicator.width / 2 - button.left - button.width / 2) < 2;
    });

    const capsuleInBounds = () => page.evaluate(() => {
      const nav = document.querySelector('.nav-glass-bar').getBoundingClientRect();
      const active = document.querySelector('.nav-selection').getBoundingClientRect();
      return active.left >= nav.left - 1 && active.right <= nav.right + 1 &&
        active.top >= nav.top - 1 && active.bottom <= nav.bottom + 1;
    });
    await page.setViewportSize({ width: 800, height: 360 });
    assert.ok(await capsuleInBounds(), 'on rotation the selected capsule immediately stays inside the rail');
    await page.waitForFunction(() => {
      const indicator = document.querySelector('.nav-selection').getBoundingClientRect();
      const button = document.querySelector('[aria-current="page"]').getBoundingClientRect();
      return Math.abs(indicator.top + indicator.height / 2 - button.top - button.height / 2) < 2;
    });
    await page.evaluate(() => switchView('discover'));
    await page.waitForFunction(() => document.querySelector('.nav-selection').getAnimations().some(a => a.playState === 'running'));
    await page.setViewportSize({ width: 347, height: 754 });
    assert.ok(await capsuleInBounds(), 'rotating mid-transition keeps the capsule within the horizontal bar');
    await button.click();
    await page.locator('#settingPlayMode').click();
    assert.notEqual(await page.locator('#playModeDialog').evaluate(dialog => dialog.style.transformOrigin), '');
    assert.equal(await page.evaluate(() => handleBackPress()), true);
    await page.waitForFunction(() => document.activeElement.id === 'settingPlayMode');

    await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    assert.equal(await button.evaluate(e => getComputedStyle(e).scale), 'none', 'reduced motion has no compression');
    await page.mouse.up();
    await page.evaluate(() => switchView('discover'));
    assert.equal(await page.locator('.nav-selection').evaluate(e => e.getAnimations().length), 0);

    await page.locator('[data-view="search"]').click();
    await page.locator('#searchInput').fill('没有配置音源时搜索');
    await page.locator('#searchInput').press('Enter');
    assert.equal(await page.locator('#pluginModalOverlay').getAttribute('aria-hidden'), 'false');
    assert.notEqual(await page.locator('#pluginModalOverlay').evaluate(dialog => dialog.style.transformOrigin), '50% 50%');
    await page.locator('#btnClosePluginModal').click();
    assert.equal(await page.locator('#btnDoSearch').evaluate(e => e === document.activeElement), true);
    console.log('PASS press feedback, navigation retarget and rotation, anchored sheets and restored focus, reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
