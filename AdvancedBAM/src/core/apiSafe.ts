import { trigger as csTrigger, useValue as csUseValue } from 'cs2/api';
import { BAM_GROUP, CHANNELS } from './channels';
import { logCatch } from '../utils/devWarn';

/**
 * Crash-proof accessor returning `defaultValue` if `value` is null or undefined.
 */
export function getSafeValue<T>(value: T | undefined | null, defaultValue: T): T {
  return value !== undefined && value !== null ? value : defaultValue;
}

/**
 * Validates a color string to prevent Cohtml styling crashes.
 */
export function getSafeColor(color: any, fallback: string = '#EAEAEA'): string {
  if (!color || typeof color !== 'string') return fallback;
  const s = color.trim().toLowerCase();
  if (s === 'inherit' || s === 'initial' || s === 'unset') return fallback;
  if (s === 'transparent') return 'rgba(0,0,0,0)';
  if (s.length < 3 || s === 'undefined' || s === 'null' || s === 'nan') return fallback;

  const original = color.trim();
  if (
    original.startsWith('#') ||
    original.startsWith('rgb') ||
    original.startsWith('hsl') ||
    original.startsWith('var(') ||
    /^[a-zA-Z]+$/.test(original)
  ) {
    return original;
  }
  return fallback;
}

/**
 * Safe trigger wrapper that catches any exception during native dispatch.
 */
export function safeTrigger(group: string, name: string, ...args: any[]): void {
  try {
    if (typeof window !== 'undefined' && ((window as any).__BAM_DEBUG_CONSOLE__ || (window as any).__DEBUG__)) {
      console.log(`[BAM-API] trigger -> ${group}.${name}`, args);
    }
    csTrigger(group, name, ...args);
  } catch (err) {
    logCatch(`apiSafe.safeTrigger(${group}.${name})`, err);
    try {
      if (typeof window !== 'undefined' && (window as any).engine && typeof (window as any).engine.trigger === 'function') {
        (window as any).engine.trigger(`${group}.${name}`, ...args);
      }
    } catch (e2) {
      logCatch(`apiSafe.engineTriggerFallback(${group}.${name})`, e2);
    }
  }
}

/**
 * Safe useValue hook that guards against undefined bindings or stubs.
 */
export function safeUseValue<T>(binding: any, defaultValue?: T): T {
  if (!binding || (binding as any).__stub) {
    return (binding && (binding as any).__defaultValue !== undefined ? (binding as any).__defaultValue : defaultValue) as T;
  }
  try {
    const val = csUseValue(binding);
    return (val !== undefined && val !== null ? val : defaultValue) as T;
  } catch (err) {
    try {
      return (binding && binding.value !== undefined ? binding.value : defaultValue) as T;
    } catch (e2) {
      logCatch('apiSafe.safeUseValue', e2);
      return defaultValue as T;
    }
  }
}

export const apiSafe = {
  trigger: safeTrigger,
  useValue: safeUseValue,
  getSafeValue,
  getSafeColor,

  // High-level mod actions
  toggleWindow: () => safeTrigger(BAM_GROUP, CHANNELS.TOGGLE_WINDOW),
  setWindowVisible: (visible: boolean) => safeTrigger(BAM_GROUP, CHANNELS.SET_WINDOW_VISIBLE, visible),
  setWindowCollapsed: (collapsed: boolean) => safeTrigger(BAM_GROUP, CHANNELS.SET_WINDOW_COLLAPSED, collapsed),
  saveWindowRect: (x: number, y: number, w: number, h: number) => safeTrigger(BAM_GROUP, CHANNELS.SAVE_WINDOW_RECT, x, y, w, h),
  requestRefresh: () => safeTrigger(BAM_GROUP, CHANNELS.REQUEST_REFRESH),
  plopPrefab: (prefabKey: string) => safeTrigger(BAM_GROUP, CHANNELS.PLOP_PREFAB, prefabKey),
  cloneBuilding: (entityKey: string) => safeTrigger(BAM_GROUP, CHANNELS.CLONE_BUILDING, entityKey),
  rebuildBuilding: (entityKey: string) => safeTrigger(BAM_GROUP, CHANNELS.REBUILD_BUILDING, entityKey),
  rebuildAllBuildings: (category: string) => safeTrigger(BAM_GROUP, CHANNELS.REBUILD_ALL_BUILDINGS, category),
  toggleDistrictPolicy: (districtKey: string, policyKey: string, active: boolean, adjustment?: number) => {
    if (adjustment !== undefined && adjustment !== 0) {
      safeTrigger(BAM_GROUP, CHANNELS.TOGGLE_DISTRICT_POLICY_WITH_ADJUSTMENT, districtKey, policyKey, active, Number(adjustment));
    } else {
      safeTrigger(BAM_GROUP, CHANNELS.TOGGLE_DISTRICT_POLICY, districtKey, policyKey, active);
    }
  },
  setDistrictPolicyAdjustment: (districtKey: string, policyKey: string, adjustment: number) =>
    safeTrigger(BAM_GROUP, CHANNELS.SET_DISTRICT_POLICY_ADJUSTMENT, districtKey, policyKey, adjustment),
  applyPolicyToAllDistricts: (policyKey: string, active: boolean, adjustment: number = 0) =>
    safeTrigger(BAM_GROUP, CHANNELS.APPLY_POLICY_TO_ALL_DISTRICTS, policyKey, active, Number(adjustment)),
  copyDistrictPolicies: (sourceDistrictKey: string, targetDistrictKey: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.COPY_DISTRICT_POLICIES, sourceDistrictKey, targetDistrictKey),
  resetDistrictPolicies: (districtKey: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.RESET_DISTRICT_POLICIES, districtKey),

  renameDistrict: (districtKey: string, newName: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.RENAME_DISTRICT, districtKey, newName),
  renameAsset: (entityKey: string, newName: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.RENAME_ASSET, entityKey, newName),
  openInSceneExplorer: (entityKey: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.OPEN_IN_SCENE_EXPLORER, entityKey),
  openExternalUrl: (url: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.OPEN_EXTERNAL_URL, url),
  exportCsv: (csvContent: string, prefix: string = "BAM_FilteredAssets") =>
    safeTrigger(BAM_GROUP, CHANNELS.EXPORT_CSV, csvContent, prefix),
  setUiPref: (key: string, value: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.SET_UI_PREF, key, value),
  removeUiPref: (key: string) =>
    safeTrigger(BAM_GROUP, CHANNELS.REMOVE_UI_PREF, key),
  clearUiPrefs: (prefix: string = "") =>
    safeTrigger(BAM_GROUP, CHANNELS.CLEAR_UI_PREFS, prefix),
  log: (msg: string) => safeTrigger(BAM_GROUP, CHANNELS.UI_LOG, msg),
  error: (msg: string) => safeTrigger(BAM_GROUP, CHANNELS.UI_ERROR, msg),
};

export default apiSafe;
