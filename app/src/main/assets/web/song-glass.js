/* One GPU surface refracts a shared procedural backdrop, never the song text.
 * Render only on layout/scroll/press. No animation loop runs while idle.
 * This is a known background plane, not capture of arbitrary DOM content. */
(() => {
  const roots = [...document.querySelectorAll('#view-discover,#view-search,#view-library,#playlistDetailOverlay,#queueOverlay')];
  const rowSelector = '#dailyRecPreviewList > div,#discoverRankList > div,#searchResultsList > div,#librarySongList > div,#plDetailTracksList > div,#queueList > .queue-item,#discoverNoSourceBanner,#dailyRecCard';
  roots.forEach(root => root.classList.add('song-scene'));
  const canvas = document.createElement('canvas');
  canvas.className = 'song-glass-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
  const maxRows = 32;
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
      uniform vec4 uRows[32];
      uniform vec4 uClips[32];
      uniform float uTime;
      vec3 paper(vec2 p) {
        vec2 uv = p / uSize;
        vec3 color = vec3(0.94, 0.955, 0.98);
        float t = uTime * 0.35;
        vec2 f1 = vec2(sin(t * 0.5) * 0.08, cos(t * 0.4) * 0.06);
        vec2 f2 = vec2(cos(t * 0.3) * 0.06, sin(t * 0.6) * 0.08);

        float violet = exp(-length((uv - vec2(0.12, 0.18) - f1) * vec2(1.3, 0.9)) * 2.2);
        float blue = exp(-length((uv - vec2(0.88, 0.14) - f2) * vec2(1.1, 1.3)) * 2.3);
        float coral = exp(-length((uv - vec2(0.48, 0.88) + f1 * 0.8) * vec2(1.4, 0.9)) * 2.5);
        float mint = exp(-length((uv - vec2(0.92, 0.72) + f2 * 0.8) * vec2(0.9, 1.2)) * 2.8);

        color = mix(color, vec3(0.64, 0.48, 0.98), violet * 0.56);
        color = mix(color, vec3(0.20, 0.62, 0.98), blue * 0.62);
        color = mix(color, vec3(0.98, 0.44, 0.58), coral * 0.46);
        color = mix(color, vec3(0.15, 0.82, 0.68), mint * 0.40);

        vec2 arc = (p - vec2(uSize.x * 0.5, uSize.y * 0.3)) * vec2(0.85, 1.05);
        float phase = (length(arc) - uTime * 14.0) / 46.0;
        float ripple = 1.0 - smoothstep(0.012, 0.042, abs(fract(phase) - 0.5));
        color = mix(color, vec3(0.30, 0.52, 0.82), ripple * 0.08);

        return color;
      }
      float rounded(vec2 p, vec2 halfSize, float radius) {
        vec2 q = abs(p) - halfSize + radius;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }
      void main() {
        vec2 p = vec2(gl_FragCoord.x / uRatio, uSize.y - gl_FragCoord.y / uRatio);
        float nearest = 10000.0; vec4 row = vec4(0.0);
        for (int i = 0; i < 32; i++) {
          if (i >= uCount) break;
          vec4 clip = uClips[i];
          if (p.x < clip.x || p.y < clip.y || p.x > clip.z || p.y > clip.w) continue;
          vec4 r = uRows[i];
          float d = rounded(p - r.xy, r.zw * 0.5, 20.0);
          if (d < nearest) { nearest = d; row = r; }
        }
        vec3 color = paper(p);
        if (nearest < 0.0) {
          vec2 local = p - row.xy;
          vec2 q = abs(local) - row.zw * 0.5 + 20.0;
          vec2 n = (q.x > 0.0 && q.y > 0.0) ? normalize(q) * sign(local) : (q.x > q.y ? vec2(sign(local.x), 0.0) : vec2(0.0, sign(local.y)));
          float depth = -nearest;
          float bend = sin(clamp(depth / 20.0, 0.0, 1.0) * 3.14159265);

          // 核心三通道真实色散位移采样 (Spectral Chromatic Dispersion)
          vec2 rSample = row.xy + local * 0.993 - n * (bend * 16.5);
          vec2 gSample = row.xy + local * 0.993 - n * (bend * 13.0);
          vec2 bSample = row.xy + local * 0.993 - n * (bend * 9.5);

          float r = paper(rSample).r;
          float g = paper(gSample).g;
          float b = paper(bSample).b;
          color = vec3(r, g, b);

          color = mix(color, vec3(1.0), 0.10);
          float light = dot(n, normalize(vec2(-0.65, -1.0))) * 0.5 + 0.5;
          float rim = exp(-depth / 2.0);
          color += rim * (light * 0.16 - 0.02);
          color += exp(-depth / 6.5) * bend * 0.025 * vec3(0.3, 0.6, 1.0);
          color = mix(paper(p) * 0.965, color, smoothstep(0.0, 0.88, depth));
        } else if (nearest < 8.0) {
          color *= 1.0 - exp(-nearest / 2.5) * 0.04;
          color += exp(-nearest / 2.0) * 0.02 * vec3(0.5, 0.7, 1.0);
        }
        gl_FragColor = vec4(color, 1.0);
      }`);
    program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'aPosition'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    locations={size:gl.getUniformLocation(program,'uSize'),ratio:gl.getUniformLocation(program,'uRatio'),count:gl.getUniformLocation(program,'uCount'),rows:gl.getUniformLocation(program,'uRows[0]'),clips:gl.getUniformLocation(program,'uClips[0]'),time:gl.getUniformLocation(program,'uTime')};
  }
  function visibleRoot() {
    if (!document.querySelector('#fullPlayerOverlay').classList.contains('translate-y-full') && document.querySelector('#queueOverlay').classList.contains('translate-y-full')) return null;
    return [...roots].reverse().find(root => root.classList.contains('view-container') ? root.classList.contains('active') : !root.classList.contains('translate-y-full'));
  }
  function refreshRows() {
    rows = scene ? [...scene.querySelectorAll(rowSelector)].filter(row => row.querySelector('img') || row.classList.contains('jelly-glass') || row.id === 'discoverNoSourceBanner' || row.id === 'dailyRecCard') : [];
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
    gl.uniform1i(locations.count,count);gl.uniform4fv(locations.rows,rectangles);gl.uniform4fv(locations.clips,clips);
    if (locations.time) gl.uniform1f(locations.time, (now || performance.now()) * 0.001);
    gl.drawArrays(gl.TRIANGLES,0,6);
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
