(function () {
  const levels = Array.isArray(window.MC_LEVELS) ? window.MC_LEVELS : [];
  window.MC_LEVELS = levels;

  window.registerMinecraftLevel = function registerMinecraftLevel(level) {
    if (!level || typeof level !== 'object' || !level.id) {
      return;
    }
    const idx = levels.findIndex((item) => item && item.id === level.id);
    if (idx >= 0) {
      levels[idx] = level;
    } else {
      levels.push(level);
    }
  };
})();
