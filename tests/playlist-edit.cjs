// Isolated browser data only; never touches a connected phone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

const tracks = [1, 2, 3].map(id => ({ title: `歌曲${id}`, subtitle: '测试歌手', ref: { id: String(id), providerId: 'wy' }, metadata: { coverUrl: `https://cover.test/${id}.jpg` } }));
const playlist = { title: '编辑测试', author: '网易云', ref: { id: '123456', providerId: 'wy', pluginId: 'ceru-music-importer' }, tracks, playlist: { trackCount: 3 }, importStatus: { total: 3, complete: true } };

async function fixture(run, width = 393, height = 852) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith('https://cover.test/')
      ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' })
      : route.request().url().startsWith('https:') ? route.abort() : route.continue());
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(pl => { localStorage.setItem('jelly_fav_playlists', JSON.stringify([pl])); localStorage.setItem('jelly_queue', JSON.stringify(pl.tracks)); localStorage.setItem('jelly_current_track', JSON.stringify(pl.tracks[0])); }, playlist);
    await page.reload();
    await page.locator('#libraryPlaylistsList > div').first().evaluate(e => e.click());
    await page.waitForTimeout(550);
    await run(page);
    assert.deepEqual(errors, [], '浏览器不应产生脚本异常');
  } finally { await browser.close(); }
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('jelly_fav_playlists')));
async function begin(page) {
  assert.equal(await page.locator('#btnEditPlaylist').count(), 1, '详情应提供编辑入口');
  await page.locator('#btnEditPlaylist').click();
  assert.equal(await page.locator('#btnPlayAllPlaylist').isVisible(), false, '编辑时隐藏播放等无关操作');
}

test('只移除选中歌曲，更新数量和首曲封面，保留队列，重开及刷新仍生效', () => fixture(async page => {
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  assert.match(await page.locator('#btnRemovePlaylistTracks').textContent(), /1/);
  await page.locator('#btnRemovePlaylistTracks').click();
  let result = await saved(page);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].tracks.map(t => t.ref.id), ['2', '3']);
  assert.equal(result[0].playlist.trackCount, 2);
  assert.equal(result[0].artworkUrl, 'https://cover.test/2.jpg');
  assert.match(await page.locator('#plDetailCount').textContent(), /2/);
  assert.match(await page.locator('#plDetailCover').getAttribute('src'), /2\.jpg$/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_queue')).map(t => t.ref.id)), ['1', '2', '3']);
  await page.evaluate(() => { closePlaylistDetail(); document.querySelector('#libraryPlaylistsList > div').click(); });
  assert.equal(await page.locator('#plDetailTracksList > div').count(), 2);
  await page.reload();
  assert.equal(await page.locator('#plDetailTracksList > div').count(), 2);
  assert.equal(await page.locator('#libraryPlaylistsList > div').count(), 1);
}));

test('取消编辑与返回详情均放弃勾选，不修改歌曲', () => fixture(async page => {
  const original = await saved(page);
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲2', exact: true }).check();
  await page.locator('#btnCancelPlaylistEdit').click();
  assert.deepEqual(await saved(page), original);
  await begin(page);
  assert.equal(await page.locator('#btnRemovePlaylistTracks').isDisabled(), true);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.evaluate(() => { closePlaylistDetail(); document.querySelector('#libraryPlaylistsList > div').click(); });
  assert.equal(await page.getByRole('checkbox').count(), 0);
  assert.deepEqual(await saved(page), original);
}));

