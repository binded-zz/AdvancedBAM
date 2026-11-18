import bamStorage from './bamStorage';

export type HousingDensityMode = 'standard' | 'detailed';

export type ZoneMatrixCategory =
  | 'housing'
  | 'commercial'
  | 'office'
  | 'industrial'
  | 'storage'
  | 'service'
  | 'signature';
export type DistrictMatrixLayout = 'switcher' | 'stacked';

export const ALL_ZONE_MATRIX_CATEGORIES: ZoneMatrixCategory[] = [
  'housing',
  'commercial',
  'office',
  'industrial',
  'storage',
  'service',
  'signature',
];

export interface ZoneMatrixSettings {
  // Master category enables
  enableHousing: boolean;
  enableCommercial: boolean;
  enableOffice: boolean;
  enableIndustrial: boolean;
  enableStorage: boolean;
  enableService: boolean;
  enableSignature: boolean;
  // Option 1: Expanded District & City-Wide details card
  inDistricts: boolean;
  districtsLayout: DistrictMatrixLayout;
  // Option 2: Districts sub-view switcher
  subviewMode: boolean;
  // Option 3: Top-level category tabs (unified + individual)
  topTabUnified: boolean;
  topTabHousing: boolean;
  topTabCommercial: boolean;
  topTabOffice: boolean;
  topTabIndustrial: boolean;
  topTabStorage: boolean;
  topTabService: boolean;
  topTabSignature: boolean;
  // Option 4: Compact inline matrix above Explorer table
  inResidential: boolean;
  inCommercial: boolean;
  inOffice: boolean;
  inIndustrial: boolean;
  inStorage: boolean;
  inService: boolean;
  inSignature: boolean;
  // Special inclusions
  includeMixedGroundFloor: boolean;
  includeIndustrialSpecials: boolean;
  includeServiceUpgrades: boolean;
}

export const ZONE_MATRIX_SETTING_KEYS = {
  enableHousing: 'bam_setting_zone_enable_housing',
  enableCommercial: 'bam_setting_zone_enable_commercial',
  enableOffice: 'bam_setting_zone_enable_office',
  enableIndustrial: 'bam_setting_zone_enable_industrial',
  enableStorage: 'bam_setting_zone_enable_storage',
  enableService: 'bam_setting_zone_enable_service',
  enableSignature: 'bam_setting_zone_enable_signature',
  inDistricts: 'bam_setting_housing_in_districts',
  districtsLayout: 'bam_setting_zone_districts_layout',
  subviewMode: 'bam_setting_housing_subview_mode',
  topTabUnified: 'bam_setting_zone_top_tab_unified',
  topTabHousing: 'bam_setting_housing_top_tab',
  topTabCommercial: 'bam_setting_zone_top_tab_commercial',
  topTabOffice: 'bam_setting_zone_top_tab_office',
  topTabIndustrial: 'bam_setting_zone_top_tab_industrial',
  topTabStorage: 'bam_setting_zone_top_tab_storage',
  topTabService: 'bam_setting_zone_top_tab_service',
  topTabSignature: 'bam_setting_zone_top_tab_signature',
  inResidential: 'bam_setting_housing_in_residential',
  inCommercial: 'bam_setting_zone_in_commercial',
  inOffice: 'bam_setting_zone_in_office',
  inIndustrial: 'bam_setting_zone_in_industrial',
  inStorage: 'bam_setting_zone_in_storage',
  inService: 'bam_setting_zone_in_service',
  inSignature: 'bam_setting_zone_in_signature',
  includeMixedGroundFloor: 'bam_setting_zone_include_mixed_ground_floor',
  includeIndustrialSpecials: 'bam_setting_zone_include_industrial_specials',
  includeServiceUpgrades: 'bam_setting_zone_include_service_upgrades',
  matrixMode: 'bam_housing_matrix_mode',
  activeCategory: 'bam_zone_matrix_active_category',
} as const;

export const ALL_ZONE_SETTING_STORAGE_KEYS: readonly string[] = Array.from(
  new Set(Object.values(ZONE_MATRIX_SETTING_KEYS))
);

export const DEFAULT_ZONE_MATRIX_SETTINGS: ZoneMatrixSettings = {
  enableHousing: true,
  enableCommercial: true,
  enableOffice: true,
  enableIndustrial: true,
  enableStorage: true,
  enableService: true,
  enableSignature: true,
  inDistricts: true,
  districtsLayout: 'switcher',
  subviewMode: true,
  topTabUnified: true,
  topTabHousing: false,
  topTabCommercial: false,
  topTabOffice: false,
  topTabIndustrial: false,
  topTabStorage: false,
  topTabService: false,
  topTabSignature: false,
  inResidential: true,
  inCommercial: true,
  inOffice: true,
  inIndustrial: true,
  inStorage: true,
  inService: true,
  inSignature: true,
  includeMixedGroundFloor: true,
  includeIndustrialSpecials: true,
  includeServiceUpgrades: true,
};

