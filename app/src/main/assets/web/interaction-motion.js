/* Delegated feedback also covers dynamically rendered songs and dialogs. */
(() => {
  const selector = 'button, [role="button"], .nav-item';
  const running = new WeakMap();
  const released = new WeakMap();
  const reduced = () => document.documentElement.classList.contains('reduce-motion') ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  let press;
  function animate(element, frames, duration, easing, hold = false) {
    const start = getComputedStyle(element).scale;
    running.get(element)?.cancel();
    if (reduced()) return;
    const animation = element.animate([{ scale: start === 'none' ? '1' : start }, ...frames], { duration, easing, fill: 'forwards' });
    running.set(element, animation);
    animation.onfinish = () => { if (hold) return; animation.cancel(); if (running.get(element) === animation) running.delete(element); };
  }
  function end(cancelled = false) {
    if (!press) return;
    const { element } = press;
    press = null;
    element.classList.remove('aura-pressed');
    released.set(element, performance.now());
    animate(element, cancelled ? [{ scale: '1' }] : [{ scale: '1.035', offset: .48 }, { scale: '.995', offset: .76 }, { scale: '1' }], cancelled ? 140 : 360, 'cubic-bezier(.2,.75,.25,1)');
  }
  document.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    const element = e.target.closest(selector);
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return;
    end(true);
    press = { element, x: e.clientX, y: e.clientY, id: e.pointerId };
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--press-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    element.style.setProperty('--press-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    element.classList.add('aura-pressed');
    animate(element, [{ scale: element.matches('[role="button"]') ? '.975' : '.90' }], 95, 'cubic-bezier(.2,.8,.2,1)', true);
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
    animate(element, [{ scale: '.92', offset: .2 }, { scale: '1.035', offset: .6 }, { scale: '1' }], 380, 'cubic-bezier(.2,.75,.25,1)');
  }, true);
  new MutationObserver(() => {
    if (!reduced()) return;
    document.getAnimations().forEach(animation => {
      const element = animation.effect?.target;
      if (element && running.get(element) === animation) animation.cancel();
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();
