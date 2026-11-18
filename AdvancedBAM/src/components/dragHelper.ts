/**
 * Calculates physical pixels per rem unit in Cities: Skylines 2 Cohtml.
 * In CS2 Cohtml, the virtual canvas height is anchored to 1080rem.
 * At 1080p, 1rem = 1.0px (1080 / 1080).
 * At 1440p, 1rem = 1.333333px (1440 / 1080).
 * At 4K, 1rem = 2.0px (2160 / 1080).
 */
export const getPixelsPerRem = (): number => {
  if (typeof window !== 'undefined' && window.innerHeight > 0) {
    return window.innerHeight / 1080;
  }
  return 1.0;
};

// Deprecated overlay helpers kept as safe no-ops
export const startGlobalDrag = (): void => {};
export const stopGlobalDrag = (): void => {};
