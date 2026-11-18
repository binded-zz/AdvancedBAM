import { logCatch } from '../../utils/devWarn';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  happinessFactorCount$,
  happinessFactorFilter$,
  mapCs2HappyCountToLimit,
  mapCs2HappyFilterToMode,
} from '../../core/bindings';
import { safeUseValue } from '../../core/apiSafe';
import { Scrollable } from 'cs2/ui';
import { useLocalization } from 'cs2/l10n';
import { DistrictItem, DistrictPolicyMeta } from '../../models/assetModels';
import {
  isPolicyForCity,
  isPolicyForDistrict,
  getConflictingActivePolicies,
  resolvePolicySliderMax,
} from './policyConfig';
import { useCardReorder } from '../../hooks/useCardReorder';
import { formatCurrency, formatFactorLabel, formatNumber, formatPolicyDisplayName } from '../../utils/formatters';
import bamStorage from '../../utils/bamStorage';
import BamCustomSlider from '../common/BamCustomSlider';
import { UilIcon, UilStandardIconName } from '../common/UilIcon';
import './DistrictDashboardCards.css';

interface DistrictCardTheme {
  accent: string;
  border: string;
  headerBg: string;
  titleColor: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  iconSrc: string;
  fallbackIcon: UilStandardIconName;
}

const DISTRICT_CARD_THEMES: Record<string, DistrictCardTheme> = {
  happiness: {
    accent: '#8bdb46',
    border: 'rgba(139, 219, 70, 0.30)',
    headerBg: 'rgba(139, 219, 70, 0.10)',
    titleColor: '#c5e1a5',
    badgeColor: '#c5e1a5',
    badgeBg: 'rgba(139, 219, 70, 0.16)',
    badgeBorder: 'rgba(139, 219, 70, 0.38)',
    iconSrc: 'Media/Game/Icons/Happy.svg',
    fallbackIcon: 'Happy',
  },
  demographics: {
    accent: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.30)',
    headerBg: 'rgba(56, 189, 248, 0.10)',
    titleColor: '#bae6fd',
    badgeColor: '#7dd3fc',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    badgeBorder: 'rgba(56, 189, 248, 0.38)',
    iconSrc: 'Media/Game/Icons/Population.svg',
    fallbackIcon: 'Globe',
  },
  workforce: {
    accent: '#ffb74d',
    border: 'rgba(255, 183, 77, 0.30)',
    headerBg: 'rgba(255, 183, 77, 0.10)',
    titleColor: '#ffe0b2',
    badgeColor: '#ffcc80',
    badgeBg: 'rgba(255, 183, 77, 0.16)',
    badgeBorder: 'rgba(255, 183, 77, 0.38)',
    iconSrc: 'Media/Game/Icons/Workers.svg',
    fallbackIcon: 'Tools',
  },
  housing: {
    accent: '#4caf50',
    border: 'rgba(76, 175, 80, 0.32)',
    headerBg: 'rgba(76, 175, 80, 0.11)',
    titleColor: '#a5d6a7',
    badgeColor: '#a5d6a7',
    badgeBg: 'rgba(76, 175, 80, 0.18)',
    badgeBorder: 'rgba(76, 175, 80, 0.40)',
    iconSrc: 'Media/Game/Icons/ZoneResidential.svg',
    fallbackIcon: 'Building',
  },
  education: {
    accent: '#ce93d8',
    border: 'rgba(206, 147, 216, 0.30)',
    headerBg: 'rgba(206, 147, 216, 0.10)',
    titleColor: '#e1bee7',
    badgeColor: '#e1bee7',
    badgeBg: 'rgba(206, 147, 216, 0.16)',
    badgeBorder: 'rgba(206, 147, 216, 0.38)',
    iconSrc: 'Media/Game/Icons/Education.svg',
    fallbackIcon: 'Graduation',
  },
  utilities: {
    accent: '#22d3ee',
    border: 'rgba(34, 211, 238, 0.30)',
    headerBg: 'rgba(34, 211, 238, 0.10)',
    titleColor: '#a5f3fc',
    badgeColor: '#67e8f9',
    badgeBg: 'rgba(34, 211, 238, 0.16)',
    badgeBorder: 'rgba(34, 211, 238, 0.38)',
    iconSrc: 'Media/Game/Icons/Utilities.svg',
    fallbackIcon: 'Thunder',
  },
  safety: {
    accent: '#f87171',
    border: 'rgba(248, 113, 113, 0.30)',
    headerBg: 'rgba(248, 113, 113, 0.10)',
    titleColor: '#fecaca',
    badgeColor: '#fca5a5',
    badgeBg: 'rgba(248, 113, 113, 0.16)',
    badgeBorder: 'rgba(248, 113, 113, 0.38)',
    iconSrc: 'Media/Game/Icons/Healthcare.svg',
    fallbackIcon: 'Shield',
  },
  gamePolicies: {
    accent: '#60a5fa',
    border: 'rgba(96, 165, 250, 0.30)',
    headerBg: 'rgba(96, 165, 250, 0.10)',
    titleColor: '#bfdbfe',
    badgeColor: '#93c5fd',
    badgeBg: 'rgba(96, 165, 250, 0.16)',
    badgeBorder: 'rgba(96, 165, 250, 0.38)',
    iconSrc: 'Media/Game/Icons/Policies.svg',
    fallbackIcon: 'District',
  },
  policyPlus: {
    accent: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.32)',
    headerBg: 'rgba(245, 158, 11, 0.11)',
    titleColor: '#fde68a',
    badgeColor: '#fcd34d',
    badgeBg: 'rgba(245, 158, 11, 0.18)',
    badgeBorder: 'rgba(245, 158, 11, 0.42)',
    iconSrc: 'Media/Game/Icons/Journal.svg',
    fallbackIcon: 'Star',
  },
};

const DEFAULT_CARD_THEME: DistrictCardTheme = DISTRICT_CARD_THEMES.demographics;

