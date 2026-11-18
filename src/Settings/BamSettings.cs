using System;
using Colossal.IO.AssetDatabase;
using Game.Modding;
using Game.Settings;
using AdvancedBAM.Utilities;
using UnityEngine;

namespace AdvancedBAM.Settings
{
    [FileLocation("ModsSettings/" + nameof(AdvancedBAM) + "/Settings")]
    [SettingsUITabOrder(kSection, kExportSection, kAboutSection)]
    [SettingsUIGroupOrder(kGeneralGroup, kExplorerGroup, kWindowGroup, kExportGroup, kAboutGroup, kLinksGroup)]
    [SettingsUIShowGroupName(kGeneralGroup, kExplorerGroup, kWindowGroup, kExportGroup, kAboutGroup, kLinksGroup)]
    public class BamSettings : ModSetting
    {
        public const string kSection = "Main";
        public const string kExportSection = "Export";
        public const string kAboutSection = "About";

        public const string kGeneralGroup = "General";
        public const string kExplorerGroup = "Explorer";
        public const string kWindowGroup = "Window";
        public const string kExportGroup = "CSV Data Export";
        public const string kAboutGroup = "Mod Information";
        public const string kLinksGroup = "Community & Links";

        public const string ParadoxModsUrl = "https://mods.paradoxplaza.com/mods/167082/Windows";
        public const string ForumThreadUrl = "https://forum.paradoxplaza.com/forum/threads/advanced-bam.1949486/";
        public const string GithubRepoUrl = "https://github.com/binded/AdvancedBAM";

        public const int DefaultWindowX = 140;
        public const int DefaultWindowY = 120;
        public const int DefaultWindowWidth = 980;
        public const int DefaultWindowHeight = 640;

        public BamSettings(IMod mod) : base(mod)
        {
            SetDefaults();
        }

        // ---- General -------------------------------------------------------

        [SettingsUISection(kSection, kGeneralGroup)]
        public bool ShowLauncherButton { get; set; }

        [SettingsUISection(kSection, kGeneralGroup)]
        public bool CloseWindowOnPlace { get; set; }

        [SettingsUISection(kSection, kGeneralGroup)]
        public bool EnableBuildingRepairs { get; set; }

        // ---- Explorer ------------------------------------------------------

        [SettingsUISlider(min = 5, max = 120, step = 5, scalarMultiplier = 1, unit = Game.UI.Unit.kInteger)]
        [SettingsUISection(kSection, kExplorerGroup)]
        public int RefreshIntervalSeconds { get; set; }

        [SettingsUISlider(min = 25, max = 200, step = 25, scalarMultiplier = 1, unit = Game.UI.Unit.kInteger)]
        [SettingsUISection(kSection, kExplorerGroup)]
        public int RowsPerPage { get; set; }

        [SettingsUISection(kSection, kExplorerGroup)]
        public bool IncludeCatalogPrefabs { get; set; }

        [SettingsUISection(kSection, kExplorerGroup)]
        public HappinessDisplayCount HappinessFactorCount { get; set; } = HappinessDisplayCount.ShowAll;

        [SettingsUISection(kSection, kExplorerGroup)]
        public HappinessDisplayFilter HappinessFactorFilter { get; set; } = HappinessDisplayFilter.AllFactors;

        // ---- Window (persisted, not shown) ---------------------------------

        [SettingsUIHidden] public int WindowX { get; set; }
        [SettingsUIHidden] public int WindowY { get; set; }
        [SettingsUIHidden] public int WindowWidth { get; set; }
        [SettingsUIHidden] public int WindowHeight { get; set; }

        [SettingsUIButton]
        [SettingsUISection(kSection, kWindowGroup)]
        public bool ResetWindowPosition
        {
            set
            {
                WindowX = DefaultWindowX;
                WindowY = DefaultWindowY;
                WindowWidth = DefaultWindowWidth;
                WindowHeight = DefaultWindowHeight;
                ApplyAndSave();
            }
        }

