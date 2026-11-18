using System.Collections.Generic;
using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public class LocaleEN : IDictionarySource
    {
        private readonly BamSettings _s;

        public LocaleEN(BamSettings settings)
        {
            _s = settings;
        }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                // Settings
                { _s.GetSettingsLocaleID(), "Advanced Building & Asset Manager" },
                { _s.GetOptionTabLocaleID(BamSettings.kSection), "Main" },
                { _s.GetOptionTabLocaleID(BamSettings.kExportSection), "Export" },
                { _s.GetOptionTabLocaleID(BamSettings.kAboutSection), "About" },
                { _s.GetOptionGroupLocaleID(BamSettings.kGeneralGroup), "General" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExplorerGroup), "Asset Explorer" },
                { _s.GetOptionGroupLocaleID(BamSettings.kWindowGroup), "Window" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExportGroup), "CSV Data Export" },
                { _s.GetOptionGroupLocaleID(BamSettings.kAboutGroup), "Mod Information" },
                { _s.GetOptionGroupLocaleID(BamSettings.kLinksGroup), "Community & Links" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ShowLauncherButton)), "Show launcher button" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ShowLauncherButton)), "Show the Asset Manager button in the top-left game toolbar." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Close window when placing" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Hide the explorer window automatically after clicking PLOP or CLONE." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Enable building repair actions" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Allow BAM repair actions to clear damage, fire, and abandonment from buildings." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Refresh interval (seconds)" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "How often the explorer re-reads city buildings while the window is open." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RowsPerPage)), "Rows per page" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RowsPerPage)), "Number of table rows shown per page in the explorer." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Include catalog prefabs" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "List unplaced building prefabs so they can be placed directly with PLOP." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorCount)), "Happiness factors shown" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorCount)), "Choose how many citizen happiness factors are displayed when inspecting buildings or districts." },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top5), "Top 5 factors" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top10), "Top 10 factors" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.ShowAll), "Show all" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.HideAll), "Hide breakdown" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Happiness factor filter" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filter displayed happiness factors by their positive or negative impact." },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.AllFactors), "All factors" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.PositiveOnly), "Positive only" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.NegativeOnly), "Negative only" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ResetWindowPosition)), "Reset window position" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ResetWindowPosition)), "Move the explorer window back to its default position and size." },

                // Export Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Export Placed Assets" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Export all placed buildings and assets in your city to a CSV spreadsheet in ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Export Districts" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Export district demographics, buildings, and active policies to a CSV spreadsheet in ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Export Catalog Prefabs" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Export all catalog building prefabs to a CSV spreadsheet in ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenExportFolder)), "Open Export Folder" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenExportFolder)), "Open the exports folder in Windows File Explorer." },

                // About Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.AboutSummary)), "Advanced Building & Asset Manager (BAM) provides live ECS inspection across placed buildings, city services, households, storage, sub-building upgrades, district analytics, policy management, zone matrices, and instant catalog plopping.\n\nTips: Click the top-left BAM toolbar icon (or \"Open in BAM\" inside any Selected Info Panel) to open the explorer, press / or Ctrl+F to search, and use the Export tab above for CSV reports." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Version)), "Version" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Version)), $"Installed release version of Advanced BAM (v{Mod.ModVersion})." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Author)), "Author" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Author)), "Mod creator and developer." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Description)), "About" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Description)), "High-performance building and asset manager with native ECS integration." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ParadoxModsId)), "Paradox Mods ID" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ParadoxModsId)), "Unique Paradox Mods workshop identifier for Advanced BAM." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Dependencies)), "Required Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Dependencies)), "Recommended and required icon library dependencies for full theme, pack, and resource icons." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenParadoxMods)), "Open Paradox Mods Page" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenParadoxMods)), "Open Advanced BAM (#167082) on Paradox Mods in your default browser." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenForumThread)), "Open Paradox Forum Thread" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenForumThread)), "Visit the official discussion, changelog, and support thread on Paradox Forums." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenGithubRepo)), "Open GitHub Repository" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenGithubRepo)), "View source code, release notes, and issue tracker on GitHub." },

                // UI Window & Shell
                { "AdvancedBAM.WindowTitle", "Advanced Building & Asset Manager" },
                { "AdvancedBAM.ToolbarTooltip", "Advanced Building & Asset Manager (BAM)" },
                { "AdvancedBAM.Header.Refresh", "Refresh" },
                { "AdvancedBAM.Header.Close", "Close" },
                { "AdvancedBAM.Header.Expand", "Expand" },
                { "AdvancedBAM.Header.Collapse", "Collapse" },
                { "AdvancedBAM.SearchPlaceholder", "Search assets, prefabs, districts..." },

                // Categories
                { "AdvancedBAM.Category.All", "All Assets" },
                { "AdvancedBAM.Category.Districts", "Districts" },
                { "AdvancedBAM.Category.Housing", "Housing" },
                { "AdvancedBAM.CAT_HOUSING", "Housing" },
                { "AdvancedBAM.Category.ZoneMatrices", "Zone Matrices" },
                { "AdvancedBAM.CAT_ZONEMATRICES", "Zone Matrices" },
                { "AdvancedBAM.Category.CommercialMatrix", "Commercial Matrix" },
                { "AdvancedBAM.CAT_COMMERCIALMATRIX", "Commercial Matrix" },
                { "AdvancedBAM.Category.OfficeMatrix", "Office Matrix" },
                { "AdvancedBAM.CAT_OFFICEMATRIX", "Office Matrix" },
                { "AdvancedBAM.Category.IndustrialMatrix", "Industrial Matrix" },
                { "AdvancedBAM.CAT_INDUSTRIALMATRIX", "Industrial Matrix" },
                { "AdvancedBAM.Category.StorageMatrix", "Storage Matrix" },
                { "AdvancedBAM.CAT_STORAGEMATRIX", "Storage Matrix" },
                { "AdvancedBAM.Category.ServiceMatrix", "Services Matrix" },
                { "AdvancedBAM.CAT_SERVICEMATRIX", "Services Matrix" },
                { "AdvancedBAM.Category.SignatureMatrix", "Signature Matrix" },
                { "AdvancedBAM.CAT_SIGNATUREMATRIX", "Signature Matrix" },
                { "AdvancedBAM.Category.Residential", "Residential" },
                { "AdvancedBAM.Category.Commercial", "Commercial" },
                { "AdvancedBAM.Category.Industrial", "Industrial" },
                { "AdvancedBAM.Category.Office", "Office" },
                { "AdvancedBAM.Category.Storage", "Storage" },
                { "AdvancedBAM.Category.Service", "Services" },
                { "AdvancedBAM.Category.Signature", "Signatures" },
                { "AdvancedBAM.Category.Catalog", "Catalog (Ploppable)" },

                // Table Columns
                { "AdvancedBAM.Column.Name", "Asset Name" },
                { "AdvancedBAM.Column.Category", "Category" },
                { "AdvancedBAM.Column.District", "District" },
                { "AdvancedBAM.Column.Level", "Level" },
                { "AdvancedBAM.Column.Occupancy", "Occupancy" },
                { "AdvancedBAM.Column.Efficiency", "Efficiency" },
                { "AdvancedBAM.Column.Status", "Status" },
                { "AdvancedBAM.Column.Actions", "Actions" },

                // Actions & Tooltips
                { "AdvancedBAM.Action.Go", "GO" },
                { "AdvancedBAM.Action.GoTooltip", "Focus camera and inspect this building" },
                { "AdvancedBAM.Action.Plop", "PLOP" },
                { "AdvancedBAM.Action.PlopTooltip", "Activate placement tool to spawn this prefab" },
                { "AdvancedBAM.Action.Clone", "CLONE" },
                { "AdvancedBAM.Action.CloneTooltip", "Duplicate and place another instance of this building" },
                { "AdvancedBAM.Action.Tools", "Tools" },
                { "AdvancedBAM.Action.Repair", "REPAIR" },
                { "AdvancedBAM.Action.RepairTooltip", "Rebuild and clear damage/abandonment from this building" },
                { "AdvancedBAM.Action.RepairAll", "Repair All" },

                // Status
                { "AdvancedBAM.Status.Healthy", "Active" },
                { "AdvancedBAM.Status.NeedsRepair", "Damaged" },

                // Summary Strips
                { "AdvancedBAM.Summary.TotalBuildings", "Total Buildings" },
                { "AdvancedBAM.Summary.DamagedBuildings", "Needing Repair" },
                { "AdvancedBAM.Summary.AvgEfficiency", "Avg Efficiency" },
                { "AdvancedBAM.Summary.TotalOccupancy", "Total Occupancy" },
                { "AdvancedBAM.Summary.Population", "Population" },
                { "AdvancedBAM.Summary.Households", "Households" },
                { "AdvancedBAM.Summary.Workforce", "Workforce" },
                { "AdvancedBAM.Summary.Policies", "Policies" },
                { "AdvancedBAM.Summary.ServicesOverview", "City Services Overview" },

                // Pagination & Filters
                { "AdvancedBAM.Pagination.Page", "Page" },
                { "AdvancedBAM.Pagination.Of", "of" },
                { "AdvancedBAM.Pagination.Showing", "Showing" },
                { "AdvancedBAM.Pagination.Total", "total assets" },
                { "AdvancedBAM.Pagination.Prev", "Prev" },
                { "AdvancedBAM.Pagination.Next", "Next" },
                { "AdvancedBAM.Filter.PlacedOnly", "Placed Only" },
                { "AdvancedBAM.Filter.CatalogOnly", "Catalog Only" },
                { "AdvancedBAM.Filter.DamagedOnly", "Damaged Only" },
                { "AdvancedBAM.Filter.AllDistricts", "All Districts" },

                { "AdvancedBAM.Header.Maximize", "Maximize" },
                { "AdvancedBAM.Header.Restore", "Restore" },
                { "AdvancedBAM.SEARCH_PLACEHOLDER", "Search assets, districts, themes, packs..." },
                { "AdvancedBAM.TOOLS_TOGGLE", "Tools" },
                { "AdvancedBAM.COL_NAME", "Name" },
                { "AdvancedBAM.COL_CATEGORY", "Category" },
                { "AdvancedBAM.COL_DISTRICT", "District" },
                { "AdvancedBAM.COL_LEVEL", "Level" },
                { "AdvancedBAM.COL_OCCUPANCY", "Occupancy" },
                { "AdvancedBAM.COL_EFFICIENCY", "Efficiency" },
                { "AdvancedBAM.COL_STATUS", "Status" },
                { "AdvancedBAM.COL_ACTIONS", "Actions" },
                { "AdvancedBAM.STATUS_HEALTHY", "Healthy" },
                { "AdvancedBAM.ACT_GO", "Inspect" },
                { "AdvancedBAM.ACT_CLONE", "Clone" },
                { "AdvancedBAM.ACT_PLOP", "Plop" },
                { "AdvancedBAM.PAGE", "Page" },
                { "AdvancedBAM.OF", "of" },
                { "AdvancedBAM.TOTAL_ASSETS", "entries" },
                { "AdvancedBAM.PREV", "Prev" },
                { "AdvancedBAM.NEXT", "Next" }
            };
        }

        public void Unload() { }
    }
}
