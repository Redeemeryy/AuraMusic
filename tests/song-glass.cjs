const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const app = pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href;
const filterFor = (locator) => locator.evaluate(node => getComputedStyle(node).backdropFilter);
const luminance = (color) => {
  const [r, g, b] = color.match(/\d+/g).slice(0, 3).map(channel => {
    const value = Number(channel) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 347, height: 754 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.addInitScript(() => {
      const track = { title: '歌曲', subtitle: '歌手', ref: { id: 'glass-test', providerId: 'tx' } };
      localStorage.setItem('jelly_current_track', JSON.stringify(track));
      localStorage.setItem('jelly_queue', JSON.stringify([track]));
      localStorage.setItem('jelly_queue_index', '0');
    });
    await page.goto(app);
    const nav = page.locator('.nav-glass-bar');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.nav-glass-bar')).backdropFilter.includes('url('));
    assert.equal(await page.locator('.song-glass-canvas').count(), 0, 'no full-screen canvas on content pages');
    assert.equal(await filterFor(page.locator('#discoverNoSourceBanner')), 'none', 'content keeps a standard surface');
    assert.match(await filterFor(page.locator('#miniPlayerContent')), /url\(/, 'mini-player optics are enabled when a song is present');
    const mini = page.locator('#miniPlayerContent');
    const miniBounds = await mini.boundingBox();
    const progressBounds = await mini.locator(':scope > div:last-child').boundingBox();
    assert.ok(progressBounds.x >= miniBounds.x && progressBounds.x + progressBounds.width <= miniBounds.x + miniBounds.width, 'mini-player progress stays inside the glass capsule');
    assert.equal(await page.locator('[data-view="discover"]').getAttribute('aria-current'), 'page');

    await page.locator('#view-discover').evaluate(node => {
      node.style.background = 'repeating-conic-gradient(#192048 0% 25%, #f9d7b5 0% 50%) 0 0 / 13px 13px';
    });
    const clip = await nav.boundingBox();
    const filtered = (await page.screenshot({ clip })).toString('base64');
    await nav.evaluate(node => {
      const href = getComputedStyle(node).backdropFilter.match(/#([^"\)]+)/)[1];
      document.getElementById(href).querySelector('feDisplacementMap').setAttribute('scale', '0');
    });
    const unfiltered = (await page.screenshot({ clip })).toString('base64');
    const changedPixels = await page.evaluate(async pictures => {
      const pixels = await Promise.all(pictures.map(async data => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + data;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      }));
      let count = 0;
      for (let i = 0; i < pixels[0].length; i += 4) {
        if (Math.abs(pixels[0][i] - pixels[1][i]) > 8) count++;
      }
      return count;
    }, [filtered, unfiltered]);
    assert.ok(changedPixels > 100, `refraction must displace real DOM pixels: ${changedPixels}`);

    for (const [width, height] of [[320, 640], [800, 360], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      const current = await nav.boundingBox();
      assert.ok(current.x >= 0 && current.x + current.width <= width);
      assert.ok(current.y >= 0 && current.y + current.height <= height);
      assert.ok((await filterFor(nav)).includes('url('), 'resize keeps the filter enabled');
    }
    await page.setViewportSize({ width: 347, height: 754 });
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.locator('[data-view="settings"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[aria-current="page"]').count(), 1);
    await page.locator('#settingReduceTransparency').check();
    assert.equal(await filterFor(nav), 'none', 'app preference disables backdrop filtering');
    await page.evaluate(() => openFullPlayer());
    const play = await page.locator('#btnPlayPause').evaluate(node => {
      const style = getComputedStyle(node);
      return { foreground: style.color, background: style.backgroundColor };
    });
    assert.notEqual(play.background, 'rgba(0, 0, 0, 0)', 'primary control is opaque in solid mode');
    const tones = [play.background, play.foreground].map(luminance).sort((a, b) => b - a);
    assert.ok((tones[0] + .05) / (tones[1] + .05) >= 4.5, 'primary control keeps contrast in solid mode');
    await page.evaluate(() => document.documentElement.classList.remove('reduce-transparency'));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    assert.equal(await filterFor(nav), 'none', 'system preference disables backdrop filtering');
    assert.deepEqual(errors, []);
    await page.close();

    const fallback = await browser.newPage({ viewport: { width: 347, height: 754 } });
    await fallback.route('https://**', route => route.abort());
    await fallback.addInitScript(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (property, value) => value?.startsWith('url(') ? false : supports(property, value);
    });
    await fallback.goto(app);
    assert.match(await filterFor(fallback.locator('.nav-glass-bar')), /^blur\(/, 'engines without SVG backgrounds keep the CSS glass layer');
    await fallback.close();
    console.log(`PASS live glass refraction (${changedPixels} changed pixels), responsive navigation and transparency fallbacks`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
