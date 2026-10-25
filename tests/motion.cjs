const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 347, height: 754 } });
    await page.route('https://**', route => route.abort());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    const button = page.locator('[data-view="settings"]');
    const box = await button.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    assert.ok(Number(await button.evaluate(e => getComputedStyle(e).scale)) < .94, 'held button compresses');
    await page.mouse.up();
    await page.waitForTimeout(120);
    assert.ok(await button.evaluate(e => e.getAnimations().length > 0), 'release animates');
    await page.waitForTimeout(400);
    assert.equal(await button.evaluate(e => getComputedStyle(e).scale), 'none', 'release cleans up');
    await page.evaluate(() => document.documentElement.classList.add('reduce-motion'));
    await page.mouse.down();
    await page.waitForTimeout(120);
    assert.equal(await button.evaluate(e => getComputedStyle(e).scale), 'none', 'reduced motion has no compression');
    await page.mouse.up();
    console.log('PASS press hold, release rebound, cleanup and reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