function readBool(storageKey: string, defaultValue: boolean): boolean {
  try {
    const raw = bamStorage.getItem(storageKey);
    if (raw === null) return defaultValue;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // Ignore storage errors inside Cohtml private/locked contexts
  }
  return defaultValue;
}

function readDistrictLayout(storageKey: string, defaultValue: DistrictMatrixLayout): DistrictMatrixLayout {
  try {
    const raw = bamStorage.getItem(storageKey);
    if (raw === 'stacked' || raw === 'switcher') return raw;
  } catch {
    // Ignore
  }
  return defaultValue;
}

function dispatchSettingsChanged(key: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent('bam-settings-changed', {
        detail: { key },
      })
    );
  } catch {
    // Ignore event dispatch failure
  }
}

export function readZoneMatrixSettings(): ZoneMatrixSettings {
  return {
    enableHousing: readBool(ZONE_MATRIX_SETTING_KEYS.enableHousing, DEFAULT_ZONE_MATRIX_SETTINGS.enableHousing),
    enableCommercial: readBool(ZONE_MATRIX_SETTING_KEYS.enableCommercial, DEFAULT_ZONE_MATRIX_SETTINGS.enableCommercial),
    enableOffice: readBool(ZONE_MATRIX_SETTING_KEYS.enableOffice, DEFAULT_ZONE_MATRIX_SETTINGS.enableOffice),
    enableIndustrial: readBool(ZONE_MATRIX_SETTING_KEYS.enableIndustrial, DEFAULT_ZONE_MATRIX_SETTINGS.enableIndustrial),
    enableStorage: readBool(ZONE_MATRIX_SETTING_KEYS.enableStorage, DEFAULT_ZONE_MATRIX_SETTINGS.enableStorage),
    enableService: readBool(ZONE_MATRIX_SETTING_KEYS.enableService, DEFAULT_ZONE_MATRIX_SETTINGS.enableService),
    enableSignature: readBool(ZONE_MATRIX_SETTING_KEYS.enableSignature, DEFAULT_ZONE_MATRIX_SETTINGS.enableSignature),
    inDistricts: readBool(ZONE_MATRIX_SETTING_KEYS.inDistricts, DEFAULT_ZONE_MATRIX_SETTINGS.inDistricts),
    districtsLayout: readDistrictLayout(ZONE_MATRIX_SETTING_KEYS.districtsLayout, DEFAULT_ZONE_MATRIX_SETTINGS.districtsLayout),
    subviewMode: readBool(ZONE_MATRIX_SETTING_KEYS.subviewMode, DEFAULT_ZONE_MATRIX_SETTINGS.subviewMode),
    topTabUnified: readBool(ZONE_MATRIX_SETTING_KEYS.topTabUnified, DEFAULT_ZONE_MATRIX_SETTINGS.topTabUnified),
    topTabHousing: readBool(ZONE_MATRIX_SETTING_KEYS.topTabHousing, DEFAULT_ZONE_MATRIX_SETTINGS.topTabHousing),
    topTabCommercial: readBool(ZONE_MATRIX_SETTING_KEYS.topTabCommercial, DEFAULT_ZONE_MATRIX_SETTINGS.topTabCommercial),
    topTabOffice: readBool(ZONE_MATRIX_SETTING_KEYS.topTabOffice, DEFAULT_ZONE_MATRIX_SETTINGS.topTabOffice),
    topTabIndustrial: readBool(ZONE_MATRIX_SETTING_KEYS.topTabIndustrial, DEFAULT_ZONE_MATRIX_SETTINGS.topTabIndustrial),
    topTabStorage: readBool(ZONE_MATRIX_SETTING_KEYS.topTabStorage, DEFAULT_ZONE_MATRIX_SETTINGS.topTabStorage),
    topTabService: readBool(ZONE_MATRIX_SETTING_KEYS.topTabService, DEFAULT_ZONE_MATRIX_SETTINGS.topTabService),
    topTabSignature: readBool(ZONE_MATRIX_SETTING_KEYS.topTabSignature, DEFAULT_ZONE_MATRIX_SETTINGS.topTabSignature),
    inResidential: readBool(ZONE_MATRIX_SETTING_KEYS.inResidential, DEFAULT_ZONE_MATRIX_SETTINGS.inResidential),
    inCommercial: readBool(ZONE_MATRIX_SETTING_KEYS.inCommercial, DEFAULT_ZONE_MATRIX_SETTINGS.inCommercial),
    inOffice: readBool(ZONE_MATRIX_SETTING_KEYS.inOffice, DEFAULT_ZONE_MATRIX_SETTINGS.inOffice),
    inIndustrial: readBool(ZONE_MATRIX_SETTING_KEYS.inIndustrial, DEFAULT_ZONE_MATRIX_SETTINGS.inIndustrial),
    inStorage: readBool(ZONE_MATRIX_SETTING_KEYS.inStorage, DEFAULT_ZONE_MATRIX_SETTINGS.inStorage),
    inService: readBool(ZONE_MATRIX_SETTING_KEYS.inService, DEFAULT_ZONE_MATRIX_SETTINGS.inService),
    inSignature: readBool(ZONE_MATRIX_SETTING_KEYS.inSignature, DEFAULT_ZONE_MATRIX_SETTINGS.inSignature),
    includeMixedGroundFloor: readBool(
      ZONE_MATRIX_SETTING_KEYS.includeMixedGroundFloor,
      DEFAULT_ZONE_MATRIX_SETTINGS.includeMixedGroundFloor
    ),
    includeIndustrialSpecials: readBool(
      ZONE_MATRIX_SETTING_KEYS.includeIndustrialSpecials,
      DEFAULT_ZONE_MATRIX_SETTINGS.includeIndustrialSpecials
    ),
    includeServiceUpgrades: readBool(
      ZONE_MATRIX_SETTING_KEYS.includeServiceUpgrades,
      DEFAULT_ZONE_MATRIX_SETTINGS.includeServiceUpgrades
    ),
  };
}

