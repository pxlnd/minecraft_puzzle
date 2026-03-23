(function () {
  const levels = Array.isArray(window.MC_LEVELS) ? window.MC_LEVELS : [];
  window.MC_LEVELS = levels;

  function detectCurrentScriptPath() {
    if (!document || !document.currentScript) {
      return '';
    }
    const scriptSrc = document.currentScript.src || '';
    if (!scriptSrc) {
      return '';
    }
    try {
      return new URL(scriptSrc, window.location.href).pathname || '';
    } catch (_) {
      return scriptSrc;
    }
  }

  window.registerMinecraftLevel = function registerMinecraftLevel(level) {
    if (!level || typeof level !== 'object' || !level.id) {
      return;
    }
    const sourcePath = detectCurrentScriptPath();
    if (sourcePath) {
      level.__sourcePath = sourcePath;
    }
    const idx = levels.findIndex((item) => item && item.id === level.id);
    if (idx >= 0) {
      levels[idx] = level;
    } else {
      levels.push(level);
    }
  };
})();
