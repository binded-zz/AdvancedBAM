import QuickPresetsBar, { QuickPresetId } from './explorer/QuickPresetsBar';
import TableBodyRow from './explorer/TableBodyRow';
import ExplorerFilterFlyout from './explorer/ExplorerFilterFlyout';
import { logCatch } from '../utils/devWarn';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useLocalization } from 'cs2/l10n';
import { bindValue, useValue } from 'cs2/api';
import { Scrollable, Tooltip } from 'cs2/ui';
import { getPixelsPerRem } from './dragHelper';
import { useAssetData } from '../context/AssetDataProvider';
import { CategoryFilter, SubBuildingItem, UnifiedAssetItem, getAssetFavoriteKey } from '../models/assetModels';
import { useBrowserTableState } from '../hooks/useBrowserTableState';
import { usePagination } from '../hooks/usePagination';
import ContextualSummaryStrip from './ContextualSummaryStrip';
import { PILL_COLUMNS_MAP, AssetSubPill } from './common/BamSettingsModal';
import UilIcon from './common/UilIcon';
import AssetThumbnail from './common/AssetThumbnail';
import DistrictsView from './districts/DistrictsView';
import ZoneMatrixPanel, { ZoneMatrixDashboardPage, ZoneMatrixFilterRequest } from './common/ZoneMatrixPanel';
import {
  STORAGE_HUB_GROUP_SILO_TANK,
  STORAGE_HUB_GROUP_WAREHOUSE,
  ZoneMatrixCategory,
  ZoneMatrixSettings,
  classifyStorageKind,
  getEnabledMatrixCategories,
  readZoneMatrixSettings,
} from '../utils/zoneMatrixSettings';
import CustomSelect, { CustomSelectOption } from './common/CustomSelect';
import ThemeIcon from './common/ThemeIcon';
import PackIcon, { isPaidDlcPack } from './common/PackIcon';
import EntityIdBadge from './common/EntityIdBadge';
import ResourceIcon from './common/ResourceIcon';
import ServiceIcon from './common/ServiceIcon';
import useResizableColumns, { ColumnKey } from '../hooks/useResizableColumns';
import useCardReorder from '../hooks/useCardReorder';
import { getCategoryVisual, getEfficiencyFactorIcon, getFactorDisplayLabel, getProfitabilityTierColor } from '../utils/iconLibrary';
import {
  formatCornerLabel,
  formatCurrency,
  formatDensityLabel,
  formatEffectString,
  formatLeisureType,
  formatNumber,
  formatProfitabilityTier,
  formatResourceLabel,
  pluralize,
} from '../utils/formatters';
import { BAM_GROUP, CHANNELS } from '../core/channels';
import {
  windowVisible$,
  happinessFactorCount$,
  happinessFactorFilter$,
  mapCs2HappyCountToLimit,
  mapCs2HappyFilterToMode,
} from '../core/bindings';
import { safeUseValue } from '../core/apiSafe';
import apiSafe from '../core/apiSafe';
import bamStorage from '../utils/bamStorage';
import './UnifiedAssetExplorer.css';

export const DEFAULT_BUILDING_CARD_ORDER = [
  'identity',
  'zoning',
  'operations',
  'performance',
  'economics',
  'education',
  'parking',
  'parks',
  'efficiency',
  'happiness',
  'upgrades',
  'effects',
];

const focusedEntityKey$ = bindValue<string>(BAM_GROUP, CHANNELS.FOCUSED_ENTITY_KEY, '');

type SortableField =
  | 'name'
  | 'lotSize'
  | 'district'
  | 'level'
  | 'occupied'
  | 'efficiency'
  | 'happiness'
  | 'profit'
  | 'company'
  | 'resource'
  | 'theme'
  | 'pack'
  | 'maintenanceCost'
  | 'cat'
  | 'service'
  | 'serviceUsage'
  | 'density'
  | 'status'
  | 'storage'
  | 'vehicles';

export interface AssetGroupVm {
  isGroup: true;
  groupKey: string;
  name: string;
  items: UnifiedAssetItem[];
  first: UnifiedAssetItem;
  totalOccupied: number;
  totalCapacity: number;
  avgEfficiency: number;
  avgHappiness: number;
  avgLevel: number;
}

const CATEGORY_FALLBACK_LABELS: Partial<Record<CategoryFilter, string>> = {
  ZoneMatrices: 'Zone Matrices',
  Housing: 'Residential Matrix',
  CommercialMatrix: 'Commercial Matrix',
  OfficeMatrix: 'Office Matrix',
  IndustrialMatrix: 'Industrial Matrix',
  StorageMatrix: 'Storage Matrix',
  ServiceMatrix: 'Services Matrix',
  SignatureMatrix: 'Signature Matrix',
};

const BASE_CATEGORIES: CategoryFilter[] = [
  'All',
  'Districts',
  'ZoneMatrices',
  'Housing',
  'CommercialMatrix',
  'OfficeMatrix',
  'IndustrialMatrix',
  'StorageMatrix',
  'ServiceMatrix',
  'SignatureMatrix',
  'Residential',
  'Commercial',
  'Industrial',
  'Office',
  'Storage',
  'Service',
  'Signature',
  'Catalog',
];