        // ---- Export --------------------------------------------------------

        [SettingsUIButton]
        [SettingsUISection(kExportSection, kExportGroup)]
        public bool ExportPlacedAssetsCsv
        {
            set => CsvExportService.ExportPlacedAssets();
        }

        [SettingsUIButton]
        [SettingsUISection(kExportSection, kExportGroup)]
        public bool ExportDistrictsCsv
        {
            set => CsvExportService.ExportDistricts();
        }

        [SettingsUIButton]
        [SettingsUISection(kExportSection, kExportGroup)]
        public bool ExportCatalogPrefabsCsv
        {
            set => CsvExportService.ExportCatalogPrefabs();
        }

        [SettingsUIButton]
        [SettingsUISection(kExportSection, kExportGroup)]
        public bool OpenExportFolder
        {
            set => CsvExportService.OpenExportFolder();
        }

        // ---- About ---------------------------------------------------------

        [SettingsUIMultilineText]
        [SettingsUISection(kAboutSection, kAboutGroup)]
        public string AboutSummary => string.Empty;

        [SettingsUISection(kAboutSection, kAboutGroup)]
        public string Version => Mod.ModVersion;

        [SettingsUISection(kAboutSection, kAboutGroup)]
        public string Author => "binded";

        [SettingsUISection(kAboutSection, kAboutGroup)]
        public string ParadoxModsId => "167082";

        [SettingsUISection(kAboutSection, kAboutGroup)]
        public string Dependencies => "Unified Icon Library (74417), Asset Icon Library (79634)";

        [SettingsUISection(kAboutSection, kAboutGroup)]
        public string Description => "Advanced Building & Asset Manager provides real-time ECS inspection, diagnostics, plopping, and district analytics.";

        [SettingsUIButton]
        [SettingsUISection(kAboutSection, kLinksGroup)]
        public bool OpenParadoxMods
        {
            set => OpenAllowedExternalUrl(ParadoxModsUrl);
        }

        [SettingsUIButton]
        [SettingsUISection(kAboutSection, kLinksGroup)]
        public bool OpenForumThread
        {
            set => OpenAllowedExternalUrl(ForumThreadUrl);
        }

        [SettingsUIButton]
        [SettingsUISection(kAboutSection, kLinksGroup)]
        public bool OpenGithubRepo
        {
            set => OpenAllowedExternalUrl(GithubRepoUrl);
        }

        /// <summary>Opens one of BAM's allowlisted external community or repository URLs.</summary>
        public static void OpenAllowedExternalUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return;
            if (!string.Equals(url, ParadoxModsUrl, StringComparison.Ordinal) &&
                !string.Equals(url, ForumThreadUrl, StringComparison.Ordinal) &&
                !string.Equals(url, GithubRepoUrl, StringComparison.Ordinal))
            {
                Mod.Log?.Warn($"Blocked external URL not in BAM allowlist: {url}");
                return;
            }
            Application.OpenURL(url);
        }

        public override void SetDefaults()
        {
            ShowLauncherButton = true;
            CloseWindowOnPlace = true;
            EnableBuildingRepairs = true;
            RefreshIntervalSeconds = 20;
            RowsPerPage = 50;
            IncludeCatalogPrefabs = true;
            HappinessFactorCount = HappinessDisplayCount.ShowAll;
            HappinessFactorFilter = HappinessDisplayFilter.AllFactors;
            WindowX = DefaultWindowX;
            WindowY = DefaultWindowY;
            WindowWidth = DefaultWindowWidth;
            WindowHeight = DefaultWindowHeight;
        }
    }

    public enum HappinessDisplayCount
    {
        Top5,
        Top10,
        ShowAll,
        HideAll
    }

    public enum HappinessDisplayFilter
    {
        AllFactors,
        PositiveOnly,
        NegativeOnly
    }
}
