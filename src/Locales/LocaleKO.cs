using System.Collections.Generic;
using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public class LocaleKO : IDictionarySource
    {
        private readonly BamSettings _s;
        public LocaleKO(BamSettings settings) { _s = settings; }

        public IEnumerable<KeyValuePair<string, string>> ReadEntries(IList<IDictionaryEntryError> errors, Dictionary<string, int> indexCounts)
        {
            return new Dictionary<string, string>
            {
                { _s.GetSettingsLocaleID(), "고급 건물 및 에셋 관리자" },
                { _s.GetOptionTabLocaleID(BamSettings.kSection), "기본" },
                { _s.GetOptionTabLocaleID(BamSettings.kExportSection), "내보내기" },
                { _s.GetOptionTabLocaleID(BamSettings.kAboutSection), "정보" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExportGroup), "CSV 데이터 내보내기" },
                { _s.GetOptionGroupLocaleID(BamSettings.kAboutGroup), "모드 정보" },
                { _s.GetOptionGroupLocaleID(BamSettings.kLinksGroup), "커뮤니티 및 링크" },
                { _s.GetOptionGroupLocaleID(BamSettings.kGeneralGroup), "일반" },
                { _s.GetOptionGroupLocaleID(BamSettings.kExplorerGroup), "에셋 탐색기" },
                { _s.GetOptionGroupLocaleID(BamSettings.kWindowGroup), "창" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ShowLauncherButton)), "실행 버튼 표시" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ShowLauncherButton)), "상단 툴바에 에셋 관리자 버튼을 표시합니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "배치 시 창 닫기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.CloseWindowOnPlace)), "배치 또는 복제 클릭 시 창을 자동으로 닫습니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "건물 수리 기능 활성화" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.EnableBuildingRepairs)), "BAM 수리 기능으로 건물의 파손, 화재 및 버려짐 상태를 복구할 수 있도록 허용합니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "새로고침 간격(초)" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RefreshIntervalSeconds)), "도시 건물을 다시 검색하는 주기입니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.RowsPerPage)), "페이지당 행 수" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.RowsPerPage)), "한 페이지에 표시할 행 수입니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "카탈로그 프리팹 포함" },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorCount)), "시민 행복도 표시 항목 수" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorCount)), "건물이나 구역을 검사할 때 표시할 시민 행복도 요인 수를 선택합니다." },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top5), "상위 5개 요인" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.Top10), "상위 10개 요인" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.ShowAll), "모두 표시" },
                { _s.GetEnumValueLocaleID(HappinessDisplayCount.HideAll), "요인 숨기기" },

                { _s.GetOptionLabelLocaleID(nameof(BamSettings.HappinessFactorFilter)), "행복도 요인 필터" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.HappinessFactorFilter)), "표시되는 행복도 요인을 긍정적 또는 부정적 영향별로 필터링합니다." },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.AllFactors), "모든 요인" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.PositiveOnly), "긍정적 요인만" },
                { _s.GetEnumValueLocaleID(HappinessDisplayFilter.NegativeOnly), "부정적 요인만" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.IncludeCatalogPrefabs)), "미배치 프리팹도 목록에 함께 표시합니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ResetWindowPosition)), "창 위치 초기화" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ResetWindowPosition)), "창을 기본 위치로 복원합니다." },

                // Export Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "배치된 자산 내보내기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportPlacedAssetsCsv)), "배치된 모든 건물을 ModsData/AdvancedBAM/Exports/ 경로의 CSV 파일로 내보냅니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "구역 통계 내보내기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportDistrictsCsv)), "구역 인구 통계 및 정책을 ModsData/AdvancedBAM/Exports/ 경로의 CSV 파일로 내보냅니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "카탈로그 프리팹 내보내기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ExportCatalogPrefabsCsv)), "모든 카탈로그 프리팹을 ModsData/AdvancedBAM/Exports/ 경로의 CSV 파일로 내보냅니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenExportFolder)), "내보내기 폴더 열기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenExportFolder)), "Windows 파일 탐색기에서 내보내기 폴더를 엽니다." },

                // About Group
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.AboutSummary)), "고급 건물 및 에셋 관리자(BAM)는 배치된 건물, 도시 서비스, 가구, 창고, 하위 건물 업그레이드, 구역 분석, 정책 관리, 구역 매트릭스 및 카탈로그 즉시 배치를 실시간 ECS 연동으로 제공합니다.\n\n팁: 왼쪽 상단 BAM 아이콘(또는 선택 정보 패널의 \"Open in BAM\")으로 창을 열고, / 또는 Ctrl+F 로 검색하며, 상단 내보내기 탭에서 CSV 보고서를 저장할 수 있습니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Version)), "버전" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Version)), $"설치된 Advanced BAM 릴리스 버전 (v{Mod.ModVersion})." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Author)), "작성자" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Author)), "모드 제작자 및 개발자." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Description)), "정보" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Description)), "기본 ECS 통합 기능을 갖춘 고성능 건물 및 자산 관리자입니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.ParadoxModsId)), "Paradox Mods ID" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.ParadoxModsId)), "Advanced BAM의 고유 Paradox Mods 식별자입니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.Dependencies)), "필수 모드" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.Dependencies)), "테마, 팩 및 자원 아이콘을 올바르게 표시하는 데 필요한 아이콘 라이브러리 모드입니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenParadoxMods)), "Paradox Mods 페이지 열기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenParadoxMods)), "기본 브라우저에서 Advanced BAM (#167082) Paradox Mods 페이지를 엽니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenForumThread)), "Paradox 포럼 스레드 열기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenForumThread)), "Paradox 포럼의 공식 토론 및 지원 스레드로 이동합니다." },
                { _s.GetOptionLabelLocaleID(nameof(BamSettings.OpenGithubRepo)), "GitHub 저장소 열기" },
                { _s.GetOptionDescLocaleID(nameof(BamSettings.OpenGithubRepo)), "GitHub에서 소스 코드, 릴리스 정보 및 이슈 트래커를 봅니다." },

                // UI Window & Shell
                { "AdvancedBAM.WindowTitle", "고급 건물 및 에셋 관리자" },
                { "AdvancedBAM.ToolbarTooltip", "고급 건물 관리자 (BAM)" },
                { "AdvancedBAM.Header.Refresh", "새로고침" },
                { "AdvancedBAM.Header.Close", "닫기" },
                { "AdvancedBAM.Header.Expand", "확장" },
                { "AdvancedBAM.Header.Collapse", "축소" },
                { "AdvancedBAM.SearchPlaceholder", "건물, 프리팹, 구역 검색..." },

                // Categories
                { "AdvancedBAM.Category.All", "모든 에셋" },
                { "AdvancedBAM.Category.Districts", "구역" },
                { "AdvancedBAM.Category.Housing", "주거 현황" },
                { "AdvancedBAM.CAT_HOUSING", "주거 현황" },
                { "AdvancedBAM.Category.ZoneMatrices", "구역 현황" },
                { "AdvancedBAM.CAT_ZONEMATRICES", "구역 현황" },
                { "AdvancedBAM.Category.CommercialMatrix", "상업 현황" },
                { "AdvancedBAM.CAT_COMMERCIALMATRIX", "상업 현황" },
                { "AdvancedBAM.Category.OfficeMatrix", "오피스 현황" },
                { "AdvancedBAM.CAT_OFFICEMATRIX", "오피스 현황" },
                { "AdvancedBAM.Category.IndustrialMatrix", "산업 현황" },
                { "AdvancedBAM.CAT_INDUSTRIALMATRIX", "산업 현황" },
                { "AdvancedBAM.Category.StorageMatrix", "보관소 현황" },
                { "AdvancedBAM.CAT_STORAGEMATRIX", "보관소 현황" },
                { "AdvancedBAM.Category.ServiceMatrix", "공공 서비스 현황" },
                { "AdvancedBAM.CAT_SERVICEMATRIX", "공공 서비스 현황" },
                { "AdvancedBAM.Category.SignatureMatrix", "특화 건물 현황" },
                { "AdvancedBAM.CAT_SIGNATUREMATRIX", "특화 건물 현황" },
                { "AdvancedBAM.Category.Residential", "주거" },
                { "AdvancedBAM.Category.Commercial", "상업" },
                { "AdvancedBAM.Category.Industrial", "산업" },
                { "AdvancedBAM.Category.Office", "오피스" },
                { "AdvancedBAM.Category.Storage", "보관소" },
                { "AdvancedBAM.Category.Service", "공공 서비스" },
                { "AdvancedBAM.Category.Signature", "특화 건물" },
                { "AdvancedBAM.Category.Catalog", "카탈로그" },

                // Table Columns
                { "AdvancedBAM.Column.Name", "에셋 이름" },
                { "AdvancedBAM.Column.Category", "카테고리" },
                { "AdvancedBAM.Column.District", "구역" },
                { "AdvancedBAM.Column.Level", "레벨" },
                { "AdvancedBAM.Column.Occupancy", "점유율" },
                { "AdvancedBAM.Column.Efficiency", "효율" },
                { "AdvancedBAM.Column.Status", "상태" },
                { "AdvancedBAM.Column.Actions", "동작" },

                // Actions & Tooltips
                { "AdvancedBAM.Action.Go", "이동" },
                { "AdvancedBAM.Action.GoTooltip", "카메라를 이동하고 건물을 상세 확인합니다" },
                { "AdvancedBAM.Action.Plop", "배치" },
                { "AdvancedBAM.Action.PlopTooltip", "이 프리팹 배치 도구를 활성화합니다" },
                { "AdvancedBAM.Action.Clone", "복제" },
                { "AdvancedBAM.Action.CloneTooltip", "동일한 건물을 복제하여 배치합니다" },
                { "AdvancedBAM.Action.Tools", "도구" },
                { "AdvancedBAM.Action.Repair", "수리" },
                { "AdvancedBAM.Action.RepairTooltip", "건물 파손 또는 버려진 상태를 복구합니다" },
                { "AdvancedBAM.Action.RepairAll", "모두 수리" },

                // Status
                { "AdvancedBAM.Status.Healthy", "정상" },
                { "AdvancedBAM.Status.NeedsRepair", "손상됨" },

                // Summary Strips
                { "AdvancedBAM.Summary.TotalBuildings", "전체 건물 수" },
                { "AdvancedBAM.Summary.DamagedBuildings", "수리 필요" },
                { "AdvancedBAM.Summary.AvgEfficiency", "평균 효율" },
                { "AdvancedBAM.Summary.TotalOccupancy", "총 점유" },
                { "AdvancedBAM.Summary.Population", "인구" },
                { "AdvancedBAM.Summary.Households", "가구 수" },
                { "AdvancedBAM.Summary.Workforce", "노동력" },
                { "AdvancedBAM.Summary.Policies", "정책" },
                { "AdvancedBAM.Summary.ServicesOverview", "도시 공공 서비스 현황" },

                // Pagination & Filters
                { "AdvancedBAM.Pagination.Page", "페이지" },
                { "AdvancedBAM.Pagination.Of", "/" },
                { "AdvancedBAM.Pagination.Showing", "표시 중" },
                { "AdvancedBAM.Pagination.Total", "개 에셋" },
                { "AdvancedBAM.Pagination.Prev", "이전" },
                { "AdvancedBAM.Pagination.Next", "다음" },
                { "AdvancedBAM.Filter.PlacedOnly", "배치된 건물만" },
                { "AdvancedBAM.Filter.CatalogOnly", "카탈로그만" },
                { "AdvancedBAM.Filter.DamagedOnly", "손상된 건물만" },
                { "AdvancedBAM.Filter.AllDistricts", "모든 구역" },

                { "AdvancedBAM.Header.Maximize", "최대화" },
                { "AdvancedBAM.Header.Restore", "원래 크기로" },
                { "AdvancedBAM.SEARCH_PLACEHOLDER", "에셋, 구역, 테마, 팩 검색..." },
                { "AdvancedBAM.TOOLS_TOGGLE", "도구" },
                { "AdvancedBAM.COL_NAME", "이름" },
                { "AdvancedBAM.COL_CATEGORY", "카테고리" },
                { "AdvancedBAM.COL_DISTRICT", "구역" },
                { "AdvancedBAM.COL_LEVEL", "레벨" },
                { "AdvancedBAM.COL_OCCUPANCY", "점유율" },
                { "AdvancedBAM.COL_EFFICIENCY", "효율" },
                { "AdvancedBAM.COL_STATUS", "상태" },
                { "AdvancedBAM.COL_ACTIONS", "동작" },
                { "AdvancedBAM.STATUS_HEALTHY", "정상" },
                { "AdvancedBAM.ACT_GO", "검사" },
                { "AdvancedBAM.ACT_CLONE", "복제" },
                { "AdvancedBAM.ACT_PLOP", "배치" },
                { "AdvancedBAM.PAGE", "페이지" },
                { "AdvancedBAM.OF", "/" },
                { "AdvancedBAM.TOTAL_ASSETS", "개 항목" },
                { "AdvancedBAM.PREV", "이전" },
                { "AdvancedBAM.NEXT", "다음" }
            };
        }
        public void Unload() { }
    }
}
