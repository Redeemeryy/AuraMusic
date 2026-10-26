/* Decode first, then crossfade two composited layers. Keep the previous artwork
 * visible on slow networks; a newer request always supersedes an older load. */
(() => {
  const player = document.getElementById('fullPlayerOverlay');
  const host = document.createElement('div');
  host.className = 'player-artwork-backdrop';
  host.setAttribute('aria-hidden', 'true');
  player.prepend(host);
  let generation = 0, desired = '', current = '', pending = null, fading = false;
  const reduce = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function display() {
    if (fading || !pending) return;
    const {url, generation: version} = pending;
    pending = null;
    if (version !== generation || current === url) return;
    const layer = document.createElement('div');
    layer.className = 'player-artwork-layer';
    layer.style.backgroundImage = `url(${JSON.stringify(url)})`;
    const previous = [...host.children];
    host.appendChild(layer);
    fading = true;
    if (previous.length && !reduce()) {
      const animation = layer.animate([{opacity: 0}, {opacity: 1}], {duration: 900, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both'});
      try { await animation.finished; } catch (_) { /* preference changed */ }
      animation.cancel();
    }
    previous.forEach(node => node.remove());
    current = url;
    host.dataset.artwork = url;
    fading = false;
    display();
  }
  async function setArtwork(url, fallback) {
    if (!url || desired === url) return;
    desired = url;
    const version = ++generation;
    pending = null;
    async function decoded(source) {
      const image = new Image(); image.src = source;
      await image.decode(); return source;
    }
    let loaded;
    try { loaded = await decoded(url); }
    catch (_) {
      if (version !== generation) return;
      try { loaded = await decoded(fallback); } catch (_) { if (version === generation) desired = ''; return; }
    }
    if (version !== generation) return;
    pending = {url: loaded, generation: version};
    display();
  }
  const finishIfReduced = () => { if (reduce()) host.getAnimations({subtree: true}).forEach(a => a.finish()); };
  new MutationObserver(finishIfReduced).observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', finishIfReduced);
  window.AuraBackdrop = { setArtwork };
})();