test('已有当前歌曲时取消和移除可真实点击，退出编辑恢复迷你播放器', () => fixture(async page => {
  const original = await saved(page);
  assert.equal(await page.locator('#miniPlayer').isVisible(), true);
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  assert.equal(await page.locator('#miniPlayer').isVisible(), false);
  await page.locator('#btnCancelPlaylistEdit').click();
  assert.equal(await page.locator('#miniPlayer').isVisible(), true);
  assert.deepEqual(await saved(page), original);
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').click();
  assert.equal(await page.locator('#miniPlayer').isVisible(), true);
  assert.deepEqual((await saved(page))[0].tracks.map(t => t.ref.id), ['2', '3']);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('jelly_current_track')).ref.id), '1');
  await begin(page);
  await page.locator('#btnClosePlaylistDetail').click();
  assert.equal(await page.locator('#miniPlayer').isVisible(), true);
}));

test('全部移除保留空歌单，重开与刷新不再联网加载', () => fixture(async page => {
  await begin(page);
  for (const id of [1, 2, 3]) await page.getByRole('checkbox', { name: `选择 歌曲${id}`, exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').click();
  assert.equal((await saved(page))[0].tracks.length, 0);
  assert.equal((await saved(page))[0].artworkUrl, '');
  await page.evaluate(() => { window.MusicAPI.getPlaylistDetail = async () => { throw Error('空歌单不得联网'); }; closePlaylistDetail(); document.querySelector('#libraryPlaylistsList > div').click(); });
  assert.match(await page.locator('#plDetailCount').textContent(), /0/);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /暂无歌曲/);
  await page.reload();
  assert.match(await page.locator('#plDetailCount').textContent(), /0/);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /暂无歌曲/);
  assert.match(await page.locator('#libraryPlaylistsList').textContent(), /0 首/);
}));

test('存储失败保留原副本和勾选，恢复写入后可以重试', () => fixture(async page => {
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.evaluate(() => { window.originalStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'jelly_fav_playlists') throw Error('空间不足'); return window.originalStorageWrite.call(this, key, value); }; });
  await page.locator('#btnRemovePlaylistTracks').click();
  assert.deepEqual((await saved(page))[0].tracks.map(t => t.ref.id), ['1', '2', '3']);
  assert.match(await page.locator('#playlistEditStatus').textContent(), /保存失败/);
  assert.equal(await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).isChecked(), true);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageWrite; });
  await page.locator('#btnRemovePlaylistTracks').click();
  assert.deepEqual((await saved(page))[0].tracks.map(t => t.ref.id), ['2', '3']);
}));

test('再次导入明确保留手动编辑结果，不恢复已移除歌曲或产生重复卡片', () => fixture(async page => {
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').click();
  await page.evaluate(items => { window.MusicAPI.getPlaylistDetail = async () => ({ title: '编辑测试', total: 3, complete: true, items }); document.querySelector('#textareaImportContent').value = 'https://music.163.com/playlist?id=123456'; document.querySelector('#btnConfirmTextImport').click(); }, tracks);
  await page.waitForFunction(() => document.querySelector('#importStatusTitle').textContent === '导入失败');
  assert.match(await page.locator('#importStatusDesc').textContent(), /手动编辑.*保留/);
  assert.equal((await saved(page)).length, 1);
  assert.deepEqual((await saved(page))[0].tracks.map(t => t.ref.id), ['2', '3']);
}));

test('编辑后重新收藏仍保留编辑保护，重导原链接不恢复移除歌曲', () => fixture(async page => {
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').click();
  const edited = (await saved(page))[0];
  await page.locator('#btnFavPlaylist').click();
  await page.locator('#btnFavPlaylist').click();
  const refavorited = (await saved(page))[0];
  assert.equal(refavorited.locallyEdited, true, '重新收藏必须保留本地编辑保护');
  assert.equal(refavorited.originalImportFingerprint, edited.originalImportFingerprint);
  assert.deepEqual(refavorited.importStatus, edited.importStatus);
  await page.evaluate(items => { window.MusicAPI.getPlaylistDetail = async () => ({ title: '编辑测试', total: 3, complete: true, items }); document.querySelector('#textareaImportContent').value = 'https://music.163.com/playlist?id=123456'; document.querySelector('#btnConfirmTextImport').click(); }, tracks);
  await page.waitForFunction(() => document.querySelector('#importStatusTitle').textContent === '导入失败');
  assert.match(await page.locator('#importStatusDesc').textContent(), /手动编辑.*保留/);
  assert.deepEqual((await saved(page))[0].tracks.map(t => t.ref.id), ['2', '3']);
}));

