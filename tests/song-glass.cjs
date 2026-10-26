const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:347,height:754}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',r=>r.abort());
    await page.addInitScript(()=>{
      localStorage.setItem('jelly_queue',JSON.stringify(Array.from({length:40},(_,i)=>({title:'歌曲 '+i,subtitle:'歌手',ref:{id:String(i),providerId:'tx'}}))));
      localStorage.setItem('jelly_queue_index','0');
    });
    await page.goto(pathToFileURL(path.resolve('app/src/main/assets/web/index.html')).href);
    await page.evaluate(()=>openFullPlayer());
    await page.locator('#btnPlaylistQueue').click();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#queueList .song-glass-row').count(),40);
    assert.ok(await page.locator('#queueOverlay').evaluate(e=>e.classList.contains('refraction-ready')),'GPU material must initialize');
    const difference=await page.locator('canvas.song-glass-canvas').evaluate(canvas=>{
      const gl=canvas.getContext('webgl');
      const program=gl.getParameter(gl.CURRENT_PROGRAM),count=gl.getUniformLocation(program,'uCount');
      const n=gl.getUniform(program,count);
      const a=new Uint8Array(canvas.width*canvas.height*4),b=new Uint8Array(a.length);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);
      gl.uniform1i(count,0);gl.drawArrays(gl.TRIANGLES,0,6);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,b);
      gl.uniform1i(count,n);gl.drawArrays(gl.TRIANGLES,0,6);
      let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>8)changed++;
      window.glassTestDraws=0;
      const draw=gl.drawArrays.bind(gl);gl.drawArrays=(...args)=>{window.glassTestDraws++;draw(...args);};
      return changed;
    });
    assert.ok(difference>1000,'refraction must change rendered background pixels');
    await page.waitForTimeout(650);
    const start=await page.evaluate(()=>glassTestDraws);
    await page.waitForTimeout(650);
    assert.equal(await page.evaluate(()=>glassTestDraws),start,'renderer must be idle when untouched');
    await page.locator('#queueList').evaluate(e=>e.scrollTop=700);
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(()=>glassTestDraws)>start,'scroll redraws material');
    await page.evaluate(()=>document.documentElement.classList.add('reduce-transparency'));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('canvas.song-glass-canvas').isVisible(),false);
    const assertOpaqueRows=async()=>{
      assert.equal(await page.locator('#queueList .song-glass-row').nth(1).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(253, 254, 254)');
      assert.equal(await page.locator('#queueList .queue-item-active').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(228, 237, 247)');
    };
    await assertOpaqueRows();
    await page.evaluate(()=>document.documentElement.classList.remove('reduce-transparency'));
    await page.waitForTimeout(100);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('canvas.song-glass-canvas').isVisible(),false);
    await assertOpaqueRows();
    await cdp.send('Emulation.setEmulatedMedia',{features:[]});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('canvas.song-glass-canvas').isVisible(),true);
    await page.locator('canvas.song-glass-canvas').evaluate(c=>c.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#queueOverlay').evaluate(e=>e.classList.contains('refraction-ready')),false,'lost context falls back to readable cards');
    assert.deepEqual(errors,[]);
    console.log(`PASS refracted pixels (${difference}), idle rendering, scroll, reduced transparency and GPU-loss fallback`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
