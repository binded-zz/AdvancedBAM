using System.Collections.Generic;
using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public class LocalePL : IDictionarySource
    {
        private readonly BamSettings _s;
        public LocalePL(BamSettings settings) { _s = settings; }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                { _s.GetSettingsLocaleID(), "Zaawansowany Menedżer Budynków i Zasobów" },
                { _s.GetOptionTabLocaleID(BamSettings.kSection), "Główne" },
                { _s.GetOptionTabLocaleID(BamSettings.kExportSection), "Eksport" },
                { _s.GetOptionTabLocaleID(BamSettings.kAboutSection), "O modzie" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExportGroup), "Eksport danych CSV" },
                { _s.GetOptionGroupLocaleID(BamSettings.kAboutGroup), "Informacje o modzie" },
                { _s.GetOptionGroupLocaleID(BamSettings.kLinksGroup), "Społeczność i linki" },
                { _s.GetOptionGroupLocaleID(BamSettings.kGeneralGroup), "Ogólne" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExplorerGroup), "Eksplorator" },
                { _s.GetOptionGroupLocaleID(BamSettings.kWindowGroup), "Okno" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ShowLauncherButton)), "Pokaż przycisk paska" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ShowLauncherButton)), "Wyświetla przycisk menedżera na górnym pasku." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Zamknij okno przy stawianiu" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Automatycznie zamyka okno po kliknięciu POSTAW lub SKLONUJ." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Włącz akcje naprawy budynków" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Pozwala akcjom naprawy BAM usuwać uszkodzenia, pożary i opuszczenie z budynków." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Częstość odświeżania (sekundy)" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Jak często budynki są ponownie odczytywane." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RowsPerPage)), "Wierszy na stronę" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RowsPerPage)), "Liczba wyświetlanych wierszy." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Uwzględnij katalog" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorCount)), "Wyświetlane czynniki zadowolenia" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorCount)), "Wybierz, ile czynników zadowolenia mieszkańców ma być wyświetlanych podczas inspekcji budynków lub dzielnic." },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top5), "Top 5 czynników" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top10), "Top 10 czynników" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.ShowAll), "Pokaż wszystkie" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.HideAll), "Ukryj podział" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filtr czynników zadowolenia" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filtruj wyświetlane czynniki zadowolenia według ich wpływu dodatniego lub ujemnego." },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.AllFactors), "Wszystkie czynniki" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.PositiveOnly), "Tylko pozytywne" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.NegativeOnly), "Tylko negatywne" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Wyświetla niepostawione szablony gotowe do umieszczenia." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ResetWindowPosition)), "Resetuj pozycję okna" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ResetWindowPosition)), "Przywraca okno do pozycji domyślnej." },

                // Export Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Eksportuj postawione obiekty" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Eksportuje wszystkie postawione budynki do arkusza CSV w ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Eksportuj dzielnice" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Eksportuje statystyki i zasady dzielnic do arkusza CSV w ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Eksportuj prefabrykaty katalogu" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Eksportuje wszystkie prefabrykaty katalogu do CSV w ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenExportFolder)), "Otwórz folder eksportu" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenExportFolder)), "Otwiera folder eksportu w Eksploratorze plików Windows." },

                // About Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.AboutSummary)), "Zaawansowany Menedżer Budynków i Zasobów (BAM) zapewnia podgląd ECS na żywo dla postawionych budynków, usług miejskich, gospodarstw domowych, magazynów, ulepszeń, analiz dzielnic, polityk, macierzy stref oraz szybkiego stawiania z katalogu.\n\nWskazówki: kliknij ikonę BAM w lewym górnym rogu (lub \"Open in BAM\" w panelu obiektu), naciśnij / lub Ctrl+F aby wyszukiwać i użyj zakładki Eksport dla plików CSV." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Version)), "Wersja" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Version)), $"Zainstalowana wersja Advanced BAM (v{Mod.ModVersion})." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Author)), "Autor" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Author)), "Twórca i programista moda." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Description)), "O modzie" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Description)), "Wysokowydajny menedżer budynków i zasobów ze zintegrowanym silnikiem ECS." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ParadoxModsId)), "ID Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ParadoxModsId)), "Unikalny identyfikator moda Advanced BAM w Paradox Mods." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Dependencies)), "Wymagane mody" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Dependencies)), "Wymagane biblioteki ikon do poprawnego wyświetlania motywów, pakietów i zasobów." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenParadoxMods)), "Otwórz stronę Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenParadoxMods)), "Otwiera stronę Advanced BAM (#167082) w Paradox Mods w domyślnej przeglądarce." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenForumThread)), "Otwórz wątek na forum Paradox" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenForumThread)), "Przejdź do oficjalnego wątku z dyskusją i pomocą na forum Paradox." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenGithubRepo)), "Otwórz repozytorium GitHub" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenGithubRepo)), "Zobacz kod źródłowy, listę zmian i zgłoszenia na GitHubie." },

                // UI Window & Shell
                { "AdvancedBAM.WindowTitle", "Zaawansowany Menedżer Budynków i Zasobów" },
                { "AdvancedBAM.ToolbarTooltip", "Zaawansowany Menedżer Budynków (BAM)" },
                { "AdvancedBAM.Header.Refresh", "Odśwież" },
                { "AdvancedBAM.Header.Close", "Zamknij" },
                { "AdvancedBAM.Header.Expand", "Rozwiń" },
                { "AdvancedBAM.Header.Collapse", "Zwiń" },
                { "AdvancedBAM.SearchPlaceholder", "Szukaj budynków, prefabrykatów, dzielnic..." },

                // Categories
                { "AdvancedBAM.Category.All", "Wszystkie zasoby" },
                { "AdvancedBAM.Category.Districts", "Dzielnice" },
                { "AdvancedBAM.Category.Housing", "Mieszkalnictwo" },
                { "AdvancedBAM.CAT_HOUSING", "Mieszkalnictwo" },
                { "AdvancedBAM.Category.ZoneMatrices", "Matryce stref" },
                { "AdvancedBAM.CAT_ZONEMATRICES", "Matryce stref" },
                { "AdvancedBAM.Category.CommercialMatrix", "Matryca handlowa" },
                { "AdvancedBAM.CAT_COMMERCIALMATRIX", "Matryca handlowa" },
                { "AdvancedBAM.Category.OfficeMatrix", "Matryca biurowa" },
                { "AdvancedBAM.CAT_OFFICEMATRIX", "Matryca biurowa" },
                { "AdvancedBAM.Category.IndustrialMatrix", "Matryca przemysłowa" },
                { "AdvancedBAM.CAT_INDUSTRIALMATRIX", "Matryca przemysłowa" },
                { "AdvancedBAM.Category.StorageMatrix", "Matryca magazynów" },
                { "AdvancedBAM.CAT_STORAGEMATRIX", "Matryca magazynów" },
                { "AdvancedBAM.Category.ServiceMatrix", "Matryca usług" },
                { "AdvancedBAM.CAT_SERVICEMATRIX", "Matryca usług" },
                { "AdvancedBAM.Category.SignatureMatrix", "Matryca wyjątkowych" },
                { "AdvancedBAM.CAT_SIGNATUREMATRIX", "Matryca wyjątkowych" },
                { "AdvancedBAM.Category.Residential", "Mieszkalne" },
                { "AdvancedBAM.Category.Commercial", "Handlowe" },
                { "AdvancedBAM.Category.Industrial", "Przemysłowe" },
                { "AdvancedBAM.Category.Office", "Biurowe" },
                { "AdvancedBAM.Category.Storage", "Magazyny" },
                { "AdvancedBAM.Category.Service", "Usługi" },
                { "AdvancedBAM.Category.Signature", "Wyjątkowe" },
                { "AdvancedBAM.Category.Catalog", "Katalog" },

                // Table Columns
                { "AdvancedBAM.Column.Name", "Nazwa zasobu" },
                { "AdvancedBAM.Column.Category", "Kategoria" },
                { "AdvancedBAM.Column.District", "Dzielnica" },
                { "AdvancedBAM.Column.Level", "Poziom" },
                { "AdvancedBAM.Column.Occupancy", "Obłożenie" },
                { "AdvancedBAM.Column.Efficiency", "Wydajność" },
                { "AdvancedBAM.Column.Status", "Status" },
                { "AdvancedBAM.Column.Actions", "Akcje" },

                // Actions & Tooltips
                { "AdvancedBAM.Action.Go", "IDŹ" },
                { "AdvancedBAM.Action.GoTooltip", "Skieruj kamerę i zbadaj budynek" },
                { "AdvancedBAM.Action.Plop", "POSTAW" },
                { "AdvancedBAM.Action.PlopTooltip", "Aktywuj narzędzie stawiania tego prefabrykatu" },
                { "AdvancedBAM.Action.Clone", "SKLONUJ" },
                { "AdvancedBAM.Action.CloneTooltip", "Powiel i postaw kolejną kopię tego budynku" },
                { "AdvancedBAM.Action.Tools", "Narzędzia" },
                { "AdvancedBAM.Action.Repair", "NAPRAW" },
                { "AdvancedBAM.Action.RepairTooltip", "Odbuduj i usuń zniszczenia lub opuszczenie" },
                { "AdvancedBAM.Action.RepairAll", "Napraw wszystko" },

                // Status
                { "AdvancedBAM.Status.Healthy", "Aktywny" },
                { "AdvancedBAM.Status.NeedsRepair", "Uszkodzony" },

                // Summary Strips
                { "AdvancedBAM.Summary.TotalBuildings", "Razem budynków" },
                { "AdvancedBAM.Summary.DamagedBuildings", "Wymaga naprawy" },
                { "AdvancedBAM.Summary.AvgEfficiency", "Średnia wydajność" },
                { "AdvancedBAM.Summary.TotalOccupancy", "Całkowite zaludnienie" },
                { "AdvancedBAM.Summary.Population", "Populacja" },
                { "AdvancedBAM.Summary.Households", "Gospodarstwa domowe" },
                { "AdvancedBAM.Summary.Workforce", "Siła robocza" },
                { "AdvancedBAM.Summary.Policies", "Zasady" },
                { "AdvancedBAM.Summary.ServicesOverview", "Przegląd usług miejskich" },

                // Pagination & Filters
                { "AdvancedBAM.Pagination.Page", "Strona" },
                { "AdvancedBAM.Pagination.Of", "z" },
                { "AdvancedBAM.Pagination.Showing", "Wyświetlanie" },
                { "AdvancedBAM.Pagination.Total", "zasobów łącznie" },
                { "AdvancedBAM.Pagination.Prev", "Poprz" },
                { "AdvancedBAM.Pagination.Next", "Nast" },
                { "AdvancedBAM.Filter.PlacedOnly", "Tylko postawione" },
                { "AdvancedBAM.Filter.CatalogOnly", "Tylko katalog" },
                { "AdvancedBAM.Filter.DamagedOnly", "Tylko uszkodzone" },
                { "AdvancedBAM.Filter.AllDistricts", "Wszystkie dzielnice" },

                { "AdvancedBAM.Header.Maximize", "Maksymalizuj" },
                { "AdvancedBAM.Header.Restore", "Przywróć" },
                { "AdvancedBAM.SEARCH_PLACEHOLDER", "Szukaj zasobów, dzielnic, motywów, pakietów..." },
                { "AdvancedBAM.TOOLS_TOGGLE", "Narzędzia" },
                { "AdvancedBAM.COL_NAME", "Nazwa" },
                { "AdvancedBAM.COL_CATEGORY", "Kategoria" },
                { "AdvancedBAM.COL_DISTRICT", "Dzielnica" },
                { "AdvancedBAM.COL_LEVEL", "Poziom" },
                { "AdvancedBAM.COL_OCCUPANCY", "Obłożenie" },
                { "AdvancedBAM.COL_EFFICIENCY", "Wydajność" },
                { "AdvancedBAM.COL_STATUS", "Status" },
                { "AdvancedBAM.COL_ACTIONS", "Akcje" },
                { "AdvancedBAM.STATUS_HEALTHY", "Aktywny" },
                { "AdvancedBAM.ACT_GO", "Zbadaj" },
                { "AdvancedBAM.ACT_CLONE", "Sklonuj" },
                { "AdvancedBAM.ACT_PLOP", "Postaw" },
                { "AdvancedBAM.PAGE", "Strona" },
                { "AdvancedBAM.OF", "z" },
                { "AdvancedBAM.TOTAL_ASSETS", "wpisów" },
                { "AdvancedBAM.PREV", "Poprz" },
                { "AdvancedBAM.NEXT", "Nast" }
            };
        }
        public void Unload() { }
    }
}
