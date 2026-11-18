import { bindValue } from 'cs2/api';
import { BAM_GROUP, CHANNELS } from './channels';
import { DEFAULT_WINDOW_RECT_JSON } from './windowConstants';
import bamStorage from '../utils/bamStorage';

export const windowVisible$ = bindValue<boolean>(BAM_GROUP, CHANNELS.WINDOW_VISIBLE, false);
export const launcherVisible$ = bindValue<boolean>(BAM_GROUP, CHANNELS.LAUNCHER_VISIBLE, true);
export const windowRect$ = bindValue<string>(BAM_GROUP, CHANNELS.WINDOW_RECT, DEFAULT_WINDOW_RECT_JSON);
export const rowsPerPage$ = bindValue<number>(BAM_GROUP, CHANNELS.ROWS_PER_PAGE, 50);
export const unifiedAssets$ = bindValue<string>(BAM_GROUP, CHANNELS.UNIFIED_ASSETS, '[]');
export const catalogAssets$ = bindValue<string>(BAM_GROUP, CHANNELS.CATALOG_ASSETS, '[]');
export const serviceStatus$ = bindValue<string>(BAM_GROUP, CHANNELS.SERVICE_STATUS, '{"cards":[]}');
export const inventoryStatus$ = bindValue<string>(BAM_GROUP, CHANNELS.INVENTORY_STATUS, '{}');
export const districtsData$ = bindValue<string>(BAM_GROUP, CHANNELS.DISTRICTS_DATA, '[]');
export const districtPolicies$ = bindValue<string>(BAM_GROUP, CHANNELS.DISTRICT_POLICIES, '[]');
export const isSceneExplorerInstalled$ = bindValue<boolean>(BAM_GROUP, CHANNELS.IS_SCENE_EXPLORER_INSTALLED, false);
export const happinessFactorCount$ = bindValue<number>(BAM_GROUP, CHANNELS.HAPPINESS_FACTOR_COUNT, 2);
export const happinessFactorFilter$ = bindValue<number>(BAM_GROUP, CHANNELS.HAPPINESS_FACTOR_FILTER, 0);
export const uiPrefs$ = bindValue<string>(BAM_GROUP, CHANNELS.UI_PREFS, '');

/** Maps BamSettings.HappinessFactorCount (0=Top5, 1=Top10, 2=ShowAll, 3=HideAll) to UI limit (-1=hide, 0=all). */
export function mapCs2HappyCountToLimit(countEnum: number): number {
  if (countEnum === 0) return 5;
  if (countEnum === 2) return 0;
  if (countEnum === 3) return -1;
  return 10;
}

/** Maps BamSettings.HappinessFactorFilter (0=AllFactors, 1=PositiveOnly, 2=NegativeOnly) to UI filter mode. */
export function mapCs2HappyFilterToMode(filterEnum: number): 'all' | 'pos' | 'neg' {
  if (filterEnum === 1) return 'pos';
  if (filterEnum === 2) return 'neg';
  return 'all';
}

const CS2_SEEN_HAPPY_COUNT_KEY = 'bam_cs2_last_happy_count';
const CS2_SEEN_HAPPY_FILTER_KEY = 'bam_cs2_last_happy_filter';

/** Syncs CS2 Options happiness count/filter changes into BAM storage and notifies mounted views. */
export function syncCs2HappinessToStorage(cs2Count: number, cs2Filter: number): void {
  try {
    const prevCountRaw = bamStorage.getItem(CS2_SEEN_HAPPY_COUNT_KEY);
    if (prevCountRaw !== String(cs2Count)) {
      bamStorage.setItem(CS2_SEEN_HAPPY_COUNT_KEY, String(cs2Count));
      if (prevCountRaw !== null || cs2Count !== 2 || bamStorage.getItem('bam_default_happy_limit') === null) {
        const mappedLimit = mapCs2HappyCountToLimit(cs2Count);
        bamStorage.setItem('bam_default_happy_limit', String(mappedLimit));
        bamStorage.setItem('bam_happy_limit', String(mappedLimit));
        window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'defaultHappyLimit', value: mappedLimit } }));
        window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'districtHappyLimit', value: mappedLimit } }));
      }
    }

    const prevFilterRaw = bamStorage.getItem(CS2_SEEN_HAPPY_FILTER_KEY);
    if (prevFilterRaw !== String(cs2Filter)) {
      bamStorage.setItem(CS2_SEEN_HAPPY_FILTER_KEY, String(cs2Filter));
      if (prevFilterRaw !== null || cs2Filter !== 0 || bamStorage.getItem('bam_happy_filter') === null) {
        const mappedFilter = mapCs2HappyFilterToMode(cs2Filter);
        bamStorage.setItem('bam_bld_happy_filter', mappedFilter);
        bamStorage.setItem('bam_happy_filter', mappedFilter);
        window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'happyFilter', value: mappedFilter } }));
      }
    }
  } catch {
    // Ignore storage access errors outside the Cohtml runtime
  }
}

