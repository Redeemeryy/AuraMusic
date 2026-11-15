(() => {
  if (!window.ResizeObserver || !CSS.supports('backdrop-filter', 'url(#glass-lens)')) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  document.body.append(svg);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  const displacementRange = 20;
  function makeLensMap(width, height, radius) {
    // A half-resolution map is enough for the smooth gradient across the bevel.
    canvas.width = Math.ceil(width / 2);
    canvas.height = Math.ceil(height / 2);
    const map = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const localX = (x + 0.5) * width / canvas.width - width / 2;
        const localY = (y + 0.5) * height / canvas.height - height / 2;
        const edgeX = Math.abs(localX) - width / 2 + radius;
        const edgeY = Math.abs(localY) - height / 2 + radius;
        const corner = Math.hypot(Math.max(edgeX, 0), Math.max(edgeY, 0));
        const depth = radius - corner - Math.min(Math.max(edgeX, edgeY), 0);
        const bevel = Math.sin(Math.PI * Math.min(Math.max(depth / 14, 0), 1));
        const nx = corner ? Math.max(edgeX, 0) / corner : Number(edgeX > edgeY);
        const ny = corner ? Math.max(edgeY, 0) / corner : Number(edgeY >= edgeX);
        const displacement = bevel * 8 / displacementRange;
        const pixel = (y * canvas.width + x) * 4;
        map.data[pixel] = 255 * (0.5 - Math.sign(localX) * nx * displacement);
        map.data[pixel + 1] = 255 * (0.5 - Math.sign(localY) * ny * displacement);
        map.data[pixel + 3] = 255;
      }
    }
    context.putImageData(map, 0, 0);
    return canvas.toDataURL();
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

    const resize = new ResizeObserver(() => {
      const { offsetWidth: width, offsetHeight: height } = surface;
      if (!width || !height) return;
      const corner = parseFloat(getComputedStyle(surface).borderTopLeftRadius);
      const radius = Math.min(corner, width / 2, height / 2);
      image.setAttribute('href', makeLensMap(width, height, radius));
      surface.style.setProperty('--glass-lens', 'url(#' + filter.id + ')');
      surface.classList.add('has-glass-lens');
    });
    resize.observe(surface, { box: 'border-box' });
  });
})();
