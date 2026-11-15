const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('main nav press-and-hold scrubbing activates glass droplet lens and glides pager views smoothly', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.route('https://**', route => route.abort());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href, { waitUntil: 'domcontentloaded' });

    const navBar = page.locator('.nav-glass-bar');
    await navBar.waitFor({ state: 'visible' });
    const box = await navBar.boundingBox();
    assert.ok(box && box.width > 200, 'nav-glass-bar should have rendered bounds');

    const y = box.y + box.height / 2;
    const xStart = box.x + box.width * 0.14;
    const xMid = box.x + box.width * 0.56;
    const xLibrary = box.x + box.width * 0.625;

    // Press and drag across the nav dock
    await page.mouse.move(xStart, y);
    await page.mouse.down();
    await page.waitForTimeout(160);
    await page.mouse.move(xMid, y, { steps: 10 });

    const midState = await page.evaluate(() => {
      const bar = document.querySelector('.nav-glass-bar');
      const track = document.getElementById('mainPagerTrack');
      const navPos = parseFloat(bar.style.getPropertyValue('--nav-selection-index'));
      const pagerPos = parseFloat(track.style.getPropertyValue('--pager-index'));
      return {
        isScrubbing: bar.classList.contains('is-scrubbing'),
        trackScrubbing: track.classList.contains('is-scrubbing'),
        navPos,
        pagerPos,
        scrubTargets: document.querySelectorAll('.nav-item.is-scrub-target').length
      };
    });

    assert.equal(midState.isScrubbing, true, 'nav-glass-bar should enter scrubbing droplet state');
    assert.equal(midState.trackScrubbing, true, 'mainPagerTrack should enter scrubbing tracking state');
    assert.ok(midState.navPos > 0.5 && midState.navPos < 2.6, `expected continuous navPos mid-drag, got ${midState.navPos}`);
    assert.ok(Math.abs(midState.navPos - midState.pagerPos) < 0.25, 'pager should track nav scrub smoothly');
    assert.equal(midState.scrubTargets, 1, 'nearest destination tab should illuminate during scrub');

    // Slide to Library slot and release
    await page.mouse.move(xLibrary, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(320);

    const endState = await page.evaluate(() => {
      const bar = document.querySelector('.nav-glass-bar');
      const track = document.getElementById('mainPagerTrack');
      return {
        isScrubbing: bar.classList.contains('is-scrubbing'),
        navPos: bar.style.getPropertyValue('--nav-selection-index'),
        pagerPos: track.style.getPropertyValue('--pager-index'),
        activeId: document.querySelector('.view-container.active')?.id,
        currentAttr: document.querySelector('.nav-item[aria-current="page"]')?.getAttribute('data-view')
      };
    });

    assert.equal(endState.isScrubbing, false, 'scrubbing state clears on release');
    assert.equal(endState.activeId, 'view-library', 'releasing over Library activates view-library');
    assert.equal(endState.currentAttr, 'library', 'aria-current updates to library');
    assert.equal(endState.navPos, '2');
    assert.equal(endState.pagerPos, '2');
  } finally {
    await browser.close();
  }
});

test('landscape side rail supports vertical press-and-hold scrubbing to settings', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
    await page.route('https://**', route => route.abort());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href, { waitUntil: 'domcontentloaded' });

    const navBar = page.locator('.nav-glass-bar');
    await navBar.waitFor({ state: 'visible' });
    const box = await navBar.boundingBox();
    assert.ok(box && box.height > box.width, 'landscape nav-glass-bar should render vertically');

    const x = box.x + box.width / 2;
    const yStart = box.y + box.height * 0.14;
    const ySettings = box.y + box.height * 0.88;

    await page.mouse.move(x, yStart);
    await page.mouse.down();
    await page.waitForTimeout(160);
    await page.mouse.move(x, ySettings, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(320);

    const endState = await page.evaluate(() => ({
      activeId: document.querySelector('.view-container.active')?.id,
      currentAttr: document.querySelector('.nav-item[aria-current="page"]')?.getAttribute('data-view')
    }));
    assert.equal(endState.activeId, 'view-settings');
    assert.equal(endState.currentAttr, 'settings');
  } finally {
    await browser.close();
  }
});

test('Material Symbols Outlined font loads offline and collapses icon ligatures to single-glyph width', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.route('https://**', route => route.abort());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const fontCheck = await page.evaluate(() => {
      const loadedFaces = [...document.fonts].filter(
        f => f.family.replace(/['"]/g, '') === 'Material Symbols Outlined' && f.status === 'loaded'
      );
      const navIcons = [...document.querySelectorAll('.nav-item .material-symbols-outlined')].map(el => {
        const cs = getComputedStyle(el);
        const fontSize = parseFloat(cs.fontSize) || 24;
        const rect = el.getBoundingClientRect();
        return {
          name: el.textContent.trim(),
          fontFamily: cs.fontFamily,
          width: rect.width,
          maxAllowed: fontSize * 1.35
        };
      });
      return { loadedCount: loadedFaces.length, fontReadyCheck: document.fonts.check('24px "Material Symbols Outlined"'), navIcons };
    });

    assert.ok(fontCheck.loadedCount >= 1, 'Material Symbols Outlined @font-face must be loaded offline');
    assert.equal(fontCheck.fontReadyCheck, true, 'document.fonts.check must confirm Material Symbols Outlined is active');
    for (const icon of fontCheck.navIcons) {
      assert.ok(
        icon.width > 0 && icon.width <= icon.maxAllowed,
        `icon "${icon.name}" width (${icon.width}) must fit a single glyph (<= ${icon.maxAllowed}) rather than fallback text`
      );
    }
  } finally {
    await browser.close();
  }
});
