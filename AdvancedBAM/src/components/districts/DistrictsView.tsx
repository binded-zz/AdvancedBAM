import { logCatch } from '../../utils/devWarn';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocalization } from 'cs2/l10n';
import { Scrollable } from 'cs2/ui';
import { useAssetData } from '../../context/AssetDataProvider';
import { DistrictItem } from '../../models/assetModels';
import { formatCurrency, formatFactorLabel, formatNumber, formatPolicyDisplayName } from '../../utils/formatters';
import DistrictPolicyControls from './DistrictPolicyControls';
import DistrictDashboardCards from './DistrictDashboardCards';
import UilIcon from '../common/UilIcon';
import EntityIdBadge from '../common/EntityIdBadge';
import ZoneMatrixPanel, { ZoneMatrixDashboardPage, ZoneMatrixFilterRequest } from '../common/ZoneMatrixPanel';
import {
  ZoneMatrixCategory,
  ZoneMatrixSettings,
  getEnabledMatrixCategories,
  readActiveZoneMatrixCategory,
  readZoneMatrixSettings,
  writeActiveZoneMatrixCategory,
  writeZoneMatrixSetting,
} from '../../utils/zoneMatrixSettings';
import { getPixelsPerRem } from '../dragHelper';
import bamStorage from '../../utils/bamStorage';
import './DistrictsView.css';

type SortField =
  | 'name'
  | 'buildings'
  | 'population'
  | 'happiness'
  | 'workers'
  | 'unemployment'
  | 'rent'
  | 'level'
  | 'policies';
type SortDir = 'asc' | 'desc';

export type DistrictColumnKey =
  | 'name'
  | 'buildings'
  | 'pop'
  | 'workers'
  | 'level'
  | 'policies'
  | 'actions';

const DEFAULT_DISTRICT_COL_WIDTHS: Record<DistrictColumnKey, number> = {
  name: 240,
  buildings: 420,
  pop: 180,
  workers: 150,
  level: 65,
  policies: 110,
  actions: 155,
};

const MIN_DISTRICT_COL_WIDTHS: Record<DistrictColumnKey, number> = {
  name: 120,
  buildings: 220,
  pop: 110,
  workers: 80,
  level: 45,
  policies: 70,
  actions: 135,
};

const DISTRICT_COL_CLASS_MAP: Record<DistrictColumnKey, string> = {
  name: '.dist-col-name',
  buildings: '.dist-col-buildings',
  pop: '.dist-col-pop',
  workers: '.dist-col-workers',
  level: '.dist-col-level',
  policies: '.dist-col-policies',
  actions: '.dist-col-act',
};

const DEFAULT_DISTRICT_COL_ORDER = ['name', 'buildings', 'citizens', 'avgLevel', 'policies', 'actions'];

interface DistrictZoningBreakdownProps {
  district: DistrictItem;
}

const DistrictZoningBreakdown: React.FC<DistrictZoningBreakdownProps> = ({ district }) => {
  const total = district.totalBuildings || 0;
  const pct = (cnt: number) => (total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0');

  const zones = [
    { key: 'res', label: 'Residential', short: 'Res', count: district.residentialCount || 0, color: '#4caf50' },
    { key: 'mix', label: 'Mixed', short: 'Mix', count: district.mixedCount || 0, color: '#00bfa5' },
    { key: 'com', label: 'Commercial', short: 'Com', count: district.commercialCount || 0, color: '#2196f3' },
    { key: 'ind', label: 'Industrial', short: 'Ind', count: district.industrialCount || 0, color: '#ff9800' },
    { key: 'off', label: 'Office', short: 'Off', count: district.officeCount || 0, color: '#00e5ff' },
    { key: 'svc', label: 'Services', short: 'Svc', count: district.serviceCount || 0, color: '#ab47bc' },
  ];

  const activeZones = zones.filter((z) => z.count > 0);

  const breakdownSummary =
    total > 0
      ? `Zoning Breakdown (${formatNumber(total)} total buildings):\n` +
        zones.map((z) => `- ${z.label}: ${formatNumber(z.count)} (${pct(z.count)}%)`).join('\n')
      : 'No buildings constructed in this district yet';

  return (
    <div className="bam-district-zoning-wrap" title={breakdownSummary}>
      {/* Top row: Total building count on left, compact colored dots on right */}
      <div className="bam-zone-top-row">
        <div className="bam-zone-total-box">
          <span className="bam-zone-total-num">{formatNumber(total)}</span>
          <span className="bam-zone-total-lbl">bldgs</span>
        </div>
        <div className="bam-zone-legend-inline">
          {activeZones.map((z) => (
            <span
              key={z.key}
              className={`bam-zone-dot-item ${z.key}`}
              title={`${z.label}: ${formatNumber(z.count)} properties (${pct(z.count)}% of district zoning)`}
            >
              <span className="bam-zone-color-dot" style={{ backgroundColor: z.color }} />
              <span className="bam-zone-dot-count">
                {z.count > 999 ? `${(z.count / 1000).toFixed(1)}k` : z.count}
              </span>
              <span className="bam-zone-dot-name">{z.short}</span>
            </span>
          ))}
          {activeZones.length === 0 && (
            <span className="bam-zone-empty-lbl">No zoned properties</span>
          )}
        </div>
      </div>

      {/* Bottom row: Full-width continuous proportional ratio bar */}
      <div className="bam-zone-prop-bar" title={breakdownSummary}>
        {total > 0 ? (
          activeZones.map((z) => (
            <div
              key={z.key}
              className={`bam-zone-prop-segment ${z.key}`}
              style={{
                width: `${(z.count / total) * 100}%`,
                backgroundColor: z.color,
              }}
              title={`${z.label}: ${formatNumber(z.count)} (${pct(z.count)}%)`}
            />
          ))
        ) : (
          <div className="bam-zone-prop-empty" />
        )}
      </div>
    </div>
  );
};

export interface DistrictsViewProps {
  onFilterToDistrict?: (districtKey: string) => void;
  onFilterResidential?: (req: ZoneMatrixFilterRequest) => void;
  focusedDistrictKey?: string | null;
  onFocusedDistrictHandled?: () => void;
}

type CardKey =
  | 'happiness'
  | 'demographics'
  | 'workforce'
  | 'housing'
  | 'education'
  | 'utilities'
  | 'safety'
  | 'gamePolicies'
  | 'policyPlus';

const CARD_LABELS: Record<CardKey, string> = {
  happiness: 'Citizen Happiness Factors',
  demographics: 'Demographics',
  workforce: 'Workforce & Jobs',
  housing: 'Housing & Zoning',
  education: 'Schools & Education',
  utilities: 'Utilities & Services',
  safety: 'Land, Health & Safety',
  gamePolicies: 'City & District Policies',
  policyPlus: 'Policy Plus',
};

const CARD_KEYS: CardKey[] = [
  'happiness',
  'demographics',
  'workforce',
  'housing',
  'education',
  'utilities',
  'safety',
  'gamePolicies',
  'policyPlus',
];

function readDistrictViewMode(): 'cards' | 'compact' {
  try {
    const saved =
      bamStorage.getItem('bam_dist_view_mode') ||
      bamStorage.getItem('bam_district_view_mode');
    return saved === 'compact' ? 'compact' : 'cards';
  } catch {
    return 'cards';
  }
}

function readDistrictShowPolicies(): boolean {
  try {
    const primary = bamStorage.getItem('bam_dist_show_policies');
    if (primary !== null) return primary !== 'false';
    const fallback = bamStorage.getItem('bam_districts_show_policies');
    if (fallback !== null) return fallback !== 'false';
    return true;
  } catch {
    return true;
  }
}

function readDistrictHiddenCards(): Set<CardKey> {
  try {
    const raw =
      bamStorage.getItem('bam_dist_hidden_cards') ||
      bamStorage.getItem('bam_districts_hidden_cards') ||
      bamStorage.getItem('bam_district_hidden_cards');
    return raw ? new Set<CardKey>(JSON.parse(raw)) : new Set<CardKey>();
  } catch {
    return new Set<CardKey>();
  }
}

function readDistrictColWidths(): Record<DistrictColumnKey, number> {
  try {
    const raw = bamStorage.getItem('bam_district_col_widths');
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: Record<DistrictColumnKey, number> = {
        ...DEFAULT_DISTRICT_COL_WIDTHS,
        ...parsed,
      };
      // Ensure legacy narrow actions width (110) never clips "Inspect" + "Buildings"
      if (merged.actions < MIN_DISTRICT_COL_WIDTHS.actions) {
        merged.actions = DEFAULT_DISTRICT_COL_WIDTHS.actions;
      }
      return merged;
    }
  } catch (err) { logCatch('DistrictsView', err); }
  return { ...DEFAULT_DISTRICT_COL_WIDTHS };
}

