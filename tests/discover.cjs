const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const [width,height] of [[320,640],[347,754],[800,360]]) {
      const p=await b.newPage({viewport:{width,height}});
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.route('https://**',r=>r.abort());
      await p.addInitScript(()=>{
        const d=new Date();
        localStorage.setItem('jelly_daily_rec_date',`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
        const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#d69e69"/><stop offset="1" stop-color="#274757"/></linearGradient></defs><path fill="url(#g)" d="M0 0h600v600H0z"/><circle cx="410" cy="170" r="130" fill="#e5cfaa"/><path d="M0 380Q180 210 320 400T600 350V600H0" fill="#395a5e"/></svg>');
        const tracks=Array.from({length:30},(_,i)=>({title:['在晚风里','很长很长的歌名也要保持整齐不要挤到播放按钮','山海之间'][i%3],subtitle:'测试歌手',ref:{id:String(i),providerId:'tx'},metadata:{artists:['测试歌手'],artworkUrl:art}}));
        localStorage.setItem('jelly_daily_rec_tracks',JSON.stringify(tracks));
        localStorage.setItem('jelly_daily_rec_summary',JSON.stringify({title:'旧版缓存标题',tags:['标签一','标签二']}));
      });
      await p.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href,{waitUntil:'domcontentloaded'});
      assert.equal(await p.locator('#dailyRecSection').isVisible(),false,'no plugin hides recommendations');
      await p.evaluate(async()=>{
        const tracks=JSON.parse(localStorage.getItem('jelly_daily_rec_tracks'));
        MusicAPI.initialized=true;MusicAPI.manifest={name:'测试音源'};
        MusicAPI.search=async()=>({items:tracks});
        MusicAPI.getPlaylists=async()=>({items:tracks.slice(0,6).map((t,i)=>({ref:t.ref,title:['夜晚适合慢一点','把日子听成诗','路上的风景'][i%3],artworkUrl:t.metadata.artworkUrl,subtitle:'精选歌单'}))});
        await window.loadDiscoverContent();
      });
      await p.waitForTimeout(200);
      assert.equal(await p.locator('#dailyRecPreviewList .discover-track').count(),3);
      assert.equal(await p.locator('#dailyRecTitle').textContent(),'每日精选');
      const dims=await p.locator('#view-discover').evaluate(e=>[e.clientWidth,e.scrollWidth]);
      assert.ok(dims[1]<=dims[0]+1,'populated page must not overflow');
      assert.equal(await p.locator('#discoverRankList').innerText().then(t=>t.includes('FLAC')),false);
      await p.screenshot({path:`artifacts/discover-new-${width}.png`});
      await p.locator('#btnViewDailyRecDetail').click();
      assert.equal(await p.locator('#playlistDetailOverlay').evaluate(e=>e.classList.contains('translate-y-full')),false);
      await p.waitForTimeout(550);
      for (const id of ['btnPlayAllPlaylist','btnFavPlaylist','btnExportPlaylist','plDetailSourceBadge']) {
        const box = await p.locator('#'+id).boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, id + ' must fit screen');
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS populated discover ${width}x${height}: cached tracks, source gating, layout, playlist navigation`);
      await p.close();
    }
  } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