test('每日推荐的新内容不被旧收藏覆盖，编辑过的收藏副本仍保留', () => fixture(async page => {
  await page.clock.setFixedTime(new Date(2026, 9, 26, 12));
  await page.evaluate(items => {
    const old = { title: '昨日每日推荐', author: '每日推荐', ref: { id: 'daily-rec', providerId: 'jelly' }, tracks: [items[0]], locallyEdited: true, playlist: { trackCount: 1 } };
    localStorage.setItem('jelly_fav_playlists', JSON.stringify([old]));
    localStorage.setItem('jelly_daily_rec_tracks', JSON.stringify(items.slice(1)));
    localStorage.removeItem('jelly_open_playlist');
  }, tracks);
  await page.reload();
  await page.locator('#btnViewDailyRecDetail').evaluate(button => button.click());
  assert.notEqual(await page.locator('#plDetailTitle').textContent(), '昨日每日推荐');
  assert.equal(await page.locator('#plDetailTracksList > div').count(), 2);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /歌曲2/);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /歌曲3/);
  assert.equal(await page.locator('#btnEditPlaylist').isDisabled(), true, '新推荐应先单独收藏');
  await page.locator('#btnFavPlaylist').click();
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲2', exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').click();
  const edited = (await saved(page)).find(pl => pl.ref.id !== 'daily-rec');
  assert.deepEqual(edited.tracks.map(t => t.ref.id), ['3']);

  // A same-day refresh changes the recommendation batch, while the saved edit remains a snapshot.
  await page.evaluate(items => { localStorage.setItem('jelly_daily_rec_tracks', JSON.stringify(items.slice(0, 2))); localStorage.removeItem('jelly_open_playlist'); }, tracks);
  await page.reload();
  await page.locator('#btnViewDailyRecDetail').evaluate(button => button.click());
  assert.equal(await page.locator('#plDetailTracksList > div').count(), 2);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /歌曲1/);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /歌曲2/);
  assert.equal(await page.locator('#btnEditPlaylist').isDisabled(), true);
  assert.deepEqual((await saved(page)).find(pl => pl.ref.id === edited.ref.id).tracks.map(t => t.ref.id), ['3']);
  await page.locator('#btnFavPlaylist').click();
  await page.evaluate(() => { closePlaylistDetail(); document.querySelector('#btnViewDailyRecDetail').click(); });
  assert.equal(await page.locator('#favPlaylistText').textContent(), '已收藏');
  assert.equal((await saved(page)).length, 3, '重复打开同一批推荐不得创建新收藏');
  await page.clock.setFixedTime(new Date(2026, 9, 27, 12));
  await page.evaluate(() => { closePlaylistDetail(); document.querySelector('#btnViewDailyRecDetail').click(); });
  assert.equal(await page.locator('#favPlaylistText').textContent(), '收藏', '日期变化应使用新的推荐快照');
  assert.equal((await saved(page)).length, 3);
  await page.evaluate(pl => openPlaylistDetail(pl.ref, pl), edited);
  assert.equal(await page.locator('#plDetailTracksList > div').count(), 1);
  assert.match(await page.locator('#plDetailTracksList').textContent(), /歌曲3/);
}));

