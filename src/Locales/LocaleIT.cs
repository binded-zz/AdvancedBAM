using System.Collections.Generic;
using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public class LocaleIT : IDictionarySource
    {
        private readonly BamSettings _s;
        public LocaleIT(BamSettings settings) { _s = settings; }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                { _s.GetSettingsLocaleID(), "Gestore Avanzato di Edifici e Asset" },
                { _s.GetOptionTabLocaleID(BamSettings.kSection), "Principale" },
                { _s.GetOptionTabLocaleID(BamSettings.kExportSection), "Esporta" },
                { _s.GetOptionTabLocaleID(BamSettings.kAboutSection), "Informazioni" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExportGroup), "Esportazione dati CSV" },
                { _s.GetOptionGroupLocaleID(BamSettings.kAboutGroup), "Informazioni sulla Mod" },
                { _s.GetOptionGroupLocaleID(BamSettings.kLinksGroup), "Comunità e collegamenti" },
                { _s.GetOptionGroupLocaleID(BamSettings.kGeneralGroup), "Generale" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExplorerGroup), "Asset Explorer" },
                { _s.GetOptionGroupLocaleID(BamSettings.kWindowGroup), "Finestra" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ShowLauncherButton)), "Mostra pulsante di avvio" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ShowLauncherButton)), "Mostra il pulsante nella barra superiore." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Chiudi finestra al piazzamento" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Chiude la finestra dopo aver premuto PIAZZA o CLONA." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Abilita azioni di riparazione edifici" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Consente alle azioni di riparazione di BAM di rimuovere danni, incendi e abbandono dagli edifici." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Intervallo aggiornamento (secondi)" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Frequenza di scansione degli edifici." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RowsPerPage)), "Righe per pagina" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RowsPerPage)), "Numero di righe mostrate per pagina." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Includi catalogo prefabbricati" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorCount)), "Fattori di felicità visualizzati" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorCount)), "Scegli quanti fattori di felicità dei cittadini mostrare durante l'ispezione di edifici o quartieri." },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top5), "Primi 5 fattori" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top10), "Primi 10 fattori" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.ShowAll), "Mostra tutti" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.HideAll), "Nascondi fattori" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filtro fattori di felicità" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filtra i fattori di felicità per impatto positivo o negativo." },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.AllFactors), "Tutti i fattori" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.PositiveOnly), "Solo positivi" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.NegativeOnly), "Solo negativi" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Mostra elementi del catalogo pronti per essere piazzati." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ResetWindowPosition)), "Ripristina posizione finestra" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ResetWindowPosition)), "Ripristina la finestra alla posizione iniziale." },

                // Export Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Esporta risorse posizionate" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Esporta tutti gli edifici posizionati in un foglio CSV in ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Esporta quartieri" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Esporta statistiche e politiche di quartiere in un foglio CSV in ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Esporta prefabbricati catalogo" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Esporta tutti i prefabbricati del catalogo in un foglio CSV in ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenExportFolder)), "Apri cartella esportazione" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenExportFolder)), "Apre la cartella di esportazione in Esplora file di Windows." },

                // About Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.AboutSummary)), "Gestore Avanzato di Edifici e Asset (BAM) offre l'ispezione ECS in tempo reale per edifici piazzati, servizi cittadini, nuclei familiari, magazzini, potenziamenti, analisi dei distretti, gestione delle politiche, matrici di zone e piazzamento dal catalogo.\n\nSuggerimenti: clicca l'icona BAM in alto a sinistra (o \"Open in BAM\" nel pannello di selezione), premi / o Ctrl+F per cercare e usa la scheda Esporta per i report CSV." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Version)), "Versione" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Version)), $"Versione installata di Advanced BAM (v{Mod.ModVersion})." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Author)), "Autore" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Author)), "Creatore e sviluppatore della mod." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Description)), "Informazioni" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Description)), "Gestore di edifici e risorse ad alte prestazioni con integrazione ECS." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ParadoxModsId)), "ID Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ParadoxModsId)), "Identificativo univoco Paradox Mods per Advanced BAM." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Dependencies)), "Mod richieste" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Dependencies)), "Librerie di icone richieste per mostrare correttamente temi, pacchetti e risorse." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenParadoxMods)), "Apri pagina Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenParadoxMods)), "Apre Advanced BAM (#167082) su Paradox Mods nel browser predefinito." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenForumThread)), "Apri thread sul forum Paradox" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenForumThread)), "Visita la discussione ufficiale e il supporto sui forum Paradox." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenGithubRepo)), "Apri repository GitHub" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenGithubRepo)), "Visualizza codice sorgente, note di rilascio e segnalazioni su GitHub." },

                // UI Window & Shell
                { "AdvancedBAM.WindowTitle", "Gestore Avanzato di Edifici e Asset" },
                { "AdvancedBAM.ToolbarTooltip", "Gestore Avanzato di Edifici (BAM)" },
                { "AdvancedBAM.Header.Refresh", "Aggiorna" },
                { "AdvancedBAM.Header.Close", "Chiudi" },
                { "AdvancedBAM.Header.Expand", "Espandi" },
                { "AdvancedBAM.Header.Collapse", "Comprimi" },
                { "AdvancedBAM.SearchPlaceholder", "Cerca edifici, prefabbricati, distretti..." },

                // Categories
                { "AdvancedBAM.Category.All", "Tutti gli asset" },
                { "AdvancedBAM.Category.Districts", "Distretti" },
                { "AdvancedBAM.Category.Housing", "Abitazioni" },
                { "AdvancedBAM.CAT_HOUSING", "Abitazioni" },
                { "AdvancedBAM.Category.ZoneMatrices", "Matrici zone" },
                { "AdvancedBAM.CAT_ZONEMATRICES", "Matrici zone" },
                { "AdvancedBAM.Category.CommercialMatrix", "Matrice commerciale" },
                { "AdvancedBAM.CAT_COMMERCIALMATRIX", "Matrice commerciale" },
                { "AdvancedBAM.Category.OfficeMatrix", "Matrice uffici" },
                { "AdvancedBAM.CAT_OFFICEMATRIX", "Matrice uffici" },
                { "AdvancedBAM.Category.IndustrialMatrix", "Matrice industriale" },
                { "AdvancedBAM.CAT_INDUSTRIALMATRIX", "Matrice industriale" },
                { "AdvancedBAM.Category.StorageMatrix", "Matrice magazzini" },
                { "AdvancedBAM.CAT_STORAGEMATRIX", "Matrice magazzini" },
                { "AdvancedBAM.Category.ServiceMatrix", "Matrice servizi" },
                { "AdvancedBAM.CAT_SERVICEMATRIX", "Matrice servizi" },
                { "AdvancedBAM.Category.SignatureMatrix", "Matrice edifici chiave" },
                { "AdvancedBAM.CAT_SIGNATUREMATRIX", "Matrice edifici chiave" },
                { "AdvancedBAM.Category.Residential", "Residenziale" },
                { "AdvancedBAM.Category.Commercial", "Commerciale" },
                { "AdvancedBAM.Category.Industrial", "Industriale" },
                { "AdvancedBAM.Category.Office", "Uffici" },
                { "AdvancedBAM.Category.Storage", "Magazzini" },
                { "AdvancedBAM.Category.Service", "Servizi" },
                { "AdvancedBAM.Category.Signature", "Edifici Chiave" },
                { "AdvancedBAM.Category.Catalog", "Catalogo" },

                // Table Columns
                { "AdvancedBAM.Column.Name", "Nome asset" },
                { "AdvancedBAM.Column.Category", "Categoria" },
                { "AdvancedBAM.Column.District", "Distretto" },
                { "AdvancedBAM.Column.Level", "Livello" },
                { "AdvancedBAM.Column.Occupancy", "Occupazione" },
                { "AdvancedBAM.Column.Efficiency", "Efficienza" },
                { "AdvancedBAM.Column.Status", "Stato" },
                { "AdvancedBAM.Column.Actions", "Azioni" },

                // Actions & Tooltips
                { "AdvancedBAM.Action.Go", "VAI" },
                { "AdvancedBAM.Action.GoTooltip", "Centra telecamera e ispeziona edificio" },
                { "AdvancedBAM.Action.Plop", "PIAZZA" },
                { "AdvancedBAM.Action.PlopTooltip", "Attiva strumento per piazzare questo prefabbricato" },
                { "AdvancedBAM.Action.Clone", "CLONA" },
                { "AdvancedBAM.Action.CloneTooltip", "Duplica e piazza un altro edificio uguale" },
                { "AdvancedBAM.Action.Tools", "Strumenti" },
                { "AdvancedBAM.Action.Repair", "RIPARA" },
                { "AdvancedBAM.Action.RepairTooltip", "Ricostruisci ed elimina danni o abbandono" },
                { "AdvancedBAM.Action.RepairAll", "Ripara tutto" },

                // Status
                { "AdvancedBAM.Status.Healthy", "Attivo" },
                { "AdvancedBAM.Status.NeedsRepair", "Danneggiato" },

                // Summary Strips
                { "AdvancedBAM.Summary.TotalBuildings", "Totale edifici" },
                { "AdvancedBAM.Summary.DamagedBuildings", "Da riparare" },
                { "AdvancedBAM.Summary.AvgEfficiency", "Efficienza media" },
                { "AdvancedBAM.Summary.TotalOccupancy", "Occupazione totale" },
                { "AdvancedBAM.Summary.Population", "Popolazione" },
                { "AdvancedBAM.Summary.Households", "Famiglie" },
                { "AdvancedBAM.Summary.Workforce", "Forza lavoro" },
                { "AdvancedBAM.Summary.Policies", "Politiche" },
                { "AdvancedBAM.Summary.ServicesOverview", "Panoramica servizi municipali" },

                // Pagination & Filters
                { "AdvancedBAM.Pagination.Page", "Pagina" },
                { "AdvancedBAM.Pagination.Of", "di" },
                { "AdvancedBAM.Pagination.Showing", "Visualizzazione" },
                { "AdvancedBAM.Pagination.Total", "asset totali" },
                { "AdvancedBAM.Pagination.Prev", "Prec" },
                { "AdvancedBAM.Pagination.Next", "Succ" },
                { "AdvancedBAM.Filter.PlacedOnly", "Solo piazzati" },
                { "AdvancedBAM.Filter.CatalogOnly", "Solo catalogo" },
                { "AdvancedBAM.Filter.DamagedOnly", "Solo danneggiati" },
                { "AdvancedBAM.Filter.AllDistricts", "Tutti i distretti" },

                { "AdvancedBAM.Header.Maximize", "Ingrandisci" },
                { "AdvancedBAM.Header.Restore", "Ripristina" },
                { "AdvancedBAM.SEARCH_PLACEHOLDER", "Cerca asset, distretti, temi, pacchetti..." },
                { "AdvancedBAM.TOOLS_TOGGLE", "Strumenti" },
                { "AdvancedBAM.COL_NAME", "Nome" },
                { "AdvancedBAM.COL_CATEGORY", "Categoria" },
                { "AdvancedBAM.COL_DISTRICT", "Distretto" },
                { "AdvancedBAM.COL_LEVEL", "Livello" },
                { "AdvancedBAM.COL_OCCUPANCY", "Occupazione" },
                { "AdvancedBAM.COL_EFFICIENCY", "Efficienza" },
                { "AdvancedBAM.COL_STATUS", "Stato" },
                { "AdvancedBAM.COL_ACTIONS", "Azioni" },
                { "AdvancedBAM.STATUS_HEALTHY", "Attivo" },
                { "AdvancedBAM.ACT_GO", "Ispeziona" },
                { "AdvancedBAM.ACT_CLONE", "Clona" },
                { "AdvancedBAM.ACT_PLOP", "Piazza" },
                { "AdvancedBAM.PAGE", "Pagina" },
                { "AdvancedBAM.OF", "di" },
                { "AdvancedBAM.TOTAL_ASSETS", "voci" },
                { "AdvancedBAM.PREV", "Prec" },
                { "AdvancedBAM.NEXT", "Succ" }
            };
        }
        public void Unload() { }
    }
}
