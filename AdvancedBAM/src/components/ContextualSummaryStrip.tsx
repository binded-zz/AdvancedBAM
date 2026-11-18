import React, { useMemo } from 'react';
import { Scrollable } from 'cs2/ui';
import { useLocalization } from 'cs2/l10n';
import { useAssetData } from '../context/AssetDataProvider';
import { CategoryFilter, UnifiedAssetItem } from '../models/assetModels';
import { formatNumber, formatStorageTons, pluralize } from '../utils/formatters';
import ServiceIcon from './common/ServiceIcon';
import UilIcon from './common/UilIcon';
import bamStorage from '../utils/bamStorage';
import './ContextualSummaryStrip.css';

interface ContextualSummaryStripProps {
  currentCategory: CategoryFilter;
  filteredAssets: UnifiedAssetItem[];
  selectedServiceType?: string;
  onSelectServiceType?: (service: string) => void;
}

// Format electricity and water numbers nicely with standard units
const formatUtilityMetric = (usage: number, capacity: number, unit: string) => {
  const safeUsage = Number.isFinite(usage) && usage > 0 ? usage : 0;
  const safeCap = Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
  if (unit === 'Power') {
    const fmt = (v: number) => {
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} GW`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(1)} MW`;
      return `${Math.round(v)} kW`;
    };
    return `${fmt(safeUsage)} used / ${fmt(safeCap)} prod`;
  }
  if (unit === 'Water') {
    const fmt = (v: number) => {
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M m³`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k m³`;
      return `${Math.round(v)} m³`;
    };
    return `${fmt(safeUsage)} / ${fmt(safeCap)}/mo`;
  }
  return `${formatNumber(Math.round(safeUsage))} / ${formatNumber(Math.round(safeCap))} ${unit}`;
};

