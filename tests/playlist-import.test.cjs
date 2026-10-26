const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

function runtime({ count = 503, failBatch = false, visibleIds = count, failDetail = false } = {}) {
  const songs = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `歌曲${i + 1}`, ar: [{ name: '歌手' }], al: { name: '专辑', picUrl: `https://cover.test/${i + 1}.jpg` }, dt: 180000 }));
  const context = vm.createContext({ console: { ...console, warn() {} }, URLSearchParams, TextDecoder, TextEncoder, AbortController,
    fetch: async (url, options) => {
      let body;
      if (url.includes('/playlist/detail')) {
        if (failDetail) throw Error('模拟平台详情暂时不可用');
        body = { code: 200, playlist: { id: 123456, name: '测试歌单', trackCount: count, trackIds: songs.slice(0, visibleIds).map(s => ({ id: s.id })), tracks: songs.slice(0, 100), coverImgUrl: 'https://cover.test/playlist.jpg' } };
      }
      else if (url.includes('/song/detail')) {
        const ids = JSON.parse(new URLSearchParams(options.body).get('c')).map(s => s.id);
        if (failBatch && ids.some(id => id > 400)) throw Error('模拟第二批网络失败');
        body = { code: 200, songs: songs.filter(s => ids.includes(s.id)).reverse() };
      } else throw Error(`Unexpected endpoint: ${url}`);
      return { status: 200, headers: new Map(), text: async () => JSON.stringify(body) };
    }
  });
  vm.runInContext(fs.readFileSync(path.resolve('app/src/main/assets/web/ceru_runtime.js'), 'utf8'), context);
  context.MusicAPI.actions.set('playlist.detail', async () => ({ title: '插件首屏', total: count, items: songs.slice(0, 100).map(s => ({ title: s.name, ref: { id: String(s.id), providerId: 'wy' } })) }));
  return context.MusicAPI;
}

test('网易云插件仅返回100首时，导入读取全部ID并按原歌单顺序取回503首', async () => {
  const result = await runtime().getPlaylistDetail('123456', 'wy');
  assert.equal(result.items.length, 503);
  assert.equal(result.items[0].ref.id, '1');
  assert.equal(result.items[502].ref.id, '503');
  assert.equal(result.total, 503);
  assert.equal(result.complete, true);
});

test('网易云某批次失败时保留成功曲目并报告真实总数和未完成状态', async () => {
  const result = await runtime({ failBatch: true }).getPlaylistDetail('123456', 'wy');
  assert.equal(result.items.length, 400);
  assert.equal(result.total, 503);
  assert.equal(result.complete, false);
  assert.match(result.warning, /400.*503/);
});

test('平台只暴露100个ID但声明503首时不得将100首标记为完整歌单', async () => {
  const result = await runtime({ visibleIds: 100 }).getPlaylistDetail('123456', 'wy');
  assert.equal(result.items.length, 100);
  assert.equal(result.total, 503);
  assert.equal(result.complete, false);
});

test('平台详情不可用时可保留插件曲目，但不得声称已完整导入', async () => {
  const result = await runtime({ failDetail: true }).getPlaylistDetail('123456', 'wy');
  assert.equal(result.items.length, 100);
  assert.equal(result.total, 503);
  assert.equal(result.complete, false);
  assert.match(result.warning, /无法核实/);
});

function offlineRoute(route) {
  return route.request().url().startsWith('https://cover.test/')
    ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="blue"/></svg>' })
    : route.request().url().startsWith('https:') ? route.abort() : route.continue();
}

test('同一网络歌单连点和再次导入只保留一张卡片，封面使用首曲metadata', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', offlineRoute);
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(() => {
      window.MusicAPI.getPlaylistDetail = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { title: '测试歌单', complete: true, total: 2, items: [
          { title: '第一首', ref: { id: '1', providerId: 'wy' }, metadata: { coverUrl: 'https://cover.test/first.jpg' } },
          { title: '第二首', ref: { id: '2', providerId: 'wy' }, artworkUrl: 'https://cover.test/second.jpg' }
        ] };
      };
      document.querySelector('#textareaImportContent').value = 'https://music.163.com/playlist?id=123456';
      document.querySelector('#btnConfirmTextImport').click();
      document.querySelector('#btnConfirmTextImport').click();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('jelly_fav_playlists') || '[]').length > 0);
    await page.waitForTimeout(150);
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')));
    assert.equal(saved.length, 1, '异步导入不得重复保存');
    assert.equal(saved[0].artworkUrl, 'https://cover.test/first.jpg');
    await page.evaluate(() => { document.querySelector('#inputImportPlaylistName').value = '重命名后再次导入'; document.querySelector('#btnConfirmTextImport').click(); });
    await page.waitForTimeout(150);
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')));
    assert.equal(saved.length, 1, '同一来源ID更新已有歌单');
    assert.equal(saved[0].title, '重命名后再次导入');
    assert.equal(await page.locator('#libraryPlaylistsList > div').count(), 1);
  } finally { await browser.close(); }
});

