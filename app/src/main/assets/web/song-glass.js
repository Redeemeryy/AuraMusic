/* One GPU surface refracts a shared procedural backdrop, never the song text.
 * Render only on layout/scroll/press. No animation loop runs while idle.
 * This is a known background plane, not capture of arbitrary DOM content. */
(() => {
  const roots = [...document.querySelectorAll('#view-discover,#view-search,#view-library,#playlistDetailOverlay,#queueOverlay')];
  const rowSelector = '#dailyRecPreviewList > div,#discoverRankList > div,#searchResultsList > div,#librarySongList > div,#plDetailTracksList > div,#queueList > .queue-item';
  roots.forEach(root => root.classList.add('song-scene'));
  const canvas = document.createElement('canvas');
  canvas.className = 'song-glass-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const maxRows = 24;
  const rectangles = new Float32Array(maxRows * 4);
  const clips = new Float32Array(maxRows * 4);
  let scene, pending = 0, motionUntil = 0, lost = false, rows = [];
  let program, locations;
  const reduced = () => document.documentElement.classList.contains('reduce-transparency') || matchMedia('(prefers-reduced-transparency: reduce)').matches;
  const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shader(type, source) {
    const object = gl.createShader(type);
    gl.shaderSource(object, source); gl.compileShader(object);
    if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(object));
    return object;
  }
  function initialize() {
    if (!gl) return;
    const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 aPosition; void main(){gl_Position=vec4(aPosition,0.,1.);}');
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform vec2 uSize;
      uniform float uRatio;
      uniform int uCount;
      uniform vec4 uRows[24];
      uniform vec4 uClips[24];
      vec3 paper(vec2 p) {
        vec2 uv=p/uSize;
        vec3 color=vec3(.948,.961,.979);
        float blue=exp(-length((uv-vec2(.85,.2))*vec2(1.5,1.)) * 2.8);
        float violet=exp(-length((uv-vec2(.05,.85))*vec2(1.6,1.)) * 3.4);
        color=mix(color,vec3(.82,.9,.92),blue*.5);
        color=mix(color,vec3(.91,.86,.94),violet*.32);
        vec2 arc=(p-vec2(uSize.x*1.30,-140.))*vec2(.85,1.);
        float phase=length(arc)/53.;
        float line=1.-smoothstep(.012,.039,abs(fract(phase)-.5));
        color=mix(color,vec3(.47,.59,.71),line*.12);
        return color;
      }
      float rounded(vec2 p,vec2 halfSize,float radius) {
        vec2 q=abs(p)-halfSize+radius;
        return length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
      }
      void main() {
        vec2 p=vec2(gl_FragCoord.x/uRatio,uSize.y-gl_FragCoord.y/uRatio);
        float nearest=10000.; vec4 row=vec4(0.);
        for(int i=0;i<24;i++) {
          if(i>=uCount) break;
          vec4 clip=uClips[i];
          if(p.x<clip.x||p.y<clip.y||p.x>clip.z||p.y>clip.w) continue;
          vec4 r=uRows[i];
          float d=rounded(p-r.xy,r.zw*.5,18.);
          if(d<nearest){nearest=d;row=r;}
        }
        vec3 color=paper(p);
        if(nearest<0.) {
          vec2 local=p-row.xy;
          vec2 q=abs(local)-row.zw*.5+18.;
          vec2 n=(q.x>0.&&q.y>0.) ? normalize(q)*sign(local) : (q.x>q.y ? vec2(sign(local.x),0.) : vec2(0.,sign(local.y)));
          float depth=-nearest;
          float bend=sin(clamp(depth/19.,0.,1.)*3.14159265);
          vec2 samplePoint=row.xy+local*.994-n*(bend*13.);
          color=paper(samplePoint);
          color=mix(color,vec3(1.),.08);
          float light=dot(n,normalize(vec2(-.65,-1.)))*.5+.5;
          float rim=exp(-depth/2.2);
          color+=rim*(light*.075-.025);
          color+=exp(-depth/7.)*bend*.012;
          color=mix(paper(p)*.965,color,smoothstep(0.,.9,depth));
        } else if(nearest<8.) {
          color*=1.-exp(-nearest/2.5)*.035;
        }
        gl_FragColor=vec4(color,1.);
      }`);
    program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'aPosition'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    locations={size:gl.getUniformLocation(program,'uSize'),ratio:gl.getUniformLocation(program,'uRatio'),count:gl.getUniformLocation(program,'uCount'),rows:gl.getUniformLocation(program,'uRows[0]'),clips:gl.getUniformLocation(program,'uClips[0]')};
  }
  function visibleRoot() {
    if (!document.querySelector('#fullPlayerOverlay').classList.contains('translate-y-full') && document.querySelector('#queueOverlay').classList.contains('translate-y-full')) return null;
    return [...roots].reverse().find(root => root.classList.contains('view-container') ? root.classList.contains('active') : !root.classList.contains('translate-y-full'));
  }
  function refreshRows() {
    rows = scene ? [...scene.querySelectorAll(rowSelector)].filter(row => row.querySelector('img')) : [];
    rows.forEach(row => row.classList.add('song-glass-row'));
  }
  function request() { if (!pending && !document.hidden) pending = requestAnimationFrame(draw); }
  function draw(now) {
    pending=0;
    const next=visibleRoot();
    if(next!==scene) {
      scene?.classList.remove('refraction-ready'); scene=next;
      if(scene) scene.appendChild(canvas); else canvas.remove();
      refreshRows();
    }
    if(!scene) return;
    if(!gl || lost || !program || reduced()) { if(scene.classList.contains('refraction-ready')) scene.classList.remove('refraction-ready'); canvas.style.display='none'; return; }
    canvas.style.display='block';
    const bounds=canvas.getBoundingClientRect();
    const ratio=Math.min(devicePixelRatio || 1,1.5);
    const w=Math.round(bounds.width*ratio),h=Math.round(bounds.height*ratio);
    if(!w||!h) return;
    if(canvas.width!==w||canvas.height!==h) {canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    let count=0;
    const clipCache=new Map();
    for(const row of rows) {
      const r=row.getBoundingClientRect();
      if(!r.width||r.bottom<bounds.top||r.top>bounds.bottom||r.right<bounds.left||r.left>bounds.right) continue;
      let clip=clipCache.get(row.parentElement);
      if(!clip) {
        clip=[0,0,bounds.width,bounds.height];
        for(let parent=row.parentElement;parent&&scene.contains(parent);parent=parent.parentElement) {
          const style=getComputedStyle(parent);
          if(/auto|scroll|hidden|clip/.test(style.overflowY+' '+style.overflowX)) {
            const rect=parent.getBoundingClientRect();
            clip=[Math.max(clip[0],rect.left-bounds.left),Math.max(clip[1],rect.top-bounds.top),Math.min(clip[2],rect.right-bounds.left),Math.min(clip[3],rect.bottom-bounds.top)];
          }
        }
        clipCache.set(row.parentElement,clip);
      }
      if(r.bottom-bounds.top<clip[1]||r.top-bounds.top>clip[3]) continue;
      rectangles.set([r.left-bounds.left+r.width/2,r.top-bounds.top+r.height/2,r.width,r.height],count*4);
      clips.set(clip,count*4);
      if(++count===maxRows) break;
    }
    gl.uniform2f(locations.size,bounds.width,bounds.height);gl.uniform1f(locations.ratio,ratio);
    gl.uniform1i(locations.count,count);gl.uniform4fv(locations.rows,rectangles);gl.uniform4fv(locations.clips,clips);gl.drawArrays(gl.TRIANGLES,0,6);
    if(!scene.classList.contains('refraction-ready')) scene.classList.add('refraction-ready');
    canvas.dataset.visibleRows=String(count);
    if(now<motionUntil && !reducedMotion()) request();
  }
  function moving() { motionUntil=performance.now()+450; request(); }
  try { initialize(); } catch(error) { lost=true; console.warn('Glass background unavailable; using CSS fallback.', error.message); }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;scene?.classList.remove('refraction-ready');canvas.style.display='none';});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;try{initialize();request();}catch(_){lost=true;}});
  roots.forEach(root=>{
    new MutationObserver(()=>{refreshRows();request();}).observe(root,{childList:true,subtree:true});
    new MutationObserver(moving).observe(root,{attributes:true,attributeFilter:['class']});
    root.addEventListener('scroll',request,{capture:true,passive:true});
  });
  new MutationObserver(moving).observe(document.querySelector('#fullPlayerOverlay'),{attributes:true,attributeFilter:['class']});
  new MutationObserver(request).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',request); document.addEventListener('visibilitychange',request);
  matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change',request);
  document.addEventListener('pointerdown',moving,{passive:true});document.addEventListener('pointerup',moving,{passive:true});
  document.addEventListener('load',request,true);
  request();
})();