test('未收藏歌单提示先收藏，保存失败不会误开放编辑', () => fixture(async page => {
  await page.evaluate(items => openPlaylistDetail({ id: '654321', providerId: 'wy' }, { title: '线上歌单', tracks: items }), tracks);
  assert.equal(await page.locator('#btnEditPlaylist').isDisabled(), true);
  assert.match(await page.locator('#playlistEditHint').textContent(), /先收藏/);
  await page.evaluate(() => { window.originalStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'jelly_fav_playlists') throw Error('空间不足'); return window.originalStorageWrite.call(this, key, value); }; });
  await page.locator('#btnFavPlaylist').click();
  assert.equal(await page.locator('#btnEditPlaylist').isDisabled(), true);
  assert.equal((await saved(page)).length, 1);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageWrite; });
  await page.locator('#btnFavPlaylist').click();
  await begin(page);
  assert.equal(await page.getByRole('checkbox').count(), 3);
}));

test('编辑时在歌曲上滑动不关闭详情或丢失选择', () => fixture(async page => {
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.locator('.playlist-select-row').first().evaluate(row => {
    const touch = y => new Touch({ identifier: 1, target: row, clientX: 100, clientY: y });
    row.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(200)] }));
    row.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch(350)] }));
    row.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(350)] }));
  });
  assert.equal(await page.locator('#playlistDetailOverlay').evaluate(e => e.classList.contains('translate-y-full')), false);
  assert.equal(await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).isChecked(), true);
}));

test('重复导入原本地文件保留手动编辑结果与一张卡片', () => fixture(async page => {
  const file = { name: '本地测试.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([
    { name: '本地第一首', songmid: '41', source: 'wy' }, { name: '本地第二首', songmid: '42', source: 'wy' }
  ])) };
  await page.locator('#playlistFileInput').setInputFiles(file);
  await page.waitForFunction(() => document.querySelector('#plDetailTitle').textContent === '本地测试');
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 本地第一首', exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').click();
  await page.locator('#playlistFileInput').setInputFiles(file);
  await page.waitForFunction(() => document.querySelector('#importStatusTitle').textContent === '导入失败');
  assert.match(await page.locator('#importStatusDesc').textContent(), /手动编辑.*保留/);
  const local = (await saved(page)).filter(pl => pl.title === '本地测试');
  assert.equal(local.length, 1);
  assert.deepEqual(local[0].tracks.map(t => t.title), ['本地第二首']);
}));

test('打开页状态写入失败时重启仍采用最新歌单，首曲无封面使用回退图', () => fixture(async page => {
  await page.evaluate(pl => {
    const tracks = pl.tracks.map((t, i) => i === 1 ? { ...t, metadata: {} } : t);
    openPlaylistDetail({ id: '987654', providerId: 'wy' }, { title: '无封面测试', tracks });
    document.querySelector('#btnFavPlaylist').click();
  }, playlist);
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.evaluate(() => { const write = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'jelly_open_playlist') throw Error('模拟状态写入失败'); return write.call(this, key, value); }; });
  await page.locator('#btnRemovePlaylistTracks').click();
  assert.match(await page.locator('#plDetailCover').getAttribute('src'), /^data:image\/svg/);
  await page.reload();
  assert.equal(await page.locator('#plDetailTracksList > div').count(), 2);
  assert.match(await page.locator('#plDetailCover').getAttribute('src'), /^data:image\/svg/);
}));

for (const [width, height] of [[320, 640], [800, 360]]) test(`编辑按钮在 ${width}×${height} 可见可点击且无横向溢出`, () => fixture(async page => {
  await begin(page);
  await page.getByRole('checkbox', { name: '选择 歌曲1', exact: true }).check();
  await page.locator('#btnRemovePlaylistTracks').scrollIntoViewIfNeeded();
  const box = await page.locator('#btnRemovePlaylistTracks').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height);
  const dims = await page.locator('#playlistDetailOverlay').evaluate(e => [e.clientWidth, e.scrollWidth]);
  assert.ok(dims[1] <= dims[0] + 1);
  fs.mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: `artifacts/playlist-edit-${width}.png` });
  await page.locator('#btnRemovePlaylistTracks').click();
  assert.equal((await saved(page))[0].tracks.length, 2);
}, width, height));