test('历史重复导入只合并内容相同的记录，并备份原始列表', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', offlineRoute);
    await page.addInitScript(() => {
      const track = { title: '第一首', ref: { id: '1', providerId: 'wy' }, metadata: { coverUrl: 'https://cover.test/first.jpg' } };
      const playlist = { title: '同名歌单', ref: { id: 'imported_1', providerId: 'wy', pluginId: 'ceru-music-importer' }, tracks: [track], artworkUrl: 'https://cover.test/stale.jpg' };
      localStorage.setItem('jelly_fav_playlists', JSON.stringify([playlist, { ...playlist, ref: { ...playlist.ref, id: 'imported_2' } }, { ...playlist, ref: { ...playlist.ref, id: 'imported_3' }, tracks: [{ ...track, ref: { id: '99', providerId: 'wy' } }] }]));
    });
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    const saved = await page.evaluate(() => ({ current: JSON.parse(localStorage.getItem('jelly_fav_playlists')), backup: JSON.parse(localStorage.getItem('jelly_fav_playlists_before_dedup')) }));
    assert.equal(saved.current.length, 2);
    assert.equal(saved.backup.length, 3);
    assert.equal(await page.locator('#libraryPlaylistsList > div').count(), 2);
    await page.locator('#libraryPlaylistsList > div').first().evaluate(e => e.click());
    assert.match(await page.locator('#plDetailCover').getAttribute('src'), /first\.jpg$/);
    await page.locator('#btnFavPlaylist').evaluate(e => e.click());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')).length), 1, '取消收藏不得删除同名但内容不同的歌单');
  } finally { await browser.close(); }
});

test('不完整导入保留警告，详情不能显示为完整总数，再次失败不得覆盖较完整副本', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', offlineRoute);
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(() => {
      window.MusicAPI.getPlaylistDetail = async () => ({ title: '部分歌单', total: 314, complete: false, warning: '已获取 2 / 314 首', items: [1, 2].map(id => ({ title: `歌曲${id}`, ref: { id: String(id), providerId: 'wy' } })) });
      document.querySelector('#textareaImportContent').value = 'https://music.163.com/playlist?id=123456';
      document.querySelector('#btnConfirmTextImport').click();
    });
    await page.waitForFunction(() => localStorage.getItem('jelly_fav_playlists'));
    assert.match(await page.locator('#importStatusTitle').textContent(), /未完整/);
    await page.locator('#libraryPlaylistsList > div').first().evaluate(e => e.click());
    assert.match(await page.locator('#plDetailCount').textContent(), /2.*314.*未完整/);
    await page.evaluate(() => {
      window.MusicAPI.getPlaylistDetail = async () => ({ title: '部分歌单', total: 314, complete: false, items: [{ title: '歌曲1', ref: { id: '1', providerId: 'wy' } }] });
      document.querySelector('#btnConfirmTextImport').click();
    });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists'))[0].tracks.length), 2);
  } finally { await browser.close(); }
});