const CardHeaderIcon: React.FC<{ theme: DistrictCardTheme }> = ({ theme }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <UilIcon name={theme.fallbackIcon} sizeRem={14} style={{ color: theme.accent }} />;
  }
  return (
    <img
      src={theme.iconSrc}
      alt=""
      style={{ width: '15rem', height: '15rem', objectFit: 'contain', display: 'block', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
};

interface Props {
  district: DistrictItem;
  hiddenCards?: Set<string>;
  policyMetas?: DistrictPolicyMeta[];
  onTogglePolicy?: (
    districtKey: string,
    policyKey: string,
    active: boolean,
    adjustment?: number
  ) => void;
  onSetAdjustment?: (
    districtKey: string,
    policyKey: string,
    adjustment: number
  ) => void;
}

interface BarItem {
  label: string;
  value: number;
  color: string;
  capacity?: number;
  pctText?: string;
}

export const MiniBar: React.FC<{ items: BarItem[] }> = ({ items }) => {
  const total = items.reduce(
    (sum, item) => sum + (item.capacity && item.capacity > 0 ? item.capacity : (item.value || 0)),
    0
  );
  if (total === 0) {
    return <div className="bam-minibar-empty">No demographic data</div>;
  }

  return (
    <div className="bam-minibar-wrap">
      <div className="bam-minibar-track">
        {items.map((item, idx) => {
          if (!item.value || item.value <= 0) return null;
          const pct = Math.max(1, Math.round((item.value / total) * 100));
          const displayPct = item.pctText || `${pct}%`;
          const hoverText =
            item.capacity !== undefined && item.capacity > 0
              ? `${item.label}: ${formatNumber(item.value)} / ${formatNumber(item.capacity)}`
              : `${item.label}: ${formatNumber(item.value)} (${displayPct})`;
          return (
            <div
              key={`seg-${item.label || item.color}-${idx}`}
              className="bam-minibar-seg"
              style={{ width: `${pct}%`, backgroundColor: item.color }}
              title={hoverText}
            />
          );
        })}
      </div>
      <div className="bam-minibar-legend">
        {(() => {
          const visibleItems = items.filter(
            (item) => (item.value && item.value > 0) || (item.capacity && item.capacity > 0)
          );
          const hasLongCapacity = visibleItems.some(
            (item) => item.capacity !== undefined && item.capacity > 0
          );
          const perRow = hasLongCapacity ? 2 : 3;
          const rows: BarItem[][] = [];
          for (let i = 0; i < visibleItems.length; i += perRow) {
            rows.push(visibleItems.slice(i, i + perRow));
          }
          return rows.map((row, rIdx) => (
            <div
              key={`leg-row-${row.map((it) => it.label || it.color).join('-')}-${rIdx}`}
              className="bam-minibar-legend-row"
            >
              {row.map((item, idx) => (
                <div
                  key={`leg-${item.label || item.color}-${idx}`}
                  className="bam-minibar-legend-item"
                >
                  <span className="bam-minibar-dot" style={{ backgroundColor: item.color }} />
                  <span className="bam-minibar-legend-text">
                    {`${item.label}${item.pctText ? ` (${item.pctText})` : ''}: `}
                  </span>
                  <strong className="bam-minibar-legend-val">
                    {item.capacity !== undefined && item.capacity > 0
                      ? `${formatNumber(item.value)} / ${formatNumber(item.capacity)}`
                      : formatNumber(item.value)}
                  </strong>
                </div>
              ))}
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export const StatRow: React.FC<{
  label: string;
  value: React.ReactNode;
  highlightColor?: string;
}> = ({ label, value, highlightColor }) => {
  return (
    <div className="bam-stat-row">
      <span className="bam-stat-row-label">{label}</span>
      <span
        className="bam-stat-row-value"
        style={highlightColor ? { color: highlightColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
};

const DEFAULT_CARD_ORDER = [
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

const CARD_ORDER_STORAGE_KEY = 'bam_district_card_order';
const COLLAPSED_CARDS_STORAGE_KEY = 'bam_dist_collapsed_cards';

export const DistrictDashboardCards: React.FC<Props> = ({
  district: d,
  hiddenCards,
  policyMetas = [],
  onTogglePolicy,
  onSetAdjustment,
}) => {
  const { translate } = useLocalization();
  const [showAllGamePolicies, setShowAllGamePolicies] = useState(false);
  const [showAllPolicyPlus, setShowAllPolicyPlus] = useState(false);
  const [activeCardSliderKey, setActiveCardSliderKey] = useState<string | null>(null);

  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem(COLLAPSED_CARDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (err) { logCatch('DistrictDashboardCards', err); }
    return new Set();
  });

  const persistCollapsedCards = useCallback((next: Set<string>) => {
    setCollapsedCards(next);
    try {
      bamStorage.setItem(COLLAPSED_CARDS_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch (err) { logCatch('DistrictDashboardCards', err); }
  }, []);

  const toggleCardCollapse = useCallback(
    (cardId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setCollapsedCards((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else {
          next.add(cardId);
        }
        try {
          bamStorage.setItem(COLLAPSED_CARDS_STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch (err) { logCatch('DistrictDashboardCards', err); }
        return next;
      });
    },
    []
  );

  const cs2HappyCount = safeUseValue(happinessFactorCount$, 2);
  const cs2HappyFilter = safeUseValue(happinessFactorFilter$, 0);

  const [happyLimit, setHappyLimit] = useState<number>(() => {
    try {
      const saved = bamStorage.getItem('bam_happy_limit');
      const parsed = saved !== null ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) && parsed >= -1 ? parsed : mapCs2HappyCountToLimit(cs2HappyCount);
    } catch {
      return mapCs2HappyCountToLimit(cs2HappyCount);
    }
  });

  const [happyFilter, setHappyFilter] = useState<'all' | 'pos' | 'neg'>(() => {
    try {
      const saved = bamStorage.getItem('bam_happy_filter');
      if (saved === 'all' || saved === 'pos' || saved === 'neg') return saved;
    } catch (err) { logCatch('DistrictDashboardCards', err); }
    return mapCs2HappyFilterToMode(cs2HappyFilter);
  });

  const handleLimitChange = (lim: number) => {
    setHappyLimit(lim);
    try { bamStorage.setItem('bam_happy_limit', lim.toString()); } catch (err) { logCatch('DistrictDashboardCards', err); }
  };

  const handleFilterChange = (f: 'all' | 'pos' | 'neg') => {
    setHappyFilter(f);
    try { bamStorage.setItem('bam_happy_filter', f); } catch (err) { logCatch('DistrictDashboardCards', err); }
  };

  // Pre-build human-readable policy name lookup for both entityKey and raw name
  const policyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (policyMetas || []).forEach((pm) => {
      if (!pm) return;
      const clean = formatPolicyDisplayName(pm.name, undefined, translate);
      if (pm.name) map.set(pm.name, clean);
      if (pm.entityKey) map.set(pm.entityKey, clean);
    });
    return map;
  }, [policyMetas, translate]);

  const hasPolicyPlus = useMemo(() => {
    return (policyMetas || []).some(
      (p) => p && p.name && (p.name.startsWith('PP_') || p.name.startsWith('DP_'))
    );
  }, [policyMetas]);

  const {
    cardOrder,
    draggedCardId,
    dragOverCardId,
    containerRef: cardsContainerRef,
    handleHeaderMouseDown,
    moveCard,
    resetLayout,
  } = useCardReorder({
    initialOrder: DEFAULT_CARD_ORDER,
    storageKey: CARD_ORDER_STORAGE_KEY,
  });

  useEffect(() => {
    const handleReset = () => {
      resetLayout();
      persistCollapsedCards(new Set());
      setHappyLimit(mapCs2HappyCountToLimit(cs2HappyCount));
      setHappyFilter(mapCs2HappyFilterToMode(cs2HappyFilter));
    };
    const handleSettingsChanged = (e: any) => {
      if (e.detail?.key === 'districtCardOrderReset') {
        resetLayout();
      }
      if (e.detail?.key === 'districtCardsReset') {
        persistCollapsedCards(new Set());
      }
      if (
        (e.detail?.key === 'districtHappyLimit' || e.detail?.key === 'defaultHappyLimit') &&
        typeof e.detail.value === 'number'
      ) {
        setHappyLimit(e.detail.value);
      } else if (
        e.detail?.key === 'happyFilter' &&
        (e.detail.value === 'all' || e.detail.value === 'pos' || e.detail.value === 'neg')
      ) {
        setHappyFilter(e.detail.value);
      }
    };
    window.addEventListener('bam-settings-reset', handleReset);
    window.addEventListener('bam-settings-changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('bam-settings-reset', handleReset);
      window.removeEventListener('bam-settings-changed', handleSettingsChanged);
    };
  }, [resetLayout, persistCollapsedCards, cs2HappyCount, cs2HappyFilter]);

  const visibleCardIds = useMemo(
    () => cardOrder.filter((id) => !hiddenCards?.has(id)),
    [cardOrder, hiddenCards]
  );

  const allVisibleCollapsed = useMemo(
    () => visibleCardIds.length > 0 && visibleCardIds.every((id) => collapsedCards.has(id)),
    [visibleCardIds, collapsedCards]
  );

  const handleToggleCollapseAll = () => {
    if (allVisibleCollapsed) {
      persistCollapsedCards(new Set());
    } else {
      persistCollapsedCards(new Set(visibleCardIds));
    }
  };

  const getHappinessInfo = (score: number) => {
    // Official CS2 Happiness categories:
    // 0-19: Miserable, 20-39: Unhappy, 40-59: Neutral, 60-79: Content, 80-100: Happy
    if (score >= 80) return { label: 'Happy', color: '#66bb6a' };
    if (score >= 60) return { label: 'Content', color: '#81c784' };
    if (score >= 40) return { label: 'Neutral', color: '#ffa726' };
    if (score >= 20) return { label: 'Unhappy', color: '#ff7043' };
    return { label: 'Miserable', color: '#ef5350' };
  };

  // Age distribution items with percentages matching Population Infoview
  const totalAge = (d.children || 0) + (d.teens || 0) + (d.adults || 0) + (d.seniors || 0);
  const getAgePct = (val: number) => (totalAge > 0 ? `${((val / totalAge) * 100).toFixed(1)}%` : '0.0%');

  const ageItems: BarItem[] = [
    { label: 'Children', value: d.children || 0, color: '#42a5f5', pctText: getAgePct(d.children || 0) },
    { label: 'Teens', value: d.teens || 0, color: '#26c6da', pctText: getAgePct(d.teens || 0) },
    { label: 'Adults', value: d.adults || 0, color: '#66bb6a', pctText: getAgePct(d.adults || 0) },
    { label: 'Seniors', value: d.seniors || 0, color: '#ffa726', pctText: getAgePct(d.seniors || 0) },
  ];

  // Resident education distribution matching native ResidentsSection
  const totalCitizenEdu =
    (d.eduUneducated || 0) +
    (d.eduPoorlyEducated || 0) +
    (d.eduEducated || 0) +
    (d.eduWellEducated || 0) +
    (d.eduHighlyEducated || 0);
  const getCitizenEduPct = (val: number) =>
    totalCitizenEdu > 0 ? `${Math.round((val / totalCitizenEdu) * 100)}%` : '0%';

  const citizenEduItems: BarItem[] = [
    { label: 'Uneducated', value: d.eduUneducated || 0, color: '#ef5350', pctText: getCitizenEduPct(d.eduUneducated || 0) },
    { label: 'Poorly Edu', value: d.eduPoorlyEducated || 0, color: '#ffa726', pctText: getCitizenEduPct(d.eduPoorlyEducated || 0) },
    { label: 'Educated', value: d.eduEducated || 0, color: '#66bb6a', pctText: getCitizenEduPct(d.eduEducated || 0) },
    { label: 'Well Edu', value: d.eduWellEducated || 0, color: '#26c6da', pctText: getCitizenEduPct(d.eduWellEducated || 0) },
    { label: 'Highly Edu', value: d.eduHighlyEducated || 0, color: '#42a5f5', pctText: getCitizenEduPct(d.eduHighlyEducated || 0) },
  ];

  // Workforce education distribution items with capacity (active / capacity)
  const workerEduItems: BarItem[] = [
    { label: 'Uneducated', value: d.workerUneducated || 0, capacity: d.workplaceUneducated, color: '#ef5350' },
    { label: 'Poorly Edu', value: d.workerPoorlyEducated || 0, capacity: d.workplacePoorlyEducated, color: '#ffa726' },
    { label: 'Educated', value: d.workerEducated || 0, capacity: d.workplaceEducated, color: '#66bb6a' },
    { label: 'Well Edu', value: d.workerWellEducated || 0, capacity: d.workplaceWellEducated, color: '#26c6da' },
    { label: 'Highly Edu', value: d.workerHighlyEducated || 0, capacity: d.workplaceHighlyEducated, color: '#42a5f5' },
  ];

  // School availability helper
  const getSchoolAvail = (cap: number, enr: number) => {
    if (cap <= 0) return { text: 'None', color: '#78909c' };
    const remaining = cap - enr;
    if (remaining <= 0) return { text: 'Full', color: '#ef5350' };
    const pct = Math.round((remaining / cap) * 100);
    if (pct < 15) return { text: `${pct}% Avail`, color: '#ffa726' };
    return { text: `${pct}% Avail`, color: '#66bb6a' };
  };

  const getWealthInfo = (w: number, key?: string) => {
    if (key) {
      switch (key) {
        case 'Wealthy':
          return { label: 'Wealthy', color: '#81c784' };
        case 'Comfortable':
          return { label: 'Comfortable', color: '#aed581' };
        case 'Modest':
          return { label: 'Modest', color: '#fff176' };
        case 'Poor':
          return { label: 'Poor', color: '#ffa726' };
        case 'Wretched':
          return { label: 'Wretched', color: '#ef5350' };
      }
    }
    if (w >= 10000) return { label: 'Wealthy', color: '#81c784' };
    if (w >= 2000) return { label: 'Comfortable', color: '#aed581' };
    if (w >= 1000) return { label: 'Modest', color: '#fff176' };
    if (w >= 0) return { label: 'Poor', color: '#ffa726' };
    return { label: 'Wretched', color: '#ef5350' };
  };

  const unempRate = d.unemploymentRate ?? 0;
  const unempColor = unempRate > 15 ? '#ef5350' : unempRate > 8 ? '#ffa726' : '#66bb6a';

  const renderCardHeader = (id: string, title: string, badgeText: string) => {
    const idx = cardOrder.indexOf(id);
    const canMoveLeft = idx > 0;
    const canMoveRight = idx >= 0 && idx < cardOrder.length - 1;
    const isCollapsed = collapsedCards.has(id);
    const theme = DISTRICT_CARD_THEMES[id] || DEFAULT_CARD_THEME;

    return (
      <div
        className="bam-dash-card-header"
        style={{
          background: theme.headerBg,
          borderBottomColor: isCollapsed ? 'transparent' : theme.border,
        }}
        onMouseDown={(e) => handleHeaderMouseDown(e, id)}
        title="Drag header to move card, or click chevron to collapse/expand"
      >
        <div className="bam-dash-card-title-group">
          <button
            type="button"
            className="bam-card-collapse-btn"
            style={{ color: theme.accent }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => toggleCardCollapse(id, e)}
            title={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            <UilIcon name={isCollapsed ? 'ChevronRight' : 'ChevronDown'} sizeRem={11} style={{ color: theme.accent }} />
          </button>
          <span className="bam-dash-card-icon-wrap">
            <CardHeaderIcon theme={theme} />
          </span>
          <span className="bam-dash-card-title" style={{ color: theme.titleColor }}>
            {title}
          </span>
        </div>
        <div className="bam-dash-card-header-actions">
          <span
            className="bam-dash-card-badge"
            style={{
              color: theme.badgeColor,
              background: theme.badgeBg,
              borderColor: theme.badgeBorder,
            }}
          >
            {badgeText}
          </span>
          <div className="bam-card-reorder-group">
            <button
              type="button"
              className={`bam-card-reorder-btn${!canMoveLeft ? ' disabled' : ''}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!canMoveLeft) return;
                moveCard(id, -1);
              }}
              title="Move card left"
            >
              <UilIcon name="ArrowLeft" sizeRem={9} />
            </button>
            <button
              type="button"
              className={`bam-card-reorder-btn${!canMoveRight ? ' disabled' : ''}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!canMoveRight) return;
                moveCard(id, 1);
              }}
              title="Move card right"
            >
              <UilIcon name="ArrowRight" sizeRem={9} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getCardClassName = (id: string) =>
    `bam-dash-card${draggedCardId === id ? ' dragging' : ''}${
      dragOverCardId === id ? ' drag-over' : ''
    }${collapsedCards.has(id) ? ' collapsed' : ''}`;

  const getCardStyle = (id: string): React.CSSProperties | undefined => {
    const theme = DISTRICT_CARD_THEMES[id] || DEFAULT_CARD_THEME;
    if (draggedCardId === id || dragOverCardId === id) {
      return { borderLeftWidth: '3rem', borderLeftStyle: 'solid' };
    }
    return {
      borderColor: theme.border,
      borderLeftWidth: '3rem',
      borderLeftStyle: 'solid',
      borderLeftColor: theme.accent,
    };
  };

  // Render dictionary
  const cardRenderers: Record<string, () => React.ReactNode> = {
    happiness: () => {
      const allFactors = d.happinessFactors || [];
      const nonZeroCount = allFactors.filter((hf) => hf.percentage !== 0).length;

      // Filter out 0-point factors by default unless "All" (happyLimit === 0) is explicitly chosen
      const filteredByPolarity = allFactors
        .filter((hf) => {
          if (happyFilter === 'pos') return hf.percentage > 0;
          if (happyFilter === 'neg') return hf.percentage < 0;
          if (happyLimit !== 0) return hf.percentage !== 0;
          return true;
        })
        .slice()
        .sort((a, b) => {
          const aZero = a.percentage === 0 ? 1 : 0;
          const bZero = b.percentage === 0 ? 1 : 0;
          if (aZero !== bZero) return aZero - bZero;
          return Math.abs(b.percentage) - Math.abs(a.percentage);
        });

      const displayFactors =
        happyLimit === 0
          ? filteredByPolarity
          : happyLimit > 0
          ? filteredByPolarity.slice(0, happyLimit)
          : [];

      const hasResidents = d.population > 0;
      const hapInfo = hasResidents
        ? getHappinessInfo(d.avgHappiness || 0)
        : { label: 'No Residents', color: '#90a4ae' };
      const isCollapsed = collapsedCards.has('happiness');

      return (
        <div
          key="happiness"
          data-card-id="happiness"
          className={getCardClassName('happiness')}
          style={getCardStyle('happiness')}
        >
          {renderCardHeader(
            'happiness',
            'Citizen Happiness Factors',
            hasResidents ? `${hapInfo.label} (${d.avgHappiness || 0}%)` : 'No Residents'
          )}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              {/* Filter Controls Bar */}
              <div className="bam-happy-controls-bar">
                <div className="bam-happy-btn-group">
                  <span className="bam-happy-group-label">Show:</span>
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn ${happyLimit === 5 ? 'active' : ''}`}
                    onClick={() => handleLimitChange(5)}
                    title="Show Top 5 non-zero factors"
                  >
                    Top 5
                  </button>
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn ${happyLimit === 10 ? 'active' : ''}`}
                    onClick={() => handleLimitChange(10)}
                    title="Show Top 10 non-zero factors"
                  >
                    Top 10
                  </button>
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn ${happyLimit === 0 ? 'active' : ''}`}
                    onClick={() => handleLimitChange(0)}
                    title={`Show all ${allFactors.length} tracked factors (${nonZeroCount} active)`}
                  >
                    {`All (${allFactors.length})`}
                  </button>
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn ${happyLimit === -1 ? 'active' : ''}`}
                    onClick={() => handleLimitChange(-1)}
                    title="Hide factor details"
                  >
                    None
                  </button>
                </div>

                <div className="bam-happy-btn-group">
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn ${happyFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('all')}
                    title="Show both positive and negative factors"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn pos ${happyFilter === 'pos' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('pos')}
                    title="Show positive satisfaction factors only"
                  >
                    + Pos
                  </button>
                  <button
                    type="button"
                    className={`bam-happy-toggle-btn neg ${happyFilter === 'neg' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('neg')}
                    title="Show negative grievance factors only"
                  >
                    - Neg
                  </button>
                </div>
              </div>

              {/* Scrollable List of factors */}
              {happyLimit !== -1 && (
                <div className="bam-dash-scroll-box" style={{ maxHeight: '240rem' }}>
                  <Scrollable vertical={true} trackVisibility="scrollable" style={{ maxHeight: '240rem' }}>
                    <div className="bam-happy-factors-list">
                      {displayFactors.length > 0 ? (
                        displayFactors.map((hf, i) => {
                          const weight = Math.round(hf.percentage);
                          const label = formatFactorLabel(hf.factor, weight);
                          return (
                            <div key={`factor-${hf.factor}`} className="bam-happy-factor-row">
                              <span className="bam-happy-factor-name" title={label}>
                                {label}
                              </span>
                              <span
                                className={`bam-happy-factor-weight ${
                                  weight > 0 ? 'pos' : weight < 0 ? 'neg' : 'neutral'
                                }`}
                              >
                                {weight > 0 ? `+${weight}` : weight < 0 ? `${weight}` : '0'}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="bam-happy-empty">No active factors match the selected filter</div>
                      )}
                    </div>
                  </Scrollable>
                </div>
              )}

              {/* In-Game Description */}
              <div className="bam-happy-desc">
                The average happiness of every household living in the district. Taking care of
                citizens&apos; basic needs increases health, while education, leisure, and safety
                increase well-being.
              </div>
            </div>
          )}
        </div>
      );
    },

    demographics: () => {
      const isCollapsed = collapsedCards.has('demographics');
      const topDrivers = (d.happinessFactors || [])
        .filter((hf) => Math.round(hf.percentage) !== 0)
        .sort((a, b) => Math.abs(b.percentage) - Math.abs(a.percentage))
        .slice(0, 6);

      return (
        <div
          key="demographics"
          data-card-id="demographics"
          className={getCardClassName('demographics')}
          style={getCardStyle('demographics')}
        >
          {renderCardHeader('demographics', 'Demographics', `Pop: ${formatNumber(d.population)}`)}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <div className="bam-dash-subhead">Age Groups</div>
              <MiniBar items={ageItems} />

              {totalCitizenEdu > 0 && (
                <>
                  <div className="bam-dash-subhead" style={{ marginTop: '8rem' }}>
                    Resident Education
                  </div>
                  <MiniBar items={citizenEduItems} />
                </>
              )}

              <div className="bam-dash-divider" />
              <StatRow label="Residents" value={formatNumber(d.population)} />
              <StatRow label="Students" value={formatNumber(d.students || 0)} />
              <StatRow label="Tourists" value={formatNumber(d.gameTourists || d.tourists || 0)} />
              {(d.homeless || 0) > 0 && (
                <StatRow
                  label="Homeless"
                  value={formatNumber(d.homeless || 0)}
                  highlightColor="#ef5350"
                />
              )}
              <StatRow
                label="Avg Happiness"
                value={
                  d.population > 0
                    ? `${getHappinessInfo(d.avgHappiness || 0).label} (${d.avgHappiness || 0}%)`
                    : 'No Residents'
                }
                highlightColor={d.population > 0 ? getHappinessInfo(d.avgHappiness || 0).color : '#90a4ae'}
              />
              {topDrivers.length > 0 && (
                <>
                  <div className="bam-dash-divider" />
                  <div className="bam-dash-subhead" style={{ marginBottom: '4rem' }}>
                    Top Happiness Drivers
                  </div>
                  <div className="bam-happiness-chips">
                    {topDrivers.map((hf, i) => {
                      const pts = Math.round(hf.percentage);
                      const label = formatFactorLabel(hf.factor, pts);
                      const signed = pts > 0 ? `+${pts}` : `${pts}`;
                      return (
                        <span
                          key={`chip-${hf.factor}`}
                          className={`bam-happy-chip ${pts > 0 ? 'pos' : 'neg'}`}
                          title={`${label}: ${signed}`}
                        >
                          {`${label} ${signed}`}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      );
    },

    workforce: () => {
      const isCollapsed = collapsedCards.has('workforce');
      return (
        <div
          key="workforce"
          data-card-id="workforce"
          className={getCardClassName('workforce')}
          style={getCardStyle('workforce')}
        >
          {renderCardHeader('workforce', 'Workforce & Jobs', `Jobs: ${formatNumber(d.workers)}`)}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <div className="bam-dash-subhead">Worker Education</div>
              <MiniBar items={workerEduItems} />

              <div className="bam-dash-divider" />
              <StatRow
                label="Employees / Capacity"
                value={`${formatNumber(d.workers)} / ${formatNumber(d.maxWorkers || 0)}`}
                highlightColor="#4fc3f7"
              />
              <StatRow
                label="Open Positions"
                value={formatNumber(d.openPositions ?? Math.max(0, (d.maxWorkers || 0) - (d.workers || 0)))}
                highlightColor="#66bb6a"
              />
              <StatRow
                label="Unemployed (Working-Age)"
                value={formatNumber(d.unemployed || 0)}
                highlightColor={(d.unemployed || 0) > 0 ? unempColor : undefined}
              />
              <StatRow
                label="Unemployment Rate"
                value={`${unempRate.toFixed(1)}%`}
                highlightColor={unempColor}
              />
            </div>
          )}
        </div>
      );
    },

    housing: () => {
      const isCollapsed = collapsedCards.has('housing');
      return (
        <div
          key="housing"
          data-card-id="housing"
          className={getCardClassName('housing')}
          style={getCardStyle('housing')}
        >
          {renderCardHeader('housing', 'Housing & Zoning', `Bldgs: ${formatNumber(d.totalBuildings)}`)}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <StatRow label="Residential (Pure)" value={formatNumber(d.residentialCount)} />
              <StatRow label="Mixed Housing" value={formatNumber(d.mixedCount || 0)} />
              <StatRow label="Commercial" value={formatNumber(d.commercialCount)} />
              <StatRow label="Industrial" value={formatNumber(d.industrialCount)} />
              <StatRow label="Office" value={formatNumber(d.officeCount)} />
              <StatRow label="Storage" value={formatNumber(d.storageCount)} />
              <StatRow label="Services" value={formatNumber(d.serviceCount)} />

              <div className="bam-dash-divider" />
              <StatRow
                label="Households / Cap"
                value={`${formatNumber(d.households)} / ${formatNumber(d.householdCapacity || 0)}`}
                highlightColor="#81c784"
              />
              {d.households > 0 && d.avgWealth !== undefined && (
                <StatRow
                  label="Avg Wealth"
                  value={`${getWealthInfo(d.avgWealth, d.avgWealthKey).label} (${formatCurrency(d.avgWealth)})`}
                  highlightColor={getWealthInfo(d.avgWealth, d.avgWealthKey).color}
                />
              )}
              {(d.avgIncome || 0) !== 0 && (
                <StatRow
                  label="Avg Income"
                  value={formatCurrency(d.avgIncome || 0, '/mo')}
                  highlightColor="#81c784"
                />
              )}
              {(d.avgRent || 0) !== 0 && (
                <StatRow label="Avg Rent" value={formatCurrency(d.avgRent || 0, '/mo')} />
              )}
              {(d.avgUpkeep ?? 0) !== 0 && (
                <StatRow
                  label="Avg Upkeep"
                  value={formatCurrency(d.avgUpkeep || 0, '/mo')}
                  highlightColor="#e0e0e0"
                />
              )}
              {(d.avgResourceCost ?? 0) !== 0 && (
                <StatRow
                  label="Avg Resource Cost"
                  value={formatCurrency(d.avgResourceCost || 0, '/mo')}
                  highlightColor="#e0e0e0"
                />
              )}
              {(d.avgFees ?? 0) !== 0 && (
                <StatRow
                  label="Avg Fees"
                  value={formatCurrency(d.avgFees || 0, '/mo')}
                  highlightColor="#e0e0e0"
                />
              )}
              {(d.pets ?? 0) > 0 && (
                <StatRow
                  label="Pets"
                  value={formatNumber(d.pets ?? 0)}
                  highlightColor="#ce93d8"
                />
              )}
              {(d.commercialActivity ?? 0) > 0 && (
                <StatRow
                  label="Commercial Activity / Sales"
                  value={formatCurrency(d.commercialActivity ?? 0, '/mo')}
                  highlightColor="#4fc3f7"
                />
              )}
            </div>
          )}
        </div>
      );
    },

    education: () => {
      const isCollapsed = collapsedCards.has('education');
      const totEnrBadge =
        (d.elemEnrolled || 0) + (d.hsEnrolled || 0) + (d.collegeEnrolled || 0) + (d.uniEnrolled || 0);
      return (
        <div
          key="education"
          data-card-id="education"
          className={getCardClassName('education')}
          style={getCardStyle('education')}
        >
          {renderCardHeader('education', 'Schools & Education', `Enrolled: ${formatNumber(totEnrBadge)}`)}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <div className="bam-schools-table">
                <div className="bam-schools-row bam-schools-head">
                  <span className="bam-sch-col level">Level</span>
                  <span className="bam-sch-col enr">Enrolled</span>
                  <span className="bam-sch-col cap">Cap</span>
                  <span className="bam-sch-col elig">Eligible</span>
                  <span className="bam-sch-col avail">Status</span>
                </div>

                {[
                  { label: 'Elementary', cap: d.elemCapacity || 0, enr: d.elemEnrolled || 0, elig: d.elemEligible || 0 },
                  { label: 'High School', cap: d.hsCapacity || 0, enr: d.hsEnrolled || 0, elig: d.hsEligible || 0 },
                  { label: 'College', cap: d.collegeCapacity || 0, enr: d.collegeEnrolled || 0, elig: d.collegeEligible || 0 },
                  { label: 'University', cap: d.uniCapacity || 0, enr: d.uniEnrolled || 0, elig: d.uniEligible || 0 },
                ].map((sch, i) => {
                  const avail = getSchoolAvail(sch.cap, sch.enr);
                  return (
                    <div key={`sch-${sch.label}`} className="bam-schools-row">
                      <span className="bam-sch-col level">{sch.label}</span>
                      <span className="bam-sch-col enr">{formatNumber(sch.enr)}</span>
                      <span className="bam-sch-col cap">{formatNumber(sch.cap)}</span>
                      <span className="bam-sch-col elig" style={{ color: '#ce93d8' }}>{formatNumber(sch.elig)}</span>
                      <span className="bam-sch-col avail" style={{ color: avail.color, fontWeight: 700 }}>
                        {avail.text}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bam-dash-divider" />
              {(() => {
                const totCap = (d.elemCapacity || 0) + (d.hsCapacity || 0) + (d.collegeCapacity || 0) + (d.uniCapacity || 0);
                const totEnr = (d.elemEnrolled || 0) + (d.hsEnrolled || 0) + (d.collegeEnrolled || 0) + (d.uniEnrolled || 0);
                const totElig = (d.elemEligible || 0) + (d.hsEligible || 0) + (d.collegeEligible || 0) + (d.uniEligible || 0);
                const utilPct = totCap > 0 ? Math.round((totEnr / totCap) * 100) : 0;
                return (
                  <>
                    <StatRow
                      label="Total School Capacity"
                      value={`${formatNumber(totEnr)} / ${formatNumber(totCap)}`}
                      highlightColor="#81d4fa"
                    />
                    <StatRow
                      label="Resident Students"
                      value={formatNumber(d.students || 0)}
                      highlightColor="#4fc3f7"
                    />
                    <StatRow
                      label="Total Eligible Students"
                      value={formatNumber(totElig)}
                      highlightColor="#ce93d8"
                    />
                    <StatRow
                      label="Capacity Utilization"
                      value={totCap > 0 ? `${utilPct}%` : 'N/A'}
                      highlightColor={utilPct >= 95 ? '#ef5350' : utilPct >= 80 ? '#ffa726' : '#81c784'}
                    />
                  </>
                );
              })()}
            </div>
          )}
        </div>
      );
    },

    utilities: () => {
      const isCollapsed = collapsedCards.has('utilities');
      return (
        <div
          key="utilities"
          data-card-id="utilities"
          className={getCardClassName('utilities')}
          style={getCardStyle('utilities')}
        >
          {renderCardHeader('utilities', 'Utilities & Services', 'Consumption')}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              {(() => {
                const elec = d.electricityConsumption ?? 0;
                const elecStr =
                  elec >= 1_000_000
                    ? `${(elec / 1_000_000).toFixed(2)} GW`
                    : elec >= 1_000
                    ? `${(elec / 1_000).toFixed(1)} MW`
                    : `${formatNumber(elec)} kW`;

                return (
                  <StatRow
                    label="Electricity Demand"
                    value={elecStr}
                    highlightColor="#ffd54f"
                  />
                );
              })()}
              <StatRow
                label="Water & Sewage"
                value={`${formatNumber(d.waterConsumption ?? 0)} m³/mo`}
                highlightColor="#4fc3f7"
              />
              <StatRow
                label="Garbage Accumulation"
                value={`${formatNumber(d.garbageAccumulation ?? 0)} t`}
                highlightColor={(d.garbageAccumulation ?? 0) > 500 ? '#ffa726' : '#b0bec5'}
              />
              <div className="bam-dash-divider" />
              <StatRow
                label="Municipal Upkeep"
                value={formatCurrency(d.maintenanceCost ?? 0, '/mo')}
                highlightColor="#ef5350"
              />
              <StatRow
                label="Public Service Buildings"
                value={formatNumber(d.serviceCount || 0)}
              />
            </div>
          )}
        </div>
      );
    },

    safety: () => {
      const isCollapsed = collapsedCards.has('safety');
      return (
        <div
          key="safety"
          data-card-id="safety"
          className={getCardClassName('safety')}
          style={getCardStyle('safety')}
        >
          {renderCardHeader('safety', 'Land, Health & Safety', 'Environment')}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <StatRow
                label="Surface Area"
                value={
                  (d.area ?? 0) > 0
                    ? `${(d.area ?? 0).toFixed(2)} km² (${formatNumber(Math.round((d.area ?? 0) * 100))} ha)`
                    : '—'
                }
                highlightColor="#81c784"
              />
              <StatRow
                label="Avg Land Value"
                value={
                  (d.landValueSamples || 0) > 0
                    ? formatCurrency(Math.round((d.totalLandValue || 0) / (d.landValueSamples || 1)))
                    : '—'
                }
                highlightColor="#ffd54f"
              />
              <StatRow
                label="Avg Building Level"
                value={d.avgBuildingLevel > 0 ? `Level ${d.avgBuildingLevel}` : '—'}
              />
              {(d.attractiveness ?? 0) > 0 && (
                <StatRow
                  label="District Attractiveness"
                  value={formatNumber(d.attractiveness ?? 0)}
                  highlightColor="#81d4fa"
                />
              )}
              {(d.touristVisits ?? 0) > 0 && (
                <StatRow
                  label="Tourist Visits"
                  value={formatNumber(d.touristVisits ?? 0)}
                  highlightColor="#ffb74d"
                />
              )}
              <div className="bam-dash-divider" />
              <StatRow
                label="Sick Citizens"
                value={formatNumber(d.sick || 0)}
                highlightColor={(d.sick || 0) > 0 ? '#ef5350' : '#81c784'}
              />
              {(() => {
                const avgCrime = d.totalBuildings > 0 ? (d.totalCrime || 0) / d.totalBuildings : 0;
                // 10,000 is base game MaxCrimeAccumulation
                const crimePct = Math.min(100, Math.round((avgCrime / 10000) * 1000) / 10);
                const crimeRisk =
                  crimePct >= 5
                    ? { label: 'High', color: '#ef5350' }
                    : crimePct >= 2
                    ? { label: 'Moderate', color: '#ffa726' }
                    : crimePct > 0
                    ? { label: 'Low', color: '#81c784' }
                    : { label: 'Safe', color: '#81c784' };

                return (
                  <StatRow
                    label="Crime Activity"
                    value={`${crimeRisk.label} (${crimePct}%)`}
                    highlightColor={crimeRisk.color}
                  />
                );
              })()}
            </div>
          )}
        </div>
      );
    },

    gamePolicies: () => {
      const isCity = !!d.isCity;
      const isCollapsed = collapsedCards.has('gamePolicies');
      const validPolicies = (policyMetas || []).filter((pol) => {
        if (isCity && !isPolicyForCity(pol)) return false;
        if (!isCity && !isPolicyForDistrict(pol)) return false;
        const isPP = pol.name && (pol.name.startsWith('PP_') || pol.name.startsWith('DP_'));
        return !isPP;
      });
      const activeList = validPolicies.filter((pol) =>
        (d.policies || []).some((ap) => ap.key === pol.entityKey)
      );
      const displayed = showAllGamePolicies ? validPolicies : activeList;
      const activeSliderPol = activeCardSliderKey
        ? validPolicies.find((p) => p.entityKey === activeCardSliderKey)
        : null;
      const activeSliderAdj = activeSliderPol
        ? (d.policies || []).find((ap) => ap.key === activeSliderPol.entityKey)?.adjustment ??
          activeSliderPol.sliderDefault ??
          0
        : 0;

      return (
        <div
          key="gamePolicies"
          className={getCardClassName('gamePolicies')}
          data-card-id="gamePolicies"
          style={getCardStyle('gamePolicies')}
        >
          {renderCardHeader(
            'gamePolicies',
            isCity ? 'City Policies' : 'District Policies',
            `${activeList.length} Active`
          )}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <div className="bam-dash-policy-toolbar">
                <span className="bam-dash-policy-count">
                  {`${activeList.length} Active ${isCity ? 'City' : 'District'} ${
                    activeList.length === 1 ? 'Policy' : 'Policies'
                  }`}
                </span>
                <button
                  type="button"
                  className="bam-dash-policy-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllGamePolicies(!showAllGamePolicies);
                  }}
                >
                  {showAllGamePolicies ? 'Show Active Only' : `Show All (${validPolicies.length})`}
                </button>
              </div>

              {/* Slider Drawer if a slider policy is open */}
              {activeSliderPol && (
                <div className="bam-dash-policy-slider-box">
                  <div className="bam-dash-slider-header">
                    <span>
                      {formatPolicyDisplayName(activeSliderPol.name, policyNameMap, translate)}
                    </span>
                    <button
                      type="button"
                      className="bam-dash-slider-close"
                      onClick={() => setActiveCardSliderKey(null)}
                      title="Keep value and close slider"
                    >
                      ✓ Done
                    </button>
                  </div>
                  <BamCustomSlider
                    value={activeSliderAdj}
                    min={activeSliderPol.sliderMin ?? 0}
                    max={resolvePolicySliderMax(activeSliderPol)}
                    step={1}
                    onChange={(val) => {
                      if (onSetAdjustment) onSetAdjustment(d.entityKey, activeSliderPol.entityKey, val);
                    }}
                  />
                </div>
              )}

              {displayed.length === 0 ? (
                <div className="bam-dash-empty-policies">
                  No active policies. Click &quot;Show All&quot; to browse and activate.
                </div>
              ) : (
                <div className="bam-dash-scroll-box" style={{ maxHeight: '230rem' }}>
                  <Scrollable vertical={true} trackVisibility="scrollable" style={{ maxHeight: '230rem' }}>
                    <div className="bam-dash-policy-grid">
                      {displayed.map((pol) => {
                        const activeItem = (d.policies || []).find((ap) => ap.key === pol.entityKey);
                        const isActive = !!activeItem;
                        const currentAdj = activeItem?.adjustment ?? pol.sliderDefault ?? 0;
                        const conflicts = getConflictingActivePolicies(pol.name, d.policies || [], policyMetas || []);
                        const hasConflict = !isActive && conflicts.length > 0;
                        const isSliderSelected = activeCardSliderKey === pol.entityKey;

                        const descKey = `Policy.DESCRIPTION[${pol.name}]`;
                        const title = formatPolicyDisplayName(pol.name, policyNameMap, translate);
                        const rawDesc = translate(descKey, '') ?? '';
                        const desc = rawDesc && !rawDesc.includes('[') ? rawDesc : '';
                        const conflictLabels = conflicts.map((c) =>
                          formatPolicyDisplayName(c, policyNameMap, translate)
                        );
                        const tooltip = `${title} (${isActive ? 'ACTIVE' : hasConflict ? 'BLOCKED' : 'OFF'})${
                          desc ? `\n\n${desc}` : ''
                        }${
                          hasConflict ? `\n\nIncompatible with: ${conflictLabels.join(', ')}` : ''
                        }\n\nClick to ${isActive ? 'turn OFF' : 'turn ON'}${
                          pol.hasSlider && isActive ? ' (or click slider icon to adjust)' : ''
                        }`;

                        return (
                          <button
                            key={pol.entityKey}
                            type="button"
                            className={`bam-dash-policy-tile${isActive ? ' active' : ''}${
                              hasConflict ? ' conflict disabled' : ''
                            }${isSliderSelected ? ' slider-selected' : ''}`}
                            title={tooltip}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasConflict) return;
                              if (onTogglePolicy) {
                                onTogglePolicy(d.entityKey, pol.entityKey, !isActive, currentAdj);
                              }
                              if (!isActive && pol.hasSlider) {
                                setActiveCardSliderKey(pol.entityKey);
                              } else if (isActive && isSliderSelected) {
                                setActiveCardSliderKey(null);
                              }
                            }}
                          >
                            {pol.icon ? (
                              <img src={pol.icon} className="bam-dash-policy-img" alt={title} />
                            ) : (
                              <span className="bam-dash-policy-initials">
                                {title.replace(/\s+/g, '').substring(0, 2).toUpperCase()}
                              </span>
                            )}
                            {pol.hasSlider && isActive && (
                              <span
                                className="bam-dash-policy-slider-badge"
                                title="Adjust policy slider"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCardSliderKey(isSliderSelected ? null : pol.entityKey);
                                }}
                              >
                                <svg width="8rem" height="8rem" viewBox="0 0 24 24" fill="none" stroke="#eceff1" strokeWidth="2.5">
                                  <line x1="4" y1="7" x2="20" y2="7" />
                                  <circle cx="8" cy="7" r="2.5" fill="#4fc3f7" stroke="none" />
                                  <line x1="4" y1="17" x2="20" y2="17" />
                                  <circle cx="16" cy="17" r="2.5" fill="#4fc3f7" stroke="none" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Scrollable>
                </div>
              )}
            </div>
          )}
        </div>
      );
    },

    policyPlus: () => {
      const isCollapsed = collapsedCards.has('policyPlus');
      if (!hasPolicyPlus) {
        return null;
      }

      const isCity = !!d.isCity;
      const validPolicies = (policyMetas || []).filter((pol) => {
        if (isCity && !isPolicyForCity(pol)) return false;
        if (!isCity && !isPolicyForDistrict(pol)) return false;
        const isPP = pol.name && (pol.name.startsWith('PP_') || pol.name.startsWith('DP_'));
        return isPP;
      });
      const activeList = validPolicies.filter((pol) =>
        (d.policies || []).some((ap) => ap.key === pol.entityKey)
      );
      const displayed = showAllPolicyPlus ? validPolicies : activeList;
      const activeSliderPol = activeCardSliderKey
        ? validPolicies.find((p) => p.entityKey === activeCardSliderKey)
        : null;
      const activeSliderAdj = activeSliderPol
        ? (d.policies || []).find((ap) => ap.key === activeSliderPol.entityKey)?.adjustment ??
          activeSliderPol.sliderDefault ??
          0
        : 0;

      return (
        <div
          key="policyPlus"
          className={getCardClassName('policyPlus')}
          data-card-id="policyPlus"
          style={getCardStyle('policyPlus')}
        >
          {renderCardHeader('policyPlus', 'Policy Plus', `${activeList.length} Active`)}
          {!isCollapsed && (
            <div className="bam-dash-card-body">
              <div className="bam-dash-policy-toolbar">
                <span className="bam-dash-policy-count">
                  {`${activeList.length} Active ${isCity ? 'City' : 'District'} ${
                    activeList.length === 1 ? 'Policy' : 'Policies'
                  }`}
                </span>
                <button
                  type="button"
                  className="bam-dash-policy-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllPolicyPlus(!showAllPolicyPlus);
                  }}
                >
                  {showAllPolicyPlus ? 'Show Active Only' : `Show All (${validPolicies.length})`}
                </button>
              </div>

              {/* Slider Drawer if a slider policy is open */}
              {activeSliderPol && (
                <div className="bam-dash-policy-slider-box">
                  <div className="bam-dash-slider-header">
                    <span>
                      {formatPolicyDisplayName(activeSliderPol.name, policyNameMap, translate)}
                    </span>
                    <button
                      type="button"
                      className="bam-dash-slider-close"
                      onClick={() => setActiveCardSliderKey(null)}
                      title="Keep value and close slider"
                    >
                      ✓ Done
                    </button>
                  </div>
                  <BamCustomSlider
                    value={activeSliderAdj}
                    min={activeSliderPol.sliderMin ?? 0}
                    max={resolvePolicySliderMax(activeSliderPol)}
                    step={1}
                    onChange={(val) => {
                      if (onSetAdjustment) onSetAdjustment(d.entityKey, activeSliderPol.entityKey, val);
                    }}
                  />
                </div>
              )}

              {displayed.length === 0 ? (
                <div className="bam-dash-empty-policies">
                  No active Policy Plus policies. Click &quot;Show All&quot; to browse and activate.
                </div>
              ) : (
                <div className="bam-dash-scroll-box" style={{ maxHeight: '230rem' }}>
                  <Scrollable vertical={true} trackVisibility="scrollable" style={{ maxHeight: '230rem' }}>
                    <div className="bam-dash-policy-grid">
                      {displayed.map((pol) => {
                        const activeItem = (d.policies || []).find((ap) => ap.key === pol.entityKey);
                        const isActive = !!activeItem;
                        const currentAdj = activeItem?.adjustment ?? pol.sliderDefault ?? 0;
                        const conflicts = getConflictingActivePolicies(pol.name, d.policies || [], policyMetas || []);
                        const hasConflict = !isActive && conflicts.length > 0;
                        const isSliderSelected = activeCardSliderKey === pol.entityKey;

                        const descKey = `Policy.DESCRIPTION[${pol.name}]`;
                        const title = formatPolicyDisplayName(pol.name, policyNameMap, translate);
                        const rawDesc = translate(descKey, '') ?? '';
                        const desc = rawDesc && !rawDesc.includes('[') ? rawDesc : '';
                        const conflictLabels = conflicts.map((c) =>
                          formatPolicyDisplayName(c, policyNameMap, translate)
                        );
                        const tooltip = `${title} (${isActive ? 'ACTIVE' : hasConflict ? 'BLOCKED' : 'OFF'})${
                          desc ? `\n\n${desc}` : ''
                        }${
                          hasConflict ? `\n\nIncompatible with: ${conflictLabels.join(', ')}` : ''
                        }\n\nClick to ${isActive ? 'turn OFF' : 'turn ON'}${
                          pol.hasSlider && isActive ? ' (or click slider icon to adjust)' : ''
                        }`;

                        return (
                          <button
                            key={pol.entityKey}
                            type="button"
                            className={`bam-dash-policy-tile${isActive ? ' active' : ''}${
                              hasConflict ? ' conflict disabled' : ''
                            }${isSliderSelected ? ' slider-selected' : ''}`}
                            title={tooltip}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasConflict) return;
                              if (onTogglePolicy) {
                                onTogglePolicy(d.entityKey, pol.entityKey, !isActive, currentAdj);
                              }
                              if (!isActive && pol.hasSlider) {
                                setActiveCardSliderKey(pol.entityKey);
                              } else if (isActive && isSliderSelected) {
                                setActiveCardSliderKey(null);
                              }
                            }}
                          >
                            {pol.icon ? (
                              <img src={pol.icon} className="bam-dash-policy-img" alt={title} />
                            ) : (
                              <span className="bam-dash-policy-initials">
                                {title.replace(/\s+/g, '').substring(0, 2).toUpperCase()}
                              </span>
                            )}
                            {pol.hasSlider && isActive && (
                              <span
                                className="bam-dash-policy-slider-badge"
                                title="Adjust policy slider"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCardSliderKey(isSliderSelected ? null : pol.entityKey);
                                }}
                              >
                                <svg width="8rem" height="8rem" viewBox="0 0 24 24" fill="none" stroke="#eceff1" strokeWidth="2.5">
                                  <line x1="4" y1="7" x2="20" y2="7" />
                                  <circle cx="8" cy="7" r="2.5" fill="#4fc3f7" stroke="none" />
                                  <line x1="4" y1="17" x2="20" y2="17" />
                                  <circle cx="16" cy="17" r="2.5" fill="#4fc3f7" stroke="none" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Scrollable>
                </div>
              )}
            </div>
          )}
        </div>
      );
    },
  };

  return (
    <div className="bam-dash-cards-wrapper">
      <div className="bam-dash-cards-toolbar">
        <span className="bam-dash-toolbar-hint">
          Tip: Drag cards by their headers, click chevrons to collapse, or use arrow buttons to reorder.
        </span>
        <div className="bam-dash-cards-toolbar-actions">
          <button
            type="button"
            className="bam-dash-reset-btn"
            onClick={handleToggleCollapseAll}
            title={allVisibleCollapsed ? 'Expand all visible cards' : 'Collapse all visible cards'}
          >
            {allVisibleCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
          <button
            type="button"
            className="bam-dash-reset-btn"
            onClick={resetLayout}
            title="Reset to default card layout"
          >
            Reset Layout
          </button>
        </div>
      </div>
      <div className="bam-dash-cards-container" ref={cardsContainerRef}>
        {visibleCardIds.map((id) => (cardRenderers[id] ? cardRenderers[id]() : null))}
      </div>
    </div>
  );
};

export default DistrictDashboardCards;
