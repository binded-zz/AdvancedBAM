/**
 * Centralized diagnostic error and warning logger for AdvancedBAM.
 * Routes caught exceptions through a structured channel so failures in
 * localStorage, JSON parsing, or ECS bindings are visible rather than silently swallowed.
 */
export const logCatch = (scope: string, err: unknown): void => {
  if (typeof window === 'undefined') return;
  const isDebug = Boolean(
    (window as any).__BAM_DEBUG_LOG_CATCHES__ ||
    (window as any).__BAM_DEBUG_CONSOLE__ ||
    (window as any).__DEBUG__
  );
  if (isDebug) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.warn(`[BAM:${scope}] ${msg}`);
  }
};

export default logCatch;