for (const incoming of [[2, 3], [2, 3, 4]]) {
  test(`不完整刷新取得${incoming.length}首但缺少旧曲目时保留旧副本`, async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      const page = await browser.newPage();
      await page.route('**/*', offlineRoute);
      await page.addInitScript(() => localStorage.setItem('jelly_fav_playlists', JSON.stringify([{
        title: '部分歌单', author: '网易云', ref: { id: '123456', providerId: 'wy', pluginId: 'ceru-music-importer' },
        tracks: [1, 2].map(id => ({ title: `歌曲${id}`, ref: { id: String(id), providerId: 'wy' } })),
        importStatus: { total: 5, complete: false }
      }])));
      await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
      await page.evaluate(ids => {
        window.MusicAPI.getPlaylistDetail = async () => ({ title: '部分歌单', total: 5, complete: false,
          items: ids.map(id => ({ title: `歌曲${id}`, ref: { id: String(id), providerId: 'wy' } })) });
        document.querySelector('#textareaImportContent').value = 'https://music.163.com/playlist?id=123456';
        document.querySelector('#btnConfirmTextImport').click();
      }, incoming);
      await page.waitForTimeout(100);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')));
      assert.deepEqual(saved[0].tracks.map(track => track.ref.id), ['1', '2']);
      assert.match(await page.locator('#importStatusDesc').textContent(), /保留原有/);
      // A later partial result containing every old identity can add progress.
      await page.evaluate(() => {
        window.MusicAPI.getPlaylistDetail = async () => ({ title: '部分歌单', total: 5, complete: false,
          items: [1, 2, 3].map(id => ({ title: `歌曲${id}`, ref: { id: String(id), providerId: 'wy' } })) });
        document.querySelector('#btnConfirmTextImport').click();
      });
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('jelly_fav_playlists'))[0].tracks.length === 3);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists'))[0].tracks.map(track => track.ref.id)), ['1', '2', '3']);
    } finally { await browser.close(); }
  });
}

test('JSON文件含封面链接仍按文件导入，首曲缺封面时不借用第二首，存储失败明确报错', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', offlineRoute);
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.locator('#playlistFileInput').setInputFiles({ name: '本地歌单.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([
      { name: '第一首', songmid: '1', source: 'wy' },
      { name: '第二首', songmid: '2', source: 'wy', img: 'https://cover.test/second.jpg' }
    ])) });
    await page.waitForFunction(() => localStorage.getItem('jelly_fav_playlists'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')));
    assert.equal(saved[0].tracks.length, 2);
    assert.equal(saved[0].artworkUrl, '');
    await page.evaluate(() => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === 'jelly_fav_playlists') throw Error('存储空间不足'); return write.call(this, key, value); };
      document.querySelector('#textareaImportContent').value = '第三首 - 歌手';
      document.querySelector('#btnConfirmTextImport').click();
    });
    await page.waitForFunction(() => document.querySelector('#importStatusTitle').textContent === '导入失败');
    assert.match(await page.locator('#importStatusDesc').textContent(), /存储空间不足/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')).length), 1);
    assert.equal(await page.locator('#libraryPlaylistsList > div').count(), 1);
  } finally { await browser.close(); }
});

test('仅将同名同作者同平台且100首精确有序前缀的旧导入升级，其他歌单保留', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', offlineRoute);
    await page.addInitScript(() => {
      const tracks = Array.from({ length: 100 }, (_, i) => ({ title: `歌曲${i}`, ref: { id: String(i), providerId: 'wy' } }));
      const playlist = { title: '测试歌单', author: '网易云', ref: { id: 'imported_1', providerId: 'wy', pluginId: 'ceru-music-importer' }, tracks };
      localStorage.setItem('jelly_fav_playlists', JSON.stringify([
        playlist,
        { ...playlist, ref: { ...playlist.ref, id: 'imported_2' }, tracks: [...tracks].reverse() },
        { ...playlist, ref: { ...playlist.ref, id: '999999' } },
        { ...playlist, title: '不同标题', ref: { ...playlist.ref, id: 'imported_3' } },
        { ...playlist, author: '不同作者', ref: { ...playlist.ref, id: 'imported_4' } },
        { ...playlist, ref: { ...playlist.ref, id: 'imported_5', providerId: 'tx' }, tracks: tracks.map(t => ({ ...t, ref: { ...t.ref, providerId: 'tx' } })) }
      ]));
    });
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(() => {
      window.MusicAPI.getPlaylistDetail = async () => ({ title: '测试歌单', total: 314, complete: true, items: Array.from({ length: 314 }, (_, i) => ({ title: `歌曲${i}`, ref: { id: String(i), providerId: 'wy' } })) });
      document.querySelector('#textareaImportContent').value = 'https://music.163.com/playlist?id=123456';
      document.querySelector('#btnConfirmTextImport').click();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('jelly_fav_playlists'))[0].tracks.length === 314);
    const result = await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem('jelly_fav_playlists')), backup: JSON.parse(localStorage.getItem('jelly_fav_playlists_before_import_upgrade')) }));
    assert.equal(result.saved.length, 6);
    assert.equal(result.saved[0].ref.id, '123456');
    assert.equal(result.saved.filter(p => p.ref.id === 'imported_1').length, 0);
    assert.equal(result.saved.filter(p => p.ref.id === '999999').length, 1);
    assert.equal(result.backup.length, 6);
  } finally { await browser.close(); }
});
