const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

// Exercise real UI and parser; only the device bridge and remote music API are replaced.
async function fixture(run) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.request().url().startsWith('https:') ? r.abort() : r.continue());
    await page.addInitScript(() => {
      window.nativeCalls = { enabled: [], plays: [], timelines: [], legacy: [] };
      window.AndroidBridge = {
        setBluetoothLyricsEnabled: value => nativeCalls.enabled.push(value),
        playMusic: (url, json) => nativeCalls.plays.push(JSON.parse(json)),
        setLyricTimeline: (key, json) => nativeCalls.timelines.push({ key, lines: JSON.parse(json) }),
        updateCurrentLyric: line => nativeCalls.legacy.push(line),
        getAppVersion: () => JSON.stringify({ versionName: '1.2.0' }),
      };
    });
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(() => {
      const tracks = [1, 2].map(id => ({ title: `歌曲${id}`, subtitle: '歌手', ref: { id: String(id), providerId: 'wy' }, metadata: { artists: ['歌手'], qualities: ['128k', '320k', 'flac'], durationMs: 60000 } }));
      localStorage.setItem('jelly_favs', JSON.stringify(tracks));
      localStorage.setItem('jelly_preferred_quality', '320k');
    });
    await page.reload();
    await page.evaluate(() => {
      window.lyricReplies = {};
      window.streamReplies = {};
      window.delayStreams = false;
      window.MusicAPI = {
        initialized: true,
        resolve: (ref, quality) => delayStreams
          ? new Promise(resolve => streamReplies[ref.id] = resolve)
          : Promise.resolve({ url: `https://audio.test/full-length-track-${ref.id}.mp3`, actualQuality: quality }),
        getLyrics: ref => new Promise(resolve => lyricReplies[ref.id] = resolve),
        search: async () => ({ items: [] }),
      };
      switchView('library');
    });
    await page.locator('#tabFavs').click();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
const play = (page, index) => page.locator('#librarySongList > div').nth(index).click();
const reply = (page, id, lyrics) => page.evaluate(({ id, lyrics }) => lyricReplies[id]({ lyric: lyrics }), { id, lyrics });

test('Bluetooth switch persists and synchronizes to native on startup and toggle', () => fixture(async page => {
  await page.evaluate(() => switchView('settings'));
  assert.equal(await page.locator('#settingBluetoothLyrics').count(), 1, 'setting must be available');
  assert.equal(await page.locator('#settingBluetoothLyrics').isChecked(), false);
  await page.locator('#settingBluetoothLyrics').check();
  assert.equal(await page.evaluate(() => nativeCalls.enabled.at(-1)), true);
  await page.reload();
  assert.equal(await page.locator('#settingBluetoothLyrics').isChecked(), true);
  assert.equal(await page.evaluate(() => nativeCalls.enabled.at(-1)), true);
  await page.locator('#settingBluetoothLyrics').uncheck();
  assert.equal(await page.evaluate(() => nativeCalls.enabled.at(-1)), false);
}));

test('full timed lyrics cross the native boundary once, including instrumental gaps', () => fixture(async page => {
  await play(page, 0);
  await page.waitForFunction(() => lyricReplies['1']);
  await reply(page, '1', '[00:01.00]第一句\n[00:03.00]\n[00:05.00]第二句');
  await page.waitForTimeout(100);
  const calls = await page.evaluate(() => nativeCalls);
  assert.ok(calls.plays[0].lyricTrackKey, 'play must establish the native lyric identity');
  assert.equal(calls.plays[0].bluetoothLyrics, false);
  assert.equal(calls.timelines.length, 1);
  assert.equal(calls.timelines[0].key, calls.plays[0].lyricTrackKey);
  assert.deepEqual(calls.timelines[0].lines, [{ time: 1, text: '第一句' }, { time: 3, text: '' }, { time: 5, text: '第二句' }]);
  await page.evaluate(() => { onNativePlaybackProgress(2000, 60000); onNativePlaybackProgress(5500, 60000); });
  assert.deepEqual(await page.evaluate(() => nativeCalls.legacy), [], 'page frames must not overwrite the native timer');
}));

test('late lyrics from a previous song cannot replace the current timeline', () => fixture(async page => {
  await play(page, 0);
  await page.waitForFunction(() => lyricReplies['1']);
  await play(page, 1);
  await page.waitForFunction(() => lyricReplies['2']);
  await reply(page, '2', '[00:01.00]当前曲目的歌词');
  await reply(page, '1', '[00:01.00]已经过期的歌词');
  await page.waitForTimeout(100);
  const calls = await page.evaluate(() => nativeCalls);
  assert.equal(calls.timelines.length, 1);
  assert.equal(calls.timelines[0].key, calls.plays[1].lyricTrackKey);
  assert.deepEqual(calls.timelines[0].lines, [{ time: 1, text: '当前曲目的歌词' }]);
}));

test('late stream resolution cannot start the wrong song or lyric identity', () => fixture(async page => {
  await page.evaluate(() => { delayStreams = true; });
  await play(page, 0);
  await play(page, 1);
  await page.evaluate(() => streamReplies['2']({ url: 'https://audio.test/full-length-current-song.mp3' }));
  await page.waitForFunction(() => nativeCalls.plays.length === 1);
  await page.evaluate(() => streamReplies['1']({ url: 'https://audio.test/full-length-outdated-song.mp3' }));
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => nativeCalls.plays.map(p => p.title)), ['歌曲2']);
}));