export const UnifiedAssetExplorer: React.FC = () => {
  const { translate } = useLocalization();
  const {
    assets,
    districts,
    inventoryStatus,
    rowsPerPage,
    focusEntity,
    plopPrefab,
    cloneBuilding,
    rebuildBuilding,
    rebuildAll,
    renameAsset,
  } = useAssetData();

  const [showTools, setShowTools] = useState<boolean>(false);
  const [groupSameName, setGroupSameName] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedUpgrades, setExpandedUpgrades] = useState<Record<string, boolean>>({});
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [focusedDistrictKey, setFocusedDistrictKey] = useState<string | null>(null);
  const focusAttemptsRef = useRef<number>(0);
  const lastFocusRefreshRef = useRef<string>('');

  const [showLotSizeColumn, setShowLotSizeColumn] = useState<boolean>(() => {
    try {
      const v = bamStorage.getItem('bam_setting_show_lotsize');
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  });

  const [showUpgradesBadge, setShowUpgradesBadge] = useState<boolean>(() => {
    try {
      const v = bamStorage.getItem('bam_setting_show_upgrades');
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  });

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_hidden_columns_assets');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [hiddenColsByPill, setHiddenColsByPill] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {};
    const pills = ['Residential', 'Commercial', 'Industrial', 'Office', 'Storage', 'Service', 'Signature', 'Catalog'];
    pills.forEach((p) => {
      try {
        const storageKey = p === 'Catalog' ? 'bam_hidden_columns_catalog' : `bam_hidden_columns_assets_${p}`;
        const saved = bamStorage.getItem(storageKey);
        if (saved) map[p] = new Set(JSON.parse(saved));
      } catch (err) { logCatch('UnifiedAssetExplorer', err); }
    });
    return map;
  });

  const [expandedSubBuildings, setExpandedSubBuildings] = useState<Record<string, boolean>>({});

  const toggleSubBuildingExpand = useCallback((key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubBuildings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleColumnVisibility = (colKey: string) => {
    let pillKey = '';
    if (categoryFilter === 'Residential') pillKey = 'Residential';
    else if (categoryFilter === 'Commercial') pillKey = 'Commercial';
    else if (categoryFilter === 'Office') pillKey = 'Office';
    else if (categoryFilter === 'Storage') pillKey = 'Storage';
    else if (categoryFilter === 'Industrial') pillKey = 'Industrial';
    else if (categoryFilter === 'Service') pillKey = 'Service';
    else if (categoryFilter === 'Signature') pillKey = 'Signature';
    else if (categoryFilter === 'Catalog') pillKey = 'Catalog';

    if (pillKey) {
      setHiddenColsByPill((prev) => {
        const current = new Set(prev[pillKey] || []);
        if (current.has(colKey)) current.delete(colKey);
        else current.add(colKey);
        const next = { ...prev, [pillKey]: current };
        try {
          const storageKey = pillKey === 'Catalog' ? 'bam_hidden_columns_catalog' : `bam_hidden_columns_assets_${pillKey}`;
          const arr = Array.from(current);
          bamStorage.setItem(storageKey, JSON.stringify(arr));
          window.dispatchEvent(
            new CustomEvent('bam-settings-changed', {
              detail:
                pillKey === 'Catalog'
                  ? { key: 'hiddenColumnsCatalog', value: arr }
                  : { key: 'hiddenColumnsPill', pill: pillKey, value: arr },
            })
          );
        } catch (err) { logCatch('UnifiedAssetExplorer', err); }
        return next;
      });
    } else {
      setHiddenColumns((prev) => {
        const next = new Set(prev);
        if (next.has(colKey)) next.delete(colKey);
        else next.add(colKey);
        try {
          bamStorage.setItem('bam_hidden_columns_assets', JSON.stringify(Array.from(next)));
          window.dispatchEvent(
            new CustomEvent('bam-settings-changed', {
              detail: { key: 'hiddenColumnsAssets', value: Array.from(next) },
            })
          );
        } catch (err) { logCatch('UnifiedAssetExplorer', err); }
        return next;
      });
    }
  };

  const isColVisible = (colKey: string) => {
    if (colKey === 'name') return true;
    let pillKey = '';
    if (categoryFilter === 'Residential') pillKey = 'Residential';
    else if (categoryFilter === 'Commercial') pillKey = 'Commercial';
    else if (categoryFilter === 'Office') pillKey = 'Office';
    else if (categoryFilter === 'Storage') pillKey = 'Storage';
    else if (categoryFilter === 'Industrial') pillKey = 'Industrial';
    else if (categoryFilter === 'Service') pillKey = 'Service';
    else if (categoryFilter === 'Signature') pillKey = 'Signature';
    else if (categoryFilter === 'Catalog') pillKey = 'Catalog';

    const pillSet = pillKey ? hiddenColsByPill[pillKey] : null;
    if (pillSet) {
      if (colKey === 'lotSize') return showLotSizeColumn && !pillSet.has('lotSize');
      return !pillSet.has(colKey);
    }

    if (colKey === 'lotSize') return showLotSizeColumn && !hiddenColumns.has('lotSize');
    return !hiddenColumns.has(colKey);
  };

  const [upgradeDisplayMode, setUpgradeDisplayMode] = useState<'both' | 'card' | 'rows'>(() => {
    try {
      return (bamStorage.getItem('bam_upgrade_display_mode') as 'both' | 'card' | 'rows') || 'both';
    } catch {
      return 'both';
    }
  });

  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [themeFilter, setThemeFilter] = useState<string>('All');
  const [packFilter, setPackFilter] = useState<string>('All');
  const [densityFilter, setDensityFilter] = useState<string>('All');
  const [levelFilter, setLevelFilter] = useState<string>('All');
  const [levelOp, setLevelOp] = useState<'=' | '>=' | '<='>('=');
  const [inputResourceFilter, setInputResourceFilter] = useState<string>('All');
  const [outputResourceFilter, setOutputResourceFilter] = useState<string>('All');
  const [storedResourceFilter, setStoredResourceFilter] = useState<string>('All');
  const [storageHubFilter, setStorageHubFilter] = useState<string>('All');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('All');
  const [signatureCatFilter, setSignatureCatFilter] = useState<string>('All');
  const [catalogCatFilter, setCatalogCatFilter] = useState<string>('All');
  const [signatureOnly, setSignatureOnly] = useState<boolean>(false);
  const cs2HappyCount = safeUseValue(happinessFactorCount$, 1);
  const cs2HappyFilter = safeUseValue(happinessFactorFilter$, 0);

  const [bldHappyLimit, setBldHappyLimit] = useState<number>(() => {
    try {
      const saved = bamStorage.getItem('bam_default_happy_limit');
      return saved !== null ? parseInt(saved, 10) : mapCs2HappyCountToLimit(cs2HappyCount);
    } catch {
      return mapCs2HappyCountToLimit(cs2HappyCount);
    }
  });
  const [bldHappyFilter, setBldHappyFilter] = useState<'all' | 'pos' | 'neg'>(() => {
    try {
      const saved = bamStorage.getItem('bam_bld_happy_filter');
      if (saved === 'all' || saved === 'pos' || saved === 'neg') return saved;
    } catch (err) { logCatch('UnifiedAssetExplorer', err); }
    return mapCs2HappyFilterToMode(cs2HappyFilter);
  });
  const [bldEffLimit, setBldEffLimit] = useState<number>(() => {
    try {
      const saved = bamStorage.getItem('bam_default_eff_limit');
      return saved !== null ? parseInt(saved, 10) : 10;
    } catch {
      return 10;
    }
  });
  const [bldEffFilter, setBldEffFilter] = useState<'all' | 'pos' | 'neg'>('all');
  const [lotSizeFilter, setLotSizeFilter] = useState<string>('All');
  const [lotWidthFilter, setLotWidthFilter] = useState<string>('All');
  const [lotWidthOp, setLotWidthOp] = useState<'=' | '>=' | '<='>('=');
  const [lotDepthFilter, setLotDepthFilter] = useState<string>('All');
  const [lotDepthOp, setLotDepthOp] = useState<'=' | '>=' | '<='>('=');
  const [cornerTypeFilter, setCornerTypeFilter] = useState<'all' | 'left' | 'straight' | 'right'>('all');
  const [parkingFilter, setParkingFilter] = useState<'all' | 'with' | 'without'>('all');
  const [isFilterFlyoutOpen, setIsFilterFlyoutOpen] = useState<boolean>(false);
  const [isColumnsPickerOpen, setIsColumnsPickerOpen] = useState<boolean>(false);
  const columnsPickerBtnRef = useRef<HTMLDivElement | null>(null);
  const filterFlyoutPanelRef = useRef<HTMLDivElement | null>(null);
  const filterFlyoutToggleRef = useRef<HTMLButtonElement | null>(null);
  const isBamVisible = safeUseValue<boolean>(windowVisible$, false);

  // Auto-close filter flyout whenever BAM window is hidden/closed
  useEffect(() => {
    if (!isBamVisible && isFilterFlyoutOpen) {
      hideTooltip();
      setIsFilterFlyoutOpen(false);
    }
  }, [isBamVisible, isFilterFlyoutOpen]);

  // Close filter flyout on Escape key press or outside click
  useEffect(() => {
    if (!isFilterFlyoutOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideTooltip();
        setIsFilterFlyoutOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        filterFlyoutPanelRef.current &&
        !filterFlyoutPanelRef.current.contains(target) &&
        filterFlyoutToggleRef.current &&
        !filterFlyoutToggleRef.current.contains(target)
      ) {
        // Do not close if interacting with a select dropdown, option, or backdrop
        if (
          target?.closest?.(
            '.bam-custom-select-dropdown, .bam-custom-select-backdrop, .bam-custom-select-container, .bam-custom-select-option'
          )
        ) {
          return;
        }
        hideTooltip();
        setIsFilterFlyoutOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterFlyoutOpen]);

  // Auto-close columns picker when BAM hidden or Escape pressed
  useEffect(() => {
    if (!isBamVisible && isColumnsPickerOpen) {
      setIsColumnsPickerOpen(false);
    }
  }, [isBamVisible, isColumnsPickerOpen]);

  useEffect(() => {
    if (!isColumnsPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsColumnsPickerOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsPickerBtnRef.current && !columnsPickerBtnRef.current.contains(e.target as Node)) {
        setIsColumnsPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnsPickerOpen]);
  const [showFilterFlyout, setShowFilterFlyout] = useState<boolean>(() => {
    try {
      const saved = bamStorage.getItem('bam_setting_show_filter_flyout');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [filterFlyoutPos, setFilterFlyoutPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = bamStorage.getItem('bam_filter_flyout_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (err) { logCatch('UnifiedAssetExplorer', err); }
    return null;
  });
  const [isDraggingFlyout, setIsDraggingFlyout] = useState<boolean>(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const showTooltip = (text: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = getPixelsPerRem();
    const vpW = window.innerWidth / scale;
    const vpH = window.innerHeight / scale;
    const rawX = (rect.left + rect.width / 2) / scale;
    const rawY = (rect.top - 6) / scale;
    setHoveredTooltip({
      text,
      x: Math.max(110, Math.min(vpW - 110, rawX)),
      y: Math.max(36, Math.min(vpH - 12, rawY)),
    });
  };

  const hideTooltip = () => {
    setHoveredTooltip(null);
  };

  // Tooltip dismiss hardening: immediately dismiss floating tooltip on any global click, window blur, or flyout toggle
  useEffect(() => {
    const handleDismissTooltip = () => setHoveredTooltip(null);
    window.addEventListener('mousedown', handleDismissTooltip);
    window.addEventListener('blur', handleDismissTooltip);
    return () => {
      window.removeEventListener('mousedown', handleDismissTooltip);
      window.removeEventListener('blur', handleDismissTooltip);
    };
  }, []);

  useEffect(() => {
    if (!isFilterFlyoutOpen) {
      setHoveredTooltip(null);
    }
  }, [isFilterFlyoutOpen]);


  const handleFlyoutMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.stopPropagation();

    const scale = getPixelsPerRem();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPos = filterFlyoutPos || { x: 220, y: 120 };

    setIsDraggingFlyout(true);

    const onMouseMove = (moveEvt: MouseEvent) => {
      moveEvt.preventDefault();
      const dx = (moveEvt.clientX - startMouseX) / scale;
      const dy = (moveEvt.clientY - startMouseY) / scale;
      const vpW = window.innerWidth / scale;
      const vpH = window.innerHeight / scale;
      const nextPos = {
        x: Math.round(Math.max(10, Math.min(vpW - 460, startPos.x + dx))),
        y: Math.round(Math.max(10, Math.min(vpH - 200, startPos.y + dy))),
      };
      setFilterFlyoutPos(nextPos);
    };

    const onMouseUp = () => {
      activeFlyoutDragCleanupRef.current = null;
      setIsDraggingFlyout(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setFilterFlyoutPos((cur) => {
        if (cur) {
          try {
            bamStorage.setItem('bam_filter_flyout_pos', JSON.stringify(cur));
          } catch (err) { logCatch('UnifiedAssetExplorer', err); }
        }
        return cur;
      });
    };

    activeFlyoutDragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDraggingFlyout(false);
      activeFlyoutDragCleanupRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  const [showQuickFilterBar, setShowQuickFilterBar] = useState<boolean>(() => {
    try {
      const saved = bamStorage.getItem('bam_setting_show_quick_filter_bar');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [zoneSettings, setZoneSettings] = useState<ZoneMatrixSettings>(readZoneMatrixSettings);
  const enabledMatrixCategories = useMemo(() => getEnabledMatrixCategories(zoneSettings), [zoneSettings]);

  const {
    cardOrder: buildingCardOrder,
    setCardOrder: setBuildingCardOrder,
    draggedCardId: buildingDraggedCardId,
    dragOverCardId: buildingDragOverCardId,
    containerRef: buildingCardsContainerRef,
    handleHeaderMouseDown: handleBuildingCardMouseDown,
    moveCard: moveBuildingCard,
    resetLayout: resetBuildingCardLayout,
  } = useCardReorder({
    initialOrder: DEFAULT_BUILDING_CARD_ORDER,
    storageKey: 'bam_building_card_order',
  });

  useEffect(() => {
    const onSettingsChanged = (e: any) => {
      const k = e.detail?.key;
      if (k === 'showLotSize') {
        setShowLotSizeColumn(e.detail.value);
      } else if (k === 'showUpgrades') {
        setShowUpgradesBadge(e.detail.value);
      } else if (k === 'upgradeDisplayMode') {
        setUpgradeDisplayMode(e.detail.value);
      } else if (k === 'hiddenColumnsAssets') {
        setHiddenColumns(new Set(e.detail.value || []));
      } else if (k === 'hiddenColumnsPill') {
        const { pill, value } = e.detail;
        setHiddenColsByPill((prev) => ({
          ...prev,
          [pill]: new Set(value || []),
        }));
      } else if (k === 'hiddenColumnsCatalog') {
        setHiddenColsByPill((prev) => ({
          ...prev,
          Catalog: new Set(e.detail.value || []),
        }));
      } else if (k === 'defaultHappyLimit') {
        setBldHappyLimit(e.detail.value);
      } else if (k === 'happyFilter' && (e.detail.value === 'all' || e.detail.value === 'pos' || e.detail.value === 'neg')) {
        setBldHappyFilter(e.detail.value);
      } else if (k === 'defaultEffLimit') {
        setBldEffLimit(e.detail.value);
      } else if (k === 'resetColumns') {
        setShowLotSizeColumn(true);
        setHiddenColumns(new Set());
        setHiddenColsByPill({});
      } else if (k === 'showFilterFlyout') {
        setShowFilterFlyout(e.detail.value);
      } else if (k === 'showQuickFilterBar') {
        setShowQuickFilterBar(e.detail.value);
      } else if (k === 'buildingHiddenCards') {
        setHiddenBuildingCards(new Set(e.detail.value || []));
      } else if (k === 'buildingCardOrder' && Array.isArray(e.detail.value)) {
        setBuildingCardOrder(e.detail.value);
      } else if (k === 'buildingCardsReset') {
        setHiddenBuildingCards(new Set());
        setCollapsedBldCards(new Set());
        resetBuildingCardLayout();
      } else if (
        k === 'housingPlacementSettings' ||
        (typeof k === 'string' && (k.startsWith('bam_setting_') || k.startsWith('bam_zone_')))
      ) {
        setZoneSettings(readZoneMatrixSettings());
      }
    };
    const handleSettingsReset = () => {
      setZoneSettings(readZoneMatrixSettings());
    };
    window.addEventListener('bam-settings-changed', onSettingsChanged);
    window.addEventListener('bam-settings-reset', handleSettingsReset);
    window.addEventListener('storage', handleSettingsReset);
    return () => {
      window.removeEventListener('bam-settings-changed', onSettingsChanged);
      window.removeEventListener('bam-settings-reset', handleSettingsReset);
      window.removeEventListener('storage', handleSettingsReset);
    };
  }, [resetBuildingCardLayout, setBuildingCardOrder]);

  const [hiddenBuildingCards, setHiddenBuildingCards] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_building_hidden_cards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (err) { logCatch('UnifiedAssetExplorer', err); }
    return new Set();
  });

  const [collapsedBldCards, setCollapsedBldCards] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_building_collapsed_cards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (err) { logCatch('UnifiedAssetExplorer', err); }
    return new Set();
  });

  const toggleBldCardCollapse = useCallback((cardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedBldCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      try {
        bamStorage.setItem('bam_building_collapsed_cards', JSON.stringify(Array.from(next)));
      } catch (err) { logCatch('UnifiedAssetExplorer', err); }
      return next;
    });
  }, []);

  const exportToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (exportToastTimerRef.current) clearTimeout(exportToastTimerRef.current);
      if (focusScrollTimerRef.current) clearTimeout(focusScrollTimerRef.current);
    };
  }, []);

  const {
    searchText,
    setSearchText,
    categoryFilter,
    setCategoryFilter,
    currentPage,
    setCurrentPage,
    sortField,
    sortDir,
    handleSort,
    sortIndicator,
  } = useBrowserTableState<SortableField>('name', 'asc');

  useEffect(() => {
    if (
      (categoryFilter === 'ZoneMatrices' && (!zoneSettings.topTabUnified || enabledMatrixCategories.length === 0)) ||
      (categoryFilter === 'Housing' && (!zoneSettings.topTabHousing || !zoneSettings.enableHousing)) ||
      (categoryFilter === 'CommercialMatrix' && (!zoneSettings.topTabCommercial || !zoneSettings.enableCommercial)) ||
      (categoryFilter === 'OfficeMatrix' && (!zoneSettings.topTabOffice || !zoneSettings.enableOffice)) ||
      (categoryFilter === 'IndustrialMatrix' && (!zoneSettings.topTabIndustrial || !zoneSettings.enableIndustrial)) ||
      (categoryFilter === 'StorageMatrix' && (!zoneSettings.topTabStorage || !zoneSettings.enableStorage)) ||
      (categoryFilter === 'ServiceMatrix' && (!zoneSettings.topTabService || !zoneSettings.enableService)) ||
      (categoryFilter === 'SignatureMatrix' && (!zoneSettings.topTabSignature || !zoneSettings.enableSignature))
    ) {
      setCategoryFilter('Districts');
    }
  }, [zoneSettings, enabledMatrixCategories, categoryFilter, setCategoryFilter]);

  // Fast local input state for 60 FPS typing without heavy dataset filter stalling
  const [searchInput, setSearchInput] = useState<string>(searchText);
  const activeFlyoutDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSearchInput(searchText);
  }, [searchText]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchText) {
        setSearchText(searchInput);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [searchInput, searchText, setSearchText]);

  // Clean up any dangling flyout drag listeners on unmount
  useEffect(() => {
    return () => {
      if (activeFlyoutDragCleanupRef.current) {
        activeFlyoutDragCleanupRef.current();
        activeFlyoutDragCleanupRef.current = null;
      }
    };
  }, []);

  // Search Input Ref & Keyboard Shortcuts (/ or Ctrl+F)
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableHeaderRef = useRef<HTMLDivElement | null>(null);

  const getTableScrollableContent = (): HTMLElement | null => {
    return (
      document.querySelector('.bam-table-body [class*="content_"]') ||
      document.querySelector('.bam-table-body > div') ||
      document.querySelector('.bam-table-body')
    ) as HTMLElement | null;
  };

  const handleTableScroll = useCallback((e?: React.UIEvent<HTMLElement>) => {
    const c = (e?.currentTarget || e?.target || getTableScrollableContent()) as HTMLElement;
    if (!c || !tableHeaderRef.current) return;
    tableHeaderRef.current.scrollLeft = c.scrollLeft;
  }, []);

  const handleHeaderWheel = useCallback((e: React.WheelEvent) => {
    const c = getTableScrollableContent();
    if (c && (e.deltaX || (e.shiftKey && e.deltaY))) {
      c.scrollLeft += (e.deltaX || e.deltaY);
    }
  }, []);
  const [statusFilter, setStatusFilter] = useState<'all' | 'damaged' | 'turnedOff'>('all');
  // Favorites (Starred assets) state persisted in localStorage
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = useCallback((key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        bamStorage.setItem('bam_favorites', JSON.stringify(Array.from(next)));
      } catch (err) { logCatch('UnifiedAssetExplorer', err); }
      return next;
    });
  }, []);

  const [quickPreset, setQuickPreset] = useState<QuickPresetId>('all');
  const [exportToast, setExportToast] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditing = targetTag === 'input' || targetTag === 'textarea';

      if (e.key === '/' && !isEditing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExportCsv = () => {
    if (!filteredAssets || filteredAssets.length === 0) return;
    const headers = [
      'ID',
      'Name',
      'Address',
      'Prefab',
      'Category',
      'SubCategory',
      'District',
      'Level',
      'Occupied',
      'Capacity',
      'Efficiency',
      'Upkeep',
      'Income',
      'Profit',
      'Wealth',
      'Condition',
      'NeedsRepair',
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredAssets.map((item) => [
      escapeCsv(item.id || item.entityKey),
      escapeCsv(item.name),
      escapeCsv(item.roadName || ''),
      escapeCsv(item.prefabName || item.secondaryName || ''),
      escapeCsv(item.category),
      escapeCsv(item.subCategory || ''),
      escapeCsv(item.district || ''),
      escapeCsv(item.level ?? 1),
      escapeCsv(item.occupied ?? 0),
      escapeCsv(item.capacity ?? 0),
      escapeCsv(item.efficiency ?? -1),
      escapeCsv(item.totalUpkeep ?? item.maintenanceCost ?? 0),
      escapeCsv(item.income ?? 0),
      escapeCsv(item.monthlyProfit ?? 0),
      escapeCsv(item.householdWealth || ''),
      escapeCsv(item.buildingCondition ?? 0),
      escapeCsv(item.needsRepair ? 'true' : 'false'),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    apiSafe.exportCsv(csvContent, `BAM_${categoryFilter || 'All'}`);

    setExportToast(`Saved ${formatNumber(filteredAssets.length)} items to ModsData/AdvancedBAM/Exports/`);
    if (exportToastTimerRef.current) clearTimeout(exportToastTimerRef.current);
    exportToastTimerRef.current = setTimeout(() => setExportToast(null), 3500);
  };


  // Focus listener from Selected Info Panel "Open in BAM" button
  const focusedKey = useValue(focusedEntityKey$);
  useEffect(() => {
    if (!focusedKey) {
      lastFocusRefreshRef.current = '';
      return;
    }

    const normKey = (k?: string) => String(k || '').replace(/[,:]/g, ':').trim();
    const fk = normKey(focusedKey);
    if (!fk) return;

    // 1. Check if focused entity is a District
    if (Array.isArray(districts) && districts.length > 0) {
      const matchedDistrict = districts.find((d) => d && normKey(d.entityKey) === fk);
      if (matchedDistrict) {
        setCategoryFilter('Districts');
        setFocusedDistrictKey(matchedDistrict.entityKey);
        lastFocusRefreshRef.current = '';
        apiSafe.trigger(BAM_GROUP, CHANNELS.CLEAR_FOCUSED_ENTITY);
        return;
      }
    }

    if (!assets || assets.length === 0) return;

    // 2. Check Buildings, Tenant Companies, and Installed Upgrades
    const target = assets.find(
      (a) =>
        normKey(a.entityKey) === fk ||
        normKey(a.id) === fk ||
        (a.companyEntityKey && normKey(a.companyEntityKey) === fk) ||
        (a.subBuildings && a.subBuildings.some((s) => normKey(s.entityKey) === fk))
    );

    if (target) {
      const matchedSub = target.subBuildings?.find((s) => normKey(s.entityKey) === fk);
      if (matchedSub) {
        setExpandedSubBuildings((prev) => ({ ...prev, [matchedSub.entityKey]: true }));
      }
      const targetCat = BASE_CATEGORIES.includes(target.category as any)
        ? (target.category as CategoryFilter)
        : 'All';
      setCategoryFilter(targetCat);
      setSearchText('');
      setDistrictFilter('');
      setThemeFilter('All');
      setPackFilter('All');
      setDensityFilter('All');
      setLevelFilter('All');
      setInputResourceFilter('All');
      setOutputResourceFilter('All');
      setStoredResourceFilter('All');
      setStorageHubFilter('All');
      setServiceTypeFilter('All');
      setSignatureCatFilter('All');
      setCatalogCatFilter('All');
      setSignatureOnly(false);
    setStatusFilter('all');
    setQuickPreset('all');
      setGroupSameName(false);
      setExpandedRowId(target.id);
      setFocusedHighlightId(target.id);
      setPendingFocusId(target.id);
      lastFocusRefreshRef.current = '';

      apiSafe.trigger(BAM_GROUP, CHANNELS.CLEAR_FOCUSED_ENTITY);
    } else if (lastFocusRefreshRef.current !== fk) {
      // Request at most ONE backend refresh per unknown key to avoid infinite refresh loops
      lastFocusRefreshRef.current = fk;
      apiSafe.requestRefresh();
    } else {
      lastFocusRefreshRef.current = '';
      apiSafe.trigger(BAM_GROUP, CHANNELS.CLEAR_FOCUSED_ENTITY);
    }
  }, [focusedKey, assets, districts, setCategoryFilter, setSearchText]);

  useEffect(() => {
    try {
      if (categoryFilter) {
        bamStorage.setItem('bam_active_category_view', categoryFilter);
      }
    } catch (err) {
      logCatch('UnifiedAssetExplorer', err);
    }
  }, [categoryFilter]);

  useEffect(() => {
    setExpandedGroups((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [categoryFilter, districtFilter, quickPreset, statusFilter, searchText, groupSameName]);

  const {
    columnOrder,
    activeResizingCol,
    handleResizeStart,
    resetColumnWidth,
    resetAllWidths,
    getColStyle,
  } = useResizableColumns(categoryFilter ? categoryFilter.toLowerCase() : 'all');

  const activeViewColumns = useMemo<ColumnKey[]>(() => {
    const allowed: string[] =
      categoryFilter === 'Catalog'
        ? ['name', 'lotSize', 'cat', 'themePack', 'level', 'occupied', 'actions']
        : PILL_COLUMNS_MAP[(categoryFilter === 'All' ? 'all' : categoryFilter) as AssetSubPill] ||
          PILL_COLUMNS_MAP.all;
    const ordered = columnOrder.filter((k) => allowed.includes(k));
    allowed.forEach((k) => {
      if (!ordered.includes(k as ColumnKey)) {
        const actionsIdx = ordered.indexOf('actions');
        if (actionsIdx >= 0) ordered.splice(actionsIdx, 0, k as ColumnKey);
        else ordered.push(k as ColumnKey);
      }
    });
    return ordered.filter((k) => k === 'name' || isColVisible(k));
  }, [categoryFilter, columnOrder, hiddenColumns, hiddenColsByPill, showLotSizeColumn]);

  useEffect(() => {
    const onFullReset = () => {
      setShowLotSizeColumn(true);
      setShowUpgradesBadge(true);
      setUpgradeDisplayMode('both');
      setHiddenColumns(new Set());
      setHiddenColsByPill({});
      setHiddenBuildingCards(new Set());
      setCollapsedBldCards(new Set());
      setBldHappyLimit(mapCs2HappyCountToLimit(cs2HappyCount));
      setBldHappyFilter(mapCs2HappyFilterToMode(cs2HappyFilter));
      setBldEffLimit(10);
      setShowFilterFlyout(true);
      setShowQuickFilterBar(true);
      resetAllWidths();
      resetBuildingCardLayout();
    };
    window.addEventListener('bam-settings-reset', onFullReset);
    return () => window.removeEventListener('bam-settings-reset', onFullReset);
  }, [resetAllWidths, resetBuildingCardLayout, cs2HappyCount, cs2HappyFilter]);

  const renderResizer = (colKey: ColumnKey) => (
    <div
      className={`bam-col-resizer${activeResizingCol === colKey ? ' resizing' : ''}`}
      onMouseDown={(e) => handleResizeStart(colKey, e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        resetColumnWidth(colKey);
      }}
      onClick={(e) => e.stopPropagation()}
      title="Drag to resize column (Double-click to reset)"
    />
  );

  // Compute unique filter options from assets
  const uniqueThemes = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.theme && a.theme.trim() !== '') set.add(a.theme.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const uniquePacks = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      const p = a.assetPack || 'Base Game';
      if (p.trim() !== '') set.add(p.trim());
    });
    if (Array.isArray(inventoryStatus?.packs)) {
      inventoryStatus.packs.forEach((pm) => {
        if (pm?.name && pm.name.trim() !== '') set.add(pm.name.trim());
      });
    }
    return ['All', ...Array.from(set).sort()];
  }, [assets, inventoryStatus]);

  const themeIconMap = useMemo(() => {
    const map = new Map<string, string>();
    assets.forEach((a) => {
      if (a.theme && a.theme !== 'Unknown' && !map.has(a.theme)) {
        map.set(a.theme, a.themeIcon || '');
      }
    });
    if (!map.has('European')) map.set('European', 'Media/Game/Themes/European.svg');
    if (!map.has('EU')) map.set('EU', 'Media/Game/Themes/European.svg');
    if (!map.has('North American')) map.set('North American', 'Media/Game/Themes/North American.svg');
    if (!map.has('NorthAmerican')) map.set('NorthAmerican', 'Media/Game/Themes/North American.svg');
    if (!map.has('USA')) map.set('USA', 'Media/Game/Themes/North American.svg');
    return map;
  }, [assets]);

  const packIconMap = useMemo(() => {
    const map = new Map<string, string>();
    assets.forEach((a) => {
      if (a.assetPack && !map.has(a.assetPack)) {
        map.set(a.assetPack, a.assetPackIcon || '');
      }
    });
    if (Array.isArray(inventoryStatus?.packs)) {
      inventoryStatus.packs.forEach((pm) => {
        if (pm?.name && pm.icon && (!map.has(pm.name) || !map.get(pm.name))) {
          map.set(pm.name, pm.icon);
        }
      });
    }
    return map;
  }, [assets, inventoryStatus]);

  const { dlcPacks, regionPacks } = useMemo(() => {
    const dlcs: string[] = [];
    const regions: string[] = [];
    uniquePacks.forEach((p) => {
      if (p === 'All' || p.toLowerCase() === 'base game') return;
      if (isPaidDlcPack(p)) {
        dlcs.push(p);
      } else {
        regions.push(p);
      }
    });
    return { dlcPacks: dlcs, regionPacks: regions };
  }, [uniquePacks]);

  const getPackAbbrev = (p: string): string => {
    const clean = p.replace(/^(CCP|DLC|Pack)\s*/i, '').trim();
    const lower = clean.toLowerCase();
    if (lower.includes('urban promenade')) return 'UP';
    if (lower.includes('modern heritage')) return 'MH';
    if (lower.includes('leisure venue')) return 'LV';
    if (lower.includes('dragon gate')) return 'DG';
    if (lower.includes('skyscraper')) return 'SK';
    if (lower.includes('supply chain')) return 'SC';
    if (lower.includes('office evolution')) return 'OE';
    if (lower.includes('san francisco')) return 'SF';
    if (lower.includes('beach propert')) return 'BP';
    if (lower.includes('bridges') || lower.includes('ports')) return 'BP';
    if (lower.includes('city station')) return 'CS';
    if (lower.includes('downtown market')) return 'DM';
    if (lower.includes('first response')) return 'FR';
    if (lower.includes('france') || lower.includes('french')) return 'FR';
    if (lower.includes('germany') || lower.includes('german')) return 'DE';
    if (lower.includes('united kingdom') || lower.includes('uk')) return 'UK';
    if (lower.includes('china') || lower.includes('chinese')) return 'CN';
    if (lower.includes('japan') || lower.includes('japanese')) return 'JP';
    if (lower.includes('netherlands') || lower.includes('dutch')) return 'NL';
    if (lower.includes('east europe')) return 'EE';
    if (lower.includes('southwest') || lower.includes('ussw')) return 'SW';
    if (lower.includes('northeast') || lower.includes('usne')) return 'NE';

    const words = clean.split(/[\s\-_]+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    if (clean.length <= 3) return clean.toUpperCase();
    return clean.substring(0, 2).toUpperCase();
  };

  const getPackFullName = (p: string): string => {
    if (!p || p === 'All') return 'All Content Packs';
    if (p.toLowerCase() === 'base game' || p.toLowerCase() === 'basegame') return 'Base Game Assets';
    const clean = p.replace(/^(CCP|DLC|Pack)\s*/i, '').trim();
    const lower = clean.toLowerCase();
    if (lower.includes('urban promenade')) return 'Urban Promenades CCP';
    if (lower.includes('modern heritage')) return 'Modern Heritage CCP';
    if (lower.includes('leisure venue')) return 'Leisure Venues CCP';
    if (lower.includes('dragon gate')) return 'Dragon Gate CCP';
    if (lower.includes('skyscraper')) return 'Skyscrapers CCP';
    if (lower.includes('supply chain')) return 'Supply Chains CCP';
    if (lower.includes('office evolution')) return 'Office Evolution CCP';
    if (lower.includes('san francisco')) return 'San Francisco Set';
    if (lower.includes('beach propert')) return 'Beach Properties Asset Pack';
    if (lower.includes('bridges') || lower.includes('ports')) return 'Bridges & Ports Expansion';
    if (lower.includes('city station')) return 'City Stations CCP';
    if (lower.includes('downtown market')) return 'Downtown Market Set';
    if (lower.includes('first response')) return 'First Response Asset Pack';
    if (lower.includes('france') || lower.includes('french')) return 'France Region Pack';
    if (lower.includes('germany') || lower.includes('german')) return 'Germany Region Pack';
    if (lower.includes('united kingdom') || lower.includes('uk')) return 'United Kingdom Region Pack';
    if (lower.includes('china') || lower.includes('chinese')) return 'China Region Pack';
    if (lower.includes('japan') || lower.includes('japanese')) return 'Japan Region Pack';
    if (lower.includes('netherlands') || lower.includes('dutch')) return 'Netherlands Region Pack';
    if (lower.includes('east europe')) return 'Eastern Europe Region Pack';
    if (lower.includes('southwest') || lower.includes('ussw')) return 'South West USA Region Pack';
    if (lower.includes('northeast') || lower.includes('usne')) return 'North East USA Region Pack';
    return p;
  };

  // Build CustomSelect options
  const realDistricts = useMemo(
    () => (Array.isArray(districts) ? districts.filter((d) => d && d.entityKey !== 'city') : []),
    [districts]
  );

  const districtOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [
      { value: '', label: 'All Districts' },
      { value: '__unassigned__', label: 'No District (Unassigned)' },
    ];
    for (const d of realDistricts) {
      opts.push({ value: d.entityKey, label: d.name });
    }
    return opts;
  }, [realDistricts]);

  const themeOptions: CustomSelectOption[] = useMemo(() => {
    return uniqueThemes.map((t) => ({
      value: t,
      label:
        t === 'All'
          ? 'All Themes'
          : t === 'NorthAmerican' || t === 'North American' || t === 'USA'
          ? 'USA / North American'
          : t === 'European' || t === 'EU'
          ? 'EU / European'
          : t === 'Unknown'
          ? 'Unknown Theme'
          : t,
      icon:
        t !== 'All' ? (
          <ThemeIcon theme={t} themeIcon={themeIconMap.get(t)} sizeRem={20} />
        ) : undefined,
    }));
  }, [uniqueThemes, themeIconMap]);

  const packOptions: CustomSelectOption[] = useMemo(() => {
    return uniquePacks.map((p) => {
      const isPaid = isPaidDlcPack(p);
      return {
        value: p,
        label: p === 'All' ? 'All Packs' : p,
        icon:
          p !== 'All' ? (
            <PackIcon pack={p} packIcon={packIconMap.get(p)} sizeRem={20} />
          ) : undefined,
        className: isPaid ? 'paid-dlc' : undefined,
        extra: isPaid ? <span className="bam-paid-gold-tag">DLC</span> : undefined,
      };
    });
  }, [uniquePacks, packIconMap]);

  // Dynamic resource lists scoped strictly to current category tab
  const currentCategoryAssets = useMemo(() => {
    if (categoryFilter === 'All') return assets;
    if (categoryFilter === 'Housing') return assets.filter((a) => a.category === 'Residential');
    return assets.filter((a) => a.category === categoryFilter);
  }, [assets, categoryFilter]);

  const uniqueInputResources = useMemo(() => {
    const set = new Set<string>();
    currentCategoryAssets.forEach((a) => {
      if (Array.isArray(a.inputResources)) {
        a.inputResources.forEach((r) => {
          if (r && r.trim() !== '' && !/^\d+$/.test(r.trim())) set.add(r.trim());
        });
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [currentCategoryAssets]);

  const uniqueOutputResources = useMemo(() => {
    const set = new Set<string>();
    currentCategoryAssets.forEach((a) => {
      if (Array.isArray(a.outputResources)) {
        a.outputResources.forEach((r) => {
          if (r && r.trim() !== '' && !/^\d+$/.test(r.trim())) set.add(r.trim());
        });
      } else if (a.resource && a.resource.trim() !== '' && !/^\d+$/.test(a.resource.trim())) {
        set.add(a.resource.trim());
      }
    });
    if (categoryFilter === 'Office') {
      ['Software', 'Telecom', 'Financial', 'Media'].forEach((o) => set.add(o));
    }
    return ['All', ...Array.from(set).sort()];
  }, [currentCategoryAssets, categoryFilter]);

  const uniqueStorageResources = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.category === 'Storage') {
        if (Array.isArray(a.outputResources)) {
          a.outputResources.forEach((r) => {
            if (r && r.trim() !== '' && !/^\d+$/.test(r.trim())) set.add(r.trim());
          });
        }
        if (Array.isArray(a.inputResources)) {
          a.inputResources.forEach((r) => {
            if (r && r.trim() !== '' && !/^\d+$/.test(r.trim())) set.add(r.trim());
          });
        }
        if (Array.isArray((a as any).storedResources)) {
          (a as any).storedResources.forEach((sr: any) => {
            if (sr && sr.name && sr.name.trim() !== '' && !/^\d+$/.test(sr.name.trim())) {
              set.add(sr.name.trim());
            }
          });
        }
        if (a.resource && a.resource.trim() !== '' && !/^\d+$/.test(a.resource.trim())) {
          set.add(a.resource.trim());
        }
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const uniqueStorageHubTypes = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.category === 'Storage' && a.subCategory && a.subCategory.trim() !== '') {
        set.add(a.subCategory.trim());
      }
    });
    if (set.size === 0) {
      return ['All', 'Warehouse', 'Cargo Terminal', 'Harbor', 'Grain Silo', 'Oil Tank', 'Storage Facility'];
    }
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const uniqueServiceTypes = useMemo(() => {
    const set = new Set<string>();
    [
      'Communications',
      'Education & Research',
      'Electricity',
      'Fire & Rescue',
      'Garbage Management',
      'Health & Deathcare',
      'Landscaping',
      'Parks & Recreation',
      'Police & Administration',
      'Roads',
      'Transportation',
      'Water & Sewage',
    ].forEach((s) => set.add(s));

    assets.forEach((a) => {
      if (a.category === 'Service' && a.subCategory && a.subCategory.trim() !== '') {
        set.add(a.subCategory.trim());
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const parseLotScore = (dim?: string, fallbackArea?: number): number => {
    if (!dim) return fallbackArea ?? 0;
    const parts = dim.replace('×', 'x').split('x');
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10) || 0;
      const d = parseInt(parts[1], 10) || 0;
      return w * d * 100 + w;
    }
    return fallbackArea ?? 0;
  };

  // Fast pre-parsed metadata cache for high-speed filtering and option generation
  const assetMetaMap = useMemo(() => {
    const map = new Map<string, {
      w: number;
      d: number;
      normLot: string;
      cType: string;
      hasParking: boolean;
      searchTokens: string;
    }>();

    const arr = assets || [];
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      let w = 0, d = 0;
      let normLot = '';
      if (a.lotDimensions && a.lotDimensions !== '-') {
        normLot = a.lotDimensions.replace('x', '×').trim();
        const parts = a.lotDimensions.replace('×', 'x').split('x');
        w = parseInt(parts[0], 10) || 0;
        d = parseInt(parts[1], 10) || 0;
      }
      const cType = (a.cornerType || 'straight').toLowerCase();
      const hasParking = (a.parkingCapacity != null && a.parkingCapacity > 0) || (a.parkedVehicles != null && a.parkedVehicles > 0);
      const searchTokens = a.isPlaced
        ? `${a.name} ${a.company || ''}`.toLowerCase()
        : `${a.name} ${a.prefabName || ''}`.toLowerCase();

      map.set(a.id || a.entityKey, { w, d, normLot, cType, hasParking, searchTokens });
    }
    return map;
  }, [assets]);

  // Dynamic Board Items (assets on the currently viewed board)
  const boardItems = useMemo(() => {
    return (assets || []).filter((item) => {
      if (categoryFilter === 'Catalog') {
        if (item.isPlaced) return false;
        if (catalogCatFilter !== 'All' && item.category !== catalogCatFilter) return false;
        return true;
      }
      if (!item.isPlaced) return false;
      if (categoryFilter === 'Signature') {
        if (!item.isSignature) return false;
        if (signatureCatFilter !== 'All' && item.category !== signatureCatFilter) return false;
        return true;
      }
      if (categoryFilter !== 'All') {
        return item.category === categoryFilter;
      }
      return true;
    });
  }, [assets, categoryFilter, catalogCatFilter, signatureCatFilter]);

  const boardLotWidths = useMemo(() => {
    const set = new Set<number>();
    const targetD = lotDepthFilter !== 'All' ? parseInt(lotDepthFilter, 10) : NaN;

    boardItems.forEach((a) => {
      const meta = assetMetaMap.get(a.id || a.entityKey);
      if (!meta || meta.w <= 0) return;

      if (!isNaN(targetD)) {
        if (lotDepthOp === '=' && meta.d !== targetD) return;
        if (lotDepthOp === '>=' && meta.d < targetD) return;
        if (lotDepthOp === '<=' && meta.d > targetD) return;
      }
      if (cornerTypeFilter !== 'all') {
        if (cornerTypeFilter === 'left' && meta.cType !== 'left' && meta.cType !== 'both' && meta.cType !== 'all') return;
        if (cornerTypeFilter === 'right' && meta.cType !== 'right' && meta.cType !== 'both' && meta.cType !== 'all') return;
        if (cornerTypeFilter === 'straight' && meta.cType !== 'straight' && meta.cType !== 'front') return;
      }
      if (parkingFilter !== 'all') {
        if (parkingFilter === 'with' && !meta.hasParking) return;
        if (parkingFilter === 'without' && meta.hasParking) return;
      }

      set.add(meta.w);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [boardItems, assetMetaMap, lotDepthFilter, lotDepthOp, cornerTypeFilter, parkingFilter]);

  const boardLotDepths = useMemo(() => {
    const set = new Set<number>();
    const targetW = lotWidthFilter !== 'All' ? parseInt(lotWidthFilter, 10) : NaN;

    boardItems.forEach((a) => {
      const meta = assetMetaMap.get(a.id || a.entityKey);
      if (!meta || meta.d <= 0) return;

      if (!isNaN(targetW)) {
        if (lotWidthOp === '=' && meta.w !== targetW) return;
        if (lotWidthOp === '>=' && meta.w < targetW) return;
        if (lotWidthOp === '<=' && meta.w > targetW) return;
      }
      if (cornerTypeFilter !== 'all') {
        if (cornerTypeFilter === 'left' && meta.cType !== 'left' && meta.cType !== 'both' && meta.cType !== 'all') return;
        if (cornerTypeFilter === 'right' && meta.cType !== 'right' && meta.cType !== 'both' && meta.cType !== 'all') return;
        if (cornerTypeFilter === 'straight' && meta.cType !== 'straight' && meta.cType !== 'front') return;
      }
      if (parkingFilter !== 'all') {
        if (parkingFilter === 'with' && !meta.hasParking) return;
        if (parkingFilter === 'without' && meta.hasParking) return;
      }

      set.add(meta.d);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [boardItems, assetMetaMap, lotWidthFilter, lotWidthOp, cornerTypeFilter, parkingFilter]);

  const lotWidthList = useMemo(() => ['All', ...boardLotWidths.map(String)], [boardLotWidths]);
  const lotDepthList = useMemo(() => ['All', ...boardLotDepths.map(String)], [boardLotDepths]);
  const buildingLevelList = useMemo(() => ['All', '1', '2', '3', '4', '5'], []);

  const stepLotWidth = (delta: number) => {
    const currentIdx = Math.max(0, lotWidthList.indexOf(lotWidthFilter));
    const nextIdx = (currentIdx + delta + lotWidthList.length) % lotWidthList.length;
    setLotWidthFilter(lotWidthList[nextIdx]);
  };

  const stepLotDepth = (delta: number) => {
    const currentIdx = Math.max(0, lotDepthList.indexOf(lotDepthFilter));
    const nextIdx = (currentIdx + delta + lotDepthList.length) % lotDepthList.length;
    setLotDepthFilter(lotDepthList[nextIdx]);
  };

  const stepBuildingLevel = (delta: number) => {
    const currentIdx = Math.max(0, buildingLevelList.indexOf(levelFilter));
    const nextIdx = (currentIdx + delta + buildingLevelList.length) % buildingLevelList.length;
    setLevelFilter(buildingLevelList[nextIdx]);
  };

  const lotWidthOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [{ value: 'All', label: 'All Widths' }];
    const widths = [...boardLotWidths];
    if (lotWidthFilter !== 'All') {
      const curW = parseInt(lotWidthFilter, 10);
      if (!isNaN(curW) && !widths.includes(curW)) {
        widths.push(curW);
        widths.sort((a, b) => a - b);
      }
    }
    widths.forEach((w) => opts.push({ value: String(w), label: `${w} Wide` }));
    return opts;
  }, [boardLotWidths, lotWidthFilter]);

  const lotDepthOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [{ value: 'All', label: 'All Depths' }];
    const depths = [...boardLotDepths];
    if (lotDepthFilter !== 'All') {
      const curD = parseInt(lotDepthFilter, 10);
      if (!isNaN(curD) && !depths.includes(curD)) {
        depths.push(curD);
        depths.sort((a, b) => a - b);
      }
    }
    depths.forEach((d) => opts.push({ value: String(d), label: `${d} Deep` }));
    return opts;
  }, [boardLotDepths, lotDepthFilter]);

  const lotSizeOptions: CustomSelectOption[] = useMemo(() => {
    const set = new Set<string>();
    boardItems.forEach((a) => {
      const meta = assetMetaMap.get(a.id || a.entityKey);
      if (meta && meta.normLot) {
        set.add(meta.normLot);
      }
    });
    const sorted = Array.from(set).sort((a, b) => {
      return parseLotScore(a) - parseLotScore(b);
    });
    return [
      { value: 'All', label: 'All Lot Sizes' },
      ...sorted.map((s) => ({ value: s, label: s })),
    ];
  }, [boardItems, assetMetaMap]);

  const densityOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [{ value: 'All', label: 'All Densities' }];
    const list = Array.isArray(assets) ? assets : [];

    if (categoryFilter === 'Commercial') {
      opts.push({ value: 'Low', label: 'Low Density' });
      const hasMed = list.some((a) => a.isPlaced && a.category === 'Commercial' && (a.density || '').toLowerCase() === 'medium');
      if (hasMed) opts.push({ value: 'Medium', label: 'Medium Density' });
      opts.push({ value: 'High', label: 'High Density' });
      const hasRowMix = list.some((a) => a.isPlaced && a.category === 'Commercial' && ((a.density || '').toLowerCase() === 'row' || (a.density || '').toLowerCase() === 'mixed'));
      if (hasRowMix) opts.push({ value: 'RowOrMixed', label: 'Row / Mixed Business' });
      const hasSig = list.some((a) => a.isPlaced && a.category === 'Commercial' && a.isSignature);
      if (hasSig) opts.push({ value: 'Signature', label: 'Signature Venues' });
    } else if (categoryFilter === 'Office') {
      opts.push({ value: 'Low', label: 'Low Density' });
      const hasMed = list.some((a) => a.isPlaced && a.category === 'Office' && (a.density || '').toLowerCase() === 'medium');
      if (hasMed) opts.push({ value: 'Medium', label: 'Medium Density' });
      opts.push({ value: 'High', label: 'High Density' });
      const hasMix = list.some((a) => a.isPlaced && a.category === 'Office' && (a.density || '').toLowerCase() === 'mixed');
      if (hasMix) opts.push({ value: 'Mixed', label: 'Mixed Office' });
      const hasSig = list.some((a) => a.isPlaced && a.category === 'Office' && a.isSignature);
      if (hasSig) opts.push({ value: 'Signature', label: 'Signature Offices' });
    } else if (categoryFilter === 'Industrial') {
      opts.push({ value: 'Manufacturing', label: 'Manufacturing' });
      const hasSpec = list.some((a) => a.isPlaced && a.category === 'Industrial' && (a.density || '').toLowerCase() === 'specialized');
      if (hasSpec) opts.push({ value: 'Specialized', label: 'Specialized Industry' });
      const hasSig = list.some((a) => a.isPlaced && a.category === 'Industrial' && a.isSignature);
      if (hasSig) opts.push({ value: 'Signature', label: 'Signature Industry' });
    } else {
      opts.push(
        { value: 'Low', label: 'Low Density' },
        { value: 'Row', label: 'Row Housing' },
        { value: 'Medium', label: 'Medium Density' },
        { value: 'Mixed', label: 'Mixed Density' },
        { value: 'Low Rent', label: 'Low Rent' },
        { value: 'High', label: 'High Density' }
      );
    }

    // Append custom modded zone types discovered in active category
    const standardTokens = new Set([
      '',
      'low',
      'row',
      'row housing',
      'medium',
      'mid',
      'high',
      'mixed',
      'low rent',
      'manufacturing',
      'specialized',
      'storage',
      'signature',
    ]);
    const customZones = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a || !a.isPlaced) continue;
      if (categoryFilter !== 'All' && a.category !== categoryFilter) continue;
      const dl = (a.density || '').toLowerCase().trim();
      if (dl && !standardTokens.has(dl)) {
        customZones.add((a.zoneType || a.density || '').trim());
      }
    }
    Array.from(customZones)
      .filter(Boolean)
      .sort()
      .forEach((z) => {
        opts.push({ value: `zone:${z}`, label: z });
      });

    return opts;
  }, [assets, categoryFilter]);

  const levelOptions: CustomSelectOption[] = useMemo(
    () => [
      { value: 'All', label: 'All Levels' },
      { value: '1', label: 'Level 1' },
      { value: '2', label: 'Level 2' },
      { value: '3', label: 'Level 3' },
      { value: '4', label: 'Level 4' },
      { value: '5', label: 'Level 5' },
    ],
    []
  );

  const inputResourceOptions: CustomSelectOption[] = useMemo(() => {
    return uniqueInputResources.map((r) => ({
      value: r,
      label: r === 'All' ? 'All Inputs' : r,
      icon: r !== 'All' ? <ResourceIcon resource={r} sizeRem={18} /> : undefined,
    }));
  }, [uniqueInputResources]);

  const outputResourceOptions: CustomSelectOption[] = useMemo(() => {
    return uniqueOutputResources.map((r) => ({
      value: r,
      label:
        r === 'All'
          ? categoryFilter === 'Commercial'
            ? 'All Products'
            : categoryFilter === 'Office'
            ? 'All Services / Outputs'
            : 'All Outputs'
          : r,
      icon: r !== 'All' ? <ResourceIcon resource={r} sizeRem={18} /> : undefined,
    }));
  }, [uniqueOutputResources, categoryFilter]);

  const storedResourceOptions: CustomSelectOption[] = useMemo(() => {
    return uniqueStorageResources.map((r) => ({
      value: r,
      label: r === 'All' ? 'All Stored Resources' : r,
      icon: r !== 'All' ? <ResourceIcon resource={r} sizeRem={18} /> : undefined,
    }));
  }, [uniqueStorageResources]);

  const storageHubOptions: CustomSelectOption[] = useMemo(() => {
    const baseOpts: CustomSelectOption[] = [{ value: 'All', label: 'All Storage Hub Types' }];
    const hasStorageAssets = (assets || []).some((a) => a && a.category === 'Storage');
    if (hasStorageAssets) {
      baseOpts.push(
        { value: STORAGE_HUB_GROUP_WAREHOUSE, label: STORAGE_HUB_GROUP_WAREHOUSE },
        { value: STORAGE_HUB_GROUP_SILO_TANK, label: STORAGE_HUB_GROUP_SILO_TANK }
      );
    }
    const seen = new Set(baseOpts.map((o) => o.value));
    uniqueStorageHubTypes.forEach((h) => {
      if (h !== 'All' && !seen.has(h)) {
        seen.add(h);
        baseOpts.push({ value: h, label: h });
      }
    });
    return baseOpts;
  }, [uniqueStorageHubTypes, assets]);

  const serviceTypeOptions: CustomSelectOption[] = useMemo(() => {
    return uniqueServiceTypes.map((s) => ({
      value: s,
      label: s === 'All' ? 'All Services' : s,
      icon: s !== 'All' ? <ServiceIcon service={s} sizeRem={18} /> : undefined,
    }));
  }, [uniqueServiceTypes]);

  const signatureCatOptions: CustomSelectOption[] = useMemo(() => {
    const opts: CustomSelectOption[] = [
      { value: 'All', label: 'All Signature Types' },
      { value: 'Residential', label: 'Residential' },
      { value: 'Commercial', label: 'Commercial' },
      { value: 'Industrial', label: 'Industrial' },
      { value: 'Office', label: 'Office' },
    ];
    const list = Array.isArray(assets) ? assets : [];
    if (list.some((a) => a && a.isPlaced && a.isSignature && a.category === 'Storage')) {
      opts.push({ value: 'Storage', label: 'Storage' });
    }
    if (list.some((a) => a && a.isPlaced && a.isSignature && a.category === 'Service')) {
      opts.push({ value: 'Service', label: 'Service' });
    }
    return opts;
  }, [assets]);

  const catalogCatOptions: CustomSelectOption[] = useMemo(
    () => [
      { value: 'All', label: 'All Categories' },
      { value: 'Residential', label: 'Residential' },
      { value: 'Commercial', label: 'Commercial' },
      { value: 'Industrial', label: 'Industrial' },
      { value: 'Office', label: 'Office' },
      { value: 'Storage', label: 'Storage' },
      { value: 'Service', label: 'Service' },
    ],
    []
  );

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchText('');
    setDistrictFilter('');
    setThemeFilter('All');
    setPackFilter('All');
    setLotSizeFilter('All');
    setLotWidthFilter('All');
    setLotWidthOp('=');
    setLotDepthFilter('All');
    setLotDepthOp('=');
    setLevelOp('=');
    setCornerTypeFilter('all');
    setParkingFilter('all');
    setDensityFilter('All');
    setLevelFilter('All');
    setInputResourceFilter('All');
    setOutputResourceFilter('All');
    setStoredResourceFilter('All');
    setStorageHubFilter('All');
    setServiceTypeFilter('All');
    setSignatureCatFilter('All');
    setCatalogCatFilter('All');
    setSignatureOnly(false);
    setStatusFilter('all');
    setQuickPreset('all');
    setCurrentPage(0);
  };

  const selectCategoryFilter = useCallback(
    (nextCat: CategoryFilter) => {
      if (nextCat !== categoryFilter) {
        setDensityFilter('All');
        setLevelFilter('All');
        setInputResourceFilter('All');
        setOutputResourceFilter('All');
        setStoredResourceFilter('All');
        setStorageHubFilter('All');
        setServiceTypeFilter('All');
        setSignatureCatFilter('All');
        setCatalogCatFilter('All');
        setSignatureOnly(false);
        if (nextCat === 'Catalog') {
          setDistrictFilter('');
          setStatusFilter('all');
          if (quickPreset !== 'all') setQuickPreset('all');
        }
      }
      setCategoryFilter(nextCat);
      setCurrentPage(0);
    },
    [categoryFilter, quickPreset, setCategoryFilter, setCurrentPage]
  );

  const filterCaps = useMemo(() => {
    const c = categoryFilter;
    return {
      isCatalog: c === 'Catalog',
      isSignature: c === 'Signature',
      allowsDensity: c !== 'Service',
      allowsLevel: c !== 'Service' && c !== 'Storage',
      allowsServiceType: c === 'Service' || c === 'All' || c === 'Catalog',
      allowsStorageFilters: c === 'Storage' || c === 'All',
      allowsInputRes: c === 'All' || c === 'Industrial' || c === 'Commercial' || c === 'Catalog',
      allowsOutputRes: c === 'All' || c === 'Commercial' || c === 'Industrial' || c === 'Office' || c === 'Catalog',
      allowsDistrict: c !== 'Catalog',
      allowsStatus: c !== 'Catalog',
    };
  }, [categoryFilter]);

  const handleFilterZoneMatrix = useCallback(
    (req: ZoneMatrixFilterRequest) => {
      const targetCat = req.category || 'Residential';
      const targetDensity =
        targetCat === 'Signature'
          ? (req.density ?? 'All')
          : req.signatureOnly && !req.density
            ? 'Signature'
            : (req.density ?? 'All');
      const targetServiceType = req.serviceType ?? 'All';
      const targetStorageHub = req.storageHub ?? 'All';
      const targetStoredResource = req.storedResource ?? 'All';
      const targetSignatureCategory = req.signatureCategory ?? 'All';

      const sameDensity =
        targetDensity !== 'All' &&
        densityFilter === targetDensity &&
        (req.pack === undefined || req.pack === 'All') &&
        (req.theme === undefined || req.theme === 'All') &&
        categoryFilter === targetCat;

      const sameServiceType =
        targetServiceType !== 'All' &&
        serviceTypeFilter === targetServiceType &&
        (req.pack === undefined || req.pack === 'All') &&
        (req.theme === undefined || req.theme === 'All') &&
        categoryFilter === targetCat;

      const sameStorageHub =
        targetStorageHub !== 'All' &&
        storageHubFilter === targetStorageHub &&
        (req.pack === undefined || req.pack === 'All') &&
        (req.theme === undefined || req.theme === 'All') &&
        categoryFilter === targetCat;

      const sameSignatureCategory =
        targetCat === 'Signature' &&
        targetSignatureCategory !== 'All' &&
        signatureCatFilter === targetSignatureCategory &&
        (req.pack === undefined || req.pack === 'All') &&
        (req.theme === undefined || req.theme === 'All') &&
        categoryFilter === targetCat;

      const samePack =
        req.pack !== undefined &&
        req.pack !== 'All' &&
        packFilter === req.pack &&
        (targetDensity === 'All' || targetDensity === densityFilter) &&
        (targetServiceType === 'All' || targetServiceType === serviceTypeFilter) &&
        (targetStorageHub === 'All' || targetStorageHub === storageHubFilter) &&
        (targetSignatureCategory === 'All' || targetSignatureCategory === signatureCatFilter) &&
        categoryFilter === targetCat;

      setCategoryFilter(targetCat);
      setDistrictFilter(req.districtKey !== undefined ? req.districtKey : '');
      setSearchInput('');
      setSearchText('');
      setQuickPreset('all');
      setDensityFilter(sameDensity ? 'All' : targetDensity);
      setThemeFilter(req.theme ?? 'All');
      setPackFilter(samePack ? 'All' : (req.pack ?? 'All'));
      setLevelFilter('All');
      setLevelOp('=');
      setLotSizeFilter('All');
      setLotWidthFilter('All');
      setLotWidthOp('=');
      setLotDepthFilter('All');
      setLotDepthOp('=');
      setCornerTypeFilter('all');
      setParkingFilter('all');
      setInputResourceFilter('All');
      setOutputResourceFilter('All');
      setStoredResourceFilter(targetStoredResource);
      setStorageHubFilter(sameStorageHub ? 'All' : targetStorageHub);
      setServiceTypeFilter(sameServiceType ? 'All' : targetServiceType);
      setSignatureCatFilter(sameSignatureCategory ? 'All' : targetSignatureCategory);
      setCatalogCatFilter('All');
      setSignatureOnly(false);
      setStatusFilter('all');
      setCurrentPage(0);
    },
    [
      categoryFilter,
      densityFilter,
      serviceTypeFilter,
      storageHubFilter,
      signatureCatFilter,
      packFilter,
      setCategoryFilter,
      setCurrentPage,
    ]
  );

  const activeFilterCount =
    (searchText.trim() !== '' ? 1 : 0) +
    (filterCaps.allowsDistrict && districtFilter !== '' ? 1 : 0) +
    (themeFilter !== 'All' ? 1 : 0) +
    (packFilter !== 'All' ? 1 : 0) +
    (lotSizeFilter !== 'All' ? 1 : 0) +
    (lotWidthFilter !== 'All' ? 1 : 0) +
    (lotDepthFilter !== 'All' ? 1 : 0) +
    (cornerTypeFilter !== 'all' ? 1 : 0) +
    (parkingFilter !== 'all' ? 1 : 0) +
    (filterCaps.allowsDensity && densityFilter !== 'All' ? 1 : 0) +
    (filterCaps.allowsLevel && levelFilter !== 'All' ? 1 : 0) +
    (filterCaps.allowsInputRes && inputResourceFilter !== 'All' ? 1 : 0) +
    (filterCaps.allowsOutputRes && outputResourceFilter !== 'All' ? 1 : 0) +
    (filterCaps.allowsStorageFilters && storedResourceFilter !== 'All' ? 1 : 0) +
    (filterCaps.allowsStorageFilters && storageHubFilter !== 'All' ? 1 : 0) +
    (filterCaps.allowsServiceType && serviceTypeFilter !== 'All' ? 1 : 0) +
    (filterCaps.isSignature && signatureCatFilter !== 'All' ? 1 : 0) +
    (filterCaps.isCatalog && catalogCatFilter !== 'All' ? 1 : 0) +
    (signatureOnly ? 1 : 0) +
    (filterCaps.allowsStatus && statusFilter !== 'all' ? 1 : 0) +
    (quickPreset !== 'all' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  // Filter items based on category, filters, and search text
  const filteredAssets = useMemo(() => {
    if (
      categoryFilter === 'Districts' ||
      categoryFilter === 'Housing' ||
      categoryFilter === 'ZoneMatrices' ||
      categoryFilter === 'CommercialMatrix' ||
      categoryFilter === 'OfficeMatrix' ||
      categoryFilter === 'IndustrialMatrix' ||
      categoryFilter === 'StorageMatrix' ||
      categoryFilter === 'ServiceMatrix' ||
      categoryFilter === 'SignatureMatrix'
    ) {
      return [];
    }
    const q = searchText.trim().toLowerCase();
    const targetW = lotWidthFilter !== 'All' ? parseInt(lotWidthFilter, 10) : NaN;
    const targetD = lotDepthFilter !== 'All' ? parseInt(lotDepthFilter, 10) : NaN;
    const targetLvl = levelFilter !== 'All' ? parseInt(levelFilter, 10) : NaN;
    const normTheme = themeFilter !== 'All' ? themeFilter.toLowerCase() : '';
    const normPack = packFilter !== 'All' ? packFilter.toLowerCase() : '';

    return (assets || []).filter((item) => {
      // Catalog vs Map Placed filter
      if (categoryFilter === 'Catalog') {
        if (item.isPlaced) return false;
        if (catalogCatFilter !== 'All' && item.category !== catalogCatFilter) return false;
      } else {
        // Must be placed on the map
        if (!item.isPlaced) return false;

        if (categoryFilter === 'Signature') {
          if (!item.isSignature) return false;
          if (signatureCatFilter !== 'All' && item.category !== signatureCatFilter) return false;
        } else if (categoryFilter !== 'All') {
          if (item.category !== categoryFilter) return false;
        }
      }

      // Quick signature only toggle
      if (signatureOnly && !item.isSignature) {
        return false;
      }

      // District filter
      if (filterCaps.allowsDistrict && districtFilter && districtFilter !== '') {
        if (districtFilter === '__unassigned__') {
          if (item.districtKey && item.districtKey.trim() !== '') return false;
        } else if (item.districtKey !== districtFilter) {
          return false;
        }
      }

      // Theme filter
      if (normTheme) {
        const itemTheme = (item.theme || 'Unknown').toLowerCase();
        if (normTheme === 'european' || normTheme === 'eu') {
          if (itemTheme.indexOf('eu') !== 0 && itemTheme.indexOf('europe') === -1) return false;
        } else if (normTheme === 'northamerican' || normTheme === 'north american' || normTheme === 'usa') {
          if (itemTheme.indexOf('na') !== 0 && itemTheme.indexOf('north') === -1 && itemTheme.indexOf('usa') === -1) return false;
        } else if (itemTheme !== normTheme) {
          return false;
        }
      }

      // Asset Pack / DLC filter
      if (normPack) {
        const p = (item.assetPack || 'Base Game').toLowerCase();
        if (p !== normPack) return false;
      }

      const meta = assetMetaMap.get(item.id || item.entityKey);

      // Lot Size filter
      if (lotSizeFilter !== 'All') {
        if (!meta || meta.normLot !== lotSizeFilter) return false;
      }

      // Lot Width filter (with comparison operator)
      if (!isNaN(targetW)) {
        if (!meta || meta.w <= 0) return false;
        if (lotWidthOp === '=' && meta.w !== targetW) return false;
        if (lotWidthOp === '>=' && meta.w < targetW) return false;
        if (lotWidthOp === '<=' && meta.w > targetW) return false;
      }

      // Lot Depth filter (with comparison operator)
      if (!isNaN(targetD)) {
        if (!meta || meta.d <= 0) return false;
        if (lotDepthOp === '=' && meta.d !== targetD) return false;
        if (lotDepthOp === '>=' && meta.d < targetD) return false;
        if (lotDepthOp === '<=' && meta.d > targetD) return false;
      }

      // Corner Type filter
      if (cornerTypeFilter !== 'all') {
        const cType = meta ? meta.cType : 'straight';
        if (cornerTypeFilter === 'left') {
          if (cType !== 'left' && cType !== 'both' && cType !== 'all') return false;
        } else if (cornerTypeFilter === 'right') {
          if (cType !== 'right' && cType !== 'both' && cType !== 'all') return false;
        } else if (cornerTypeFilter === 'straight') {
          if (cType !== 'straight' && cType !== 'front') return false;
        }
      }

      // Parking filter
      if (parkingFilter === 'with') {
        if (!meta || !meta.hasParking) return false;
      } else if (parkingFilter === 'without') {
        if (meta && meta.hasParking) return false;
      }

      // Zone Type / Density filter (Residential, Commercial, Office, Industrial + Modded Zones)
      if (filterCaps.allowsDensity && densityFilter && densityFilter !== 'All') {
        const d = (item.density || '').toLowerCase().trim();
        const zt = (item.zoneType || '').toLowerCase().trim();
        const sub = (item.subCategory || '').toLowerCase();
        const name = (item.prefabName || item.name || '').toLowerCase();
        const target = densityFilter.toLowerCase().trim();

        let matches = false;
        if (target === 'signature') {
          matches = Boolean(item.isSignature);
        } else if (target.startsWith('zone:')) {
          const zTarget = target.slice(5).trim();
          matches = zt === zTarget || d === zTarget || sub === zTarget;
        } else if (target === 'low') {
          matches =
            !item.isSignature &&
            ((d === 'low' && !sub.includes('rent') && !sub.includes('row')) ||
              (d === '' && sub.includes('low') && !sub.includes('rent') && !sub.includes('row')));
        } else if (target === 'row' || target === 'row housing') {
          matches = d.includes('row') || sub.includes('row') || name.includes('row');
        } else if (target === 'rowormixed') {
          matches = !item.isSignature && (d === 'row' || d === 'mixed' || sub.includes('row') || sub.includes('mixed'));
        } else if (target === 'mediumall' || target === 'medium_all') {
          matches =
            (d === 'medium' || d === 'mid' || d.includes('row') || sub.includes('row') || name.includes('row')) &&
            !sub.includes('mixed');
        } else if (target === 'medium' || target === 'mid') {
          matches = !item.isSignature && ((d === 'medium' || d === 'mid') && !sub.includes('row') && !sub.includes('mixed'));
        } else if (target === 'mixed') {
          matches = d === 'mixed' || sub.includes('mixed') || name.includes('mixed');
        } else if (target === 'low rent' || target === 'low rent housing' || target === 'low income' || target === 'lowrent') {
          matches = d.includes('rent') || d.includes('income') || sub.includes('rent') || sub.includes('income') || name.includes('lowrent');
        } else if (target === 'highall' || target === 'high_all') {
          matches =
            d === 'high' ||
            d.includes('rent') ||
            d.includes('income') ||
            sub.includes('rent') ||
            sub.includes('income') ||
            name.includes('lowrent') ||
            (sub.includes('high') && !sub.includes('row'));
        } else if (target === 'high') {
          matches = !item.isSignature && (d === 'high' || (d === '' && sub.includes('high') && !sub.includes('row')));
        } else if (target === 'manufacturing') {
          matches =
            !item.isSignature &&
            (d === 'manufacturing' ||
              (item.category === 'Industrial' && d === '' && !sub.includes('specialized') && !sub.includes('storage')));
        } else if (target === 'specialized') {
          matches = d === 'specialized' || sub.includes('specialized');
        } else if (target === 'storage') {
          matches = item.category === 'Storage' || d === 'storage';
        } else {
          matches = zt === target || d === target || sub.includes(target) || name.includes(target);
        }
        if (!matches) return false;
      }

      // Level filter (with comparison operator)
      if (filterCaps.allowsLevel && !isNaN(targetLvl)) {
        if (levelOp === '=' && item.level !== targetLvl) return false;
        if (levelOp === '>=' && item.level < targetLvl) return false;
        if (levelOp === '<=' && item.level > targetLvl) return false;
      }

      // Service Type filter
      if (filterCaps.allowsServiceType && serviceTypeFilter && serviceTypeFilter !== 'All') {
        if (item.subCategory !== serviceTypeFilter) return false;
      }

      // Storage Hub Type filter
      if (filterCaps.allowsStorageFilters && storageHubFilter && storageHubFilter !== 'All') {
        if (storageHubFilter === STORAGE_HUB_GROUP_WAREHOUSE) {
          if (item.category !== 'Storage' || item.isSignature || classifyStorageKind(item) !== 'warehouse') {
            return false;
          }
        } else if (storageHubFilter === STORAGE_HUB_GROUP_SILO_TANK) {
          if (item.category !== 'Storage' || item.isSignature || classifyStorageKind(item) !== 'silo_tank') {
            return false;
          }
        } else {
          const sub = (item.subCategory || '').toLowerCase();
          const name = (item.prefabName || item.name || '').toLowerCase();
          const target = storageHubFilter.toLowerCase();
          if (!sub.includes(target) && !name.includes(target)) return false;
        }
      }

      // Input Resource filter (multi in supported)
      if (filterCaps.allowsInputRes && inputResourceFilter && inputResourceFilter !== 'All') {
        const hasInput =
          (Array.isArray(item.inputResources) && item.inputResources.includes(inputResourceFilter)) ||
          item.resource === inputResourceFilter;
        if (!hasInput) return false;
      }

      // Output Resource / Product filter (multi out supported)
      if (filterCaps.allowsOutputRes && outputResourceFilter && outputResourceFilter !== 'All') {
        const hasOutput =
          (Array.isArray(item.outputResources) && item.outputResources.includes(outputResourceFilter)) ||
          item.resource === outputResourceFilter;
        if (!hasOutput) return false;
      }

      // Stored Resource filter
      if (filterCaps.allowsStorageFilters && storedResourceFilter && storedResourceFilter !== 'All') {
        const hasStored =
          (Array.isArray(item.storedResources) && item.storedResources.some((sr) => sr.name === storedResourceFilter)) ||
          (Array.isArray(item.outputResources) && item.outputResources.includes(storedResourceFilter)) ||
          (Array.isArray(item.inputResources) && item.inputResources.includes(storedResourceFilter)) ||
          item.resource === storedResourceFilter;
        if (!hasStored) return false;
      }

      // High-speed Multi-token Search text filter (matches all space-delimited keywords)
      if (q) {
        if (!meta) return false;
        const tokens = q.split(/\s+/);
        for (let t = 0; t < tokens.length; t++) {
          if (tokens[t] && !meta.searchTokens.includes(tokens[t])) return false;
        }
      }

      // Operational status filter (Damaged vs Turned Off / Inactive)
      if (filterCaps.allowsStatus) {
        if (statusFilter === 'damaged') {
          if (!item.isDamaged && !item.needsRepair) return false;
        } else if (statusFilter === 'turnedOff') {
          if (!item.isTurnedOff) return false;
        }
      }

      // Quick Filter Presets
      if (quickPreset === 'favorites') {
        const itemKey = getAssetFavoriteKey(item);
        if (!favoriteKeys.has(itemKey)) return false;
      } else if (quickPreset === 'damaged') {
        if (!item.isDamaged && !item.needsRepair) return false;
      } else if (quickPreset === 'turnedOff') {
        if (!item.isTurnedOff) return false;
      } else if (quickPreset === 'needsRepair') {
        if (!item.needsRepair) return false;
      } else if (quickPreset === 'abandoned') {
        const isAbandoned =
          item.needsRepair ||
          (item.buildingCondition !== undefined && item.buildingCondition < 0);
        if (!isAbandoned) return false;
      } else if (quickPreset === 'unprofitable') {
        const isUnprof =
          (item.monthlyProfit !== undefined && item.monthlyProfit < 0) ||
          item.profitabilityTier === 'Losing Money';
        if (!isUnprof) return false;
      } else if (quickPreset === 'overcrowded') {
        const isOver =
          (item.capacity ?? 0) > 0 && (item.occupied ?? 0) >= (item.capacity ?? 0);
        if (!isOver) return false;
      } else if (quickPreset === 'empty') {
        const isWorkplace =
          item.category === 'Commercial' ||
          item.category === 'Industrial' ||
          item.category === 'Office' ||
          item.category === 'Storage';
        const isEmpty = isWorkplace
          ? !item.company && (item.occupied ?? 0) <= 0
          : (item.occupied ?? 0) <= 0;
        if (!isEmpty) return false;
      } else if (quickPreset === 'deliveryFleet') {
        const hasDelivery =
          (item.companyVehiclesMax ?? 0) > 0 ||
          (item.companyVehicles ?? 0) > 0 ||
          (item.vehiclesMax ?? 0) > 0 ||
          (item.vehicles ?? 0) > 0;
        if (!hasDelivery) return false;
      } else if (quickPreset === 'highWealth') {
        const isHigh =
          item.householdWealth === 'Wealthy' ||
          item.householdWealth === 'High wealth';
        if (!isHigh) return false;
      } else if (quickPreset === 'mixed') {
        const isMixed =
          Boolean(item.isMixedUse) ||
          (item.subCategory && item.subCategory.toLowerCase().includes('mixed'));
        if (!isMixed) return false;
      }

      return true;
    });
  }, [
    assets,
    assetMetaMap,
    categoryFilter,
    districtFilter,
    themeFilter,
    packFilter,
    lotSizeFilter,
    lotWidthFilter,
    lotWidthOp,
    lotDepthFilter,
    lotDepthOp,
    cornerTypeFilter,
    parkingFilter,
    densityFilter,
    levelFilter,
    levelOp,
    inputResourceFilter,
    outputResourceFilter,
    storedResourceFilter,
    storageHubFilter,
    serviceTypeFilter,
    signatureCatFilter,
    catalogCatFilter,
    signatureOnly,
    filterCaps,
    quickPreset,
    statusFilter,
    searchText,
    favoriteKeys,
  ]);

  const didInitPageResetRef = useRef(false);
  useEffect(() => {
    if (!didInitPageResetRef.current) {
      didInitPageResetRef.current = true;
      return;
    }
    if (!pendingFocusId) {
      setCurrentPage(0);
    }
  }, [
    categoryFilter,
    districtFilter,
    themeFilter,
    packFilter,
    lotSizeFilter,
    lotWidthFilter,
    lotWidthOp,
    lotDepthFilter,
    lotDepthOp,
    cornerTypeFilter,
    parkingFilter,
    densityFilter,
    levelFilter,
    levelOp,
    inputResourceFilter,
    outputResourceFilter,
    storedResourceFilter,
    storageHubFilter,
    serviceTypeFilter,
    signatureCatFilter,
    catalogCatFilter,
    signatureOnly,
    statusFilter,
    quickPreset,
    searchText,
    sortField,
    sortDir,
    groupSameName,
  ]);

  const compareAssetOrGroup = useCallback(
    (entryA: UnifiedAssetItem | AssetGroupVm, entryB: UnifiedAssetItem | AssetGroupVm): number => {
      const a = 'isGroup' in entryA ? entryA.first : entryA;
      const b = 'isGroup' in entryB ? entryB.first : entryB;
      const mult = sortDir === 'asc' ? 1 : -1;
      const compareStrings = (aStr?: string, bStr?: string) => (aStr || '').localeCompare(bStr || '');
      const nameA = 'isGroup' in entryA ? entryA.name : a.name;
      const nameB = 'isGroup' in entryB ? entryB.name : b.name;
      const tieBreak = () => compareStrings(nameA, nameB) || compareStrings(a.id, b.id);
      const compareNullable = (hasA: boolean, valA: number, hasB: boolean, valB: number, tieValA = 0, tieValB = 0) => {
        if (hasA !== hasB) return hasA ? -1 : 1;
        const diff = hasA ? mult * (valA - valB) : 0;
        if (diff !== 0) return diff;
        if (hasA && tieValA !== tieValB) return mult * (tieValA - tieValB);
        return tieBreak();
      };
      const getStatusTier = (it: UnifiedAssetItem) =>
        it.isDamaged || it.needsRepair ? 0 : it.isTurnedOff ? 1 : 2;
      const getPrimaryResource = (it: UnifiedAssetItem) =>
        it.resource || it.outputResources?.[0] || it.inputResources?.[0] || it.storedResources?.[0]?.name || '';

      let cmp = 0;
      if (sortField === 'name') {
        cmp = mult * compareStrings(nameA, nameB);
      } else if (sortField === 'lotSize') {
        cmp = mult * (parseLotScore(a.lotDimensions, a.lotSize) - parseLotScore(b.lotDimensions, b.lotSize));
      } else if (sortField === 'cat') {
        cmp = mult * (compareStrings(a.category, b.category) || compareStrings(a.subCategory, b.subCategory));
      } else if (sortField === 'service') {
        cmp = mult * compareStrings(a.subCategory || a.category, b.subCategory || b.category);
      } else if (sortField === 'serviceUsage') {
        const uA = a.serviceUsage ?? a.storageAmount ?? a.occupied ?? 0;
        const uB = b.serviceUsage ?? b.storageAmount ?? b.occupied ?? 0;
        cmp = mult * (uA - uB);
        if (cmp === 0) {
          const capA = a.serviceCapacity ?? a.storageCapacity ?? a.capacity ?? 0;
          const capB = b.serviceCapacity ?? b.storageCapacity ?? b.capacity ?? 0;
          cmp = mult * (capA - capB);
        }
      } else if (sortField === 'density') {
        cmp = mult * compareStrings(formatDensityLabel(a.density || a.zoneType), formatDensityLabel(b.density || b.zoneType));
      } else if (sortField === 'status') {
        const tierA = getStatusTier(a);
        const tierB = getStatusTier(b);
        cmp = mult * (tierA - tierB);
        if (cmp === 0) {
          if (tierA === 0) {
            cmp = mult * ((b.damagePercent ?? 0) - (a.damagePercent ?? 0));
          }
          if (cmp === 0) {
            cmp = mult * ((a.buildingCondition ?? 100) - (b.buildingCondition ?? 100));
          }
        }
      } else if (sortField === 'district') {
        cmp = mult * compareStrings(a.district, b.district);
      } else if (sortField === 'level') {
        const lvlA = 'isGroup' in entryA ? entryA.avgLevel : (a.level ?? 0);
        const lvlB = 'isGroup' in entryB ? entryB.avgLevel : (b.level ?? 0);
        return compareNullable(lvlA > 0, lvlA, lvlB > 0, lvlB);
      } else if (sortField === 'occupied') {
        if (categoryFilter === 'Storage') {
          const occA = 'isGroup' in entryA
            ? entryA.items.reduce((s, it) => s + (it.storageAmount ?? it.occupied ?? 0), 0)
            : (a.storageAmount ?? a.occupied ?? 0);
          const occB = 'isGroup' in entryB
            ? entryB.items.reduce((s, it) => s + (it.storageAmount ?? it.occupied ?? 0), 0)
            : (b.storageAmount ?? b.occupied ?? 0);
          cmp = mult * (occA - occB);
          if (cmp === 0) {
            const capA = 'isGroup' in entryA
              ? entryA.items.reduce((s, it) => s + (it.storageCapacity ?? it.capacity ?? 0), 0)
              : (a.storageCapacity ?? a.capacity ?? 0);
            const capB = 'isGroup' in entryB
              ? entryB.items.reduce((s, it) => s + (it.storageCapacity ?? it.capacity ?? 0), 0)
              : (b.storageCapacity ?? b.capacity ?? 0);
            cmp = mult * (capA - capB);
          }
        } else {
          const occA = 'isGroup' in entryA ? entryA.totalOccupied : (a.occupied ?? 0);
          const occB = 'isGroup' in entryB ? entryB.totalOccupied : (b.occupied ?? 0);
          cmp = mult * (occA - occB);
          if (cmp === 0) {
            const capA = 'isGroup' in entryA ? entryA.totalCapacity : (a.capacity ?? 0);
            const capB = 'isGroup' in entryB ? entryB.totalCapacity : (b.capacity ?? 0);
            cmp = mult * (capA - capB);
          }
        }
      } else if (sortField === 'efficiency') {
        const effA = 'isGroup' in entryA ? entryA.avgEfficiency : a.efficiency;
        const effB = 'isGroup' in entryB ? entryB.avgEfficiency : b.efficiency;
        cmp = mult * (effA - effB);
      } else if (sortField === 'happiness') {
        const happyA = 'isGroup' in entryA ? entryA.avgHappiness : a.happiness;
        const happyB = 'isGroup' in entryB ? entryB.avgHappiness : b.happiness;
        const hasA = happyA !== null && happyA !== undefined && happyA >= 0;
        const hasB = happyB !== null && happyB !== undefined && happyB >= 0;
        return compareNullable(hasA, happyA ?? 0, hasB, happyB ?? 0);
      } else if (sortField === 'profit') {
        const hasA = a.monthlyProfit !== undefined && a.monthlyProfit !== null;
        const hasB = b.monthlyProfit !== undefined && b.monthlyProfit !== null;
        return compareNullable(
          hasA,
          a.monthlyProfit ?? 0,
          hasB,
          b.monthlyProfit ?? 0,
          a.profitMargin ?? 0,
          b.profitMargin ?? 0
        );
      } else if (sortField === 'company') {
        cmp = mult * compareStrings(a.company, b.company);
      } else if (sortField === 'vehicles') {
        const aMax = (a.companyVehiclesMax ?? 0) > 0 ? a.companyVehiclesMax! : (a.vehiclesMax ?? 0);
        const bMax = (b.companyVehiclesMax ?? 0) > 0 ? b.companyVehiclesMax! : (b.vehiclesMax ?? 0);
        const aCur = (a.companyVehiclesMax ?? 0) > 0 ? (a.companyVehicles ?? 0) : (a.vehicles ?? 0);
        const bCur = (b.companyVehiclesMax ?? 0) > 0 ? (b.companyVehicles ?? 0) : (b.vehicles ?? 0);
        return compareNullable(aMax > 0 || aCur > 0, aCur, bMax > 0 || bCur > 0, bCur);
      } else if (sortField === 'resource') {
        cmp = mult * compareStrings(getPrimaryResource(a), getPrimaryResource(b));
      } else if (sortField === 'storage') {
        const amtA = 'isGroup' in entryA
          ? entryA.items.reduce((s, it) => s + (it.storageAmount ?? 0), 0)
          : (a.storageAmount ?? 0);
        const amtB = 'isGroup' in entryB
          ? entryB.items.reduce((s, it) => s + (it.storageAmount ?? 0), 0)
          : (b.storageAmount ?? 0);
        cmp = mult * (amtA - amtB);
        if (cmp === 0) {
          const capA = 'isGroup' in entryA
            ? entryA.items.reduce((s, it) => s + (it.storageCapacity ?? 0), 0)
            : (a.storageCapacity ?? 0);
          const capB = 'isGroup' in entryB
            ? entryB.items.reduce((s, it) => s + (it.storageCapacity ?? 0), 0)
            : (b.storageCapacity ?? 0);
          cmp = mult * (capA - capB);
        }
      } else if (sortField === 'theme' || sortField === 'pack') {
        cmp = mult * (compareStrings(a.theme, b.theme) || compareStrings(a.assetPack, b.assetPack));
      } else if (sortField === 'maintenanceCost') {
        cmp = mult * ((a.totalUpkeep ?? a.maintenanceCost ?? 0) - (b.totalUpkeep ?? b.maintenanceCost ?? 0));
      }

      if (cmp !== 0) return cmp;
      return tieBreak();
    },
    [sortField, sortDir, categoryFilter]
  );

  // Sort items
  const sortedAssets = useMemo(() => {
    if (filteredAssets.length === 0) return [];
    const list = [...filteredAssets];
    list.sort(compareAssetOrGroup);
    return list;
  }, [filteredAssets, compareAssetOrGroup]);

  // Navigate pagination to the page containing the target building and scroll to it
  useEffect(() => {
    if (!pendingFocusId) {
      focusAttemptsRef.current = 0;
      return;
    }

    const normKey = (k: string) => String(k || '').replace(/[,:]/g, ':');
    const targetIdx = sortedAssets.findIndex(
      (a) => normKey(a.id) === normKey(pendingFocusId) || normKey(a.entityKey) === normKey(pendingFocusId)
    );

    if (targetIdx >= 0) {
      const safePageSize = rowsPerPage > 0 ? rowsPerPage : 50;
      const targetPage = Math.floor(targetIdx / safePageSize);
      if (currentPage !== targetPage) {
        setCurrentPage(targetPage);
      }
      const idToFocus = pendingFocusId;
      setPendingFocusId(null);
      focusAttemptsRef.current = 0;

      const scrollTarget = (attempts = 0) => {
        const rowEl =
          (document.getElementById(`bam-row-${idToFocus}`) as HTMLElement) ||
          (document.querySelector(`[data-row-id="${idToFocus}"]`) as HTMLElement);
        const content =
          (document.querySelector('.bam-table-body .content_gqa') as HTMLElement) ||
          (document.querySelector('.bam-table-body') as HTMLElement);
        if (rowEl && content) {
          const cRect = content.getBoundingClientRect();
          const rRect = rowEl.getBoundingClientRect();
          // Center the header row itself in the content view (approx 38rem height)
          const rowHeaderCenter = rRect.top + Math.min(rRect.height, 40) / 2;
          const viewportCenter = cRect.top + cRect.height / 2;
          const diff = rowHeaderCenter - viewportCenter;
          content.scrollTop += diff;
          if (attempts < 3) {
            if (focusScrollTimerRef.current) clearTimeout(focusScrollTimerRef.current);
            focusScrollTimerRef.current = setTimeout(() => scrollTarget(attempts + 1), 160);
          }
        } else if (attempts < 12) {
          if (focusScrollTimerRef.current) clearTimeout(focusScrollTimerRef.current);
          focusScrollTimerRef.current = setTimeout(() => scrollTarget(attempts + 1), 60);
        }
      };

      if (focusScrollTimerRef.current) clearTimeout(focusScrollTimerRef.current);
      focusScrollTimerRef.current = setTimeout(() => scrollTarget(0), 100);
    } else {
      focusAttemptsRef.current += 1;
      if (focusAttemptsRef.current > 6) {
        setPendingFocusId(null);
        focusAttemptsRef.current = 0;
      }
    }
  }, [pendingFocusId, sortedAssets, rowsPerPage, currentPage, setCurrentPage]);

  // Group Same Name aggregation
  const groupedDisplayList = useMemo((): (UnifiedAssetItem | AssetGroupVm)[] => {
    if (!groupSameName) return sortedAssets;

    const groupMap = new Map<string, UnifiedAssetItem[]>();
    const groupSeen = new Map<string, Set<string>>();
    const groupOrder: string[] = [];

    sortedAssets.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const uid = item.entityKey || item.id || item.prefabKey || '';
      if (!uid && !item.name && !item.prefabName) return;

      let key = (item.name || item.prefabName || 'Unknown').trim() || 'Unknown';
      if (
        categoryFilter === 'Industrial' ||
        categoryFilter === 'Commercial' ||
        categoryFilter === 'Office' ||
        categoryFilter === 'Storage'
      ) {
        const biz =
          item.company &&
          item.company !== '—' &&
          item.company !== 'Independent' &&
          item.company !== 'Industrial Manufacturing' &&
          item.company.trim() !== ''
            ? item.company.trim()
            : item.resource && item.resource.trim() !== ''
            ? `${item.resource.trim()} Facility`
            : item.name;
        if (biz && biz.trim()) key = biz.trim();
      }
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groupSeen.set(key, new Set<string>());
        groupOrder.push(key);
      }
      if (uid) {
        const seen = groupSeen.get(key)!;
        if (seen.has(uid)) return;
        seen.add(uid);
      }
      groupMap.get(key)!.push(item);
    });

    const groupedEntries = groupOrder.reduce<(UnifiedAssetItem | AssetGroupVm)[]>((acc, key) => {
      const items = (groupMap.get(key) || []).filter(
        (it): it is UnifiedAssetItem =>
          Boolean(it && (it.entityKey || it.id || it.prefabKey || it.name))
      );
      if (items.length === 0) return acc;
      if (items.length === 1) {
        acc.push(items[0]);
        return acc;
      }

      const first = items[0];
      const totalOccupied = items.reduce((sum, it) => sum + (it.occupied || 0), 0);
      const totalCapacity = items.reduce((sum, it) => sum + (it.capacity || 0), 0);
      const validEff = items.filter((it) => (it.efficiency ?? -1) >= 0);
      const avgEfficiency =
        validEff.length > 0
          ? Math.round(validEff.reduce((sum, it) => sum + (it.efficiency || 0), 0) / validEff.length)
          : -1;
      const validHappy = items.filter((it) => (it.happiness ?? -1) >= 0);
      const avgHappiness =
        validHappy.length > 0
          ? Math.round(validHappy.reduce((sum, it) => sum + (it.happiness || 0), 0) / validHappy.length)
          : -1;
      const avgLevel = Math.round(items.reduce((sum, it) => sum + (it.level || 1), 0) / items.length);

      acc.push({
        isGroup: true,
        groupKey: key,
        name: key,
        items,
        first,
        totalOccupied,
        totalCapacity,
        avgEfficiency,
        avgHappiness,
        avgLevel,
      });
      return acc;
    }, []);
    groupedEntries.sort(compareAssetOrGroup);
    return groupedEntries;
  }, [sortedAssets, groupSameName, categoryFilter, compareAssetOrGroup]);

  // Paginate items
  const { pageItems, safePage, totalPages, totalItems, canNext, canPrev } = usePagination(
    groupedDisplayList,
    rowsPerPage > 0 ? rowsPerPage : 50,
    currentPage
  );

  // Automatically reset table scroll to top whenever page changes (unless focusing a specific building row)
  useEffect(() => {
    if (pendingFocusId) return;
    const resetScroll = () => {
      const content = getTableScrollableContent();
      if (content) {
        content.scrollTop = 0;
      }
    };
    resetScroll();
    const t = setTimeout(resetScroll, 40);
    return () => clearTimeout(t);
  }, [safePage, pendingFocusId]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleUpgrades = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedUpgrades((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const distList = Array.isArray(districts) ? districts : [];
    counts['Districts'] = distList.filter((d) => d && d.entityKey !== 'city').length;

    const assetList = Array.isArray(assets) ? assets : [];
    let unifiedMatrixCount = 0;
    for (let i = 0; i < assetList.length; i++) {
      const it = assetList[i];
      if (!it) continue;
      if (it.isPlaced) {
        counts['All'] = (counts['All'] || 0) + 1;
        if (it.isSignature) {
          counts['Signature'] = (counts['Signature'] || 0) + 1;
        }
        counts[it.category] = (counts[it.category] || 0) + 1;

        const inUnifiedMatrix =
          (zoneSettings.enableHousing && it.category === 'Residential') ||
          (zoneSettings.enableCommercial && it.category === 'Commercial') ||
          (zoneSettings.enableOffice && it.category === 'Office') ||
          (zoneSettings.enableIndustrial &&
            (it.category === 'Industrial' || (zoneSettings.includeIndustrialSpecials && it.category === 'Storage'))) ||
          (zoneSettings.enableStorage && it.category === 'Storage') ||
          (zoneSettings.enableService && it.category === 'Service') ||
          (zoneSettings.enableSignature && Boolean(it.isSignature));
        if (inUnifiedMatrix) {
          unifiedMatrixCount += 1;
        }
      } else {
        counts['Catalog'] = (counts['Catalog'] || 0) + 1;
      }
    }
    counts['Housing'] = counts['Residential'] || 0;
    counts['CommercialMatrix'] = counts['Commercial'] || 0;
    counts['OfficeMatrix'] = counts['Office'] || 0;
    counts['IndustrialMatrix'] =
      (counts['Industrial'] || 0) + (zoneSettings.includeIndustrialSpecials ? (counts['Storage'] || 0) : 0);
    counts['StorageMatrix'] = counts['Storage'] || 0;
    counts['ServiceMatrix'] = counts['Service'] || 0;
    counts['SignatureMatrix'] = counts['Signature'] || 0;
    counts['ZoneMatrices'] = unifiedMatrixCount;
    return counts;
  }, [assets, districts, zoneSettings]);

  const visibleCategories = useMemo(() => {
    return BASE_CATEGORIES.filter((cat) => {
      if (cat === 'Catalog') {
        return (categoryCounts['Catalog'] || 0) > 0;
      }
      if (cat === 'ZoneMatrices') {
        return zoneSettings.topTabUnified && enabledMatrixCategories.length > 0;
      }
      if (cat === 'Housing') {
        return zoneSettings.topTabHousing && zoneSettings.enableHousing;
      }
      if (cat === 'CommercialMatrix') {
        return zoneSettings.topTabCommercial && zoneSettings.enableCommercial;
      }
      if (cat === 'OfficeMatrix') {
        return zoneSettings.topTabOffice && zoneSettings.enableOffice;
      }
      if (cat === 'IndustrialMatrix') {
        return zoneSettings.topTabIndustrial && zoneSettings.enableIndustrial;
      }
      if (cat === 'StorageMatrix') {
        return zoneSettings.topTabStorage && zoneSettings.enableStorage;
      }
      if (cat === 'ServiceMatrix') {
        return zoneSettings.topTabService && zoneSettings.enableService;
      }
      if (cat === 'SignatureMatrix') {
        return zoneSettings.topTabSignature && zoneSettings.enableSignature;
      }
      return true;
    });
  }, [categoryCounts, zoneSettings, enabledMatrixCategories]);

  const searchPlaceholder = 'Search assets by name...';
  const toolsToggleLabel = translate('AdvancedBAM.TOOLS_TOGGLE', 'Tools') ?? 'Tools';
  const colName = translate('AdvancedBAM.COL_NAME', 'Name') ?? 'Name';
  const colCat = translate('AdvancedBAM.COL_CATEGORY', 'Category') ?? 'Category';
  const colDist = translate('AdvancedBAM.COL_DISTRICT', 'District') ?? 'District';
  const colLvl = translate('AdvancedBAM.COL_LEVEL', 'Level') ?? 'Level';
  const colOcc = translate('AdvancedBAM.COL_OCCUPANCY', 'Occupancy') ?? 'Occupancy';
  const colEff = translate('AdvancedBAM.COL_EFFICIENCY', 'Efficiency') ?? 'Efficiency';
  const colStatus = translate('AdvancedBAM.COL_STATUS', 'Status') ?? 'Status';
  const colAct = translate('AdvancedBAM.COL_ACTIONS', 'Actions') ?? 'Actions';
  const statusHealthy = translate('AdvancedBAM.STATUS_HEALTHY', 'Healthy') ?? 'Healthy';
  const actClone = translate('AdvancedBAM.ACT_CLONE', 'Clone') ?? 'Clone';
  const actPlop = translate('AdvancedBAM.ACT_PLOP', 'Plop') ?? 'Plop';
  const actRepair = translate('AdvancedBAM.Action.Repair', 'REPAIR') ?? 'REPAIR';
  const pageLabel = translate('AdvancedBAM.PAGE', 'Page') ?? 'Page';
  const ofLabel = translate('AdvancedBAM.OF', 'of') ?? 'of';
  const totalAssetsLabel = translate('AdvancedBAM.TOTAL_ASSETS', 'entries') ?? 'entries';
  const prevLabel = translate('AdvancedBAM.PREV', 'Prev') ?? 'Prev';
  const nextLabel = translate('AdvancedBAM.NEXT', 'Next') ?? 'Next';

  const liveFavoritesCount = useMemo(() => {
    if (favoriteKeys.size === 0 || !Array.isArray(assets)) return 0;
    const isCat = categoryFilter === 'Catalog';
    let count = 0;
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (!a) continue;
      if (isCat ? a.isPlaced : !a.isPlaced) continue;
      if (favoriteKeys.has(getAssetFavoriteKey(a))) count++;
    }
    return count;
  }, [assets, favoriteKeys, categoryFilter]);

  useEffect(() => {
    if (!Array.isArray(assets) || assets.length === 0 || favoriteKeys.size === 0) return;
    // Prune orphaned placed entity keys (e.g. demolished/rebuilt/replaced buildings) once placed assets are loaded
    const hasAnyPlaced = assets.some((a) => a && a.isPlaced);
    if (!hasAnyPlaced) return;
    const livePlacedKeys = new Set<string>();
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a && a.isPlaced) {
        livePlacedKeys.add(getAssetFavoriteKey(a));
      }
    }
    let changed = false;
    const next = new Set<string>();
    favoriteKeys.forEach((k) => {
      if (k.startsWith('prefab:') || livePlacedKeys.has(k)) {
        next.add(k);
      } else if (/^\d+[,:]\d+$/.test(k)) {
        changed = true;
      } else {
        next.add(k);
      }
    });
    if (changed) {
      setFavoriteKeys(next);
      try {
        bamStorage.setItem('bam_favorites', JSON.stringify(Array.from(next)));
      } catch (err) {
        logCatch('UnifiedAssetExplorer', err);
      }
    }
  }, [assets, favoriteKeys]);

  // Helper to render a single building row
  const renderItemRow = (item: UnifiedAssetItem, isNested = false) => {
    if (!item || typeof item !== 'object') return null;
    const stableKey =
      item.entityKey ||
      item.id ||
      `${item.prefabKey || item.prefabName || 'row'}:${item.name || ''}`;
    return (
    <TableBodyRow
      key={stableKey}
      item={item}
      isNested={isNested}
      categoryFilter={categoryFilter}
      activeViewColumns={activeViewColumns}
      getColStyle={getColStyle}
      isColVisible={isColVisible}
      favoriteKeys={favoriteKeys}
      toggleFavorite={toggleFavorite}
      showUpgradesBadge={showUpgradesBadge}
      expandedUpgrades={expandedUpgrades}
      toggleUpgrades={toggleUpgrades}
      expandedRowId={expandedRowId}
      setExpandedRowId={setExpandedRowId}
      focusedHighlightId={focusedHighlightId}
      setFocusedHighlightId={setFocusedHighlightId}
      statusHealthy={statusHealthy}
      actClone={actClone}
      actPlop={actPlop}
      actRepair={actRepair}
      buildingCardOrder={buildingCardOrder}
      hiddenBuildingCards={hiddenBuildingCards}
      collapsedBldCards={collapsedBldCards}
      setCollapsedBldCards={setCollapsedBldCards}
      buildingDraggedCardId={buildingDraggedCardId}
      buildingDragOverCardId={buildingDragOverCardId}
      buildingCardsContainerRef={buildingCardsContainerRef}
      handleBuildingCardMouseDown={handleBuildingCardMouseDown}
      moveBuildingCard={moveBuildingCard}
      resetBuildingCardLayout={resetBuildingCardLayout}
      toggleBldCardCollapse={toggleBldCardCollapse}
      bldEffFilter={bldEffFilter}
      setBldEffFilter={setBldEffFilter}
      bldEffLimit={bldEffLimit}
      setBldEffLimit={setBldEffLimit}
      bldHappyFilter={bldHappyFilter}
      setBldHappyFilter={setBldHappyFilter}
      bldHappyLimit={bldHappyLimit}
      setBldHappyLimit={setBldHappyLimit}
      upgradeDisplayMode={upgradeDisplayMode}
      setUpgradeDisplayMode={setUpgradeDisplayMode}
      expandedSubBuildings={expandedSubBuildings}
      toggleSubBuildingExpand={toggleSubBuildingExpand}
      focusEntity={focusEntity}
      cloneBuilding={cloneBuilding}
      rebuildBuilding={rebuildBuilding}
      renameAsset={renameAsset}
      plopPrefab={plopPrefab}
      showTools={showTools}
      translate={translate}
    />
    );
  };

  return (
    <div className="bam-explorer-container">
      {/* Category Pills Navigation */}
      <div className="bam-category-bar">
        {visibleCategories.map((cat) => {
          const isActive = categoryFilter === cat;
          const count = categoryCounts[cat] || 0;
          const labelKey = `AdvancedBAM.CAT_${cat.toUpperCase()}`;
          const fallbackLabel = CATEGORY_FALLBACK_LABELS[cat] ?? cat;
          const label = translate(labelKey, fallbackLabel) ?? fallbackLabel;
          const catVis = getCategoryVisual(cat);

          return (
            <button
              key={cat}
              className={`bam-category-pill${isActive ? ' active' : ''}`}
              style={
                isActive
                  ? {
                      background: catVis.activeBg,
                      borderColor: catVis.activeBorder,
                      color: '#ffffff',
                    }
                  : {
                      borderColor: catVis.border,
                    }
              }
              onClick={() => selectCategoryFilter(cat)}
            >
              <span
                className="bam-category-tab-dot"
                style={{ backgroundColor: isActive ? '#ffffff' : catVis.dotColor }}
              />
              <span>{label}</span>
              <span className="bam-pill-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {categoryFilter === 'Districts' ? (
        <DistrictsView
          focusedDistrictKey={focusedDistrictKey}
          onFocusedDistrictHandled={() => setFocusedDistrictKey(null)}
          onFilterResidential={handleFilterZoneMatrix}
          onFilterToDistrict={(districtKey) => {
            setCategoryFilter('All');
            setDistrictFilter(districtKey);
            setCurrentPage(0);
          }}
        />
      ) : categoryFilter === 'ZoneMatrices' ||
        categoryFilter === 'Housing' ||
        categoryFilter === 'CommercialMatrix' ||
        categoryFilter === 'OfficeMatrix' ||
        categoryFilter === 'IndustrialMatrix' ||
        categoryFilter === 'StorageMatrix' ||
        categoryFilter === 'ServiceMatrix' ||
        categoryFilter === 'SignatureMatrix' ? (
        <ZoneMatrixDashboardPage
          assets={assets}
          districts={districts}
          initialCategory={
            categoryFilter === 'Housing'
              ? 'housing'
              : categoryFilter === 'CommercialMatrix'
                ? 'commercial'
                : categoryFilter === 'OfficeMatrix'
                  ? 'office'
                  : categoryFilter === 'IndustrialMatrix'
                    ? 'industrial'
                    : categoryFilter === 'StorageMatrix'
                      ? 'storage'
                      : categoryFilter === 'ServiceMatrix'
                        ? 'service'
                        : categoryFilter === 'SignatureMatrix'
                          ? 'signature'
                          : undefined
          }
          lockedCategory={categoryFilter !== 'ZoneMatrices'}
          enabledCategories={enabledMatrixCategories}
          includeMixedGroundFloor={zoneSettings.includeMixedGroundFloor}
          includeIndustrialSpecials={zoneSettings.includeIndustrialSpecials}
          includeServiceUpgrades={zoneSettings.includeServiceUpgrades}
          onFilterAsset={handleFilterZoneMatrix}
          onFilterResidential={handleFilterZoneMatrix}
          onInspectDistrict={(distKey) => {
            setCategoryFilter('Districts');
            setFocusedDistrictKey(distKey);
          }}
        />
      ) : (
        <>
          {/* Controls & Filter Bar */}
          <div className="bam-control-bar">
            <div className="bam-filter-dropdowns">
              {/* Search Box */}
              <div className="bam-search-box">
                <span className="bam-search-icon">
                  <UilIcon name="Search" sizeRem={12} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="bam-search-input"
                  placeholder={`${searchPlaceholder} (Press '/' or Ctrl+F)`}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  aria-label={searchPlaceholder}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="bam-search-clear"
                    onClick={() => {
                      setSearchInput('');
                      setSearchText('');
                    }}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <UilIcon name="Close" sizeRem={11} alt="Clear" />
                  </button>
                )}
              </div>

              {/* Filters Flyout Toggle Button */}
              {showFilterFlyout && (
                <button
                  ref={filterFlyoutToggleRef}
                  className={`bam-filter-flyout-toggle${isFilterFlyoutOpen ? ' active' : ''}`}
                  onClick={() => {
                    if (!isFilterFlyoutOpen && !filterFlyoutPos && filterFlyoutToggleRef.current) {
                      const rect = filterFlyoutToggleRef.current.getBoundingClientRect();
                      const scale = getPixelsPerRem();
                      const vpW = window.innerWidth / scale;
                      const vpH = window.innerHeight / scale;
                      const targetX = Math.round(Math.max(10, Math.min(vpW - 470, rect.left / scale)));
                      const targetY = Math.round(Math.max(10, Math.min(vpH - 580, (rect.bottom / scale) + 6)));
                      const initPos = { x: targetX, y: targetY };
                      setFilterFlyoutPos(initPos);
                      try {
                        bamStorage.setItem('bam_filter_flyout_pos', JSON.stringify(initPos));
                      } catch (err) { logCatch('UnifiedAssetExplorer', err); }
                    }
                    setIsFilterFlyoutOpen(!isFilterFlyoutOpen);
                  }}
                  title="Toggle Advanced Filters"
                >
                  <UilIcon name="Filter" sizeRem={12} style={{ color: isFilterFlyoutOpen ? '#0f172a' : '#38bdf8' }} />
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <span className="bam-filter-flyout-badge">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}

              {/* Columns Quick Toggle Menu */}
              <div ref={columnsPickerBtnRef} style={{ position: 'relative', display: 'flex' }}>
                  <button
                    type="button"
                    className={`bam-filter-flyout-toggle${isColumnsPickerOpen ? ' active' : ''}`}
                    onClick={() => setIsColumnsPickerOpen(!isColumnsPickerOpen)}
                    title="Toggle table columns visibility (e.g. Maintenance, Lot Size)"
                  >
                    <svg width="12rem" height="12rem" viewBox="0 0 24 24" style={{ marginRight: '5rem' }} fill={isColumnsPickerOpen ? '#38bdf8' : '#94a3b8'}>
                      <path d="M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 0h4v16h-4V4z" />
                    </svg>
                    <span>Columns</span>
                  </button>
                  {isColumnsPickerOpen && (
                    <div
                      className="bam-columns-dropdown-menu"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4rem',
                        background: 'rgba(22, 38, 56, 0.98)',
                        border: '1.5rem solid rgba(56, 189, 248, 0.6)',
                        borderRadius: '6rem',
                        boxShadow: '0 12rem 30rem rgba(0, 0, 0, 0.85)',
                        padding: '6rem 8rem',
                        zIndex: 100030,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '150rem',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ fontSize: '10rem', fontWeight: 700, color: '#38bdf8', padding: '4rem 6rem', borderBottom: '1rem solid rgba(255,255,255,0.08)', marginBottom: '4rem', textTransform: 'uppercase', letterSpacing: '0.5rem' }}>
                        Columns
                      </div>
                      {(() => {
                        const allowed: string[] =
                          categoryFilter === 'Catalog'
                            ? ['name', 'lotSize', 'cat', 'themePack', 'level', 'occupied', 'actions']
                            : PILL_COLUMNS_MAP[(categoryFilter === 'All' ? 'all' : categoryFilter) as AssetSubPill] ||
                              PILL_COLUMNS_MAP['all'] ||
                              [];
                        const allCandidates = [
                          { key: 'lotSize', label: 'Lot Size' },
                          { key: 'cat', label: 'Category' },
                          { key: 'company', label: 'Company' },
                          { key: 'vehicles', label: categoryFilter === 'Service' ? 'Service Fleet' : 'Delivery Fleet' },
                          { key: 'resource', label: 'Resource' },
                          { key: 'storage', label: 'Storage Totals' },
                          { key: 'profit', label: 'Profit' },
                          { key: 'service', label: 'Service Type' },
                          { key: 'serviceUsage', label: 'Usage / Capacity' },
                          { key: 'themePack', label: 'Theme / Pack' },
                          { key: 'district', label: 'District' },
                          { key: 'density', label: 'Density' },
                          { key: 'level', label: 'Level' },
                          {
                            key: 'occupied',
                            label:
                              categoryFilter === 'Residential'
                                ? 'Households'
                                : categoryFilter === 'Service'
                                ? 'Staff / Workers'
                                : categoryFilter === 'Catalog'
                                ? 'Capacity'
                                : 'Occupancy',
                          },
                          { key: 'happiness', label: 'Happiness' },
                          { key: 'efficiency', label: 'Efficiency' },
                          { key: 'maintenance', label: 'Maintenance' },
                          { key: 'status', label: 'Status' },
                          { key: 'actions', label: categoryFilter === 'Catalog' ? 'Placement Tool' : 'Actions' },
                        ];
                        return allCandidates.filter((c) => allowed.includes(c.key));
                      })().map((col) => {
                        const visible = isColVisible(col.key);
                        return (
                          <button
                            key={col.key}
                            type="button"
                            className={`bam-quick-preset-pill${visible ? ' active' : ''}`}
                            style={{
                              padding: '4rem 8rem',
                              fontSize: '11rem',
                              marginBottom: '3rem',
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              background: visible ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                              borderColor: visible ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                              color: visible ? '#ffffff' : '#94a3b8',
                            }}
                            onClick={() => toggleColumnVisibility(col.key)}
                          >
                            <span style={{ marginRight: '6rem', color: visible ? '#38bdf8' : '#64748b', fontWeight: 700 }}>
                              {visible ? '✓' : '—'}
                            </span>
                            {col.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

              {/* City Tools & Emergency Repair Mode Toggle */}
              <button
                type="button"
                className={`bam-tool-toggle${showTools ? ' active' : ''}`}
                onClick={() => setShowTools(!showTools)}
                title="Toggle clone, placement & emergency building repair tools"
              >
                <UilIcon name="Tools" sizeRem={12} />
                <span style={{ marginLeft: '5rem' }}>
                  {toolsToggleLabel}: {showTools ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Clear All Filters Quick Button */}
              {hasActiveFilters && (
                <button
                  className="bam-filter-clear-btn"
                  onClick={handleResetFilters}
                  title="Reset all active filters to default"
                >
                  <UilIcon name="Close" sizeRem={11} style={{ marginRight: '4rem' }} />
                  <span>Clear ({activeFilterCount})</span>
                </button>
              )}

              {/* District Select (Placed buildings only) */}
              {categoryFilter !== 'Catalog' && (
                <CustomSelect
                  value={districtFilter}
                  options={districtOptions}
                  onChange={(val) => setDistrictFilter(val)}
                  title="Filter buildings by district"
                />
              )}

              {/* Theme Select */}
              {uniqueThemes.length > 1 && (
                <CustomSelect
                  value={themeFilter}
                  options={themeOptions}
                  onChange={(val) => setThemeFilter(val)}
                  title="Filter by architecture theme"
                />
              )}

              {/* Asset Pack / DLC Select */}
              {uniquePacks.length > 1 && (
                <CustomSelect
                  value={packFilter}
                  options={packOptions}
                  onChange={(val) => setPackFilter(val)}
                  title="Filter by DLC / content pack"
                />
              )}



              {/* Pill-Specific Dropdowns */}
              {categoryFilter === 'Residential' && (
                <>
                  <CustomSelect
                    value={densityFilter}
                    options={densityOptions}
                    onChange={(val) => setDensityFilter(val)}
                    title="Filter by residential density"
                  />
                  <CustomSelect
                    value={levelFilter}
                    options={levelOptions}
                    onChange={(val) => setLevelFilter(val)}
                    title="Filter by building level"
                  />
                </>
              )}

              {categoryFilter === 'Commercial' && (
                <>
                  <CustomSelect
                    value={densityFilter}
                    options={densityOptions}
                    onChange={(val) => setDensityFilter(val)}
                    title="Filter by commercial zone density"
                  />
                  <CustomSelect
                    value={levelFilter}
                    options={levelOptions}
                    onChange={(val) => setLevelFilter(val)}
                    title="Filter by commercial level"
                  />
                  {uniqueOutputResources.length > 1 && (
                    <CustomSelect
                      value={outputResourceFilter}
                      options={outputResourceOptions}
                      onChange={(val) => setOutputResourceFilter(val)}
                      title="Filter by commercial product sold"
                    />
                  )}
                </>
              )}

              {categoryFilter === 'Industrial' && (
                <>
                  <CustomSelect
                    value={densityFilter}
                    options={densityOptions}
                    onChange={(val) => setDensityFilter(val)}
                    title="Filter by industrial zone / facility type"
                  />
                  <CustomSelect
                    value={levelFilter}
                    options={levelOptions}
                    onChange={(val) => setLevelFilter(val)}
                    title="Filter by industrial level"
                  />
                  {uniqueInputResources.length > 1 && (
                    <CustomSelect
                      value={inputResourceFilter}
                      options={inputResourceOptions}
                      onChange={(val) => setInputResourceFilter(val)}
                      title="Filter by consumed input material"
                    />
                  )}
                  {uniqueOutputResources.length > 1 && (
                    <CustomSelect
                      value={outputResourceFilter}
                      options={outputResourceOptions}
                      onChange={(val) => setOutputResourceFilter(val)}
                      title="Filter by manufactured output product"
                    />
                  )}
                </>
              )}

              {categoryFilter === 'Office' && (
                <>
                  <CustomSelect
                    value={densityFilter}
                    options={densityOptions}
                    onChange={(val) => setDensityFilter(val)}
                    title="Filter by office density"
                  />
                  <CustomSelect
                    value={levelFilter}
                    options={levelOptions}
                    onChange={(val) => setLevelFilter(val)}
                    title="Filter by office level"
                  />
                  {uniqueOutputResources.length > 1 && (
                    <CustomSelect
                      value={outputResourceFilter}
                      options={outputResourceOptions}
                      onChange={(val) => setOutputResourceFilter(val)}
                      title="Filter by output service/product"
                    />
                  )}
                </>
              )}

              {categoryFilter === 'Storage' && (
                <>
                  {storageHubOptions.length > 1 && (
                    <CustomSelect
                      value={storageHubFilter}
                      options={storageHubOptions}
                      onChange={(val) => setStorageHubFilter(val)}
                      title="Filter by storage hub or warehouse type"
                    />
                  )}
                  {uniqueStorageResources.length > 1 && (
                    <CustomSelect
                      value={storedResourceFilter}
                      options={storedResourceOptions}
                      onChange={(val) => setStoredResourceFilter(val)}
                      title="Filter by stored cargo resource"
                    />
                  )}
                </>
              )}

              {categoryFilter === 'Service' && (
                <>
                  {uniqueServiceTypes.length > 1 && (
                    <CustomSelect
                      value={serviceTypeFilter}
                      options={serviceTypeOptions}
                      onChange={(val) => setServiceTypeFilter(val)}
                      title="Filter by public service department"
                    />
                  )}
                </>
              )}

              {categoryFilter === 'Signature' && (
                <>
                  <CustomSelect
                    value={signatureCatFilter}
                    options={signatureCatOptions}
                    onChange={(val) => setSignatureCatFilter(val)}
                    title="Filter signature by category"
                  />
                  <CustomSelect
                    value={levelFilter}
                    options={levelOptions}
                    onChange={(val) => setLevelFilter(val)}
                    title="Filter by building level"
                  />
                </>
              )}

              {categoryFilter === 'Catalog' && (
                <>
                  <CustomSelect
                    value={catalogCatFilter}
                    options={catalogCatOptions}
                    onChange={(val) => setCatalogCatFilter(val)}
                    title="Filter catalog prefabs by category"
                  />
                  <CustomSelect
                    value={levelFilter}
                    options={levelOptions}
                    onChange={(val) => setLevelFilter(val)}
                    title="Filter catalog prefabs by level"
                  />
                </>
              )}

            </div>

            {/* Quick Filter Presets Component */}
            {showQuickFilterBar && (
              <QuickPresetsBar
                quickPreset={quickPreset as QuickPresetId}
                onSelectPreset={(p) => {
                  setQuickPreset(p);
                  setCurrentPage(0);
                }}
                favoritesCount={liveFavoritesCount}
                isCatalog={categoryFilter === 'Catalog'}
                onHideBar={() => {
                  setShowQuickFilterBar(false);
                  bamStorage.setItem('bam_show_quick_filter_bar', 'false');
                  window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'showQuickFilterBar', value: false } }));
                }}
              />
            )}

            {/* Free-Floating Draggable Filters Panel (Portaled to document.body to prevent container clipping) */}
            <ExplorerFilterFlyout
              isBamVisible={isBamVisible}
              showFilterFlyout={showFilterFlyout}
              isFilterFlyoutOpen={isFilterFlyoutOpen}
              setIsFilterFlyoutOpen={setIsFilterFlyoutOpen}
              filterFlyoutPanelRef={filterFlyoutPanelRef}
              filterFlyoutPos={filterFlyoutPos}
              handleFlyoutMouseDown={handleFlyoutMouseDown}
              isDraggingFlyout={isDraggingFlyout}
              hasActiveFilters={hasActiveFilters}
              handleResetFilters={handleResetFilters}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
              categoryFilter={categoryFilter}
              setCategoryFilter={selectCategoryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              lotWidthFilter={lotWidthFilter}
              setLotWidthFilter={setLotWidthFilter}
              lotWidthList={lotWidthList}
              stepLotWidth={stepLotWidth}
              lotDepthFilter={lotDepthFilter}
              setLotDepthFilter={setLotDepthFilter}
              lotDepthList={lotDepthList}
              stepLotDepth={stepLotDepth}
              levelFilter={levelFilter}
              setLevelFilter={setLevelFilter}
              stepBuildingLevel={stepBuildingLevel}
              cornerTypeFilter={cornerTypeFilter}
              setCornerTypeFilter={setCornerTypeFilter}
              catalogCatFilter={catalogCatFilter}
              setCatalogCatFilter={setCatalogCatFilter}
              signatureCatFilter={signatureCatFilter}
              setSignatureCatFilter={setSignatureCatFilter}
              densityFilter={densityFilter}
              setDensityFilter={setDensityFilter}
              inputResourceFilter={inputResourceFilter}
              setInputResourceFilter={setInputResourceFilter}
              inputResourceOptions={inputResourceOptions}
              outputResourceFilter={outputResourceFilter}
              setOutputResourceFilter={setOutputResourceFilter}
              outputResourceOptions={outputResourceOptions}
              storageHubFilter={storageHubFilter}
              setStorageHubFilter={setStorageHubFilter}
              storageHubOptions={storageHubOptions}
              storedResourceFilter={storedResourceFilter}
              setStoredResourceFilter={setStoredResourceFilter}
              storedResourceOptions={storedResourceOptions}
              serviceTypeFilter={serviceTypeFilter}
              setServiceTypeFilter={setServiceTypeFilter}
              serviceTypeOptions={serviceTypeOptions}
              parkingFilter={parkingFilter}
              setParkingFilter={setParkingFilter}
              signatureOnly={signatureOnly}
              setSignatureOnly={setSignatureOnly}
              groupSameName={groupSameName}
              setGroupSameName={setGroupSameName}
              packFilter={packFilter}
              setPackFilter={setPackFilter}
              regionPacks={regionPacks}
              dlcPacks={dlcPacks}
              packIconMap={packIconMap}
              getPackAbbrev={getPackAbbrev}
              getPackFullName={getPackFullName}
              themeFilter={themeFilter}
              setThemeFilter={setThemeFilter}
              themeIconMap={themeIconMap}
            />

            {/* Active Filter Chips Subbar (rendered only when filters are active) */}
            {hasActiveFilters && (
              <div className="bam-control-subbar">
                <div className="bam-subbar-toggles">
                  <div className="bam-active-filters-chips">
                    <span className="bam-chips-label">Active Filters ({activeFilterCount}):</span>
                    {searchText.trim() !== '' && (
                      <span className="bam-filter-chip" onClick={() => { setSearchInput(''); setSearchText(''); }} title="Click to clear search">
                        Search: "{searchText}" ×
                      </span>
                    )}
                    {filterCaps.allowsDistrict && districtFilter !== '' && (
                      <span className="bam-filter-chip" onClick={() => setDistrictFilter('')} title="Click to clear district filter">
                        District: {districtFilter === '__unassigned__' ? 'No District (Unassigned)' : (realDistricts.find((d) => d.entityKey === districtFilter)?.name || districtFilter)} ×
                      </span>
                    )}
                    {quickPreset !== 'all' && (
                      <span className="bam-filter-chip" onClick={() => setQuickPreset('all')} title="Click to reset preset">
                        Preset: {quickPreset} ×
                      </span>
                    )}
                    {themeFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setThemeFilter('All')} title="Click to clear theme filter">
                        Theme: {themeFilter} ×
                      </span>
                    )}
                    {packFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setPackFilter('All')} title="Click to clear pack filter">
                        Pack: {packFilter} ×
                      </span>
                    )}
                    {lotSizeFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setLotSizeFilter('All')} title="Click to clear lot size filter">
                        Size: {lotSizeFilter} ×
                      </span>
                    )}
                    {lotWidthFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setLotWidthFilter('All')} title="Click to clear width filter">
                        W: {lotWidthFilter} ×
                      </span>
                    )}
                    {lotDepthFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setLotDepthFilter('All')} title="Click to clear depth filter">
                        D: {lotDepthFilter} ×
                      </span>
                    )}
                    {filterCaps.allowsLevel && levelFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setLevelFilter('All')} title="Click to clear level filter">
                        Lvl: {levelFilter} ×
                      </span>
                    )}
                    {cornerTypeFilter !== 'all' && (
                      <span className="bam-filter-chip" onClick={() => setCornerTypeFilter('all')} title="Click to clear corner filter">
                        Corner: {formatCornerLabel(cornerTypeFilter)} ×
                      </span>
                    )}
                    {filterCaps.allowsDensity && densityFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setDensityFilter('All')} title="Click to clear density filter">
                        Type:{' '}
                        {densityFilter === 'MediumAll'
                          ? 'Medium (+ Row)'
                          : densityFilter === 'HighAll'
                            ? 'High (+ Low Rent)'
                            : densityFilter === 'RowOrMixed'
                              ? 'Row / Mixed'
                              : densityFilter.startsWith('zone:')
                                ? densityFilter.slice(5)
                                : densityFilter}{' '}
                        ×
                      </span>
                    )}
                    {parkingFilter !== 'all' && (
                      <span className="bam-filter-chip" onClick={() => setParkingFilter('all')} title="Click to clear parking filter">
                        {parkingFilter === 'with' ? 'Parking' : 'No Parking'} ×
                      </span>
                    )}
                    {signatureOnly && (
                      <span className="bam-filter-chip" onClick={() => setSignatureOnly(false)} title="Click to clear signature filter" style={{ display: 'flex', alignItems: 'center' }}>
                        <UilIcon name="Star" sizeRem={10} style={{ color: '#ffd54f', marginRight: '4rem' }} />
                        <span>Signature ×</span>
                      </span>
                    )}
                    {filterCaps.allowsStatus && statusFilter !== 'all' && (
                      <span className="bam-filter-chip" onClick={() => setStatusFilter('all')} title="Click to clear status filter">
                        Status: {statusFilter === 'damaged' ? 'Damaged' : 'Turned Off'} ×
                      </span>
                    )}
                    {filterCaps.allowsInputRes && inputResourceFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setInputResourceFilter('All')} title="Click to clear input resource">
                        In: {inputResourceFilter} ×
                      </span>
                    )}
                    {filterCaps.allowsOutputRes && outputResourceFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setOutputResourceFilter('All')} title="Click to clear output resource">
                        Out: {outputResourceFilter} ×
                      </span>
                    )}
                    {filterCaps.allowsStorageFilters && storedResourceFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setStoredResourceFilter('All')} title="Click to clear stored resource">
                        Stored: {storedResourceFilter} ×
                      </span>
                    )}
                    {filterCaps.allowsStorageFilters && storageHubFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setStorageHubFilter('All')} title="Click to clear hub filter">
                        Hub: {storageHubFilter} ×
                      </span>
                    )}
                    {filterCaps.allowsServiceType && serviceTypeFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setServiceTypeFilter('All')} title="Click to clear service type">
                        Service: {serviceTypeFilter} ×
                      </span>
                    )}
                    {filterCaps.isSignature && signatureCatFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setSignatureCatFilter('All')} title="Click to clear signature category">
                        Category: {signatureCatFilter} ×
                      </span>
                    )}
                    {filterCaps.isCatalog && catalogCatFilter !== 'All' && (
                      <span className="bam-filter-chip" onClick={() => setCatalogCatFilter('All')} title="Click to clear catalog category">
                        Catalog: {catalogCatFilter} ×
                      </span>
                    )}
                    <button
                      type="button"
                      className="bam-filter-chip-clear-all"
                      onClick={() => {
                        handleResetFilters();
                        setSearchInput('');
                        setQuickPreset('all');
                      }}
                      title="Clear all active filters"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Compact Tools & Emergency Repairs Strip */}
          {showTools && (
            <div className="bam-tools-panel">
              <div className="bam-tools-title-group">
                <UilIcon name="Tools" sizeRem={12} style={{ marginRight: '4rem', color: '#4fc3f7' }} />
                <span className="bam-tools-title">Repairs</span>
              </div>
              <div className="bam-tools-grid">
                {(
                  [
                    {
                      scope: 'all' as const,
                      cls: 'repair-all',
                      icon: 'Thunder' as const,
                      color: '#ffd54f',
                      label: 'Repair All',
                      tooltip: 'Repairs all damaged, burned, flooded, storm-hit, collapsed, abandoned, and broken-path buildings across the city',
                    },
                    {
                      scope: 'path' as const,
                      cls: 'path',
                      icon: 'Refresh' as const,
                      color: '#4dd0e1',
                      label: 'Fix Broken Paths',
                      tooltip: 'Relocates buildings with broken road/pedestrian/car/track access in-place at their exact position & rotation',
                    },
                    {
                      scope: 'fire' as const,
                      cls: 'fire',
                      icon: 'Fire' as const,
                      color: '#ff7043',
                      label: 'Extinguish Fires',
                      tooltip: 'Extinguishes active fires, clears fire rescue requests, and repairs fire-damaged buildings',
                    },
                    {
                      scope: 'flood' as const,
                      cls: 'flood',
                      icon: 'Water' as const,
                      color: '#29b6f6',
                      label: 'Drain Floods',
                      tooltip: 'Clears flood damage, water-level flags, and restores flood-damaged buildings',
                    },
                    {
                      scope: 'weather' as const,
                      cls: 'weather',
                      icon: 'Thunder' as const,
                      color: '#ab47bc',
                      label: 'Storm Recovery',
                      tooltip: 'Repairs buildings damaged by tornadoes, hail, and storm events',
                    },
                    {
                      scope: 'accident' as const,
                      cls: 'accident',
                      icon: 'Shield' as const,
                      color: '#ef5350',
                      label: 'Clear Accidents',
                      tooltip: 'Clears traffic accident sites, involved-in-accident flags, police requests, and road collision icons',
                    },
                    {
                      scope: 'collapse' as const,
                      cls: 'collapse',
                      icon: 'Tools' as const,
                      color: '#ffa726',
                      label: 'Rebuild Collapsed',
                      tooltip: 'Rebuilds collapsed rubble, clears destroyed flags, and restores road/path connections',
                    },
                    {
                      scope: 'abandoned' as const,
                      cls: 'abandoned',
                      icon: 'Trash' as const,
                      color: '#bcaaa4',
                      label: 'Reclaim Abandoned',
                      tooltip: 'Clears abandoned and condemned flags so buildings can become active again',
                    },
                  ] as const
                ).map((btn) => (
                  <button
                    key={btn.scope}
                    type="button"
                    className={`bam-tool-action-btn ${btn.cls}`}
                    onClick={() => {
                      hideTooltip();
                      rebuildAll(btn.scope);
                    }}
                    onMouseEnter={(e) => showTooltip(btn.tooltip, e)}
                    onMouseLeave={hideTooltip}
                  >
                    <UilIcon name={btn.icon} sizeRem={12} style={{ marginRight: '4rem', color: btn.color }} />
                    <span className="bam-tool-btn-title">{btn.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Inline Zoning Matrix Headers per Explorer Tab (Default OFF) */}
          {(() => {
            let inlineCat: ZoneMatrixCategory | null = null;
            if (categoryFilter === 'Residential' && zoneSettings.enableHousing && zoneSettings.inResidential) {
              inlineCat = 'housing';
            } else if (categoryFilter === 'Commercial' && zoneSettings.enableCommercial && zoneSettings.inCommercial) {
              inlineCat = 'commercial';
            } else if (categoryFilter === 'Office' && zoneSettings.enableOffice && zoneSettings.inOffice) {
              inlineCat = 'office';
            } else if (categoryFilter === 'Industrial' && zoneSettings.enableIndustrial && zoneSettings.inIndustrial) {
              inlineCat = 'industrial';
            } else if (categoryFilter === 'Storage' && zoneSettings.enableStorage && zoneSettings.inStorage) {
              inlineCat = 'storage';
            } else if (categoryFilter === 'Service' && zoneSettings.enableService && zoneSettings.inService) {
              inlineCat = 'service';
            } else if (categoryFilter === 'Signature' && zoneSettings.enableSignature && zoneSettings.inSignature) {
              inlineCat = 'signature';
            }
            if (!inlineCat) return null;
            return (
              <div style={{ padding: '6rem 10rem 0 10rem', flexShrink: 0 }}>
                <ZoneMatrixPanel
                  compact={true}
                  assets={assets}
                  districts={districts}
                  districtKey={districtFilter || undefined}
                  zoneCategory={inlineCat}
                  includeMixedGroundFloor={zoneSettings.includeMixedGroundFloor}
                  includeIndustrialSpecials={zoneSettings.includeIndustrialSpecials}
                  includeServiceUpgrades={zoneSettings.includeServiceUpgrades}
                  activeDensity={densityFilter}
                  activeServiceType={serviceTypeFilter}
                  activeStorageHub={storageHubFilter}
                  activeSignatureCategory={signatureCatFilter}
                  activePack={packFilter}
                  activeTheme={themeFilter}
                  onFilterAsset={(req) =>
                    handleFilterZoneMatrix({
                      ...req,
                      districtKey: req.districtKey !== undefined ? req.districtKey : districtFilter,
                    })
                  }
                  onFilterResidential={(req) =>
                    handleFilterZoneMatrix({
                      ...req,
                      districtKey: req.districtKey !== undefined ? req.districtKey : districtFilter,
                    })
                  }
                />
              </div>
            );
          })()}

          {/* Contextual Summary Strip */}
          <ContextualSummaryStrip
            currentCategory={categoryFilter}
            filteredAssets={filteredAssets}
            selectedServiceType={serviceTypeFilter}
            onSelectServiceType={(s) => setServiceTypeFilter(s === serviceTypeFilter ? 'All' : s)}
          />

          {/* Dynamic Table Area */}
          <div className="bam-table-wrapper">
            {/* Dynamic Table Header (Rendered in DOM order for Cohtml) */}
            <div className="bam-table-header" ref={tableHeaderRef} onWheel={handleHeaderWheel}>
              {activeViewColumns.map((colKey) => {
                switch (colKey) {
                  case 'name':
                    return (
                      <div key="name" className="bam-th col-name" style={getColStyle('name')} onClick={() => handleSort('name')}>
                        <span>{categoryFilter === 'Catalog' ? 'Prefab Asset' : colName}</span>
                        <span>{sortIndicator('name')}</span>
                        {renderResizer('name')}
                      </div>
                    );
                  case 'lotSize':
                    return (
                      <div key="lotSize" className="bam-th col-lotsize" style={getColStyle('lotSize')} onClick={() => handleSort('lotSize')}>
                        <span>Lot Size</span>
                        <span>{sortIndicator('lotSize')}</span>
                        {renderResizer('lotSize')}
                      </div>
                    );
                  case 'company':
                    return (
                      <div key="company" className="bam-th col-company" style={getColStyle('company')} onClick={() => handleSort('company')}>
                        <span>Company / Brand</span>
                        <span>{sortIndicator('company')}</span>
                        {renderResizer('company')}
                      </div>
                    );
                  case 'vehicles':
                    return (
                      <div key="vehicles" className="bam-th col-vehicles" style={getColStyle('vehicles')} onClick={() => handleSort('vehicles', true)}>
                        <span>{categoryFilter === 'Service' ? 'Service Fleet' : 'Delivery Fleet'}</span>
                        <span>{sortIndicator('vehicles')}</span>
                        {renderResizer('vehicles')}
                      </div>
                    );
                  case 'storage':
                    return (
                      <div key="storage" className="bam-th col-storage" style={getColStyle('storage')} onClick={() => handleSort('storage', true)}>
                        <span>Storage Totals</span>
                        <span>{sortIndicator('storage')}</span>
                        {renderResizer('storage')}
                      </div>
                    );
                  case 'service':
                    return (
                      <div key="service" className="bam-th col-service" style={getColStyle('service')} onClick={() => handleSort('service')}>
                        <span>Service Type</span>
                        <span>{sortIndicator('service')}</span>
                        {renderResizer('service')}
                      </div>
                    );
                  case 'serviceUsage':
                    return (
                      <div key="serviceUsage" className="bam-th col-service-usage" style={getColStyle('serviceUsage')} onClick={() => handleSort('serviceUsage', true)}>
                        <span>Usage / Capacity</span>
                        <span>{sortIndicator('serviceUsage')}</span>
                        {renderResizer('serviceUsage')}
                      </div>
                    );
                  case 'cat':
                    return (
                      <div key="cat" className="bam-th col-cat" style={getColStyle('cat')} onClick={() => handleSort('cat')}>
                        <span>{categoryFilter === 'Catalog' ? 'Category' : colCat}</span>
                        <span>{sortIndicator('cat')}</span>
                        {renderResizer('cat')}
                      </div>
                    );
                  case 'resource':
                    return (
                      <div key="resource" className="bam-th col-resource" style={getColStyle('resource')} onClick={() => handleSort('resource')}>
                        <span>Resource</span>
                        <span>{sortIndicator('resource')}</span>
                        {renderResizer('resource')}
                      </div>
                    );
                  case 'profit':
                    return (
                      <div key="profit" className="bam-th col-profit" style={getColStyle('profit')} onClick={() => handleSort('profit', true)}>
                        <span>Profit / Tier</span>
                        <span>{sortIndicator('profit')}</span>
                        {renderResizer('profit')}
                      </div>
                    );
                  case 'themePack':
                    return (
                      <div key="themePack" className="bam-th col-theme-pack" style={getColStyle('themePack')} onClick={() => handleSort('theme')}>
                        <span>Theme/Pack</span>
                        <span>{sortIndicator('theme')}</span>
                        {renderResizer('themePack')}
                      </div>
                    );
                  case 'district':
                    return (
                      <div key="district" className="bam-th col-dist" style={getColStyle('district')} onClick={() => handleSort('district')}>
                        <span>{colDist}</span>
                        <span>{sortIndicator('district')}</span>
                        {renderResizer('district')}
                      </div>
                    );
                  case 'density':
                    return (
                      <div key="density" className="bam-th col-density" style={getColStyle('density')} onClick={() => handleSort('density')}>
                        <span>Density</span>
                        <span>{sortIndicator('density')}</span>
                        {renderResizer('density')}
                      </div>
                    );
                  case 'level':
                    return (
                      <div key="level" className="bam-th col-lvl" style={getColStyle('level')} onClick={() => handleSort('level', true)}>
                        <span>{colLvl}</span>
                        <span>{sortIndicator('level')}</span>
                        {renderResizer('level')}
                      </div>
                    );
                  case 'occupied': {
                    const occLabel =
                      categoryFilter === 'Residential'
                        ? 'Households'
                        : categoryFilter === 'Service'
                        ? 'Staff / Workers'
                        : categoryFilter === 'Catalog'
                        ? 'Capacity'
                        : categoryFilter === 'Commercial' ||
                          categoryFilter === 'Industrial' ||
                          categoryFilter === 'Office' ||
                          categoryFilter === 'Storage'
                        ? 'Workers'
                        : 'Occupancy';
                    return (
                      <div
                        key="occupied"
                        className="bam-th col-occ"
                        style={getColStyle('occupied')}
                        onClick={categoryFilter === 'Catalog' ? undefined : () => handleSort('occupied', true)}
                      >
                        <span>{occLabel}</span>
                        {categoryFilter !== 'Catalog' && <span>{sortIndicator('occupied')}</span>}
                        {renderResizer('occupied')}
                      </div>
                    );
                  }
                  case 'happiness':
                    return (
                      <div key="happiness" className="bam-th col-happy" style={getColStyle('happiness')} onClick={() => handleSort('happiness', true)}>
                        <span>Happiness</span>
                        <span>{sortIndicator('happiness')}</span>
                        {renderResizer('happiness')}
                      </div>
                    );
                  case 'efficiency':
                    return (
                      <div key="efficiency" className="bam-th col-eff" style={getColStyle('efficiency')} onClick={() => handleSort('efficiency', true)}>
                        <span>{colEff}</span>
                        <span>{sortIndicator('efficiency')}</span>
                        {renderResizer('efficiency')}
                      </div>
                    );
                  case 'maintenance':
                    return (
                      <div key="maintenance" className="bam-th col-maint" style={getColStyle('maintenance')} onClick={() => handleSort('maintenanceCost', true)} title="Building Upkeep Cost & Maintenance Condition">
                        <span>Maintenance</span>
                        <span>{sortIndicator('maintenanceCost')}</span>
                        {renderResizer('maintenance')}
                      </div>
                    );
                  case 'status':
                    return (
                      <div key="status" className="bam-th col-status" style={getColStyle('status')} onClick={() => handleSort('status')}>
                        <span>{colStatus}</span>
                        <span>{sortIndicator('status')}</span>
                        {renderResizer('status')}
                      </div>
                    );
                  case 'actions':
                    return (
                      <div key="actions" className="bam-th col-act" style={getColStyle('actions')}>
                        <span>{categoryFilter === 'Catalog' ? 'Placement Tool' : colAct}</span>
                        {renderResizer('actions')}
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </div>

            {/* Scrollable Table Body */}
            <Scrollable vertical={true} horizontal={true} trackVisibility="scrollable" className="bam-table-body" onScroll={handleTableScroll}>
              {pageItems.length === 0 ? (
                <div className="bam-empty-message">{categoryFilter === 'Catalog' ? 'No matching catalog prefabs found.' : 'No matching buildings or assets found.'}</div>
              ) : (
                pageItems.map((entry) => {
                  if ('isGroup' in entry && entry.isGroup) {
                    const group = entry as AssetGroupVm;
                    const validItems = Array.isArray(group.items)
                      ? group.items.filter(
                          (it): it is UnifiedAssetItem =>
                            Boolean(it && (it.entityKey || it.id || it.prefabKey || it.name))
                        )
                      : [];
                    if (validItems.length === 0) return null;
                    const isExpanded = !!expandedGroups[group.groupKey];
                    const first = group.first || validItems[0];

                    const effClass =
                      group.avgEfficiency >= 85 ? 'good' : group.avgEfficiency >= 60 ? 'fair' : 'poor';

                    const happyColor =
                      group.avgHappiness >= 75
                        ? '#8bdb46'
                        : group.avgHappiness >= 50
                        ? '#50b8e9'
                        : group.avgHappiness >= 30
                        ? '#e88c3a'
                        : '#ef5350';

                    return (
                      <div key={`group-${group.groupKey}`}>
                        {/* Group Header Row */}
                        <div
                          className={`bam-group-row${isExpanded ? ' expanded' : ''}`}
                          onClick={() => toggleGroup(group.groupKey)}
                          title={isExpanded ? 'Click to collapse group' : 'Click to expand group'}
                        >
                          <span className="bam-group-arrow">
                            <UilIcon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} sizeRem={10} />
                          </span>
                          <AssetThumbnail item={first} sizeRem={22} />
                          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '6rem' }}>
                            <span className="bam-group-name" style={{ fontWeight: 700, color: '#ffffff', fontSize: '12rem' }}>
                              {group.name}
                            </span>
                            <span className="bam-group-badge">
                              {pluralize(validItems.length, 'building')}
                            </span>
                          </div>

                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                            {/* Theme and Pack of first item */}
                            <div className="col-theme-pack" style={{ width: 'auto', marginRight: '14rem' }}>
                              {first.theme && first.theme !== 'Unknown' && (
                                <ThemeIcon theme={first.theme} themeIcon={first.themeIcon} sizeRem={20} />
                              )}
                              <PackIcon pack={first.assetPack} packIcon={first.assetPackIcon} sizeRem={20} />
                            </div>

                            <span style={{ fontSize: '11rem', color: '#b0bec5', marginRight: '14rem' }}>
                              Lv {group.avgLevel} avg
                            </span>

                            <span style={{ fontSize: '11rem', color: '#eceff1', fontWeight: 600, marginRight: group.avgHappiness >= 0 || group.avgEfficiency >= 0 ? '14rem' : '0' }}>
                              Total: {formatNumber(group.totalOccupied)}
                              {group.totalCapacity > 0 ? ` / ${formatNumber(group.totalCapacity)}` : ''}
                            </span>

                            {group.avgHappiness >= 0 && (
                              <span style={{ fontSize: '11rem', color: happyColor, fontWeight: 700, marginRight: group.avgEfficiency >= 0 ? '14rem' : '0' }}>
                                {group.avgHappiness}% happy
                              </span>
                            )}

                            {group.avgEfficiency >= 0 && (
                              <span className={`bam-eff-tag ${effClass}`}>
                                {group.avgEfficiency}% eff
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Group Children Rows */}
                        {isExpanded && (
                          <div className="bam-group-children">
                            {validItems.map((it) => renderItemRow(it, true))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return renderItemRow(entry as UnifiedAssetItem, false);
                })
              )}
            </Scrollable>
          </div>

          {/* Pagination Bar */}
          <div className="bam-pagination-bar">
            <div className="bam-page-info">
              <span>
                {`${pageLabel} ${safePage + 1} ${ofLabel} ${totalPages} (${formatNumber(totalItems)} ${totalAssetsLabel})`}
              </span>
            </div>
            <div className="bam-page-nav">
              <button
                className={`bam-page-btn ${!canPrev ? 'disabled' : ''}`}
                onClick={() => {
                  if (!canPrev) return;
                  setCurrentPage(Math.max(0, safePage - 1));
                  const c = getTableScrollableContent();
                  if (c) c.scrollTop = 0;
                }}
              >
                <UilIcon name="ArrowLeft" sizeRem={11} style={{ marginRight: '4rem' }} />
                <span>{prevLabel}</span>
              </button>
              <button
                className={`bam-page-btn ${!canNext ? 'disabled' : ''}`}
                onClick={() => {
                  if (!canNext) return;
                  setCurrentPage(safePage + 1);
                  const c = getTableScrollableContent();
                  if (c) c.scrollTop = 0;
                }}
              >
                <span style={{ marginRight: '4rem' }}>{nextLabel}</span>
                <UilIcon name="ArrowRight" sizeRem={11} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Export CSV Toast Notification */}
      {exportToast && (
        <div className="bam-export-toast">
          <UilIcon name="Checkmark" sizeRem={14} style={{ color: '#66bb6a', marginRight: '6rem' }} />
          <span>{exportToast}</span>
        </div>
      )}

      {/* Floating In-Game Style Tooltip Directly Over Hovered Filter Icons (Mounted to document.body to prevent any container clipping) */}
      {typeof document !== 'undefined' && hoveredTooltip && ReactDOM.createPortal(
        <div
          className="bam-floating-tooltip"
          style={{
            left: `${hoveredTooltip.x}rem`,
            top: `${hoveredTooltip.y}rem`,
          }}
        >
          <div className="bam-floating-tooltip-bubble">{hoveredTooltip.text}</div>
          <div className="bam-floating-tooltip-arrow" />
        </div>,
        document.body
      )}
    </div>
  );
};

export default UnifiedAssetExplorer;