const formatCompactSignedCurrency = (amount: number): string => {
  const n = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}¢${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}¢${(abs / 1_000).toFixed(1)}k`;
  return `${sign}¢${formatNumber(Math.round(abs))}`;
};

export const ContextualSummaryStrip: React.FC<ContextualSummaryStripProps> = ({
  currentCategory,
  filteredAssets,
  selectedServiceType = 'All',
  onSelectServiceType,
}) => {
  useLocalization();
  const { serviceCards } = useAssetData();

  const [hiddenWidgets, setHiddenWidgets] = React.useState<Set<string>>(() => {
    try {
      const raw = bamStorage.getItem('bam_summary_strip_hidden_widgets');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  React.useEffect(() => {
    const handleSettingsChanged = (e: any) => {
      if (e?.detail?.key === 'summaryStripHiddenWidgets') {
        setHiddenWidgets(new Set(e.detail.value || []));
      }
    };
    window.addEventListener('bam-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('bam-settings-changed', handleSettingsChanged);
  }, []);

  const isCardVisible = (label: string) => !hiddenWidgets.has(label);

  const renderStrip = (cards: React.ReactNode) => (
    <Scrollable vertical={true} trackVisibility="scrollable" className="bam-summary-strip-scroll">
      <div className="bam-summary-strip">{cards}</div>
    </Scrollable>
  );

  // Compute rich aggregate statistics for the current category slice
  const stats = useMemo(() => {
    let totalCount = 0;
    let placedCount = 0;
    let totalOccupied = 0;
    let totalCapacity = 0;
    let totalResidents = 0;
    let totalHouseholds = 0;
    let totalJobs = 0;
    let effSum = 0;
    let effCount = 0;
    let happySum = 0;
    let happyCount = 0;
    let levelSum = 0;
    let levelCount = 0;
    let profitSum = 0;
    let profitCount = 0;
    let presenceSum = 0;
    let presenceCount = 0;
    let totalStored = 0;
    let totalStorageCap = 0;
    let signatureCount = 0;

    let resCount = 0;
    let comCount = 0;
    let indCount = 0;
    let offCount = 0;
    let svcCount = 0;
    let lowDensity = 0;
    let medDensity = 0;
    let highDensity = 0;
    let mixedDensity = 0;

    const districts = new Set<string>();

    const list = Array.isArray(filteredAssets) ? filteredAssets : [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      totalCount++;
      if (a.isPlaced) {
        placedCount++;
        if (a.category === 'Residential') resCount++;
        else if (a.category === 'Commercial') comCount++;
        else if (a.category === 'Industrial') indCount++;
        else if (a.category === 'Office') offCount++;
        else if (a.category === 'Service') svcCount++;
      }

      if (a.density === 'Low') lowDensity++;
      else if (a.density === 'Medium') medDensity++;
      else if (a.density === 'High') highDensity++;
      else if (a.density === 'Mixed') mixedDensity++;

      if (a.isSignature) signatureCount++;

      if (a.district && a.district !== '—' && a.district.trim() !== '') {
        districts.add(a.district);
      }

      const occVal = Number.isFinite(a.occupied) ? a.occupied : 0;
      totalOccupied += occVal;
      totalCapacity += Number.isFinite(a.capacity) ? a.capacity : 0;
      totalResidents += Number.isFinite(a.residents) ? (a.residents as number) : 0;
      if (a.isPlaced) {
        if (a.category === 'Residential') {
          totalHouseholds += occVal;
        } else {
          totalJobs += occVal;
        }
      }
      totalStored += Number.isFinite(a.storageAmount) ? (a.storageAmount as number) : 0;
      totalStorageCap += Number.isFinite(a.storageCapacity) ? (a.storageCapacity as number) : 0;

      if (typeof a.monthlyProfit === 'number' && Number.isFinite(a.monthlyProfit) && (a.company || a.profitabilityTier || a.monthlyProfit !== 0)) {
        profitSum += a.monthlyProfit;
        profitCount++;
      }

      if (typeof a.citizenPresence === 'number' && Number.isFinite(a.citizenPresence) && a.citizenPresence > 0) {
        presenceSum += a.citizenPresence;
        presenceCount++;
      }

      if (typeof a.level === 'number' && Number.isFinite(a.level) && a.level > 0) {
        levelSum += a.level;
        levelCount++;
      }

      if (typeof a.happiness === 'number' && Number.isFinite(a.happiness) && a.happiness >= 0) {
        happySum += a.happiness;
        happyCount++;
      }

      if (typeof a.efficiency === 'number' && Number.isFinite(a.efficiency) && a.efficiency >= 0) {
        effSum += a.efficiency;
        effCount++;
      }
    }

    const avgEff = effCount > 0 ? Math.round(effSum / effCount) : -1;
    const avgHappy = happyCount > 0 ? Math.round(happySum / happyCount) : -1;
    const avgLevel = levelCount > 0 ? (levelSum / levelCount).toFixed(1) : null;
    const avgPresence = presenceCount > 0 ? Math.round((presenceSum / presenceCount / 255) * 100) : 0;
    const occPct = totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0;

    return {
      totalCount,
      placedCount,
      totalOccupied,
      totalCapacity,
      totalResidents,
      totalHouseholds,
      totalJobs,
      occPct,
      totalStored,
      totalStorageCap,
      districtCount: districts.size,
      avgEff,
      effCount,
      avgHappy,
      happyCount,
      avgLevel,
      levelCount,
      avgPresence,
      presenceCount,
      profitSum,
      profitCount,
      signatureCount,
      resCount,
      comCount,
      indCount,
      offCount,
      svcCount,
      lowDensity,
      medDensity,
      highDensity,
      mixedDensity,
    };
  }, [filteredAssets]);

  // When filtered by "Service", render Responsive Multi-Service Cards with click-to-filter
  if (currentCategory === 'Service') {
    const rawCards = Array.isArray(serviceCards) ? [...serviceCards] : [];

    // Ensure standard services like Transportation exist in the card deck
    const cardMap = new Map<string, typeof rawCards[0]>();
    rawCards.forEach((c) => cardMap.set(c.label.toLowerCase(), c));

    // If Transportation is not yet reported by backend, synthesize clean card from filtered assets
    if (!cardMap.has('transportation')) {
      const transAssets = filteredAssets.filter(
        (a) => a.category === 'Service' && a.subCategory?.toLowerCase().includes('transport')
      );
      if (transAssets.length > 0) {
        let occ = 0;
        let cap = 0;
        let eff = 0;
        let effN = 0;
        transAssets.forEach((a) => {
          occ += a.occupied || 0;
          cap += a.capacity || 0;
          if (a.efficiency >= 0) {
            eff += a.efficiency;
            effN++;
          }
        });
        rawCards.push({
          key: 'transportation',
          label: 'Transportation',
          buildingCount: transAssets.length,
          usage: occ,
          capacity: cap,
          unit: 'Workers',
          avgEfficiency: effN > 0 ? Math.round(eff / effN) : -1,
        });
      }
    }

    if (rawCards.length === 0) {
      return renderStrip(
        isCardVisible('Total Public Services') ? (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Total Public Services</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {stats.placedCount === 1 ? 'Facility placed' : 'Facilities placed'}
              </span>
            </div>
          </div>
        ) : null
      );
    }

    return (
      <div className="bam-summary-strip service-strip">
        <Scrollable horizontal={true} vertical={false} trackVisibility="scrollable" style={{ width: '100%' }}>
          <div className="bam-summary-service-row">
        {rawCards.filter((svc) => isCardVisible(svc.label)).map((svc) => {
          const isSelected = selectedServiceType === svc.label;
          const pct =
            svc.capacity > 0 ? Math.min(100, Math.round((svc.usage / svc.capacity) * 100)) : 0;
          const barColor = pct > 90 ? '#ef5350' : pct > 75 ? '#ffa726' : '#4fc3f7';
          const safeEff = Number.isFinite(svc.avgEfficiency) && svc.avgEfficiency >= 0 ? Math.round(svc.avgEfficiency) : -1;
          const effColor = safeEff >= 90 ? '#4caf50' : safeEff >= 70 ? '#ffb74d' : safeEff >= 0 ? '#e57373' : '#78909c';

          return (
            <div
              key={svc.key}
              className={`bam-service-card${isSelected ? ' active' : ''}`}
              onClick={() => onSelectServiceType?.(svc.label)}
              title={`Click to filter table to ${svc.label} (${pluralize(svc.buildingCount, 'facility', 'facilities')})`}
            >
              <div className="bam-service-header">
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ display: 'flex', alignItems: 'center', marginRight: '5rem', flexShrink: 0 }}>
                    <ServiceIcon service={svc.label} sizeRem={15} />
                  </span>
                  <span className="bam-service-name">{svc.label}</span>
                </div>
                <span className="bam-service-count">{svc.buildingCount}</span>
              </div>
              <div className="bam-service-bar-container">
                <div
                  className="bam-service-bar-fill"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
              <div className="bam-service-footer">
                <span className="bam-service-metric-text">
                  {formatUtilityMetric(svc.usage, svc.capacity, svc.unit)}
                </span>
                <span style={{ color: effColor, fontWeight: 700 }}>
                  {safeEff >= 0 ? `${safeEff}% eff` : '—'}
                </span>
              </div>
            </div>
          );
        })}
          </div>
        </Scrollable>
      </div>
    );
  }

  // ALL BUILDINGS OVERVIEW
  if (currentCategory === 'All') {
    const happyIcon = stats.avgHappy >= 50 ? 'Happy' : stats.avgHappy >= 30 ? 'Neutral' : 'Sad';
    const happyColor = stats.avgHappy >= 75 ? '#66bb6a' : stats.avgHappy >= 50 ? '#4fc3f7' : '#ffa726';

    return renderStrip(
      <>
        {isCardVisible('Total City Buildings') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Total City Buildings</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {`${formatNumber(stats.resCount)} Res | ${formatNumber(stats.comCount)} Com | ${formatNumber(stats.indCount)} Ind | ${formatNumber(stats.offCount)} Off | ${formatNumber(stats.svcCount)} Svc`}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('Total Population & Capacity') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Total Population &amp; Capacity</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.totalResidents)}</span>
              <span className="bam-stat-sub">
                {`${formatNumber(stats.totalHouseholds)} HH | ${formatNumber(stats.totalJobs)} Jobs`}
              </span>
            </div>
          </div>
        )}

        {stats.avgHappy >= 0 && isCardVisible('Citizen Happiness') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Citizen Happiness</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val" style={{ color: happyColor, display: 'flex', alignItems: 'center' }}>
                <UilIcon name={happyIcon} sizeRem={14} style={{ color: happyColor, marginRight: '4rem' }} />
                <span>{stats.avgHappy}%</span>
              </span>
              <span className="bam-stat-sub">City Average</span>
            </div>
          </div>
        )}

        {isCardVisible('Avg Efficiency') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Avg Efficiency</span>
            <div className="bam-stat-value-row">
              <span
                className="bam-stat-val"
                style={{
                  color:
                    stats.avgEff < 0
                      ? '#78909c'
                      : stats.avgEff >= 85
                      ? '#66bb6a'
                      : stats.avgEff >= 65
                      ? '#ffa726'
                      : '#ef5350',
                }}
              >
                {stats.avgEff >= 0 ? `${stats.avgEff}%` : '—'}
              </span>
              <span className="bam-stat-sub">Operational</span>
            </div>
          </div>
        )}

        {isCardVisible('Building Quality') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Building Quality</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{stats.avgLevel ? `Lv ${stats.avgLevel}` : '—'}</span>
              <span className="bam-stat-sub">Average Progress</span>
            </div>
          </div>
        )}

        {isCardVisible('Districts & Landmarks') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Districts &amp; Landmarks</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.districtCount)}</span>
              <span className="bam-stat-sub">
                {`${stats.districtCount === 1 ? 'District' : 'Districts'} | ${pluralize(stats.signatureCount, 'Signature')}`}
              </span>
            </div>
          </div>
        )}
      </>
    );
  }

  // RESIDENTIAL
  if (currentCategory === 'Residential') {
    const hasHappy = stats.avgHappy >= 0;
    const happyIcon = stats.avgHappy >= 50 ? 'Happy' : stats.avgHappy >= 30 ? 'Neutral' : 'Sad';
    const happyColor = stats.avgHappy >= 75 ? '#66bb6a' : stats.avgHappy >= 50 ? '#4fc3f7' : '#ffa726';

    return renderStrip(
      <>
        {isCardVisible('Homes & Properties') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Homes &amp; Properties</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {`${formatNumber(stats.lowDensity)} Low | ${formatNumber(stats.medDensity)} Med | ${formatNumber(stats.highDensity)} High | ${formatNumber(stats.mixedDensity)} Mixed`}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('Residents & Households') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Residents &amp; Households</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.totalResidents)}</span>
              <span className="bam-stat-sub">
                {stats.totalCapacity > 0
                  ? `${formatNumber(stats.totalOccupied)} / ${formatNumber(stats.totalCapacity)} HH (${stats.occPct}%)`
                  : `${formatNumber(stats.totalOccupied)} HH`}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('Resident Happiness') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Resident Happiness</span>
            <div className="bam-stat-value-row">
              {hasHappy ? (
                <span className="bam-stat-val" style={{ color: happyColor, display: 'flex', alignItems: 'center' }}>
                  <UilIcon name={happyIcon} sizeRem={14} style={{ color: happyColor, marginRight: '4rem' }} />
                  <span>{stats.avgHappy}%</span>
                </span>
              ) : (
                <span className="bam-stat-val" style={{ color: '#78909c' }}>
                  —
                </span>
              )}
              <span className="bam-stat-sub">{hasHappy ? 'Quality of Life' : 'No occupied homes'}</span>
            </div>
          </div>
        )}

        {isCardVisible('Average Building Level') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Average Building Level</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{stats.avgLevel ? `Lv ${stats.avgLevel}` : '—'}</span>
              <span className="bam-stat-sub">Wealth Progression</span>
            </div>
          </div>
        )}

        {isCardVisible('Districts') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Districts</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.districtCount)}</span>
              <span className="bam-stat-sub">
                {stats.districtCount === 1 ? 'Neighborhood covered' : 'Neighborhoods covered'}
              </span>
            </div>
          </div>
        )}
      </>
    );
  }

  // COMMERCIAL
  if (currentCategory === 'Commercial') {
    return renderStrip(
      <>
        {isCardVisible('Commercial Venues') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Commercial Venues</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {stats.placedCount === 1 ? 'Store / Business' : 'Stores & Businesses'}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('Employed Staff & Jobs') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Employed Staff &amp; Jobs</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.totalOccupied)}</span>
              {stats.totalCapacity > 0 && (
                <span className="bam-stat-sub">
                  {`/ ${pluralize(stats.totalCapacity, 'position')} (${stats.occPct}%)`}
                </span>
              )}
            </div>
          </div>
        )}

        {isCardVisible('Customer Activity') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Customer Activity</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val" style={{ color: stats.presenceCount > 0 ? '#4fc3f7' : '#78909c' }}>
                {stats.presenceCount > 0 ? `${stats.avgPresence}%` : '—'}
              </span>
              <span className="bam-stat-sub">Foot Traffic Volume</span>
            </div>
          </div>
        )}

        {isCardVisible('Avg Efficiency') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Avg Efficiency</span>
            <div className="bam-stat-value-row">
              <span
                className="bam-stat-val"
                style={{
                  color:
                    stats.avgEff < 0
                      ? '#78909c'
                      : stats.avgEff >= 85
                      ? '#66bb6a'
                      : stats.avgEff >= 65
                      ? '#ffa726'
                      : '#ef5350',
                }}
              >
                {stats.avgEff >= 0 ? `${stats.avgEff}%` : '—'}
              </span>
              <span className="bam-stat-sub">Sales Performance</span>
            </div>
          </div>
        )}

        {stats.profitCount > 0 && isCardVisible('Estimated Profits') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Estimated Profits</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val" style={{ color: stats.profitSum >= 0 ? '#66bb6a' : '#ef5350' }}>
                {formatCompactSignedCurrency(stats.profitSum)}
              </span>
              <span className="bam-stat-sub">/ month</span>
            </div>
          </div>
        )}
      </>
    );
  }

  // INDUSTRIAL & EXTRACTORS
  if (currentCategory === 'Industrial') {
    return renderStrip(
      <>
        {isCardVisible('Industrial Facilities') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Industrial Facilities</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {stats.placedCount === 1 ? 'Factory / Facility' : 'Factories & Processing'}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('Industrial Workforce') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Industrial Workforce</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.totalOccupied)}</span>
              {stats.totalCapacity > 0 && (
                <span className="bam-stat-sub">
                  {`/ ${pluralize(stats.totalCapacity, 'position')} (${stats.occPct}%)`}
                </span>
              )}
            </div>
          </div>
        )}

        {isCardVisible('Production Efficiency') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Production Efficiency</span>
            <div className="bam-stat-value-row">
              <span
                className="bam-stat-val"
                style={{
                  color:
                    stats.avgEff < 0
                      ? '#78909c'
                      : stats.avgEff >= 85
                      ? '#66bb6a'
                      : stats.avgEff >= 65
                      ? '#ffa726'
                      : '#ef5350',
                }}
              >
                {stats.avgEff >= 0 ? `${stats.avgEff}%` : '—'}
              </span>
              <span className="bam-stat-sub">Output Multiplier</span>
            </div>
          </div>
        )}

        {stats.profitCount > 0 && isCardVisible('Industrial Earnings') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Industrial Earnings</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val" style={{ color: stats.profitSum >= 0 ? '#66bb6a' : '#ef5350' }}>
                {formatCompactSignedCurrency(stats.profitSum)}
              </span>
              <span className="bam-stat-sub">/ month net</span>
            </div>
          </div>
        )}

        {isCardVisible('Facility Progress') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Facility Progress</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{stats.avgLevel ? `Lv ${stats.avgLevel}` : '—'}</span>
              <span className="bam-stat-sub">Industrial Level</span>
            </div>
          </div>
        )}
      </>
    );
  }

  // OFFICE
  if (currentCategory === 'Office') {
    return renderStrip(
      <>
        {isCardVisible('Office Towers') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Office Towers</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {stats.placedCount === 1 ? 'Office Building' : 'Corporate & Tech'}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('White-Collar Workforce') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">White-Collar Workforce</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.totalOccupied)}</span>
              {stats.totalCapacity > 0 && (
                <span className="bam-stat-sub">
                  {`/ ${pluralize(stats.totalCapacity, 'educated job')} (${stats.occPct}%)`}
                </span>
              )}
            </div>
          </div>
        )}

        {isCardVisible('Software & Financial Eff') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Software &amp; Financial Eff</span>
            <div className="bam-stat-value-row">
              <span
                className="bam-stat-val"
                style={{
                  color:
                    stats.avgEff < 0
                      ? '#78909c'
                      : stats.avgEff >= 85
                      ? '#66bb6a'
                      : stats.avgEff >= 65
                      ? '#ffa726'
                      : '#ef5350',
                }}
              >
                {stats.avgEff >= 0 ? `${stats.avgEff}%` : '—'}
              </span>
              <span className="bam-stat-sub">Service Output</span>
            </div>
          </div>
        )}

        {isCardVisible('Office Tower Level') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Office Tower Level</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{stats.avgLevel ? `Lv ${stats.avgLevel}` : '—'}</span>
              <span className="bam-stat-sub">Tech Progression</span>
            </div>
          </div>
        )}
      </>
    );
  }

  // STORAGE / WAREHOUSES
  if (currentCategory === 'Storage') {
    const storageOccPct =
      stats.totalStorageCap > 0 ? Math.min(100, Math.round((stats.totalStored / stats.totalStorageCap) * 100)) : 0;

    return renderStrip(
      <>
        {isCardVisible('Warehouses & Logistics') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Warehouses &amp; Logistics</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.placedCount)}</span>
              <span className="bam-stat-sub">
                {stats.placedCount === 1 ? 'Storage Hub' : 'Storage Hubs'}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('Stored Cargo / Capacity') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Stored Cargo / Capacity</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">
                {formatStorageTons(stats.totalStored)}
              </span>
              {stats.totalStorageCap > 0 && (
                <span className="bam-stat-sub">
                  {`/ ${formatStorageTons(stats.totalStorageCap)} (${storageOccPct}%)`}
                </span>
              )}
            </div>
          </div>
        )}

        {isCardVisible('Logistics Workforce') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Logistics Workforce</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.totalOccupied)}</span>
              <span className="bam-stat-sub">Warehouse staff</span>
            </div>
          </div>
        )}

        {isCardVisible('Active Districts') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Active Districts</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.districtCount)}</span>
              <span className="bam-stat-sub">
                {stats.districtCount === 1 ? 'Industrial zone' : 'Industrial zones'}
              </span>
            </div>
          </div>
        )}
      </>
    );
  }

  // SIGNATURE BUILDINGS
  if (currentCategory === 'Signature') {
    return renderStrip(
      <>
        {isCardVisible('Signature Landmarks') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Signature Landmarks</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val">{formatNumber(stats.signatureCount)}</span>
              <span className="bam-stat-sub">
                {stats.signatureCount === 1 ? 'Unique City Landmark' : 'Unique City Landmarks'}
              </span>
            </div>
          </div>
        )}

        {isCardVisible('City-Wide Benefits') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">City-Wide Benefits</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val" style={{ color: stats.placedCount > 0 ? '#ffd54f' : '#94a3b8', display: 'flex', alignItems: 'center' }}>
                <UilIcon name="Star" sizeRem={12} style={{ color: stats.placedCount > 0 ? '#ffd54f' : '#94a3b8', marginRight: '4rem' }} />
                <span>{stats.placedCount > 0 ? 'Active' : 'None Placed'}</span>
              </span>
              <span className="bam-stat-sub">Economic &amp; Tourism Buffs</span>
            </div>
          </div>
        )}

        {isCardVisible('Landmark Efficiency') && (
          <div className="bam-stat-card">
            <span className="bam-stat-label">Landmark Efficiency</span>
            <div className="bam-stat-value-row">
              <span className="bam-stat-val" style={{ color: stats.avgEff >= 0 ? '#4caf50' : '#78909c' }}>
                {stats.avgEff >= 0 ? `${stats.avgEff}%` : '—'}
              </span>
              <span className="bam-stat-sub">Optimal Performance</span>
            </div>
          </div>
        )}
      </>
    );
  }

  // CATALOG PREFABS
  return renderStrip(
    <>
      {isCardVisible('Catalog Prefabs') && (
        <div className="bam-stat-card">
          <span className="bam-stat-label">Catalog Prefabs</span>
          <div className="bam-stat-value-row">
            <span className="bam-stat-val">{formatNumber(stats.totalCount)}</span>
            <span className="bam-stat-sub">
              {stats.totalCount === 1 ? 'Available asset in game library' : 'Available assets in game library'}
            </span>
          </div>
        </div>
      )}

      {isCardVisible('Zoning & Building Variety') && (
        <div className="bam-stat-card">
          <span className="bam-stat-label">Zoning &amp; Building Variety</span>
          <div className="bam-stat-value-row">
            <span className="bam-stat-val">Low / Med / High</span>
            <span className="bam-stat-sub">Residential, Commercial &amp; Industrial</span>
          </div>
        </div>
      )}

      {isCardVisible('Theme Compatibility') && (
        <div className="bam-stat-card">
          <span className="bam-stat-label">Theme Compatibility</span>
          <div className="bam-stat-value-row">
            <span className="bam-stat-val">EU &amp; USA</span>
            <span className="bam-stat-sub">Official Themes &amp; DLC Packs</span>
          </div>
        </div>
      )}
    </>
  );
};

export default ContextualSummaryStrip;
