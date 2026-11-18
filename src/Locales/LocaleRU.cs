using System.Collections.Generic;
using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public class LocaleRU : IDictionarySource
    {
        private readonly BamSettings _s;
        public LocaleRU(BamSettings settings) { _s = settings; }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                { _s.GetSettingsLocaleID(), "Продвинутый менеджер зданий и ассетов" },
                { _s.GetOptionTabLocaleID(BamSettings.kSection), "Главная" },
                { _s.GetOptionTabLocaleID(BamSettings.kExportSection), "Экспорт" },
                { _s.GetOptionTabLocaleID(BamSettings.kAboutSection), "О моде" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExportGroup), "Экспорт данных CSV" },
                { _s.GetOptionGroupLocaleID(BamSettings.kAboutGroup), "Информация о моде" },
                { _s.GetOptionGroupLocaleID(BamSettings.kLinksGroup), "Сообщество и ссылки" },
                { _s.GetOptionGroupLocaleID(BamSettings.kGeneralGroup), "Общие" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExplorerGroup), "Обозреватель ассетов" },
                { _s.GetOptionGroupLocaleID(BamSettings.kWindowGroup), "Окно" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ShowLauncherButton)), "Показывать кнопку запуска" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ShowLauncherButton)), "Отображает кнопку на верхней панели инструментов." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Закрывать окно при размещении" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "Автоматически закрывать окно после нажатия РАЗМЕСТИТЬ или КЛОНИРОВАТЬ." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Включить действия по ремонту зданий" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "Разрешает действиям ремонта BAM устранять повреждения, пожары и запустение зданий." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Интервал обновления (секунды)" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "Частота сканирования зданий в городе." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RowsPerPage)), "Строк на странице" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RowsPerPage)), "Количество отображаемых строк на странице." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Включить каталог префабов" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorCount)), "Отображаемые факторы счастья" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorCount)), "Выберите, сколько факторов счастья горожан отображать при осмотре зданий или районов." },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top5), "Топ 5 факторов" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top10), "Топ 10 факторов" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.ShowAll), "Показать все" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.HideAll), "Скрыть разбивку" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Фильтр факторов счастья" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorFilter)), "Фильтруйте отображаемые факторы счастья по их положительному или отрицательному влиянию." },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.AllFactors), "Все факторы" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.PositiveOnly), "Только положительные" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.NegativeOnly), "Только отрицательные" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "Отображать еще не построенные префабы для быстрого размещения." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ResetWindowPosition)), "Сбросить положение окна" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ResetWindowPosition)), "Возвращает окно в стандартное положение." },

                // Export Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Экспорт размещенных объектов" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "Экспортирует все размещенные здания в таблицу CSV в ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Экспорт районов" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "Экспортирует статистику районов и политики в таблицу CSV в ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Экспорт каталога префабов" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "Экспортирует все префабы каталога в таблицу CSV в ModsData/AdvancedBAM/Exports/." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenExportFolder)), "Открыть папку экспорта" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenExportFolder)), "Открывает папку экспорта в проводнике Windows." },

                // About Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.AboutSummary)), "Продвинутый менеджер зданий и ассетов (BAM) предоставляет живой ECS-инспектор размещенных зданий, городских служб, домохозяйств, складов, улучшений, аналитику районов, управление политиками, матрицы зон и быстрое размещение из каталога.\n\nСоветы: нажмите значок BAM в левом верхнем углу (или \"Open in BAM\" в панели объекта), используйте / или Ctrl+F для поиска и вкладку «Экспорт» для CSV-отчетов." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Version)), "Версия" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Version)), $"Установленная версия выпуска Advanced BAM (v{Mod.ModVersion})." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Author)), "Автор" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Author)), "Создатель и разработчик мода." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Description)), "О моде" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Description)), "Высокопроизводительный менеджер зданий и ресурсов с интеграцией ECS." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ParadoxModsId)), "ID в Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ParadoxModsId)), "Уникальный идентификатор мода Advanced BAM в Paradox Mods." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Dependencies)), "Необходимые моды" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Dependencies)), "Библиотеки иконок, необходимые для корректного отображения тем, наборов и ресурсов." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenParadoxMods)), "Открыть страницу Paradox Mods" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenParadoxMods)), "Открывает страницу Advanced BAM (#167082) в Paradox Mods в браузере по умолчанию." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenForumThread)), "Открыть тему на форуме Paradox" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenForumThread)), "Переходит к официальному обсуждению и поддержке мода на форуме Paradox." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenGithubRepo)), "Открыть репозиторий GitHub" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenGithubRepo)), "Открывает исходный код, список изменений и трекер ошибок на GitHub." },

                // UI Window & Shell
                { "AdvancedBAM.WindowTitle", "Продвинутый менеджер зданий и ассетов" },
                { "AdvancedBAM.ToolbarTooltip", "Продвинутый менеджер зданий (BAM)" },
                { "AdvancedBAM.Header.Refresh", "Обновить" },
                { "AdvancedBAM.Header.Close", "Закрыть" },
                { "AdvancedBAM.Header.Expand", "Развернуть" },
                { "AdvancedBAM.Header.Collapse", "Свернуть" },
                { "AdvancedBAM.SearchPlaceholder", "Поиск зданий, префабов, районов..." },

                // Categories
                { "AdvancedBAM.Category.All", "Все ассеты" },
                { "AdvancedBAM.Category.Districts", "Районы" },
                { "AdvancedBAM.Category.Housing", "Жильё" },
                { "AdvancedBAM.CAT_HOUSING", "Жильё" },
                { "AdvancedBAM.Category.ZoneMatrices", "Матрицы зон" },
                { "AdvancedBAM.CAT_ZONEMATRICES", "Матрицы зон" },
                { "AdvancedBAM.Category.CommercialMatrix", "Матрица коммерции" },
                { "AdvancedBAM.CAT_COMMERCIALMATRIX", "Матрица коммерции" },
                { "AdvancedBAM.Category.OfficeMatrix", "Матрица офисов" },
                { "AdvancedBAM.CAT_OFFICEMATRIX", "Матрица офисов" },
                { "AdvancedBAM.Category.IndustrialMatrix", "Матрица промзон" },
                { "AdvancedBAM.CAT_INDUSTRIALMATRIX", "Матрица промзон" },
                { "AdvancedBAM.Category.StorageMatrix", "Матрица складов" },
                { "AdvancedBAM.CAT_STORAGEMATRIX", "Матрица складов" },
                { "AdvancedBAM.Category.ServiceMatrix", "Матрица служб" },
                { "AdvancedBAM.CAT_SERVICEMATRIX", "Матрица служб" },
                { "AdvancedBAM.Category.SignatureMatrix", "Матрица уникальных" },
                { "AdvancedBAM.CAT_SIGNATUREMATRIX", "Матрица уникальных" },
                { "AdvancedBAM.Category.Residential", "Жилые" },
                { "AdvancedBAM.Category.Commercial", "Коммерция" },
                { "AdvancedBAM.Category.Industrial", "Промзона" },
                { "AdvancedBAM.Category.Office", "Офисы" },
                { "AdvancedBAM.Category.Storage", "Склады" },
                { "AdvancedBAM.Category.Service", "Службы" },
                { "AdvancedBAM.Category.Signature", "Уникальные" },
                { "AdvancedBAM.Category.Catalog", "Каталог" },

                // Table Columns
                { "AdvancedBAM.Column.Name", "Название ассета" },
                { "AdvancedBAM.Column.Category", "Категория" },
                { "AdvancedBAM.Column.District", "Район" },
                { "AdvancedBAM.Column.Level", "Уровень" },
                { "AdvancedBAM.Column.Occupancy", "Заполненность" },
                { "AdvancedBAM.Column.Efficiency", "Эффективность" },
                { "AdvancedBAM.Column.Status", "Статус" },
                { "AdvancedBAM.Column.Actions", "Действия" },

                // Actions & Tooltips
                { "AdvancedBAM.Action.Go", "ПЕРЕЙТИ" },
                { "AdvancedBAM.Action.GoTooltip", "Навести камеру и осмотреть здание" },
                { "AdvancedBAM.Action.Plop", "ПОСТРОИТЬ" },
                { "AdvancedBAM.Action.PlopTooltip", "Включить инструмент размещения этого префаба" },
                { "AdvancedBAM.Action.Clone", "КЛОНИРОВАТЬ" },
                { "AdvancedBAM.Action.CloneTooltip", "Создать копию и разместить еще одно такое здание" },
                { "AdvancedBAM.Action.Tools", "Инструменты" },
                { "AdvancedBAM.Action.Repair", "ПОЧИНИТЬ" },
                { "AdvancedBAM.Action.RepairTooltip", "Восстановить здание и убрать разрушения" },
                { "AdvancedBAM.Action.RepairAll", "Починить все" },

                // Status
                { "AdvancedBAM.Status.Healthy", "Работает" },
                { "AdvancedBAM.Status.NeedsRepair", "Повреждено" },

                // Summary Strips
                { "AdvancedBAM.Summary.TotalBuildings", "Всего зданий" },
                { "AdvancedBAM.Summary.DamagedBuildings", "Требуют ремонта" },
                { "AdvancedBAM.Summary.AvgEfficiency", "Средняя эффективность" },
                { "AdvancedBAM.Summary.TotalOccupancy", "Общая занятость" },
                { "AdvancedBAM.Summary.Population", "Население" },
                { "AdvancedBAM.Summary.Households", "Домохозяйства" },
                { "AdvancedBAM.Summary.Workforce", "Рабочая сила" },
                { "AdvancedBAM.Summary.Policies", "Политики" },
                { "AdvancedBAM.Summary.ServicesOverview", "Городские службы" },

                // Pagination & Filters
                { "AdvancedBAM.Pagination.Page", "Страница" },
                { "AdvancedBAM.Pagination.Of", "из" },
                { "AdvancedBAM.Pagination.Showing", "Показано" },
                { "AdvancedBAM.Pagination.Total", "ассетов всего" },
                { "AdvancedBAM.Pagination.Prev", "Назад" },
                { "AdvancedBAM.Pagination.Next", "Вперед" },
                { "AdvancedBAM.Filter.PlacedOnly", "Только построенные" },
                { "AdvancedBAM.Filter.CatalogOnly", "Только каталог" },
                { "AdvancedBAM.Filter.DamagedOnly", "Только поврежденные" },
                { "AdvancedBAM.Filter.AllDistricts", "Все районы" },

                { "AdvancedBAM.Header.Maximize", "Максимизировать" },
                { "AdvancedBAM.Header.Restore", "Восстановить" },
                { "AdvancedBAM.SEARCH_PLACEHOLDER", "Поиск ассетов, районов, тем, наборов..." },
                { "AdvancedBAM.TOOLS_TOGGLE", "Инструменты" },
                { "AdvancedBAM.COL_NAME", "Название" },
                { "AdvancedBAM.COL_CATEGORY", "Категория" },
                { "AdvancedBAM.COL_DISTRICT", "Район" },
                { "AdvancedBAM.COL_LEVEL", "Уровень" },
                { "AdvancedBAM.COL_OCCUPANCY", "Заполненность" },
                { "AdvancedBAM.COL_EFFICIENCY", "Эффективность" },
                { "AdvancedBAM.COL_STATUS", "Статус" },
                { "AdvancedBAM.COL_ACTIONS", "Действия" },
                { "AdvancedBAM.STATUS_HEALTHY", "Работает" },
                { "AdvancedBAM.ACT_GO", "Осмотр" },
                { "AdvancedBAM.ACT_CLONE", "Клонировать" },
                { "AdvancedBAM.ACT_PLOP", "Построить" },
                { "AdvancedBAM.PAGE", "Страница" },
                { "AdvancedBAM.OF", "из" },
                { "AdvancedBAM.TOTAL_ASSETS", "записей" },
                { "AdvancedBAM.PREV", "Назад" },
                { "AdvancedBAM.NEXT", "Вперед" }
            };
        }
        public void Unload() { }
    }
}
