/**
 * Single source of truth for C# <-> UI binding and trigger channel names.
 * Must match AdvancedBAM.Systems.BamChannels in C#.
 */
export const BAM_GROUP = "assetManager";

export const CHANNELS = {
  // ValueBindings (C# -> UI)
  WINDOW_VISIBLE: "windowVisible",
  LAUNCHER_VISIBLE: "launcherVisible",
  WINDOW_RECT: "windowRect",
  ROWS_PER_PAGE: "rowsPerPage",
  UNIFIED_ASSETS: "unifiedAssets",
  CATALOG_ASSETS: "catalogAssets",
  SERVICE_STATUS: "serviceStatus",
  INVENTORY_STATUS: "inventoryStatus",
  DISTRICTS_DATA: "districtsData",
  DISTRICT_POLICIES: "districtPolicies",
  IS_SCENE_EXPLORER_INSTALLED: "isSceneExplorerInstalled",
  FOCUSED_ENTITY_KEY: "focusedEntityKey",
  HAPPINESS_FACTOR_COUNT: "happinessFactorCount",
  HAPPINESS_FACTOR_FILTER: "happinessFactorFilter",
  UI_PREFS: "uiPrefs",

  // Triggers (UI -> C#)
  TOGGLE_WINDOW: "toggleWindow",
  SET_WINDOW_VISIBLE: "setWindowVisible",
  SET_WINDOW_COLLAPSED: "setWindowCollapsed",
  SAVE_WINDOW_RECT: "saveWindowRect",
  REQUEST_REFRESH: "requestRefresh",
  FOCUS_BUILDING_IN_BAM: "focusBuildingInBam",
  CLEAR_FOCUSED_ENTITY: "clearFocusedEntity",
  PLOP_PREFAB: "plopPrefab",
  CLONE_BUILDING: "cloneBuilding",
  REBUILD_BUILDING: "rebuildBuilding",
  REBUILD_ALL_BUILDINGS: "rebuildAllBuildings",
  TOGGLE_DISTRICT_POLICY: "toggleDistrictPolicy",
  TOGGLE_DISTRICT_POLICY_WITH_ADJUSTMENT: "toggleDistrictPolicyWithAdjustment",
  SET_DISTRICT_POLICY_ADJUSTMENT: "setDistrictPolicyAdjustment",
  APPLY_POLICY_TO_ALL_DISTRICTS: "applyPolicyToAllDistricts",
  COPY_DISTRICT_POLICIES: "copyDistrictPolicies",
  RESET_DISTRICT_POLICIES: "resetDistrictPolicies",
  RENAME_DISTRICT: "renameDistrict",
  RENAME_ASSET: "renameAsset",
  OPEN_IN_SCENE_EXPLORER: "openInSceneExplorer",
  OPEN_EXTERNAL_URL: "openExternalUrl",
  EXPORT_CSV: "exportCsv",
  SET_UI_PREF: "setUiPref",
  REMOVE_UI_PREF: "removeUiPref",
  CLEAR_UI_PREFS: "clearUiPrefs",

  UI_LOG: "uiLog",
  UI_ERROR: "uiError",
} as const;
