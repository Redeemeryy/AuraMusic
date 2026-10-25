(function (root) {
  function createPreferences(storage) {
    const defaults = { playMode: 'sequence', reduceMotion: false, reduceTransparency: false };
    function normalize(value) {
      value = value && typeof value === 'object' ? value : {};
      return {
        playMode: ['sequence', 'loop', 'shuffle'].includes(value.playMode) ? value.playMode : 'sequence',
        reduceMotion: value.reduceMotion === true,
        reduceTransparency: value.reduceTransparency === true
      };
    }
    let current = { ...defaults };
    try { current = normalize(JSON.parse(storage.getItem('aura_preferences'))); } catch (_) {}
    return {
      get: () => ({ ...current }),
      set(change) {
        current = normalize({ ...current, ...change });
        try { storage.setItem('aura_preferences', JSON.stringify(current)); } catch (_) {}
        return { ...current };
      },
      clearHistory() { storage.removeItem('jelly_history'); }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createPreferences };
  if (root.document) {
    let storage;
    try { storage = root.localStorage; } catch (_) { storage = null; }
    root.AuraPreferences = createPreferences(storage);
    root.applyAppearancePreferences = function () {
      const prefs = root.AuraPreferences.get();
      root.document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion);
      root.document.documentElement.classList.toggle('reduce-transparency', prefs.reduceTransparency);
    };
    root.applyAppearancePreferences();
  }
})(typeof window === 'undefined' ? globalThis : window);
