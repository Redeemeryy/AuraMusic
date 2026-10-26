// Optional live check: node tests/playlist-live.cjs <playlistId> [saved-playlists.json]
// Uses an isolated browser profile. Never reads or writes a connected phone.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const id = process.argv[2];
  if (!/^\d{5,14}$/.test(id || '')) throw Error('请传入公开网易云歌单ID');
  const seed = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : [];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    await page.route('https://**', route => route.abort());
    // Exercise the same HTTP callback boundary used by the Android WebView,
    // forwarding only public playlist API traffic to the real upstream.
    await page.exposeFunction('testPlaylistHttp', async request => {
      const url = new URL(request.url);
      if (url.hostname !== 'music.163.com' || !url.pathname.startsWith('/api/')) throw Error('Unexpected API URL');
      try {
        const response = await fetch(request.url, {
          method: request.method, body: request.body || undefined,
          headers: JSON.parse(request.headers),
          signal: AbortSignal.timeout(20000)
        });
        return { requestId: request.id, status: response.status, body: await response.text() };
      } catch (error) { return { requestId: request.id, status: 0, error: error.message }; }
    });
    await page.addInitScript(() => {
      window.AndroidBridge = { httpRequest(id, url, method, headers, body) {
        window.testPlaylistHttp({ id, url, method, headers, body }).then(response => window.onNativeHttpResponse(JSON.stringify(response)));
      } };
    });
    await page.addInitScript(data => localStorage.setItem('jelly_fav_playlists', JSON.stringify(data)), seed);
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(playlistId => {
      document.querySelector('#textareaImportContent').value = `https://music.163.com/playlist?id=${playlistId}`;
      document.querySelector('#btnConfirmTextImport').click();
      document.querySelector('#btnConfirmTextImport').click();
    }, id);
    await page.waitForFunction(playlistId => JSON.parse(localStorage.getItem('jelly_fav_playlists') || '[]').some(pl => pl.ref.id === playlistId), id, { timeout: 60000 });
    const report = await page.evaluate(playlistId => {
      const all = JSON.parse(localStorage.getItem('jelly_fav_playlists'));
      const pl = all.find(p => p.ref.id === playlistId);
      return {
        playlistId, savedPlaylists: all.length, renderedCards: document.querySelector('#libraryPlaylistsList').children.length,
        loaded: pl.tracks.length, total: pl.importStatus.total, complete: pl.importStatus.complete,
        firstId: pl.tracks[0].ref.id, firstTitle: pl.tracks[0].title,
        cover: pl.artworkUrl, firstCover: pl.tracks[0].artworkUrl,
        duplicateBackupCount: JSON.parse(localStorage.getItem('jelly_fav_playlists_before_dedup') || '[]').length,
        upgradeBackupCount: JSON.parse(localStorage.getItem('jelly_fav_playlists_before_import_upgrade') || '[]').length
      };
    }, id);
    assert.equal(report.complete, true);
    assert.equal(report.loaded, report.total);
    assert.equal(report.renderedCards, report.savedPlaylists);
    assert.equal(report.cover, report.firstCover);
    assert.ok(report.cover);
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
