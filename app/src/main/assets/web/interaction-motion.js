/* Delegated feedback also covers dynamically rendered songs and dialogs. */
(() => {
  const selector = 'button, [role="button"], #miniPlayerContent';
  const running = new WeakMap();
  const released = new WeakMap();
  const reduced = () => document.documentElement.classList.contains('reduce-motion') ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  let press;
  function animate(element, frames, duration, easing, { hold = false, property = 'scale' } = {}) {
    const start = getComputedStyle(element).getPropertyValue(property).trim();
    running.get(element)?.cancel();
    if (reduced()) return;
    const animation = element.animate([{ [property]: start === 'none' ? '1' : start }, ...frames], { duration, easing, fill: 'forwards' });
    running.set(element, animation);
    animation.onfinish = () => { if (hold) return; animation.cancel(); if (running.get(element) === animation) running.delete(element); };
  }
  function end(cancelled = false) {
    if (!press) return;
    const { element } = press;
    press = null;
    element.classList.remove('aura-pressed');
    released.set(element, performance.now());
    animate(element, cancelled ? [{ scale: '1' }] : [{ scale: '1.015', offset: .55 }, { scale: '1' }], cancelled ? 125 : 240, 'cubic-bezier(.2,.75,.25,1)');
  }
  document.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    const element = e.target.closest(selector);
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return;
    end(true);
    press = { element, x: e.clientX, y: e.clientY, id: e.pointerId };
    const surface = element.closest('.glass-surface') || element;
    const rect = surface.getBoundingClientRect();
    surface.style.setProperty('--press-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    surface.style.setProperty('--press-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    element.classList.add('aura-pressed');
    animate(element, [{ scale: '.975' }], 95, 'cubic-bezier(.2,.8,.2,1)', { hold: true });
  }, { passive: true, capture: true });
  document.addEventListener('pointermove', e => {
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) end(true);
  }, { passive: true, capture: true });
  document.addEventListener('pointerup', () => end(), { passive: true, capture: true });
  document.addEventListener('pointercancel', () => end(true), { passive: true, capture: true });
  window.addEventListener('blur', () => end(true));
  document.addEventListener('click', e => {
    const element = e.target.closest(selector);
    if (!element || element.disabled || performance.now() - (released.get(element) ?? -Infinity) < 450 || reduced()) return;
    animate(element, [{ scale: '.975', offset: .25 }, { scale: '1.015', offset: .65 }, { scale: '1' }], 250, 'cubic-bezier(.2,.75,.25,1)');
  }, true);

  const nav = document.querySelector('.nav-glass-bar');
  const selection = nav.querySelector('.nav-selection');
  let selected = nav.style.getPropertyValue('--nav-selection-index');
  new MutationObserver(() => {
    const next = nav.style.getPropertyValue('--nav-selection-index');
    if (next === selected) return;
    selected = next;
    if (nav.classList.contains('is-scrubbing')) return;
    animate(selection, [{ '--nav-elongation': '1.09', offset: .4 }, { '--nav-elongation': '1' }],
      260, 'cubic-bezier(.22,.78,.25,1)', { property: '--nav-elongation' });
  }).observe(nav, { attributes: true, attributeFilter: ['style'] });

  function stopWhenReduced() {
    if (!reduced()) return;
    document.getAnimations().forEach(animation => {
      const element = animation.effect?.target;
      if (element && running.get(element) === animation) animation.cancel();
    });
  }
  new MutationObserver(stopWhenReduced).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', stopWhenReduced);
})();
