namespace AdvancedBAM.Systems
{
    /// <summary>
    /// Single source of truth for every C# &lt;-&gt; UI binding name.
    /// Mirror: AdvancedBAM/src/core/channels.ts
    /// </summary>
    public static class BamChannels
    {
        public const string Group = "assetManager";

        // ---- ValueBindings (C# -> UI) ----
        public const string WindowVisible = "windowVisible";
        public const string LauncherVisible = "launcherVisible";
        public const string WindowRect = "windowRect";
        public const string RowsPerPage = "rowsPerPage";
        public const string UnifiedAssets = "unifiedAssets";
        public const string CatalogAssets = "catalogAssets";
        public const string ServiceStatus = "serviceStatus";
        public const string InventoryStatus = "inventoryStatus";
        public const string DistrictsData = "districtsData";
        public const string DistrictPolicies = "districtPolicies";
        public const string IsSceneExplorerInstalled = "isSceneExplorerInstalled";
        public const string FocusedEntityKey = "focusedEntityKey";
        public const string HappinessFactorCount = "happinessFactorCount";
        public const string HappinessFactorFilter = "happinessFactorFilter";
        public const string UiPrefs = "uiPrefs";

        // ---- Triggers (UI -> C#) ----
        public const string ToggleWindow = "toggleWindow";
        public const string SetWindowVisible = "setWindowVisible";
        public const string SetWindowCollapsed = "setWindowCollapsed";
        public const string SaveWindowRect = "saveWindowRect";
        public const string RequestRefresh = "requestRefresh";
        public const string FocusBuildingInBam = "focusBuildingInBam";
        public const string ClearFocusedEntity = "clearFocusedEntity";
        public const string PlopPrefab = "plopPrefab";
        public const string CloneBuilding = "cloneBuilding";
        public const string RebuildBuilding = "rebuildBuilding";
        public const string RebuildAllBuildings = "rebuildAllBuildings";
        public const string ToggleDistrictPolicy = "toggleDistrictPolicy";
        public const string ToggleDistrictPolicyWithAdjustment = "toggleDistrictPolicyWithAdjustment";
        public const string SetDistrictPolicyAdjustment = "setDistrictPolicyAdjustment";
        public const string ApplyPolicyToAllDistricts = "applyPolicyToAllDistricts";
        public const string CopyDistrictPolicies = "copyDistrictPolicies";
        public const string ResetDistrictPolicies = "resetDistrictPolicies";
        public const string RenameDistrict = "renameDistrict";
        public const string RenameAsset = "renameAsset";
        public const string OpenInSceneExplorer = "openInSceneExplorer";
        public const string OpenExternalUrl = "openExternalUrl";
        public const string ExportCsv = "exportCsv";
        public const string SetUiPref = "setUiPref";
        public const string RemoveUiPref = "removeUiPref";
        public const string ClearUiPrefs = "clearUiPrefs";

        public const string UiLog = "uiLog";
        public const string UiError = "uiError";
    }
}
