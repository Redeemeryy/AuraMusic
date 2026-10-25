const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const [width,height] of [[320,640],[347,754],[800,360]]) {
      const p=await b.newPage({viewport:{width,height}});
      await p.route('https://**',r=>r.abort());
      await p.addInitScript(()=>{
        localStorage.setItem('jelly_queue',JSON.stringify(Array.from({length:8},(_,i)=>({title:i?'很长的歌曲标题应该省略而不是挤压删除按钮':'第一首歌',subtitle:'测试歌手',ref:{id:String(i),providerId:'tx'}}))));
        localStorage.setItem('jelly_queue_index','0');
        localStorage.setItem('jelly_queue_title','一个很长很长的队列来源名称');
      });
      await p.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
      await p.evaluate(()=>openFullPlayer());
      await p.locator('#btnPlaylistQueue').click();
      await p.waitForTimeout(550);
      assert.equal(await p.locator('.queue-track-main').count(),8);
      const dims=await p.locator('#queueOverlay').evaluate(e=>[e.clientWidth,e.scrollWidth]);
      assert.ok(dims[1]<=dims[0]+1);
      await p.locator('.btn-remove-track').nth(1).click();
      assert.equal(await p.locator('.queue-track-main').count(),7);
      await p.locator('#btnQueuePlayMode').click();
      assert.equal(await p.locator('#queuePlayModeText').textContent(),'单曲循环');
      await p.screenshot({path:`artifacts/queue-${width}.png`});
      assert.equal(await p.evaluate(()=>handleBackPress()),true);
      console.log(`PASS queue ${width}: populated layout, remove, mode, back`);
      await p.close();
    }
  } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