export function writeZoneMatrixSetting<K extends keyof ZoneMatrixSettings>(
  field: K,
  value: ZoneMatrixSettings[K]
): ZoneMatrixSettings {
  const storageKey = ZONE_MATRIX_SETTING_KEYS[field];
  try {
    bamStorage.setItem(storageKey, String(value));
  } catch {
    // Ignore storage errors inside Cohtml private/locked contexts
  }
  const next = readZoneMatrixSettings();
  dispatchSettingsChanged(storageKey);
  return next;
}

export function getEnabledMatrixCategories(settings: ZoneMatrixSettings): ZoneMatrixCategory[] {
  const out: ZoneMatrixCategory[] = [];
  if (settings.enableHousing) out.push('housing');
  if (settings.enableCommercial) out.push('commercial');
  if (settings.enableOffice) out.push('office');
  if (settings.enableIndustrial) out.push('industrial');
  if (settings.enableStorage) out.push('storage');
  if (settings.enableService) out.push('service');
  if (settings.enableSignature) out.push('signature');
  return out;
}

export function readHousingDensityMode(): HousingDensityMode {
  try {
    const raw = bamStorage.getItem(ZONE_MATRIX_SETTING_KEYS.matrixMode);
    if (raw === 'detailed' || raw === 'standard') return raw;
  } catch {
    // Ignore storage errors
  }
  return 'standard';
}

export function writeHousingDensityMode(mode: HousingDensityMode): void {
  try {
    bamStorage.setItem(ZONE_MATRIX_SETTING_KEYS.matrixMode, mode);
    dispatchSettingsChanged(ZONE_MATRIX_SETTING_KEYS.matrixMode);
  } catch {
    // Ignore storage errors
  }
}

export function readActiveZoneMatrixCategory(enabledCategories?: ZoneMatrixCategory[]): ZoneMatrixCategory {
  const allowed = enabledCategories && enabledCategories.length > 0 ? enabledCategories : ALL_ZONE_MATRIX_CATEGORIES;
  try {
    const raw = bamStorage.getItem(ZONE_MATRIX_SETTING_KEYS.activeCategory) as ZoneMatrixCategory | null;
    if (raw && allowed.includes(raw)) return raw;
  } catch {
    // Ignore
  }
  return allowed[0] || 'housing';
}

export function writeActiveZoneMatrixCategory(category: ZoneMatrixCategory): void {
  try {
    bamStorage.setItem(ZONE_MATRIX_SETTING_KEYS.activeCategory, category);
    dispatchSettingsChanged(ZONE_MATRIX_SETTING_KEYS.activeCategory);
  } catch {
    // Ignore
  }
}

export type StorageKindBucket = 'warehouse' | 'silo_tank';

export const STORAGE_HUB_GROUP_WAREHOUSE = 'Warehouses & Depots';
export const STORAGE_HUB_GROUP_SILO_TANK = 'Silos, Tanks & Yards';

export function classifyStorageKind(item: {
  name?: string;
  prefabName?: string;
  subCategory?: string;
}): StorageKindBucket {
  const txt = `${item.prefabName || ''} ${item.name || ''} ${item.subCategory || ''}`.toLowerCase();
  if (
    /\b(silo|tank|yard|pile|bunker|hopper|cistern|reservoir|bulk|liquid|grain|ore|coal|crude|oil|petro|timber|log|rock|stone|mineral)s?\b/.test(
      txt
    )
  ) {
    return 'silo_tank';
  }
  return 'warehouse';
}
