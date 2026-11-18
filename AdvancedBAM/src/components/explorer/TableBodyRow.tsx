import React from 'react';
import { CategoryFilter, UnifiedAssetItem, getAssetFavoriteKey } from '../../models/assetModels';
import { ColumnKey } from '../../hooks/useResizableColumns';
import UilIcon from '../common/UilIcon';
import AssetThumbnail from '../common/AssetThumbnail';
import ThemeIcon from '../common/ThemeIcon';
import PackIcon from '../common/PackIcon';
import ResourceIcon from '../common/ResourceIcon';
import ServiceIcon from '../common/ServiceIcon';
import { getCategoryVisual, getFactorDisplayLabel } from '../../utils/iconLibrary';
import {
  formatCurrency,
  formatNumber,
  formatProfitabilityTier,
  formatResourceLabel,
  formatStoragePair,
  pluralize,
} from '../../utils/formatters';
import InspectorDrawer, { InspectorDrawerProps, SubBuildingUpgradeCard } from './InspectorDrawer';

export interface TableBodyRowProps extends Omit<InspectorDrawerProps, 'item' | 'densityColor' | 'happyVal' | 'happyColor' | 'hasUpgrades' | 'isUpgradesOpen'> {
  item: UnifiedAssetItem;
  isNested?: boolean;
  categoryFilter: CategoryFilter;
  activeViewColumns: ColumnKey[];
  getColStyle: (colKey: ColumnKey) => React.CSSProperties;
  isColVisible: (colKey: string) => boolean;
  favoriteKeys: Set<string>;
  toggleFavorite: (key: string, e?: React.MouseEvent) => void;
  showUpgradesBadge: boolean;
  expandedUpgrades: Record<string, boolean>;
  toggleUpgrades: (id: string, e: React.MouseEvent) => void;
  expandedRowId: string | null;
  setExpandedRowId: React.Dispatch<React.SetStateAction<string | null>>;
  focusedHighlightId: string | null;
  setFocusedHighlightId: React.Dispatch<React.SetStateAction<string | null>>;
  statusHealthy: string;
  actClone: string;
  actPlop: string;
  actRepair: string;
  rebuildBuilding: (entityKey: string) => void;
}

