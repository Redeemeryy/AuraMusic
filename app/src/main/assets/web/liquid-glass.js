(() => {
  if (!window.ResizeObserver || !CSS.supports('backdrop-filter', 'url(#glass-lens)')) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  document.body.append(svg);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  const displacementRange = 32;
  const lensCache = new Map();
  const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

  // Exact rounded-box SDF (distance <= 0 inside shape)
  function roundedRectSdf(px, py, halfW, halfH, radius) {
    const qx = Math.abs(px) - (halfW - radius);
    const qy = Math.abs(py) - (halfH - radius);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  }

  // Convex crystal bezel optical height & smoothstep rim slope (childrentime/liquid-glass SDF optics)
  function makeLensMap(width, height, radius) {
    const cacheKey = `${Math.round(width)}x${Math.round(height)}x${Math.round(radius)}`;
    const cached = lensCache.get(cacheKey);
    if (cached) return cached;

    const scaleDown = Math.max(width, height) > 220 ? 2 : 1;
    canvas.width = Math.max(2, Math.ceil(width / scaleDown));
    canvas.height = Math.max(2, Math.ceil(height / scaleDown));
    const map = context.createImageData(canvas.width, canvas.height);

    const halfW = width / 2;
    const halfH = height / 2;
    const minSide = Math.min(width, height);
    const r = clamp(radius, 0, minSide / 2);
    const bevelWidth = clamp(minSide * 0.44, 14, 30);

    for (let y = 0; y < canvas.height; y++) {
      const localY = (y + 0.5) * height / canvas.height - halfH;
      for (let x = 0; x < canvas.width; x++) {
        const localX = (x + 0.5) * width / canvas.width - halfW;
        const dist = roundedRectSdf(localX, localY, halfW, halfH, r);
        const depth = Math.max(0, -dist);

        // Smooth C1 normal from finite difference of the SDF
        let gx = roundedRectSdf(localX + 1, localY, halfW, halfH, r) - roundedRectSdf(localX - 1, localY, halfW, halfH, r);
        let gy = roundedRectSdf(localX, localY + 1, halfW, halfH, r) - roundedRectSdf(localX, localY - 1, halfW, halfH, r);
        const gLen = Math.hypot(gx, gy) || 1;
        gx /= gLen;
        gy /= gLen;

        // Convex liquid-glass edge profile: smooth taper at 1px perimeter, peak crystal refraction in shoulder, gentle center lensing
        const t = clamp(depth / bevelWidth, 0, 1);
        const s = 1 - t;
        const smoothRim = s * s * (3 - 2 * s);
        const outerAntiAlias = clamp(depth / 1.5, 0, 1);
        const rimProfile = outerAntiAlias * (Math.sin(t * Math.PI * 0.92) * 0.52 + smoothRim * 0.34);
        const coreLens = 0.055 * outerAntiAlias;
        const shiftNorm = clamp((rimProfile * 22 + coreLens * minSide * 0.08) / displacementRange, 0, 0.96);

        const pixel = (y * canvas.width + x) * 4;
        map.data[pixel] = Math.round(127.5 - gx * shiftNorm * 127.5);
        map.data[pixel + 1] = Math.round(127.5 - gy * shiftNorm * 127.5);
        map.data[pixel + 2] = 128;
        map.data[pixel + 3] = 255;
      }
    }

    context.putImageData(map, 0, 0);
    const dataUrl = canvas.toDataURL();
    if (lensCache.size > 40) lensCache.clear();
    lensCache.set(cacheKey, dataUrl);
    return dataUrl;
  }

  document.querySelectorAll('[data-glass-lens]').forEach((surface, index) => {
    const filter = document.createElementNS(svgNamespace, 'filter');
    filter.id = 'aura-glass-lens-' + index;
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const image = document.createElementNS(svgNamespace, 'feImage');
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', 'lens-map');
    const displace = document.createElementNS(svgNamespace, 'feDisplacementMap');
    displace.setAttribute('in', 'SourceGraphic');
    displace.setAttribute('in2', 'lens-map');
    displace.setAttribute('xChannelSelector', 'R');
    displace.setAttribute('yChannelSelector', 'G');
    displace.setAttribute('scale', String(displacementRange));
    filter.append(image, displace);
    svg.append(filter);

    let lastSizeKey = '';
    const resize = new ResizeObserver(() => {
      const width = surface.offsetWidth;
      const height = surface.offsetHeight;
      if (!width || !height) return;
      const computed = getComputedStyle(surface);
      const corner = parseFloat(computed.borderTopLeftRadius) || height / 2;
      const radius = Math.min(corner, width / 2, height / 2);
      const sizeKey = `${width}x${height}x${Math.round(radius)}`;
      if (sizeKey === lastSizeKey) return;
      lastSizeKey = sizeKey;
      image.setAttribute('href', makeLensMap(width, height, radius));
      surface.style.setProperty('--glass-lens', 'url(#' + filter.id + ')');
      surface.classList.add('has-glass-lens');
    });
    resize.observe(surface, { box: 'border-box' });
  });
})();