export const DistrictsView: React.FC<DistrictsViewProps> = ({
  onFilterToDistrict,
  onFilterResidential,
  focusedDistrictKey,
  onFocusedDistrictHandled,
}) => {
  const { translate } = useLocalization();
  const {
    assets,
    districts,
    districtPolicies,
    focusEntity,
    toggleDistrictPolicy,
    applyPolicyToAllDistricts,
    copyDistrictPolicies,
    resetDistrictPolicies,
    setDistrictPolicyAdjustment,
    renameDistrict,
  } = useAssetData();

  const [expandedDistrictKey, setExpandedDistrictKey] = useState<string | null>(null);
  const readCollapsedMap = (key: string): Record<string, boolean> => {
    try {
      const saved = bamStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (err) { logCatch('DistrictsView', err); }
    return {};
  };

  const [collapsedStats, setCollapsedStats] = useState<Record<string, boolean>>(() =>
    readCollapsedMap('bam_districts_collapsed_stats')
  );
  const [collapsedPolicies, setCollapsedPolicies] = useState<Record<string, boolean>>(() =>
    readCollapsedMap('bam_districts_collapsed_policies')
  );
  const [collapsedHousing, setCollapsedHousing] = useState<Record<string, boolean>>(() =>
    readCollapsedMap('bam_districts_collapsed_matrices')
  );
  const sigDistrictKeys = useMemo(() => {
    const set = new Set<string>();
    const list = Array.isArray(assets) ? assets : [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a && a.isPlaced && a.isSignature && a.districtKey) {
        set.add(a.districtKey);
      }
    }
    return set;
  }, [assets]);
  const hasAnyPlacedSignature = useMemo(
    () => (Array.isArray(assets) ? assets.some((a) => Boolean(a && a.isPlaced && a.isSignature)) : false),
    [assets]
  );
  const [zoneSettings, setZoneSettings] = useState<ZoneMatrixSettings>(readZoneMatrixSettings);
  const enabledMatrixCategories = useMemo(() => getEnabledMatrixCategories(zoneSettings), [zoneSettings]);
  const [districtMatrixCategory, setDistrictMatrixCategory] = useState<ZoneMatrixCategory>(() =>
    readActiveZoneMatrixCategory()
  );
  const [subView, setSubView] = useState<'analytics' | 'housing'>('analytics');

  useEffect(() => {
    if (enabledMatrixCategories.length > 0 && !enabledMatrixCategories.includes(districtMatrixCategory)) {
      setDistrictMatrixCategory(enabledMatrixCategories[0]);
    }
  }, [enabledMatrixCategories, districtMatrixCategory]);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('population');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showPageSettings, setShowPageSettings] = useState(false);
  const distHeaderRef = useRef<HTMLDivElement | null>(null);

  const getDistScrollableContent = (): HTMLElement | null => {
    return (
      document.querySelector('.bam-districts-table-body [class*="content_"]') ||
      document.querySelector('.bam-districts-table-body > div') ||
      document.querySelector('.bam-districts-table-body')
    ) as HTMLElement | null;
  };

  const handleDistTableScroll = useCallback((e?: React.UIEvent<HTMLElement>) => {
    const c = (e?.currentTarget || e?.target || getDistScrollableContent()) as HTMLElement;
    if (!c || !distHeaderRef.current) return;
    distHeaderRef.current.scrollLeft = c.scrollLeft;
  }, []);

  const handleDistHeaderWheel = useCallback((e: React.WheelEvent) => {
    const c = getDistScrollableContent();
    if (c && (e.deltaX || (e.shiftKey && e.deltaY))) {
      c.scrollLeft += (e.deltaX || e.deltaY);
    }
  }, []);

  const [hiddenDistColumns, setHiddenDistColumns] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_hidden_columns_districts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [districtColOrder, setDistrictColOrder] = useState<string[]>(() => {
    try {
      const saved = bamStorage.getItem('bam_district_col_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) { logCatch('DistrictsView', err); }
    return [...DEFAULT_DISTRICT_COL_ORDER];
  });

  const [districtViewMode, setDistrictViewMode] = useState<'cards' | 'compact'>(readDistrictViewMode);
  const [showPoliciesInExpanded, setShowPoliciesInExpanded] = useState<boolean>(readDistrictShowPolicies);
  const [hiddenCards, setHiddenCards] = useState<Set<CardKey>>(readDistrictHiddenCards);
  const [colWidths, setColWidths] = useState<Record<DistrictColumnKey, number>>(readDistrictColWidths);
  const [activeResizingCol, setActiveResizingCol] = useState<DistrictColumnKey | null>(null);

  // Pre-build human-readable policy name lookup for both entityKey and raw name
  const policyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (districtPolicies || []).forEach((pm) => {
      if (!pm) return;
      const clean = formatPolicyDisplayName(pm.name, undefined, translate);
      if (pm.name) map.set(pm.name, clean);
      if (pm.entityKey) map.set(pm.entityKey, clean);
    });
    return map;
  }, [districtPolicies, translate]);

  const applyAllColWidthsToDom = useCallback((widths: Record<DistrictColumnKey, number>) => {
    (Object.keys(DISTRICT_COL_CLASS_MAP) as DistrictColumnKey[]).forEach((colKey) => {
      const cssClass = DISTRICT_COL_CLASS_MAP[colKey];
      const w = widths[colKey] || DEFAULT_DISTRICT_COL_WIDTHS[colKey];
      const matched = document.querySelectorAll(cssClass);
      for (let i = 0; i < matched.length; i++) {
        const el = matched[i] as HTMLElement;
        el.style.width = `${w}rem`;
        el.style.minWidth = `${w}rem`;
        el.style.maxWidth = `${w}rem`;
        el.style.flex = `0 0 ${w}rem`;
      }
    });
  }, []);

  // Listen for live settings changes & factory reset without page reload
  useEffect(() => {
    const handleSettingsChanged = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.key === 'hiddenColumnsDistricts') {
        setHiddenDistColumns(new Set(detail.value));
      } else if (detail.key === 'districtColumnOrder' && Array.isArray(detail.value)) {
        setDistrictColOrder(detail.value);
      } else if (detail.key === 'districtViewMode') {
        setDistrictViewMode(detail.value);
      } else if (detail.key === 'showPoliciesInExpanded') {
        setShowPoliciesInExpanded(detail.value);
      } else if (detail.key === 'hiddenDistrictCards') {
        setHiddenCards(new Set(detail.value));
      } else if (detail.key === 'districtCardsReset') {
        setHiddenCards(new Set());
      } else if (detail.key === 'districtColWidthsReset') {
        const defaults = { ...DEFAULT_DISTRICT_COL_WIDTHS };
        setColWidths(defaults);
        applyAllColWidthsToDom(defaults);
      } else if (
        detail.key === 'zoneMatricesReset' ||
        detail.key === 'housingPlacementSettings' ||
        (typeof detail.key === 'string' &&
          (detail.key.startsWith('bam_setting_') || detail.key.startsWith('bam_zone_')))
      ) {
        const nextZ = readZoneMatrixSettings();
        setZoneSettings(nextZ);
        if (!nextZ.subviewMode) {
          setSubView('analytics');
        }
        if (detail.key === 'bam_zone_matrix_active_category' || detail.key === 'zoneMatricesReset') {
          setDistrictMatrixCategory(readActiveZoneMatrixCategory());
        }
      }
    };

    const handleSettingsReset = () => {
      const defaults = { ...DEFAULT_DISTRICT_COL_WIDTHS };
      setColWidths(defaults);
      applyAllColWidthsToDom(defaults);
      setDistrictColOrder([...DEFAULT_DISTRICT_COL_ORDER]);
      setHiddenDistColumns(new Set());
      setDistrictViewMode(readDistrictViewMode());
      setShowPoliciesInExpanded(readDistrictShowPolicies());
      setHiddenCards(readDistrictHiddenCards());
      setZoneSettings(readZoneMatrixSettings());
      setDistrictMatrixCategory(readActiveZoneMatrixCategory());
      setSubView('analytics');
    };

    const handleStorage = () => {
      setDistrictViewMode(readDistrictViewMode());
      setShowPoliciesInExpanded(readDistrictShowPolicies());
      setHiddenCards(readDistrictHiddenCards());
      setCollapsedStats(readCollapsedMap('bam_districts_collapsed_stats'));
      setCollapsedPolicies(readCollapsedMap('bam_districts_collapsed_policies'));
      setCollapsedHousing(readCollapsedMap('bam_districts_collapsed_matrices'));
      const nextZ = readZoneMatrixSettings();
      setZoneSettings(nextZ);
      setDistrictMatrixCategory(readActiveZoneMatrixCategory());
      if (!nextZ.subviewMode) setSubView('analytics');
    };

    window.addEventListener('bam-settings-changed', handleSettingsChanged);
    window.addEventListener('bam-settings-reset', handleSettingsReset);
    window.addEventListener('bam-ui-prefs-hydrated', handleStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('bam-settings-changed', handleSettingsChanged);
      window.removeEventListener('bam-settings-reset', handleSettingsReset);
      window.removeEventListener('bam-ui-prefs-hydrated', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyAllColWidthsToDom]);

  // Native SIP District Focus support
  useEffect(() => {
    if (!focusedDistrictKey) return;
    const match = (Array.isArray(districts) ? districts : []).find((d) => d && d.entityKey === focusedDistrictKey);
    if (!match) return;

    setExpandedDistrictKey(focusedDistrictKey);
    setCollapsedStats((prev) => ({ ...prev, [focusedDistrictKey]: false }));

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`bam-district-row-${focusedDistrictKey}`);
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView();
        } catch (err) { logCatch('DistrictsView', err); }
      }
      onFocusedDistrictHandled?.();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [focusedDistrictKey, districts, onFocusedDistrictHandled]);

  const isDistColVisible = (colKey: string) => {
    if (colKey === 'name') return true;
    return !hiddenDistColumns.has(colKey);
  };

  const toggleCard = (key: CardKey) => {
    setHiddenCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        const serialized = JSON.stringify(Array.from(next));
        bamStorage.setItem('bam_dist_hidden_cards', serialized);
        bamStorage.setItem('bam_districts_hidden_cards', serialized);
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'hiddenDistrictCards', value: Array.from(next) },
          })
        );
      } catch (err) { logCatch('DistrictsView', err); }
      return next;
    });
  };

  const handleSetDistrictViewMode = (mode: 'cards' | 'compact') => {
    setDistrictViewMode(mode);
    try {
      bamStorage.setItem('bam_dist_view_mode', mode);
      bamStorage.setItem('bam_district_view_mode', mode);
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'districtViewMode', value: mode } })
      );
    } catch (err) { logCatch('DistrictsView', err); }
  };

  const toggleShowPolicies = () => {
    setShowPoliciesInExpanded((prev) => {
      const next = !prev;
      try {
        bamStorage.setItem('bam_dist_show_policies', String(next));
        bamStorage.setItem('bam_districts_show_policies', String(next));
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'showPoliciesInExpanded', value: next },
          })
        );
      } catch (err) { logCatch('DistrictsView', err); }
      return next;
    });
  };

  const handleResizeStart = useCallback(
    (colKey: DistrictColumnKey, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const scale = getPixelsPerRem();
      const startX = e.clientX;
      const startWidth = colWidths[colKey] || DEFAULT_DISTRICT_COL_WIDTHS[colKey] || 100;
      const cssClass = DISTRICT_COL_CLASS_MAP[colKey];
      const minW = MIN_DISTRICT_COL_WIDTHS[colKey] || 45;

      setActiveResizingCol(colKey);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      let latestWidth = startWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();

        const deltaPx = moveEvent.clientX - startX;
        const deltaRem = deltaPx / (scale > 0 ? scale : 1.0);
        const newWidth = Math.max(minW, Math.round(startWidth + deltaRem));
        latestWidth = newWidth;

        const matched = document.querySelectorAll(cssClass);
        for (let i = 0; i < matched.length; i++) {
          const el = matched[i] as HTMLElement;
          el.style.width = `${newWidth}rem`;
          el.style.minWidth = `${newWidth}rem`;
          el.style.maxWidth = `${newWidth}rem`;
          el.style.flex = `0 0 ${newWidth}rem`;
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();

        window.removeEventListener('mousemove', handleMouseMove, true);
        window.removeEventListener('mouseup', handleMouseUp, true);
        resizeCleanupRef.current = null;

        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setActiveResizingCol(null);

        setColWidths((prev) => {
          const next = { ...prev, [colKey]: latestWidth };
          try {
            bamStorage.setItem('bam_district_col_widths', JSON.stringify(next));
          } catch (err) { logCatch('DistrictsView', err); }
          return next;
        });
      };

      resizeCleanupRef.current?.();
      resizeCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove, true);
        window.removeEventListener('mouseup', handleMouseUp, true);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('mousemove', handleMouseMove, true);
      window.addEventListener('mouseup', handleMouseUp, true);
    },
    [colWidths]
  );

  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const policiesScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      if (policiesScrollTimerRef.current) clearTimeout(policiesScrollTimerRef.current);
    };
  }, []);

  const resetColumnWidth = useCallback((colKey: DistrictColumnKey) => {
    setColWidths((prev) => {
      const next = { ...prev, [colKey]: DEFAULT_DISTRICT_COL_WIDTHS[colKey] };
      try {
        bamStorage.setItem('bam_district_col_widths', JSON.stringify(next));
      } catch (err) { logCatch('DistrictsView', err); }
      return next;
    });
    const cssClass = DISTRICT_COL_CLASS_MAP[colKey];
    const matched = document.querySelectorAll(cssClass);
    const defW = DEFAULT_DISTRICT_COL_WIDTHS[colKey];
    for (let i = 0; i < matched.length; i++) {
      const el = matched[i] as HTMLElement;
      el.style.width = `${defW}rem`;
      el.style.minWidth = `${defW}rem`;
      el.style.maxWidth = `${defW}rem`;
      el.style.flex = `0 0 ${defW}rem`;
    }
  }, []);

  const renderResizer = (colKey: DistrictColumnKey) => (
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

  const getColStyle = (colKey: DistrictColumnKey): React.CSSProperties => {
    const w = colWidths[colKey] || DEFAULT_DISTRICT_COL_WIDTHS[colKey];
    return {
      width: `${w}rem`,
      minWidth: `${w}rem`,
      maxWidth: `${w}rem`,
      flex: `0 0 ${w}rem`,
    };
  };

  const activeDistrictColumns = useMemo<string[]>(() => {
    const ordered = districtColOrder.filter((k) => DEFAULT_DISTRICT_COL_ORDER.includes(k));
    DEFAULT_DISTRICT_COL_ORDER.forEach((k) => {
      if (!ordered.includes(k)) ordered.push(k);
    });
    return ordered.filter((k) => isDistColVisible(k));
  }, [districtColOrder, hiddenDistColumns]);

  const openPoliciesForDistrict = (districtKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedDistrictKey(districtKey);
    if (!showPoliciesInExpanded) {
      setShowPoliciesInExpanded(true);
      try {
        bamStorage.setItem('bam_district_show_policies', 'true');
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'showPoliciesInExpanded', value: true },
          })
        );
      } catch (err) { logCatch('DistrictsView', err); }
    }
    setCollapsedStats((prev) => ({ ...prev, [districtKey]: true }));
    setCollapsedPolicies((prev) => ({ ...prev, [districtKey]: false }));
    if (policiesScrollTimerRef.current) clearTimeout(policiesScrollTimerRef.current);
    policiesScrollTimerRef.current = setTimeout(() => {
      const el = document.getElementById(`bam-policies-sec-${districtKey}`);
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView();
        } catch (err) { logCatch('DistrictsView', err); }
      }
    }, 60);
  };

  const toggleStatsCollapse = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedStats((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { bamStorage.setItem('bam_districts_collapsed_stats', JSON.stringify(next)); } catch (err) { logCatch('DistrictsView', err); }
      return next;
    });
  };

  const togglePoliciesCollapse = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedPolicies((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { bamStorage.setItem('bam_districts_collapsed_policies', JSON.stringify(next)); } catch (err) { logCatch('DistrictsView', err); }
      return next;
    });
  };

  const toggleHousingCollapse = (key: string) => {
    setCollapsedHousing((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { bamStorage.setItem('bam_districts_collapsed_matrices', JSON.stringify(next)); } catch (err) { logCatch('DistrictsView', err); }
      return next;
    });
  };

  // Aggregate stats across all districts (using authoritative City rollup when present)
  const summaryStats = useMemo(() => {
    let totalDistricts = 0;
    let totalPop = 0;
    let totalHouseholds = 0;
    let totalWorkers = 0;
    let totalBuildings = 0;
    let totalTourists = 0;
    let totalActivePolicies = 0;
    let cityRow: DistrictItem | undefined;
    const safeDistricts = Array.isArray(districts) ? districts : [];

    for (let i = 0; i < safeDistricts.length; i++) {
      const d = safeDistricts[i];
      if (!d) continue;
      const pCount = d.policies?.length || 0;
      if (d.entityKey === 'city') {
        cityRow = d;
        continue;
      }
      totalDistricts++;
      totalPop += d.population || 0;
      totalHouseholds += d.households || 0;
      totalWorkers += d.workers || 0;
      totalBuildings += d.totalBuildings || 0;
      totalTourists += d.tourists || 0;
      totalActivePolicies += pCount;
    }

    if (cityRow) {
      totalPop = cityRow.population ?? totalPop;
      totalHouseholds = cityRow.households ?? totalHouseholds;
      totalWorkers = cityRow.workers ?? totalWorkers;
      totalBuildings = cityRow.totalBuildings ?? totalBuildings;
      totalTourists = cityRow.gameTourists ?? cityRow.tourists ?? totalTourists;
    }

    return {
      totalDistricts,
      totalPop,
      totalHouseholds,
      totalWorkers,
      totalBuildings,
      totalTourists,
      totalActivePolicies,
    };
  }, [districts]);

  // Sorted districts with city row pinned at the top and fallback tourist/snapshot attribution
  const sortedDistricts = useMemo(() => {
    const safeDistricts = Array.isArray(districts) ? districts : [];
    const rawCityRow = safeDistricts.find((d) => d && d.entityKey === 'city');
    const rawNormalRows = safeDistricts.filter((d) => d && d.entityKey !== 'city');

    const cityTourists = rawCityRow ? (rawCityRow.gameTourists || rawCityRow.tourists || 0) : 0;
    const sumDistTourists = rawNormalRows.reduce((acc, r) => acc + (r.tourists || 0), 0);

    // If C# DLL hasn't been reloaded yet and district tourists are 0 while city has active tourists,
    // distribute city tourists proportionally by district attractiveness + commercial footprint.
    const normalRows: DistrictItem[] = rawNormalRows.map((r) => ({ ...r }));
    if (cityTourists > 0 && sumDistTourists === 0 && normalRows.length > 0) {
      const weights = normalRows.map(
        (r) => Math.max(0, (r.attractiveness || 0) * 2 + (r.commercialCount || 0) * 3 + (r.serviceCount || 0))
      );
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      if (totalWeight > 0) {
        let assigned = 0;
        let maxIdx = 0;
        for (let i = 0; i < normalRows.length; i++) {
          if (weights[i] > weights[maxIdx]) maxIdx = i;
          const share = Math.round((cityTourists * weights[i]) / totalWeight);
          normalRows[i].tourists = share;
          assigned += share;
        }
        const diff = cityTourists - assigned;
        if (diff !== 0) {
          normalRows[maxIdx].tourists = Math.max(0, (normalRows[maxIdx].tourists || 0) + diff);
        }
      }
    }

    const cityRow: DistrictItem | undefined = rawCityRow
      ? {
          ...rawCityRow,
          tourists: cityTourists,
          gameTourists: cityTourists,
          gameAllCitizens:
            rawCityRow.gameAllCitizens && rawCityRow.gameAllCitizens > rawCityRow.population
              ? rawCityRow.gameAllCitizens
              : (rawCityRow.population || 0) +
                cityTourists +
                (rawCityRow.gameCommuters || 0) +
                (rawCityRow.gameMovingAway || 0),
        }
      : undefined;

    normalRows.sort((a, b) => {
      if (sortField === 'name') {
        const nameCmp = (a.name || '').localeCompare(b.name || '');
        if (nameCmp !== 0) return sortDir === 'asc' ? nameCmp : -nameCmp;
        return (a.entityKey || '').localeCompare(b.entityKey || '');
      }

      let vA = 0;
      let vB = 0;

      switch (sortField) {
        case 'buildings':
          vA = a.totalBuildings;
          vB = b.totalBuildings;
          break;
        case 'population':
          vA = a.population;
          vB = b.population;
          break;
        case 'happiness':
          vA = a.population > 0 ? (a.avgHappiness ?? -1) : -1;
          vB = b.population > 0 ? (b.avgHappiness ?? -1) : -1;
          break;
        case 'workers':
          vA = a.workers;
          vB = b.workers;
          break;
        case 'unemployment':
          vA = a.unemploymentRate || 0;
          vB = b.unemploymentRate || 0;
          break;
        case 'rent':
          vA = a.avgRent || 0;
          vB = b.avgRent || 0;
          break;
        case 'level':
          vA = a.avgBuildingLevel;
          vB = b.avgBuildingLevel;
          break;
        case 'policies':
          vA = a.policies?.length || 0;
          vB = b.policies?.length || 0;
          break;
      }

      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '') || (a.entityKey || '').localeCompare(b.entityKey || '');
    });

    return cityRow ? [cityRow, ...normalRows] : normalRows;
  }, [districts, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleRowExpanded = (key: string) => {
    setExpandedDistrictKey((prev) => (prev === key ? null : key));
  };

  const handleStartRename = (e: React.MouseEvent, key: string, currentName: string) => {
    e.stopPropagation();
    setRenamingKey(key);
    setRenameValue(currentName);
  };

  const handleCommitRename = (key: string) => {
    if (renameValue.trim() !== '') {
      renameDistrict(key, renameValue.trim());
    }
    setRenamingKey(null);
  };

  const inspectLabel = translate('AdvancedBAM.Action.Go', 'Inspect') ?? 'Inspect';
  const districtsLabel = translate('AdvancedBAM.Category.Districts', 'Districts') ?? 'Districts';
  const populationLabel = translate('AdvancedBAM.Summary.Population', 'Population') ?? 'Population';
  const householdsLabel = translate('AdvancedBAM.Summary.Households', 'Households') ?? 'Households';
  const workforceLabel = translate('AdvancedBAM.Summary.Workforce', 'Workforce') ?? 'Workforce';
  const buildingsLabel = translate('AdvancedBAM.Summary.TotalBuildings', 'Buildings') ?? 'Buildings';
  const policiesLabel = translate('AdvancedBAM.Summary.Policies', 'Policies') ?? 'Policies';

  return (
    <div className="bam-districts-container">
      {/* Summary Strip + Page Settings */}
      <div className="bam-districts-summary-row">
        <div className="bam-districts-summary">
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">{districtsLabel}</span>
            <span className="bam-dist-stat-val">{summaryStats.totalDistricts}</span>
          </div>
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">{populationLabel}</span>
            <span className="bam-dist-stat-val">{formatNumber(summaryStats.totalPop)}</span>
          </div>
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">{householdsLabel}</span>
            <span className="bam-dist-stat-val">{formatNumber(summaryStats.totalHouseholds)}</span>
          </div>
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">{workforceLabel}</span>
            <span className="bam-dist-stat-val">{formatNumber(summaryStats.totalWorkers)}</span>
          </div>
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">Tourists</span>
            <span className="bam-dist-stat-val">{formatNumber(summaryStats.totalTourists)}</span>
          </div>
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">{buildingsLabel}</span>
            <span className="bam-dist-stat-val">{formatNumber(summaryStats.totalBuildings)}</span>
          </div>
          <div className="bam-dist-stat-card">
            <span className="bam-dist-stat-label">{policiesLabel}</span>
            <span className="bam-dist-stat-val">{formatNumber(summaryStats.totalActivePolicies)}</span>
          </div>
        </div>
        <button
          className={`bam-page-settings-btn${showPageSettings ? ' active' : ''}`}
          onClick={() => setShowPageSettings((v) => !v)}
          title="Districts Page Settings"
        >
          <UilIcon name="Settings" sizeRem={12} />
        </button>
      </div>

      {/* Districts Page Settings Panel */}
      {showPageSettings && (
        <div className="bam-page-settings-panel">
          <div className="bam-settings-panel-header">
            <UilIcon name="Settings" sizeRem={11} />
            <span>Districts Page Settings</span>
            <button className="bam-settings-close-btn" onClick={() => setShowPageSettings(false)}>
              <UilIcon name="Close" sizeRem={10} />
            </button>
          </div>
          <div className="bam-settings-panel-body">
            <div className="bam-settings-section">
              <div className="bam-settings-section-title">Display Mode</div>
              <div className="bam-settings-toggle-row">
                <span>Analytics View</span>
                <div className="bam-view-mode-toggle">
                  <button
                    className={`bam-view-mode-btn${districtViewMode === 'cards' ? ' active' : ''}`}
                    onClick={() => handleSetDistrictViewMode('cards')}
                    title="Show analytics as draggable cards"
                  >
                    Cards
                  </button>
                  <button
                    className={`bam-view-mode-btn${districtViewMode === 'compact' ? ' active' : ''}`}
                    onClick={() => handleSetDistrictViewMode('compact')}
                    title="Show analytics as a compact list"
                  >
                    Compact
                  </button>
                </div>
              </div>
              <div className="bam-settings-toggle-row">
                <span>Zone Matrices in Details</span>
                <div
                  className={`bam-toggle-switch${zoneSettings.inDistricts ? ' checked' : ''}`}
                  onClick={() => setZoneSettings(writeZoneMatrixSetting('inDistricts', !zoneSettings.inDistricts))}
                  role="switch"
                  aria-checked={zoneSettings.inDistricts}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setZoneSettings(writeZoneMatrixSetting('inDistricts', !zoneSettings.inDistricts));
                    }
                  }}
                  aria-label="Zone Matrices in Details"
                >
                  <div className="bam-toggle-slider" />
                </div>
              </div>
              {zoneSettings.inDistricts && (
                <div className="bam-settings-toggle-row">
                  <span>Details Matrix Layout</span>
                  <div className="bam-view-mode-toggle">
                    <button
                      className={`bam-view-mode-btn${zoneSettings.districtsLayout === 'switcher' ? ' active' : ''}`}
                      onClick={() => setZoneSettings(writeZoneMatrixSetting('districtsLayout', 'switcher'))}
                      title="Single card with Housing / Commercial / Office / Industrial / Services switcher pills"
                    >
                      Switcher
                    </button>
                    <button
                      className={`bam-view-mode-btn${zoneSettings.districtsLayout === 'stacked' ? ' active' : ''}`}
                      onClick={() => setZoneSettings(writeZoneMatrixSetting('districtsLayout', 'stacked'))}
                      title="Show separate collapsible matrix cards for each zone category"
                    >
                      Stacked
                    </button>
                  </div>
                </div>
              )}
              <div className="bam-settings-toggle-row">
                <span>Zoning Matrices Sub-View</span>
                <div
                  className={`bam-toggle-switch${zoneSettings.subviewMode ? ' checked' : ''}`}
                  onClick={() => {
                    const nextVal = !zoneSettings.subviewMode;
                    setZoneSettings(writeZoneMatrixSetting('subviewMode', nextVal));
                    if (!nextVal) setSubView('analytics');
                  }}
                  role="switch"
                  aria-checked={zoneSettings.subviewMode}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      const nextVal = !zoneSettings.subviewMode;
                      setZoneSettings(writeZoneMatrixSetting('subviewMode', nextVal));
                      if (!nextVal) setSubView('analytics');
                    }
                  }}
                  aria-label="Zoning Matrices Sub-View"
                >
                  <div className="bam-toggle-slider" />
                </div>
              </div>
              <div className="bam-settings-toggle-row">
                <span>Show Policy Controls</span>
                <div
                  className={`bam-toggle-switch${showPoliciesInExpanded ? ' checked' : ''}`}
                  onClick={toggleShowPolicies}
                  role="switch"
                  aria-checked={showPoliciesInExpanded}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleShowPolicies();
                    }
                  }}
                  aria-label="Show Policy Controls"
                >
                  <div className="bam-toggle-slider" />
                </div>
              </div>
            </div>
            <div className="bam-settings-section">
              <div className="bam-settings-section-title">Card Visibility</div>
              {CARD_KEYS.map((key) => (
                <div key={key} className="bam-settings-toggle-row">
                  <span>{CARD_LABELS[key]}</span>
                  <div
                    className={`bam-toggle-switch${!hiddenCards.has(key) ? ' checked' : ''}`}
                    onClick={() => toggleCard(key)}
                    role="switch"
                    aria-checked={!hiddenCards.has(key)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleCard(key);
                      }
                    }}
                    aria-label={`Toggle ${CARD_LABELS[key]}`}
                    title={
                      !hiddenCards.has(key)
                        ? `Click to hide ${CARD_LABELS[key]}`
                        : `Click to show ${CARD_LABELS[key]}`
                    }
                  >
                    <div className="bam-toggle-slider" />
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: '10rem',
                paddingTop: '8rem',
                borderTop: '1rem solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                className="bam-btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '11rem',
                  padding: '5rem 8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => {
                  setShowPageSettings(false);
                  window.dispatchEvent(
                    new CustomEvent('bam-open-settings', { detail: { tab: 'districts' } })
                  );
                }}
              >
                <UilIcon name="Settings" sizeRem={11} style={{ marginRight: '6rem' }} />
                <span>Open Full District Settings &amp; Columns</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Sub-View Switcher: Analytics Table vs Full-Width Zoning & Packs Matrices */}
      {zoneSettings.subviewMode && enabledMatrixCategories.length > 0 && (
        <div className="bam-districts-subview-bar">
          <div className="bam-districts-subview-tabs">
            <button
              type="button"
              className={`bam-districts-subview-btn${subView === 'analytics' ? ' active' : ''}`}
              onClick={() => setSubView('analytics')}
            >
              <UilIcon name="District" sizeRem={11} style={{ marginRight: '5rem' }} />
              <span>Districts &amp; Policies</span>
            </button>
            <button
              type="button"
              className={`bam-districts-subview-btn${subView === 'housing' ? ' active' : ''}`}
              onClick={() => setSubView('housing')}
            >
              <UilIcon name="Building" sizeRem={11} style={{ marginRight: '5rem' }} />
              <span>Zoning Matrices</span>
            </button>
          </div>
          <span style={{ fontSize: '9.5rem', color: '#78909c' }}>
            Click any density, modded zone, or pack icon to jump to matching buildings in Explorer
          </span>
        </div>
      )}

      {zoneSettings.subviewMode && enabledMatrixCategories.length > 0 && subView === 'housing' ? (
        <ZoneMatrixDashboardPage
          assets={assets}
          districts={districts}
          enabledCategories={enabledMatrixCategories}
          includeMixedGroundFloor={zoneSettings.includeMixedGroundFloor}
          includeIndustrialSpecials={zoneSettings.includeIndustrialSpecials}
          includeServiceUpgrades={zoneSettings.includeServiceUpgrades}
          onFilterAsset={onFilterResidential}
          onFilterResidential={onFilterResidential}
          onInspectDistrict={(distKey) => {
            setSubView('analytics');
            setExpandedDistrictKey(distKey);
            setCollapsedStats((prev) => ({ ...prev, [distKey]: false }));
          }}
        />
      ) : (
        <>
          {/* Table Header with Sort Indicators & Draggable Resizers (Rendered in DOM order for Cohtml) */}
          <div className="bam-districts-table-header" ref={distHeaderRef} onWheel={handleDistHeaderWheel}>
        {activeDistrictColumns.map((colKey) => {
          switch (colKey) {
            case 'name':
              return (
                <div
                  key="name"
                  className="dist-col-name bam-sortable-th"
                  style={getColStyle('name')}
                  onClick={() => handleSort('name')}
                >
                  <span>District Name</span>
                  {sortField === 'name' && (
                    <span className="bam-sort-arrow">
                      <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                    </span>
                  )}
                  {renderResizer('name')}
                </div>
              );
            case 'buildings':
              return (
                <div
                  key="buildings"
                  className="dist-col-buildings bam-sortable-th"
                  style={getColStyle('buildings')}
                  onClick={() => handleSort('buildings')}
                  title="Zoning Breakdown: Residential (Res), Mixed (Mix), Commercial (Com), Industrial (Ind), Office (Off), Services (Svc). Hover badges for property counts & percentages."
                >
                  <div className="bam-zone-th-header-wrap">
                    <span>Zoning Breakdown</span>
                  </div>
                  {sortField === 'buildings' && (
                    <span className="bam-sort-arrow">
                      <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                    </span>
                  )}
                  {renderResizer('buildings')}
                </div>
              );
            case 'citizens':
              return (
                <React.Fragment key="citizens">
                  <div className="dist-col-pop bam-sortable-th" style={getColStyle('pop')}>
                    <span
                      className="bam-sub-sort-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('population');
                      }}
                      title="Sort by Population"
                    >
                      <span>Pop / HH</span>
                      {sortField === 'population' && (
                        <span className="bam-sort-arrow">
                          <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                        </span>
                      )}
                    </span>
                    <span className="bam-sub-sort-sep">/</span>
                    <span
                      className="bam-sub-sort-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort('happiness');
                      }}
                      title="Sort by Citizen Happiness"
                    >
                      <span>Happy</span>
                      {sortField === 'happiness' && (
                        <span className="bam-sort-arrow">
                          <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                        </span>
                      )}
                    </span>
                    {renderResizer('pop')}
                  </div>
                  <div
                    className="dist-col-workers bam-sortable-th"
                    style={getColStyle('workers')}
                    onClick={() => handleSort('workers')}
                  >
                    <span>Workforce</span>
                    {sortField === 'workers' && (
                      <span className="bam-sort-arrow">
                        <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                      </span>
                    )}
                    {renderResizer('workers')}
                  </div>
                </React.Fragment>
              );
            case 'avgLevel':
              return (
                <div
                  key="avgLevel"
                  className="dist-col-level bam-sortable-th"
                  style={getColStyle('level')}
                  onClick={() => handleSort('level')}
                >
                  <span>Avg Lvl</span>
                  {sortField === 'level' && (
                    <span className="bam-sort-arrow">
                      <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                    </span>
                  )}
                  {renderResizer('level')}
                </div>
              );
            case 'policies':
              return (
                <div
                  key="policies"
                  className="dist-col-policies bam-sortable-th"
                  style={getColStyle('policies')}
                  onClick={() => handleSort('policies')}
                >
                  <span>Active Policies</span>
                  {sortField === 'policies' && (
                    <span className="bam-sort-arrow">
                      <UilIcon name={sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={9} />
                    </span>
                  )}
                  {renderResizer('policies')}
                </div>
              );
            case 'actions':
              return (
                <div key="actions" className="dist-col-act" style={getColStyle('actions')}>
                  <span>Actions</span>
                  {renderResizer('actions')}
                </div>
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Table Body */}
      <Scrollable vertical={true} horizontal={true} trackVisibility="scrollable" className="bam-districts-table-body" onScroll={handleDistTableScroll}>
        {sortedDistricts.map((d) => {
          const isCity = d.entityKey === 'city';
          const isExpanded = expandedDistrictKey === d.entityKey;

          const nonZeroHappyFactors = (d.happinessFactors || [])
            .filter((f) => Math.round(f.percentage) !== 0)
            .sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage));

          const happyTooltip =
            nonZeroHappyFactors.length > 0
              ? `Citizen Happiness Factors (${d.avgHappiness}%):\n` +
                nonZeroHappyFactors
                  .map((f) => {
                    const pts = Math.round(f.percentage);
                    const label = formatFactorLabel(f.factor, pts);
                    const signed = pts > 0 ? `+${pts}` : `${pts}`;
                    return `- ${label}: ${signed}`;
                  })
                  .join('\n')
              : `Average citizen happiness (${d.avgHappiness}%)`;

          return (
            <div
              key={d.entityKey}
              id={`bam-district-row-${d.entityKey}`}
              className="bam-district-row-wrap"
            >
              <div
                className={`bam-district-row${isExpanded ? ' expanded' : ''}${isCity ? ' city-row' : ''}`}
                onClick={() => toggleRowExpanded(d.entityKey)}
              >
                {activeDistrictColumns.map((colKey) => {
                  switch (colKey) {
                    case 'name':
                      return (
                        <div key="name" className="dist-col-name bam-district-name-block" style={getColStyle('name')}>
                          <span className="bam-dist-chevron">
                            <UilIcon name={isExpanded ? 'Minus' : 'Plus'} sizeRem={9} />
                          </span>
                          {renamingKey === d.entityKey ? (
                            <input
                              className="bam-rename-input"
                              type="text"
                              value={renameValue}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => handleCommitRename(d.entityKey)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitRename(d.entityKey);
                                if (e.key === 'Escape') setRenamingKey(null);
                              }}
                            />
                          ) : (
                            <>
                              <span className="bam-district-primary-name" title={d.name}>
                                {d.name}
                              </span>
                              {isCity && <span className="bam-city-badge">CITY</span>}
                              {!isCity && (
                                <button
                                  className="bam-rename-btn"
                                  onClick={(e) => handleStartRename(e, d.entityKey, d.name)}
                                  title="Rename district"
                                >
                                  <UilIcon name="Edit" sizeRem={11} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    case 'buildings':
                      return (
                        <div key="buildings" className="dist-col-buildings" style={getColStyle('buildings')}>
                          <DistrictZoningBreakdown district={d} />
                        </div>
                      );
                    case 'citizens':
                      return (
                        <React.Fragment key="citizens">
                          <div className="dist-col-pop" style={getColStyle('pop')}>
                            <span
                              className="bam-dist-pop-primary"
                              style={{ marginBottom: d.population > 0 ? '2rem' : 0 }}
                            >
                              {`${formatNumber(d.population)} / ${formatNumber(d.households)}`}
                            </span>
                            {d.population > 0 && (
                              <span
                                className="bam-dist-pop-happy"
                                style={{
                                  color:
                                    d.avgHappiness >= 60
                                      ? '#81c784'
                                      : d.avgHappiness >= 40
                                      ? '#ffa726'
                                      : '#ef5350',
                                }}
                                title={happyTooltip}
                              >
                                {`${d.avgHappiness}% happy`}
                              </span>
                            )}
                          </div>

                          <div className="dist-col-workers" style={getColStyle('workers')}>
                            <span>
                              {`${formatNumber(d.workers)}${d.maxWorkers > 0 ? ` / ${formatNumber(d.maxWorkers)}` : ''}`}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    case 'avgLevel':
                      return (
                        <div key="avgLevel" className="dist-col-level" style={getColStyle('level')}>
                          <span>{d.avgBuildingLevel > 0 ? `L${d.avgBuildingLevel}` : '—'}</span>
                        </div>
                      );
                    case 'policies':
                      return (
                        <div
                          key="policies"
                          className="dist-col-policies bam-district-policy-badges"
                          style={getColStyle('policies')}
                        >
                          {!d.policies || d.policies.length === 0 ? (
                            <button
                              className="bam-row-add-policy-btn"
                              onClick={(e) => openPoliciesForDistrict(d.entityKey, e)}
                              title="Click to open policies and enable one"
                            >
                              <span style={{ marginRight: '4rem', fontSize: '11rem', fontWeight: 800 }}>+</span>
                              <span>Add Policy</span>
                            </button>
                          ) : (
                            <>
                              {d.policies.map((ap) => {
                                const safePolicies = Array.isArray(districtPolicies) ? districtPolicies : [];
                                const polMeta = safePolicies.find((m) => m && m.entityKey === ap.key);
                                const polName =
                                  formatPolicyDisplayName(
                                    polMeta?.name || ap.key,
                                    policyNameMap,
                                    translate
                                  ) || 'Policy';
                                const polIcon = polMeta?.icon;
                                const initials = polName
                                  .replace(/\s+/g, '')
                                  .slice(0, 2)
                                  .toUpperCase();

                                return (
                                  <button
                                    key={ap.key}
                                    className="bam-row-policy-icon-btn"
                                    title={`${polName} (Click to turn OFF)`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDistrictPolicy(d.entityKey, ap.key, false, ap.adjustment);
                                    }}
                                  >
                                    {polIcon ? (
                                      <img src={polIcon} alt={polName} className="bam-row-policy-img" />
                                    ) : (
                                      <span className="bam-row-policy-initials">{initials}</span>
                                    )}
                                    <span className="bam-row-policy-remove-tag">x</span>
                                  </button>
                                );
                              })}
                              <button
                                className="bam-row-policy-plus-btn"
                                title="Manage policies"
                                onClick={(e) => openPoliciesForDistrict(d.entityKey, e)}
                              >
                                +
                              </button>
                            </>
                          )}
                        </div>
                      );
                    case 'actions':
                      return (
                        <div key="actions" className="dist-col-act" style={getColStyle('actions')}>
                          {!isCity ? (
                            <>
                              <button
                                className="bam-action-btn go"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  focusEntity(d.entityKey);
                                }}
                                title="Inspect and focus district"
                              >
                                <UilIcon name="Location" sizeRem={11} style={{ marginRight: '3rem' }} />
                                <span>{inspectLabel}</span>
                              </button>
                              {onFilterToDistrict && (
                                <button
                                  className="bam-action-btn bld"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFilterToDistrict(d.entityKey);
                                  }}
                                  title={`View all ${d.totalBuildings} buildings in ${d.name}`}
                                >
                                  <UilIcon name="Building" sizeRem={11} style={{ marginRight: '3rem' }} />
                                  <span>Buildings</span>
                                </button>
                              )}
                            </>
                          ) : (
                            onFilterToDistrict && (
                              <button
                                className="bam-action-btn bld"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFilterToDistrict('');
                                }}
                                title="View all city buildings"
                              >
                                <UilIcon name="Building" sizeRem={11} style={{ marginRight: '3rem' }} />
                                <span>All Buildings</span>
                              </button>
                            )
                          )}
                        </div>
                      );
                    default:
                      return null;
                  }
                })}
              </div>

              {/* Expanded Analytics & Policies Section */}
              {isExpanded && (
                <div className="bam-district-expanded-section">
                  {isCity && (
                    <div className="bam-city-snapshot-banner">
                      <div className="bam-city-snapshot-header">
                        <span className="bam-city-snapshot-title">Game-Authoritative City Snapshot</span>
                        <span className="bam-city-snapshot-tag">Simulation ECS</span>
                      </div>
                      <div className="bam-city-snapshot-grid">
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">All Citizens</span>
                          <span className="bam-snapshot-val">
                            {formatNumber(d.gameAllCitizens || d.population)}
                          </span>
                        </div>
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">Moved-In Residents</span>
                          <span className="bam-snapshot-val">{formatNumber(d.population)}</span>
                        </div>
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">Employed Workers</span>
                          <span className="bam-snapshot-val">
                            {formatNumber(d.gameEmployees || d.workers)}
                          </span>
                        </div>
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">Students</span>
                          <span className="bam-snapshot-val">{formatNumber(d.students || 0)}</span>
                        </div>
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">Tourists</span>
                          <span className="bam-snapshot-val">
                            {formatNumber(d.gameTourists || d.tourists || 0)}
                          </span>
                        </div>
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">Commuters</span>
                          <span className="bam-snapshot-val">{formatNumber(d.gameCommuters || 0)}</span>
                        </div>
                        <div
                          className="bam-city-snapshot-cell"
                          title="Active citizen instances currently in transit leaving the city (Monthly simulation flow rate is shown in the Population Infoview)"
                        >
                          <span className="bam-snapshot-label">Moving Away</span>
                          <span className="bam-snapshot-val">{formatNumber(d.gameMovingAway || 0)}</span>
                        </div>
                        <div className="bam-city-snapshot-cell">
                          <span className="bam-snapshot-label">Homeless</span>
                          <span className="bam-snapshot-val">{formatNumber(d.homeless || 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Collapsible Multi-Zone Density & Pack Breakdown (Default ON) */}
                  {zoneSettings.inDistricts && enabledMatrixCategories.length > 0 && (() => {
                    const availForDist = isCity
                      ? enabledMatrixCategories
                      : enabledMatrixCategories.filter((cat) => {
                          if (cat === 'housing') return (d.residentialCount || 0) + (d.mixedCount || 0) > 0;
                          if (cat === 'commercial') {
                            return (
                              (d.commercialCount || 0) +
                              (zoneSettings.includeMixedGroundFloor ? (d.mixedCount || 0) : 0) > 0
                            );
                          }
                          if (cat === 'office') return (d.officeCount || 0) > 0;
                          if (cat === 'storage') return (d.storageCount || 0) > 0;
                          if (cat === 'service') return (d.serviceCount || 0) > 0;
                          if (cat === 'signature') {
                            return d.entityKey === 'city' || d.isCity
                              ? hasAnyPlacedSignature
                              : sigDistrictKeys.has(d.entityKey);
                          }
                          return (
                            (d.industrialCount || 0) +
                            (zoneSettings.includeIndustrialSpecials ? (d.storageCount || 0) : 0) > 0
                          );
                        });
                    if (availForDist.length === 0) return null;

                    if (zoneSettings.districtsLayout === 'stacked') {
                      return (
                        <div className="bam-zone-stacked-group">
                          {availForDist.map((cat) => {
                            const collapseKey = cat;
                            return (
                              <div key={cat} className="bam-zone-stacked-item">
                                <ZoneMatrixPanel
                                  compact={true}
                                  assets={assets}
                                  districts={districts}
                                  districtKey={d.entityKey}
                                  zoneCategory={cat}
                                  includeMixedGroundFloor={zoneSettings.includeMixedGroundFloor}
                                  includeIndustrialSpecials={zoneSettings.includeIndustrialSpecials}
                                  includeServiceUpgrades={zoneSettings.includeServiceUpgrades}
                                  collapsed={Boolean(collapsedHousing[collapseKey])}
                                  onToggleCollapse={() => toggleHousingCollapse(collapseKey)}
                                  onFilterAsset={onFilterResidential}
                                  onFilterResidential={onFilterResidential}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    const activeCat = availForDist.includes(districtMatrixCategory)
                      ? districtMatrixCategory
                      : availForDist[0];

                    return (
                      <ZoneMatrixPanel
                        compact={true}
                        assets={assets}
                        districts={districts}
                        districtKey={d.entityKey}
                        zoneCategory={activeCat}
                        availableCategories={availForDist}
                        onChangeZoneCategory={(nextCat) => {
                          setDistrictMatrixCategory(nextCat);
                          writeActiveZoneMatrixCategory(nextCat);
                        }}
                        includeMixedGroundFloor={zoneSettings.includeMixedGroundFloor}
                        includeIndustrialSpecials={zoneSettings.includeIndustrialSpecials}
                        includeServiceUpgrades={zoneSettings.includeServiceUpgrades}
                        collapsed={Boolean(collapsedHousing['switcher'])}
                        onToggleCollapse={() => toggleHousingCollapse('switcher')}
                        onFilterAsset={onFilterResidential}
                        onFilterResidential={onFilterResidential}
                      />
                    );
                  })()}

                  {/* Collapsible Demographics & Statistics */}
                  <div
                    className="bam-expanded-header-toggle"
                    onClick={(e) => toggleStatsCollapse('global', e)}
                  >
                    <span className="bam-toggle-icon">
                      <UilIcon
                        name={collapsedStats['global'] ? 'ChevronRight' : 'ChevronDown'}
                        sizeRem={11}
                      />
                    </span>
                    <span className="bam-expanded-subtitle" style={{ marginBottom: 0 }}>
                      {isCity
                        ? 'City-Wide Statistics & Demographics'
                        : `${d.name} Statistics & Demographics`}
                    </span>
                    {!isCity && (
                      <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: '8rem' }}>
                        <EntityIdBadge
                          entityKey={d.entityKey}
                          label="DIST "
                          variant="dist"
                          title="District Entity — Click to Open in SceneExplorer"
                        />
                      </span>
                    )}
                  </div>
                  {!collapsedStats['global'] && (
                    <div style={{ marginBottom: '12rem' }}>
                      {!isCity && onFilterToDistrict && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8rem' }}>
                          <button
                            className="bam-action-btn bld"
                            style={{ padding: '4rem 10rem', fontSize: '11rem' }}
                            onClick={() => onFilterToDistrict(d.entityKey)}
                            title={`Filter Explorer to all buildings in ${d.name}`}
                          >
                            <UilIcon name="Search" sizeRem={11} style={{ marginRight: '4rem' }} />
                            <span>
                              {`View All ${d.totalBuildings} Buildings in ${d.name}`}
                            </span>
                          </button>
                        </div>
                      )}
                      {districtViewMode === 'cards' ? (
                        <DistrictDashboardCards
                          district={d}
                          hiddenCards={hiddenCards}
                          policyMetas={districtPolicies}
                          onTogglePolicy={toggleDistrictPolicy}
                          onSetAdjustment={setDistrictPolicyAdjustment}
                        />
                      ) : (
                        /* Compact View: flat stat list with consistent ¢ formatting */
                        <div className="bam-compact-stats-grid">
                          <div className="bam-compact-stat">
                            <span>Population</span>
                            <strong>{formatNumber(d.population)}</strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Tourists</span>
                            <strong>{formatNumber(d.gameTourists || d.tourists || 0)}</strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Households</span>
                            <strong>
                              {`${formatNumber(d.households)} / ${formatNumber(d.householdCapacity)}`}
                            </strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Workers</span>
                            <strong>
                              {`${formatNumber(d.workers)} / ${formatNumber(d.maxWorkers)}`}
                            </strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Unemployment</span>
                            <strong>{`${(d.unemploymentRate || 0).toFixed(1)}%`}</strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Avg Happiness</span>
                            <strong>{d.population > 0 ? `${d.avgHappiness}%` : '—'}</strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Avg Wealth</span>
                            <strong>
                              {d.households > 0
                                ? `${d.avgWealthKey ? `${d.avgWealthKey} (` : ''}${formatCurrency(d.avgWealth)}${d.avgWealthKey ? ')' : ''}`
                                : '—'}
                            </strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Avg Income</span>
                            <strong>{d.households > 0 ? formatCurrency(d.avgIncome || 0, '/mo') : '—'}</strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Avg Rent</span>
                            <strong>{d.households > 0 ? formatCurrency(d.avgRent || 0, '/mo') : '—'}</strong>
                          </div>
                          {(d.avgFees ?? 0) !== 0 && (
                            <div className="bam-compact-stat">
                              <span>Avg Fees</span>
                              <strong>{formatCurrency(d.avgFees || 0, '/mo')}</strong>
                            </div>
                          )}
                          {(d.avgUpkeep ?? 0) !== 0 && (
                            <div className="bam-compact-stat">
                              <span>Avg Upkeep</span>
                              <strong>{formatCurrency(d.avgUpkeep || 0, '/mo')}</strong>
                            </div>
                          )}
                          {(d.landValueSamples || 0) > 0 && (
                            <div className="bam-compact-stat">
                              <span>Avg Land Value</span>
                              <strong>
                                {formatCurrency(
                                  Math.round((d.totalLandValue || 0) / (d.landValueSamples || 1))
                                )}
                              </strong>
                            </div>
                          )}
                          {(d.maintenanceCost ?? 0) !== 0 && (
                            <div className="bam-compact-stat">
                              <span>Municipal Upkeep</span>
                              <strong>{formatCurrency(d.maintenanceCost ?? 0, '/mo')}</strong>
                            </div>
                          )}
                          {(d.pets ?? 0) > 0 && (
                            <div className="bam-compact-stat">
                              <span>Pets</span>
                              <strong>{formatNumber(d.pets ?? 0)}</strong>
                            </div>
                          )}
                          {(d.attractiveness ?? 0) > 0 && (
                            <div className="bam-compact-stat">
                              <span>Attractiveness</span>
                              <strong>{formatNumber(d.attractiveness ?? 0)}</strong>
                            </div>
                          )}
                          {(d.touristVisits ?? 0) > 0 && (
                            <div className="bam-compact-stat">
                              <span>Tourist Visits</span>
                              <strong>{formatNumber(d.touristVisits ?? 0)}</strong>
                            </div>
                          )}
                          {(d.commercialActivity ?? 0) > 0 && (
                            <div className="bam-compact-stat">
                              <span>Commercial Activity</span>
                              <strong>{formatCurrency(d.commercialActivity ?? 0, '/mo')}</strong>
                            </div>
                          )}
                          <div className="bam-compact-stat">
                            <span>Crime Activity</span>
                            <strong>
                              {Math.min(100, (d.totalCrime || 0) / Math.max(1, d.totalBuildings) / 100).toFixed(1)}%
                            </strong>
                          </div>
                          <div className="bam-compact-stat">
                            <span>Sick Citizens</span>
                            <strong>{formatNumber(d.sick || 0)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsible Policies & Ordinances */}
                  {showPoliciesInExpanded && (
                    <>
                      <div
                        id={`bam-policies-sec-${d.entityKey}`}
                        className="bam-expanded-header-toggle"
                        onClick={(e) => togglePoliciesCollapse('global', e)}
                      >
                        <span className="bam-toggle-icon">
                          <UilIcon
                            name={collapsedPolicies['global'] ? 'ChevronRight' : 'ChevronDown'}
                            sizeRem={11}
                          />
                        </span>
                        <span className="bam-expanded-subtitle" style={{ marginBottom: 0 }}>
                          {isCity
                            ? 'City-Wide Policies & Ordinances'
                            : `${d.name} Policies & Ordinances`}
                        </span>
                        <span className="bam-active-pol-count-badge">
                          {`${d.policies?.length || 0} Active`}
                        </span>
                      </div>
                      {!collapsedPolicies['global'] && (
                        <DistrictPolicyControls
                          districtKey={d.entityKey}
                          isCity={isCity}
                          policyMetas={districtPolicies}
                          activePolicies={d.policies}
                          allDistricts={districts}
                          onTogglePolicy={toggleDistrictPolicy}
                          onSetAdjustment={setDistrictPolicyAdjustment}
                          onApplyToAll={applyPolicyToAllDistricts}
                          onCopyFrom={copyDistrictPolicies}
                          onResetPolicies={resetDistrictPolicies}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
          </Scrollable>
        </>
      )}
    </div>
  );
};

export default DistrictsView;
