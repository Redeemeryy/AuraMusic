const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const track = (title, id = title, providerId = 'wy') => ({ title, ref: { id, providerId } });
const tracks = ['A', 'B', 'C'].map(title => track(title));

async function withQueue(queue, mode, run) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.addInitScript(({ queue, mode }) => {
      localStorage.setItem('aura_preferences', JSON.stringify({ playMode: mode }));
      localStorage.setItem('jelly_queue', JSON.stringify(queue));
      localStorage.setItem('jelly_queue_index', '0');
      localStorage.setItem('jelly_current_track', JSON.stringify(queue[0]));
      window.playback = {
        requested: [],
        current: queue[0],
        playing: true,
        autoStart: true,
        pauses: 0,
        start(song) {
          this.current = song;
          this.playing = true;
          window.onNativePlaybackStateChanged(true);
        },
      };
      window.AndroidBridge = {
        getPlaybackState: () => JSON.stringify({ track: playback.current, isPlaying: playback.playing }),
        playMusic: (_url, json) => {
          const song = JSON.parse(json);
          playback.requested.push(song);
          if (playback.autoStart) queueMicrotask(() => playback.start(song));
        },
        pauseMusic: () => {
          playback.pauses++;
          playback.playing = false;
          window.onNativePlaybackStateChanged(false);
        },
      };
    }, { queue, mode });
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(() => {
      window.MusicAPI = {
        initialized: true,
        resolve: async () => ({ url: 'https://audio.test/full-length-test-song.mp3' }),
        getLyrics: async () => ({ lyric: '' }),
      };
    });
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

async function assertRequests(page, titles) {
  await page.waitForFunction(count => playback.requested.length >= count, titles.length);
  assert.deepEqual(await page.evaluate(() => playback.requested.map(track => track.title)), titles);
}

test('shuffle next excludes the current song and previous returns through playback history', () => withQueue(tracks, 'shuffle', async page => {
  await page.evaluate(() => { Math.random = () => 0.99; });
  await page.locator('#miniNextBtn').click();
  await assertRequests(page, ['C']);

  await page.evaluate(() => openFullPlayer());
  await page.locator('#btnPrev').click();
  await assertRequests(page, ['C', 'A']);
  await page.evaluate(() => dispatchMediaEvent('prev'));
  assert.equal(await page.locator('#fullTitle').textContent(), 'A', 'empty history keeps the current song');

  await page.evaluate(() => { Math.random = () => 0; onNativeTrackCompleted(); });
  await assertRequests(page, ['C', 'A', 'B']);
  await page.evaluate(() => dispatchMediaEvent('prev'));
  await assertRequests(page, ['C', 'A', 'B', 'A']);
}));

test('shuffle history survives a mode change within the same queue', () => withQueue(tracks, 'sequence', async page => {
  await page.evaluate(() => openFullPlayer());
  await page.locator('#btnPlaylistQueue').click();
  await page.locator('.queue-track-main').nth(2).click();
  await assertRequests(page, ['C']);
  await page.locator('#btnCloseQueue').click();
  await page.locator('#btnPlayMode').click();
  await page.locator('#btnPlayMode').click();
  await page.locator('#btnPrev').click();
  await assertRequests(page, ['C', 'A']);
}));

test('shuffle history skips tracks that the player did not start', () => withQueue(tracks, 'shuffle', async page => {
  await page.evaluate(() => { playback.autoStart = false; Math.random = () => 0.99; });
  await page.locator('#miniNextBtn').click();
  await assertRequests(page, ['C']);
  await page.evaluate(() => dispatchMediaEvent('next'));
  await assertRequests(page, ['C', 'B']);
  await page.evaluate(() => playback.start(playback.requested.at(-1)));
  await page.evaluate(() => dispatchMediaEvent('prev'));
  await assertRequests(page, ['C', 'B', 'A']);
}));

test('shuffle previous returns to the audible song while the next song resolves', () => withQueue(tracks, 'shuffle', async page => {
  await page.evaluate(() => {
    const resolve = MusicAPI.resolve;
    MusicAPI.resolve = ref => ref.id === 'C' ? new Promise(done => { window.finishC = done; }) : resolve(ref);
    Math.random = () => 0.99;
    dispatchMediaEvent('next');
  });
  await page.waitForFunction(() => typeof window.finishC === 'function');
  await page.evaluate(() => dispatchMediaEvent('prev'));
  assert.equal(await page.locator('#miniTitle').textContent(), 'A');
  await assertRequests(page, ['A']);
  await page.evaluate(() => finishC({ url: 'https://audio.test/full-length-test-song.mp3' }));
  assert.deepEqual(await page.evaluate(() => playback.requested.map(track => track.title)), ['A']);
}));

test('shuffle previous skips entries removed from the queue', () => withQueue(tracks, 'shuffle', async page => {
  await page.evaluate(() => { Math.random = () => 0.99; dispatchMediaEvent('next'); });
  await assertRequests(page, ['C']);
  await page.evaluate(() => { dispatchMediaEvent('next'); openFullPlayer(); });
  await assertRequests(page, ['C', 'B']);
  await page.locator('#btnPlaylistQueue').click();
  await page.locator('.btn-remove-track').nth(2).click();
  await page.evaluate(() => dispatchMediaEvent('prev'));
  await assertRequests(page, ['C', 'B', 'A']);
}));

test('equal IDs across music sources do not reset the selected queue position', () => withQueue([
  track('A', '123', 'wy'), track('B', '123', 'tx'), track('C'),
], 'sequence', async page => {
  await page.evaluate(() => openFullPlayer());
  await page.locator('#btnPlaylistQueue').click();
  assert.deepEqual(await page.locator('.queue-item-active strong').allTextContents(), ['A']);
  await page.locator('.queue-track-main').nth(1).click();
  await assertRequests(page, ['B']);
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_queue_index')), '1');
  assert.deepEqual(await page.locator('.queue-item-active strong').allTextContents(), ['B']);
  await page.evaluate(() => dispatchMediaEvent('next'));
  await assertRequests(page, ['B', 'C']);
}));

test('selecting a search result plays its source even when the same song is queued', () => withQueue([
  track('A', '123', 'tx'),
], 'sequence', async page => {
  await page.evaluate(result => {
    MusicAPI.search = async () => ({ items: [result] });
    switchView('search');
  }, track('A', '123', 'wy'));
  await page.locator('#searchInput').fill('A');
  await page.locator('#btnDoSearch').click();
  await page.locator('#searchResultsList > div').first().click();
  await assertRequests(page, ['A']);
  assert.equal(await page.evaluate(() => playback.requested[0].ref.providerId), 'wy');
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_queue_index')), '1');
}));

test('removing the only queue entry leaves the current playback controls working', () => withQueue([tracks[0]], 'sequence', async page => {
  await page.evaluate(() => openFullPlayer());
  await page.locator('#btnPlaylistQueue').click();
  await page.locator('.btn-remove-track').click();
  await page.locator('#btnCloseQueue').click();
  await page.locator('#btnPlayPause').click();
  assert.equal(await page.evaluate(() => playback.pauses), 1);
  assert.equal(await page.locator('#fullPlayIcon').textContent(), 'play_arrow');
}));

test('loop mode leaves the queue empty when a removed song finishes', () => withQueue([tracks[0]], 'loop', async page => {
  await page.evaluate(() => openFullPlayer());
  await page.locator('#btnPlaylistQueue').click();
  await page.locator('.btn-remove-track').click();
  await page.evaluate(() => onNativeTrackCompleted());
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_queue'))), []);
}));
