using System.Collections.Generic;
using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public class LocalePTBR : IDictionarySource
    {
        private readonly BamSettings _s;
        public LocalePTBR(BamSettings settings) { _s = settings; }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                { _s.GetSettingsLocaleID(), "Gerenciador Avançado de Edifícios e Ativos" },
                { _s.GetOptionTabLocaleID(BamSettings.kSection), "Principal" },
                { _s.GetOptionTabLocaleID(BamSettings.kExportSection), "Exportar" },
                { _s.GetOptionTabLocaleID(BamSettings.kAboutSection), "Sobre" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExportGroup), "Exportação de Dados CSV" },
                { _s.GetOptionGroupLocaleID(BamSettings.kAboutGroup), "Informações do Mod" },
                { _s.GetOptionGroupLocaleID(BamSettings.kLinksGroup), "Comunidade e Links" },
                { _s.GetOptionGroupLocaleID(BamSettings.kGeneralGroup), "Geral" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExplorerGroup), "Explorador de Ativos" },
                { _s.GetOptionGroupLocaleID(BamSettings.kWindowGroup), "Janela" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ShowLauncherButton)), "Mostrar botão lançador" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ShowLauncherButton)), "Exibe o botão na barra superior." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Fechar janela ao posicionar" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Fecha a janela ao clicar em POSICIONAR ou CLONAR." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Ativar ações de reparo de edifícios" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Permite que as ações de reparo do BAM removam danos, incêndios e abandono dos edifícios." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Intervalo de atualização (segundos)" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Frequência de releitura dos edifícios." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RowsPerPage)), "Linhas por página" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RowsPerPage)), "Quantidade de linhas exibidas por página." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Incluir catálogo de prefabs" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorCount)), "Fatores de felicidade exibidos" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorCount)), "Escolha quantos fatores de felicidade dos cidadãos serão exibidos ao inspecionar edifícios ou distritos." },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top5), "Top 5 fatores" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top10), "Top 10 fatores" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.ShowAll), "Mostrar todos" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.HideAll), "Ocultar detalhes" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filtro de fatores de felicidade" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Filtre os fatores de felicidade exibidos pelo seu impacto positivo ou negativo." },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.AllFactors), "Todos os fatores" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.PositiveOnly), "Apenas positivos" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.NegativeOnly), "Apenas negativos" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Exibe prefabs prontos para serem posicionados." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ResetWindowPosition)), "Redefinir posição da janela" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ResetWindowPosition)), "Restaura a janela para a posição padrão." },

                // Export Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Exportar Recursos Posicionados" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Exporta todos os edifícios posicionados para uma planilha CSV em ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Exportar Distritos" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Exporta dados demográficos e políticas dos distritos para uma planilha CSV em ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Exportar Prefabs do Catálogo" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Exporta todos os prefabs do catálogo para uma planilha CSV em ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenExportFolder)), "Abrir Pasta de Exportação" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenExportFolder)), "Abre a pasta de exportações no Explorador de Arquivos do Windows." },

                // About Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.AboutSummary)), "O Gerenciador Avançado de Edifícios e Ativos (BAM) oferece inspeção ECS em tempo real para edifícios posicionados, serviços municipais, famílias, armazéns, melhorias, análises de distritos, gestão de políticas, matrizes de zonas e posicionamento direto do catálogo.\n\nDicas: Clique no ícone do BAM no topo esquerdo (ou em \"Open in BAM\" no painel de seleção), pressione / ou Ctrl+F para pesquisar e use a aba Exportar para planilhas CSV." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Version)), "Versão" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Version)), $"Versão de lançamento instalada do Advanced BAM (v{Mod.ModVersion})." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Author)), "Autor" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Author)), "Criador e desenvolvedor do mod." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Description)), "Sobre" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Description)), "Gerenciador de ativos e edifícios de alto desempenho com integração ECS nativa." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ParadoxModsId)), "ID no Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ParadoxModsId)), "Identificador único do Advanced BAM no Paradox Mods." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Dependencies)), "Mods Necessários" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Dependencies)), "Bibliotecas de ícones necessárias para exibir corretamente temas, pacotes e recursos." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenParadoxMods)), "Abrir página no Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenParadoxMods)), "Abre o Advanced BAM (#167082) no Paradox Mods em seu navegador padrão." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenForumThread)), "Abrir tópico no Fórum Paradox" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenForumThread)), "Visita o tópico oficial de discussão, notas e suporte no Fórum Paradox." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenGithubRepo)), "Abrir repositório no GitHub" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenGithubRepo)), "Visualiza o código-fonte, lançamentos e rastreador de problemas no GitHub." },

                // UI Window & Shell
                { "AdvancedBAM.WindowTitle", "Gerenciador Avançado de Edifícios e Ativos" },
                { "AdvancedBAM.ToolbarTooltip", "Gerenciador Avançado de Edifícios (BAM)" },
                { "AdvancedBAM.Header.Refresh", "Atualizar" },
                { "AdvancedBAM.Header.Close", "Fechar" },
                { "AdvancedBAM.Header.Expand", "Expandir" },
                { "AdvancedBAM.Header.Collapse", "Recolher" },
                { "AdvancedBAM.SearchPlaceholder", "Pesquisar ativos, prefabs, distritos..." },

                // Categories
                { "AdvancedBAM.Category.All", "Todos os Ativos" },
                { "AdvancedBAM.Category.Districts", "Distritos" },
                { "AdvancedBAM.Category.Housing", "Habitação" },
                { "AdvancedBAM.CAT_HOUSING", "Habitação" },
                { "AdvancedBAM.Category.ZoneMatrices", "Matrizes de zonas" },
                { "AdvancedBAM.CAT_ZONEMATRICES", "Matrizes de zonas" },
                { "AdvancedBAM.Category.CommercialMatrix", "Matriz comercial" },
                { "AdvancedBAM.CAT_COMMERCIALMATRIX", "Matriz comercial" },
                { "AdvancedBAM.Category.OfficeMatrix", "Matriz de escritórios" },
                { "AdvancedBAM.CAT_OFFICEMATRIX", "Matriz de escritórios" },
                { "AdvancedBAM.Category.IndustrialMatrix", "Matriz industrial" },
                { "AdvancedBAM.CAT_INDUSTRIALMATRIX", "Matriz industrial" },
                { "AdvancedBAM.Category.StorageMatrix", "Matriz de armazéns" },
                { "AdvancedBAM.CAT_STORAGEMATRIX", "Matriz de armazéns" },
                { "AdvancedBAM.Category.ServiceMatrix", "Matriz de serviços" },
                { "AdvancedBAM.CAT_SERVICEMATRIX", "Matriz de serviços" },
                { "AdvancedBAM.Category.SignatureMatrix", "Matriz de marcantes" },
                { "AdvancedBAM.CAT_SIGNATUREMATRIX", "Matriz de marcantes" },
                { "AdvancedBAM.Category.Residential", "Residencial" },
                { "AdvancedBAM.Category.Commercial", "Comercial" },
                { "AdvancedBAM.Category.Industrial", "Industrial" },
                { "AdvancedBAM.Category.Office", "Escritórios" },
                { "AdvancedBAM.Category.Storage", "Armazéns" },
                { "AdvancedBAM.Category.Service", "Serviços" },
                { "AdvancedBAM.Category.Signature", "Marcantes" },
                { "AdvancedBAM.Category.Catalog", "Catálogo" },

                // Table Columns
                { "AdvancedBAM.Column.Name", "Nome do Ativo" },
                { "AdvancedBAM.Column.Category", "Categoria" },
                { "AdvancedBAM.Column.District", "Distrito" },
                { "AdvancedBAM.Column.Level", "Nível" },
                { "AdvancedBAM.Column.Occupancy", "Ocupação" },
                { "AdvancedBAM.Column.Efficiency", "Eficiência" },
                { "AdvancedBAM.Column.Status", "Status" },
                { "AdvancedBAM.Column.Actions", "Ações" },

                // Actions & Tooltips
                { "AdvancedBAM.Action.Go", "IR" },
                { "AdvancedBAM.Action.GoTooltip", "Focar câmera e inspecionar edifício" },
                { "AdvancedBAM.Action.Plop", "POSICIONAR" },
                { "AdvancedBAM.Action.PlopTooltip", "Ativar ferramenta para posicionar este prefab" },
                { "AdvancedBAM.Action.Clone", "CLONAR" },
                { "AdvancedBAM.Action.CloneTooltip", "Duplicar e posicionar outra cópia deste edifício" },
                { "AdvancedBAM.Action.Tools", "Ferramentas" },
                { "AdvancedBAM.Action.Repair", "REPARAR" },
                { "AdvancedBAM.Action.RepairTooltip", "Reconstruir e remover danos ou abandono" },
                { "AdvancedBAM.Action.RepairAll", "Reparar Todos" },

                // Status
                { "AdvancedBAM.Status.Healthy", "Ativo" },
                { "AdvancedBAM.Status.NeedsRepair", "Danificado" },

                // Summary Strips
                { "AdvancedBAM.Summary.TotalBuildings", "Total de Edifícios" },
                { "AdvancedBAM.Summary.DamagedBuildings", "Necessitam Reparo" },
                { "AdvancedBAM.Summary.AvgEfficiency", "Eficiência Média" },
                { "AdvancedBAM.Summary.TotalOccupancy", "Ocupação Total" },
                { "AdvancedBAM.Summary.Population", "População" },
                { "AdvancedBAM.Summary.Households", "Famílias" },
                { "AdvancedBAM.Summary.Workforce", "Mão de Obra" },
                { "AdvancedBAM.Summary.Policies", "Políticas" },
                { "AdvancedBAM.Summary.ServicesOverview", "Visão Geral dos Serviços" },

                // Pagination & Filters
                { "AdvancedBAM.Pagination.Page", "Página" },
                { "AdvancedBAM.Pagination.Of", "de" },
                { "AdvancedBAM.Pagination.Showing", "Exibindo" },
                { "AdvancedBAM.Pagination.Total", "ativos no total" },
                { "AdvancedBAM.Pagination.Prev", "Ant" },
                { "AdvancedBAM.Pagination.Next", "Próx" },
                { "AdvancedBAM.Filter.PlacedOnly", "Apenas Construídos" },
                { "AdvancedBAM.Filter.CatalogOnly", "Apenas Catálogo" },
                { "AdvancedBAM.Filter.DamagedOnly", "Apenas Danificados" },
                { "AdvancedBAM.Filter.AllDistricts", "Todos os Distritos" },

                { "AdvancedBAM.Header.Maximize", "Maximizar" },
                { "AdvancedBAM.Header.Restore", "Restaurar" },
                { "AdvancedBAM.SEARCH_PLACEHOLDER", "Pesquisar ativos, distritos, temas, pacotes..." },
                { "AdvancedBAM.TOOLS_TOGGLE", "Ferramentas" },
                { "AdvancedBAM.COL_NAME", "Nome" },
                { "AdvancedBAM.COL_CATEGORY", "Categoria" },
                { "AdvancedBAM.COL_DISTRICT", "Distrito" },
                { "AdvancedBAM.COL_LEVEL", "Nível" },
                { "AdvancedBAM.COL_OCCUPANCY", "Ocupação" },
                { "AdvancedBAM.COL_EFFICIENCY", "Eficiência" },
                { "AdvancedBAM.COL_STATUS", "Status" },
                { "AdvancedBAM.COL_ACTIONS", "Ações" },
                { "AdvancedBAM.STATUS_HEALTHY", "Ativo" },
                { "AdvancedBAM.ACT_GO", "Inspecionar" },
                { "AdvancedBAM.ACT_CLONE", "Clonar" },
                { "AdvancedBAM.ACT_PLOP", "Posicionar" },
                { "AdvancedBAM.PAGE", "Página" },
                { "AdvancedBAM.OF", "de" },
                { "AdvancedBAM.TOTAL_ASSETS", "entradas" },
                { "AdvancedBAM.PREV", "Ant" },
                { "AdvancedBAM.NEXT", "Próx" }
            };
        }
        public void Unload() { }
    }
}