test('quality restart retains the timeline and current Bluetooth setting', () => fixture(async page => {
  await page.evaluate(() => switchView('settings'));
  assert.equal(await page.locator('#settingBluetoothLyrics').count(), 1);
  await page.locator('#settingBluetoothLyrics').check();
  await page.evaluate(() => switchView('library'));
  await play(page, 0);
  await page.waitForFunction(() => lyricReplies['1']);
  await reply(page, '1', '[00:01.00]第一句\n[00:05.00]第二句');
  await page.evaluate(() => openFullPlayer());
  await page.locator('#fullQualityPill').click();
  await page.locator('.quality-picker-option[data-quality="128k"]').click();
  await page.waitForFunction(() => nativeCalls.plays.length === 2);
  const calls = await page.evaluate(() => nativeCalls);
  assert.equal(calls.plays[1].lyricTrackKey, calls.plays[0].lyricTrackKey);
  assert.equal(calls.plays[1].bluetoothLyrics, true);
  assert.deepEqual(calls.plays[1].lyricsTimeline, [{ time: 1, text: '第一句' }, { time: 5, text: '第二句' }]);
}));

test('quality change after restoring a saved song also loads its lyrics', () => fixture(async page => {
  await page.evaluate(() => {
    localStorage.setItem('jelly_current_track', JSON.stringify(JSON.parse(localStorage.getItem('jelly_favs'))[0]));
  });
  await page.reload();
  await page.evaluate(() => {
    window.MusicAPI = {
      initialized: true,
      resolve: async () => ({ url: 'https://audio.test/restored-long-track.mp3', actualQuality: '128k' }),
      getLyrics: async () => ({ lyric: '[00:01.00]重新打开后的歌词' }),
    };
    openFullPlayer();
  });
  await page.locator('#fullQualityPill').click();
  await page.locator('.quality-picker-option[data-quality="128k"]').click();
  await page.waitForTimeout(200);
  const calls = await page.evaluate(() => nativeCalls);
  assert.ok(calls.plays[0]?.lyricTrackKey, 'restored playback needs a fresh lyric identity');
  assert.deepEqual(calls.timelines[0]?.lines, [{ time: 1, text: '重新打开后的歌词' }]);
}));

test('only the latest quality request can restart playback and retain lyrics', () => fixture(async page => {
  await play(page, 0);
  await page.waitForFunction(() => lyricReplies['1']);
  await reply(page, '1', '[00:01.00]保留当前歌词');
  await page.evaluate(() => {
    window.qualityReplies = {};
    MusicAPI.resolve = (ref, quality) => new Promise(resolve => qualityReplies[quality] = resolve);
    openFullPlayer();
  });
  await page.locator('#fullQualityPill').click();
  await page.locator('.quality-picker-option[data-quality="128k"]').click();
  await page.locator('#fullQualityPill').click();
  await page.locator('.quality-picker-option[data-quality="flac"]').click();
  await page.evaluate(() => qualityReplies.flac({ url: 'https://audio.test/current-quality-full-track.flac', actualQuality: 'flac' }));
  await page.waitForFunction(() => nativeCalls.plays.length === 2);
  await page.evaluate(() => qualityReplies['128k']({ url: 'https://audio.test/outdated-quality-full-track.mp3', actualQuality: '128k' }));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => nativeCalls.plays.length), 2, 'older quality request must not restart playback');
  assert.equal(await page.evaluate(() => localStorage.getItem('jelly_current_quality')), 'flac');
}));

test('native synchronization during a pending song resolution cannot restore the previous song', () => fixture(async page => {
  await play(page, 0);
  await page.waitForFunction(() => lyricReplies['1']);
  await reply(page, '1', '[00:01.00]第一首的歌词');
  await page.evaluate(() => {
    const oldTrack = nativeCalls.plays[0];
    AndroidBridge.getPlaybackState = () => JSON.stringify({ track: oldTrack, isPlaying: true, currentPosition: 10000, duration: 60000 });
    delayStreams = true;
  });
  await play(page, 1);
  await page.evaluate(() => syncPlaybackFromNative());
  assert.equal(await page.locator('#miniTitle').textContent(), '歌曲2', 'pending song must stay selected while native still reports the old song');
  await page.evaluate(() => streamReplies['2']({ url: 'https://audio.test/new-pending-full-song.mp3' }));
  await page.waitForFunction(() => nativeCalls.plays.length === 2);
  await page.evaluate(() => syncPlaybackFromNative());
  assert.equal(await page.locator('#miniTitle').textContent(), '歌曲2');
  await page.evaluate(() => {
    AndroidBridge.getPlaybackState = () => JSON.stringify({ track: nativeCalls.plays[1], isPlaying: true, currentPosition: 0, duration: 60000 });
    syncPlaybackFromNative();
  });
  assert.equal(await page.locator('#miniTitle').textContent(), '歌曲2');
}));