export const TableBodyRow: React.FC<TableBodyRowProps> = ({
  item,
  isNested = false,
  categoryFilter,
  activeViewColumns,
  getColStyle,
  isColVisible,
  favoriteKeys,
  toggleFavorite,
  showUpgradesBadge,
  expandedUpgrades,
  toggleUpgrades,
  expandedRowId,
  setExpandedRowId,
  focusedHighlightId,
  setFocusedHighlightId,
  statusHealthy,
  actClone,
  actPlop,
  actRepair,
  buildingCardOrder,
  hiddenBuildingCards,
  collapsedBldCards,
  setCollapsedBldCards,
  buildingDraggedCardId,
  buildingDragOverCardId,
  buildingCardsContainerRef,
  handleBuildingCardMouseDown,
  moveBuildingCard,
  resetBuildingCardLayout,
  toggleBldCardCollapse,
  bldEffFilter,
  setBldEffFilter,
  bldEffLimit,
  setBldEffLimit,
  bldHappyFilter,
  setBldHappyFilter,
  bldHappyLimit,
  setBldHappyLimit,
  upgradeDisplayMode,
  setUpgradeDisplayMode,
  expandedSubBuildings,
  toggleSubBuildingExpand,
  focusEntity,
  cloneBuilding,
  rebuildBuilding,
  renameAsset,
  plopPrefab,
  showTools,
  translate,
}) => {
  const effClass =
    item.efficiency >= 85 ? 'good' : item.efficiency >= 60 ? 'fair' : 'poor';

  const dmgPct = Math.max(0, Math.min(100, item.damagePercent ?? 0));
  const dmgStr = dmgPct > 0 ? (dmgPct % 1 === 0 ? `${Math.round(dmgPct)}%` : `${dmgPct.toFixed(1)}%`) : '';
  const isRowDamaged = Boolean(item.needsRepair || item.isDamaged || dmgPct > 0);
  const hasStatusColumn = activeViewColumns.includes('status');

  const densityColor =
    item.density === 'Low'
      ? '#8bdb46'
      : item.density === 'Medium'
      ? '#50b8e9'
      : item.density === 'High'
      ? '#e88c3a'
      : item.density === 'Mixed'
      ? '#c084fc'
      : '#90a4ae';

  const happyVal = item.happiness ?? -1;
  const happyColor =
    happyVal >= 75
      ? '#8bdb46'
      : happyVal >= 50
      ? '#50b8e9'
      : happyVal >= 30
      ? '#e88c3a'
      : '#ef5350';

  const hasUpgrades = Array.isArray(item.subBuildings) && item.subBuildings.length > 0;
  const isUpgradesOpen = !!expandedUpgrades[item.id];
  const isRowExpanded = expandedRowId === item.id;

  return (
    <React.Fragment>
      <div
        id={`bam-row-${item.id}`}
        data-row-id={item.id}
        data-entity-key={item.entityKey}
        className={`bam-table-row${!item.isPlaced ? ' catalog' : ''}${isNested ? ' nested' : ''}${isRowExpanded ? ' expanded' : ''}${focusedHighlightId === item.id ? ' bam-row-focused-pulse' : ''}`}
        onClick={() => {
          if (focusedHighlightId === item.id) {
            setFocusedHighlightId(null);
          }
          setExpandedRowId(isRowExpanded ? null : item.id);
        }}
        title={isRowExpanded ? 'Click to collapse details' : 'Click to inspect building details'}
        style={{ cursor: 'pointer' }}
      >
          {activeViewColumns.map((colKey) => {
            switch (colKey) {
              case 'name': {
                const itemKey = getAssetFavoriteKey(item);
                const isFav = favoriteKeys.has(itemKey);
                return (
                  <div key="name" className="col-name bam-asset-name-block" style={getColStyle('name')}>
                    <span
                      className="bam-row-expand-arrow"
                      role="button"
                      tabIndex={0}
                      aria-label={isRowExpanded ? 'Collapse details' : 'Expand details'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedRowId(isRowExpanded ? null : item.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedRowId(isRowExpanded ? null : item.id);
                        }
                      }}
                    >
                      <UilIcon name={isRowExpanded ? 'ChevronDown' : 'ChevronRight'} sizeRem={10} />
                    </span>
                    <button
                      type="button"
                      className={`bam-star-btn${isFav ? ' active' : ''}`}
                      onClick={(e) => toggleFavorite(itemKey, e)}
                      title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                    >
                      <svg width="12rem" height="12rem" viewBox="0 0 24 24" fill={isFav ? '#f59e0b' : 'none'} stroke={isFav ? '#f59e0b' : '#64748b'} strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                    <AssetThumbnail item={item} sizeRem={26} />
                    <div className="bam-asset-name-text">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="bam-asset-primary-name">{item.name}</span>
                        {isRowDamaged && !hasStatusColumn && (
                          <span
                            className="bam-status-pill warning"
                            style={{
                              background: 'rgba(255, 167, 38, 0.2)',
                              borderColor: '#ffa726',
                              color: '#ffa726',
                              fontSize: '9rem',
                              padding: '1rem 5rem',
                              marginLeft: '5rem',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                            title={item.hasBrokenPath && !dmgStr ? 'Broken path / road or pedestrian access missing' : `Building damage: ${dmgStr || 'Damaged / Needs repair'}`}
                          >
                            {dmgStr ? `Damaged ${dmgStr}` : item.hasBrokenPath ? 'Broken Path' : 'Damaged'}
                          </span>
                        )}
                        {hasUpgrades && showUpgradesBadge && (
                          <button
                            className="bam-upgrade-tag-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isRowExpanded) setExpandedRowId(null);
                              toggleUpgrades(item.id, e);
                            }}
                            title="Click to view installed sub-building upgrades"
                          >
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                              <UilIcon name={isUpgradesOpen ? 'ChevronDown' : 'ChevronRight'} sizeRem={9} />
                            </span>
                            <span style={{ marginLeft: '4rem' }}>
                              {`+${pluralize(item.subBuildings!.length, 'Upgrade')}`}
                            </span>
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', overflow: 'hidden' }}>
                        <span className="bam-asset-sub-name" style={{ marginRight: '5rem' }}>
                          {item.secondaryName || item.prefabName}
                        </span>
                        {!isColVisible('lotSize') && item.lotDimensions && (
                          <span
                            style={{
                              fontSize: '9rem',
                              padding: '1rem 4rem',
                              borderRadius: '3rem',
                              background: 'rgba(255, 202, 40, 0.12)',
                              color: '#ffca28',
                              border: '1rem solid rgba(255, 202, 40, 0.25)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              marginRight: '5rem',
                            }}
                            title={`Lot size: ${item.lotDimensions.replace('x', ' × ')}`}
                          >
                            {item.lotDimensions.replace('x', ' × ')}
                          </span>
                        )}
                        {item.isHistorical && (
                          <span
                            style={{
                              fontSize: '9rem',
                              padding: '1rem 4rem',
                              borderRadius: '3rem',
                              background: 'rgba(186, 104, 200, 0.15)',
                              color: '#ba68c8',
                              border: '1rem solid rgba(186, 104, 200, 0.3)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Historical preserved building"
                          >
                            <UilIcon name="District" sizeRem={9} style={{ color: '#ba68c8', marginRight: '3rem' }} />
                            <span>Hist</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              case 'lotSize':
                return (
                  <div key="lotSize" className="col-lotsize" style={getColStyle('lotSize')}>
                    {item.lotDimensions ? (
                      <span className="bam-lotsize-badge" title={`Lot size: ${item.lotDimensions.replace('x', ' × ')}`}>
                        {item.lotDimensions.replace('x', ' × ')}
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11rem' }}>—</span>
                    )}
                  </div>
                );
              case 'company':
                return (
                  <div key="company" className="col-company" style={getColStyle('company')}>
                    <span className="bam-company-text" title={item.company || (item.resource ? `${item.resource} Facility` : 'Independent')}>
                      {item.company || (item.resource ? `${item.resource} Facility` : '—')}
                    </span>
                  </div>
                );
              case 'vehicles': {
                const cMax = item.companyVehiclesMax ?? 0;
                const cCur = item.companyVehicles ?? 0;
                const vMax = item.vehiclesMax ?? 0;
                const vCur = item.vehicles ?? 0;
                const hasCompanyFleet = cMax > 0 || cCur > 0;
                const cur = hasCompanyFleet ? cCur : vCur;
                const max = hasCompanyFleet ? cMax : vMax;
                return (
                  <div key="vehicles" className="col-vehicles" style={getColStyle('vehicles')}>
                    {max > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#ffd54f', whiteSpace: 'nowrap' }}>
                          {`${cur} / ${max} veh`}
                        </span>
                        <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                          {`${Math.round((cur / (max || 1)) * 100)}% active`}
                        </span>
                      </div>
                    ) : cur > 0 ? (
                      <span style={{ fontWeight: 600, color: '#ffd54f', whiteSpace: 'nowrap' }}>
                        {`${cur} veh`}
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11rem' }}>—</span>
                    )}
                  </div>
                );
              }
              case 'service':
                return (
                  <div key="service" className="col-service" style={getColStyle('service')}>
                    <ServiceIcon service={item.subCategory} sizeRem={20} showLabel={true} />
                  </div>
                );
              case 'serviceUsage':
                return (
                  <div key="serviceUsage" className="col-service-usage" style={getColStyle('serviceUsage')}>
                    {item.subCategory === 'Parking' && (item.parkingCapacity ?? 0) > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#eceff1', whiteSpace: 'nowrap' }}>
                          {`${formatNumber(item.parkedVehicles ?? 0)} / ${formatNumber(item.parkingCapacity ?? 0)} cars`}
                        </span>
                        <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                          {`${Math.min(100, Math.round(((item.parkedVehicles ?? 0) / (item.parkingCapacity || 1)) * 100))}% parked`}
                        </span>
                      </div>
                    ) : (item.serviceCapacity ?? 0) > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#eceff1', whiteSpace: 'nowrap' }}>
                          {`${formatNumber(Math.round(item.serviceUsage ?? 0))} / ${formatNumber(Math.round(item.serviceCapacity ?? 0))}${item.serviceUnit ? ` ${item.serviceUnit}` : ''}`}
                        </span>
                        <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                          {item.subCategory === 'Parks & Recreation' && item.parkMaintenance !== undefined && item.parkMaintenance >= 0
                            ? `Maintenance: ${item.parkMaintenance}%`
                            : `${Math.min(100, Math.round(((item.serviceUsage ?? 0) / (item.serviceCapacity || 1)) * 100))}% capacity`}
                        </span>
                      </div>
                    ) : (item.vehiclesMax ?? 0) > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#ffd54f', whiteSpace: 'nowrap' }}>
                          {`${item.vehicles ?? 0} / ${item.vehiclesMax} veh`}
                        </span>
                        <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                          {`${Math.round(((item.vehicles ?? 0) / (item.vehiclesMax || 1)) * 100)}% active fleet`}
                        </span>
                      </div>
                    ) : (item.parkingCapacity ?? 0) > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#eceff1', whiteSpace: 'nowrap' }}>
                          {`${formatNumber(item.parkedVehicles ?? 0)} / ${formatNumber(item.parkingCapacity ?? 0)} cars`}
                        </span>
                        <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                          {`${Math.min(100, Math.round(((item.parkedVehicles ?? 0) / (item.parkingCapacity || 1)) * 100))}% parked`}
                        </span>
                      </div>
                    ) : item.subCategory === 'Parks & Recreation' && item.parkMaintenance !== undefined && item.parkMaintenance >= 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#8bdb46', whiteSpace: 'nowrap' }}>
                          {`Maint: ${item.parkMaintenance}%`}
                        </span>
                        <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                          {item.recreation ? `+${item.recreation} ${item.leisureType || 'Rec'}` : 'Park Condition'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11rem' }}>—</span>
                    )}
                  </div>
                );
              case 'cat': {
                const catVis = getCategoryVisual(item.category, item.subCategory);
                return (
                  <div key="cat" className="col-cat" style={getColStyle('cat')}>
                    <span
                      className="bam-cat-pill"
                      style={{
                        color: catVis.color,
                        background: catVis.bg,
                        borderColor: catVis.border,
                      }}
                    >
                      {item.category === 'Service' ? (
                        <span style={{ display: 'flex', alignItems: 'center', marginRight: '4rem', flexShrink: 0 }}>
                          <ServiceIcon service={item.subCategory} sizeRem={15} />
                        </span>
                      ) : (
                        <img
                          src={catVis.iconPath}
                          alt=""
                          style={{
                            width: '13rem',
                            height: '13rem',
                            objectFit: 'contain',
                            marginRight: '4rem',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span>{item.subCategory || item.category}</span>
                    </span>
                    {item.isSignature && <span className="bam-sig-badge">SIG</span>}
                    {!item.isPlaced && <span className="bam-catalog-badge">CAT</span>}
                  </div>
                );
              }
              case 'resource':
                const inputResList = Array.isArray(item.inputResources) ? item.inputResources.filter(Boolean) : [];
                const outputResList = Array.isArray(item.outputResources) ? item.outputResources.filter(Boolean) : [];
                return (
                  <div
                    key="resource"
                    className="col-resource"
                    style={getColStyle('resource')}
                    title={[
                      ...inputResList.map((r) => `In: ${formatResourceLabel(r)}`),
                      ...outputResList.map((r) => `${item.category === 'Storage' ? (item.isPlaced ? 'Stores' : 'Eligible') : 'Out'}: ${formatResourceLabel(r)}`),
                      item.resource ? `Resource: ${formatResourceLabel(item.resource)}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  >
                    {outputResList.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        {outputResList.slice(0, 3).map((res) => (
                          <span key={res} style={{ display: 'flex', marginRight: '4rem' }}>
                            <ResourceIcon resource={res} sizeRem={20} />
                          </span>
                        ))}
                        {outputResList.length > 3 && (
                          <span className="bam-pill-badge" style={{ fontSize: '10rem', padding: '1rem 3rem' }}>
                            +{outputResList.length - 3}
                          </span>
                        )}
                      </div>
                    ) : inputResList.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        {inputResList.slice(0, 3).map((res) => (
                          <span key={res} style={{ display: 'flex', marginRight: '4rem' }}>
                            <ResourceIcon key={res} resource={res} sizeRem={20} />
                          </span>
                        ))}
                        {inputResList.length > 3 && (
                          <span className="bam-pill-badge" style={{ fontSize: '10rem', padding: '1rem 3rem' }}>
                            +{inputResList.length - 3}
                          </span>
                        )}
                      </div>
                    ) : item.resource ? (
                      <ResourceIcon resource={item.resource} sizeRem={20} />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                );
              case 'storage': {
                const amt = item.storageAmount ?? 0;
                const cap = item.storageCapacity ?? 0;
                const pct = cap > 0 ? Math.min(100, Math.round((amt / cap) * 100)) : 0;
                return (
                  <div key="storage" className="col-storage" style={getColStyle('storage')}>
                    {cap > 0 || amt > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, color: '#ffb74d', whiteSpace: 'nowrap' }}>
                          {formatStoragePair(amt, cap)}
                        </span>
                        {cap > 0 && (
                          <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                            {`${pct}% full`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11rem' }}>—</span>
                    )}
                  </div>
                );
              }
              case 'profit':
                return (
                  <div key="profit" className="col-profit" style={getColStyle('profit')}>
                    {item.profitMargin !== undefined && item.profitMargin !== null && Boolean(item.company || item.profitabilityTier) ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                          <span
                            className="bam-profit-val"
                            style={{
                              marginRight: '4rem',
                              color:
                                item.profitMargin > 0
                                  ? '#8bdb46'
                                  : item.profitMargin < 0
                                  ? '#e05050'
                                  : 'rgba(255,255,255,0.7)',
                            }}
                          >
                            {item.profitMargin > 0 ? `+${item.profitMargin}%` : `${item.profitMargin}%`}
                          </span>
                          {item.taxRate !== undefined && item.taxRate > 0 && (
                            <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.5)', marginLeft: '4rem' }}>
                              ({item.taxRate}% tax)
                            </span>
                          )}
                        </div>
                        {item.profitabilityTier && (() => {
                          const tierInfo = formatProfitabilityTier(item.profitabilityTier);
                          return (
                            <span className={`bam-tier-badge bam-tier-${tierInfo.cssSlug}`} style={{ marginTop: '2rem' }}>
                              {tierInfo.label}
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11rem' }}>—</span>
                    )}
                  </div>
                );
              case 'themePack':
                return (
                  <div key="themePack" className="col-theme-pack" style={getColStyle('themePack')}>
                    {item.theme && item.theme !== 'Unknown' && (
                      <ThemeIcon theme={item.theme} themeIcon={item.themeIcon} sizeRem={20} />
                    )}
                    <PackIcon pack={item.assetPack || 'Base Game'} packIcon={item.assetPackIcon} sizeRem={20} />
                  </div>
                );
              case 'district':
                return (
                  <div key="district" className="col-dist" style={getColStyle('district')}>
                    <span>{item.district || '—'}</span>
                  </div>
                );
              case 'density':
                return (
                  <div key="density" className="col-density" style={getColStyle('density')}>
                    {item.density ? (
                      <span
                        className="bam-density-badge"
                        style={{
                          color: densityColor,
                          borderColor: `${densityColor}66`,
                          background: `${densityColor}18`,
                        }}
                      >
                        {item.density}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                );
              case 'level':
                return (
                  <div key="level" className="col-lvl" style={getColStyle('level')}>
                    <span>{item.level > 0 ? `L${item.level}` : '—'}</span>
                  </div>
                );
              case 'occupied':
                return (
                  <div key="occupied" className="col-occ" style={getColStyle('occupied')}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span>
                        {`${item.capacity > 0 ? `${formatNumber(item.occupied)} / ${formatNumber(item.capacity)}` : formatNumber(item.occupied)}${categoryFilter === 'Residential' ? ' HH' : ''}`}
                      </span>
                      {categoryFilter === 'Residential' && (item.residents ?? 0) > 0 && (
                        <span style={{ fontSize: '10rem', color: 'rgba(80, 184, 233, 0.85)', whiteSpace: 'nowrap', marginTop: '2rem' }}>
                          {formatNumber(item.residents ?? 0)} res.
                        </span>
                      )}
                      {categoryFilter !== 'Residential' && categoryFilter !== 'Catalog' && happyVal >= 0 && (
                        <span
                          style={{ fontSize: '10rem', color: happyColor, whiteSpace: 'nowrap', marginTop: '2rem' }}
                          title={
                            Array.isArray(item.happinessFactors) && item.happinessFactors.length > 0
                              ? `Worker Happiness Factors (${happyVal}%):\n` +
                                item.happinessFactors
                                  .filter(Boolean)
                                  .map((hf) => `- ${getFactorDisplayLabel(hf.factor, hf.percentage)}: ${hf.percentage >= 0 ? '+' : ''}${hf.percentage}`)
                                  .join('\n')
                              : 'Average happiness of employees'
                          }
                        >
                          {happyVal}% happy
                        </span>
                      )}
                    </div>
                  </div>
                );
              case 'happiness':
                return (
                  <div key="happiness" className="col-happy" style={getColStyle('happiness')}>
                    {happyVal >= 0 ? (
                      <span
                        style={{ color: happyColor }}
                        title={
                          Array.isArray(item.happinessFactors) && item.happinessFactors.length > 0
                            ? `Resident Happiness Factors (${happyVal}%):\n` +
                              item.happinessFactors
                                .filter(Boolean)
                                .map((hf) => `- ${getFactorDisplayLabel(hf.factor, hf.percentage)}: ${hf.percentage >= 0 ? '+' : ''}${hf.percentage}`)
                                .join('\n')
                            : 'Resident happiness'
                        }
                      >
                        {happyVal}%
                      </span>
                    ) : (
                      <span style={{ color: '#78909c' }}>—</span>
                    )}
                  </div>
                );
              case 'efficiency':
                return (
                  <div key="efficiency" className="col-eff" style={getColStyle('efficiency')}>
                    {item.efficiency >= 0 ? (
                      <span className={`bam-eff-tag ${effClass}`}>{item.efficiency}%</span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                );
              case 'maintenance':
                return (
                  <div key="maintenance" className="col-maint" style={getColStyle('maintenance')}>
                    {item.category === 'Service' || (item.maintenanceCost ?? 0) > 0 || (item.parkMaintenance !== undefined && item.parkMaintenance >= 0) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        {(item.maintenanceCost ?? 0) > 0 ? (
                          <span style={{ fontWeight: 600, color: '#ef5350', whiteSpace: 'nowrap', fontSize: '11rem' }}>
                            {formatCurrency(item.maintenanceCost ?? 0, '/mo')}
                          </span>
                        ) : item.category === 'Service' ? (
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11rem', whiteSpace: 'nowrap' }}>
                            ¢0/mo
                          </span>
                        ) : null}
                        {item.parkMaintenance !== undefined && item.parkMaintenance >= 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', marginTop: '2rem' }}>
                            <span
                              style={{
                                fontSize: '10rem',
                                fontWeight: 600,
                                color: item.parkMaintenance >= 80 ? '#81c784' : item.parkMaintenance >= 50 ? '#ffd54f' : '#ef5350',
                                whiteSpace: 'nowrap',
                                marginRight: '4rem',
                              }}
                            >
                              {`${item.parkMaintenance}%`}
                            </span>
                            <div style={{ width: '36rem', height: '4rem', background: 'rgba(255,255,255,0.15)', borderRadius: '2rem', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, Math.max(0, item.parkMaintenance))}%`,
                                  height: '100%',
                                  background: item.parkMaintenance >= 80 ? '#81c784' : item.parkMaintenance >= 50 ? '#ffd54f' : '#ef5350'
                                }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11rem' }}>—</span>
                    )}
                  </div>
                );
              case 'status': {
                return (
                  <div key="status" className="col-status" style={getColStyle('status')}>
                    {isRowDamaged ? (
                      <span className="bam-status-pill warning" style={{ background: 'rgba(255, 167, 38, 0.2)', borderColor: '#ffa726', color: '#ffa726' }}>
                        {dmgStr ? `Damaged ${dmgStr}` : item.hasBrokenPath ? 'Broken Path' : 'Damaged'}
                      </span>
                    ) : item.efficiency === 0 ? (
                      <span className="bam-status-pill halted" style={{ background: 'rgba(144, 164, 174, 0.2)', borderColor: '#90a4ae', color: '#b0bec5' }}>
                        Inactive
                      </span>
                    ) : (
                      <span className="bam-status-pill healthy">
                        <UilIcon name="Checkmark" sizeRem={10} style={{ marginRight: '3rem' }} />
                        {statusHealthy}
                      </span>
                    )}
                  </div>
                );
              }
              case 'actions':
                return (
                  <div key="actions" className="col-act bam-row-actions" style={getColStyle('actions')}>
                    {item.isPlaced ? (
                      <>
                        {item.companyEntityKey ? (
                          <div className="bam-locate-dual-group">
                            <button
                              className="bam-action-btn co"
                              onClick={(e) => {
                                e.stopPropagation();
                                focusEntity(item.companyEntityKey!);
                              }}
                              title="Focus camera and inspect tenant Company"
                            >
                              CO
                            </button>
                            <button
                              className="bam-action-btn bld"
                              onClick={(e) => {
                                e.stopPropagation();
                                focusEntity(item.entityKey);
                              }}
                              title="Focus camera and inspect physical Building"
                            >
                              BLD
                            </button>
                          </div>
                        ) : (
                          <button
                            className="bam-action-btn bld"
                            onClick={(e) => {
                              e.stopPropagation();
                              focusEntity(item.entityKey);
                            }}
                            title="Focus camera and inspect physical Building"
                          >
                            BLD
                          </button>
                        )}
                        {(item.needsRepair || item.isDamaged) && (
                          <button
                            className="bam-action-btn repair"
                            onClick={(e) => {
                              e.stopPropagation();
                              rebuildBuilding(item.entityKey);
                            }}
                            title="Repair damage, extinguish fire/flood, and clear abandonment"
                          >
                            <UilIcon name="Tools" sizeRem={10} style={{ marginRight: '3rem' }} />
                            {actRepair}
                          </button>
                        )}
                        {(item.hasBrokenPath || showTools) && (
                          <button
                            className="bam-action-btn repair"
                            style={{
                              borderColor: item.hasBrokenPath ? '#4dd0e1' : 'rgba(77, 208, 225, 0.45)',
                              color: '#4dd0e1',
                              background: item.hasBrokenPath ? 'rgba(77, 208, 225, 0.2)' : 'rgba(77, 208, 225, 0.1)',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              rebuildBuilding(`path:${item.entityKey}`);
                            }}
                            title="Fix broken path & road/pedestrian access via automated in-place Move/Relocate (preserves exact road side & rotation)"
                          >
                            <UilIcon name="Refresh" sizeRem={10} style={{ marginRight: '3rem', color: '#4dd0e1' }} />
                            Path
                          </button>
                        )}
                        {showTools && (
                          <button
                            className="bam-action-btn clone"
                            onClick={(e) => {
                              e.stopPropagation();
                              cloneBuilding(item.entityKey);
                            }}
                            title="Clone and place duplicate"
                          >
                            <UilIcon name="Copy" sizeRem={10} style={{ marginRight: '3rem' }} />
                            {actClone}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className="bam-action-btn plop"
                        onClick={(e) => {
                          e.stopPropagation();
                          plopPrefab(item.prefabKey);
                        }}
                        title="Activate placement tool"
                      >
                        <UilIcon name="Tools" sizeRem={11} style={{ marginRight: '3rem' }} />
                        {actPlop}
                      </button>
                    )}
                  </div>
                );
              default:
                return null;
            }
          })}

      </div>

      {/* Expanded Row Details Panel */}
      {isRowExpanded && (
        <InspectorDrawer
          item={item}
          densityColor={densityColor}
          happyVal={happyVal}
          happyColor={happyColor}
          hasUpgrades={hasUpgrades}
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
          isUpgradesOpen={isUpgradesOpen}
          toggleUpgrades={toggleUpgrades}
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
      )}

      {/* Sub-buildings / Upgrades Drawer (only if row is NOT expanded) */}
      {hasUpgrades && !isRowExpanded && isUpgradesOpen && (
        <div className="bam-upgrades-drawer">
          {item.subBuildings!.map((sub) => (
            <SubBuildingUpgradeCard
              key={sub.entityKey || sub.prefabName || sub.name}
              sub={sub}
              isExpanded={!!expandedSubBuildings[sub.entityKey]}
              onToggleExpand={toggleSubBuildingExpand}
              onFocusEntity={focusEntity}
              onRebuildEntity={rebuildBuilding}
              translate={translate}
            />
          ))}
        </div>
      )}
    </React.Fragment>
  );
};

export default TableBodyRow;
