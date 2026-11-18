import React, { useState } from 'react';
import bamStorage from '../../utils/bamStorage';
import { Scrollable } from 'cs2/ui';
import { SubBuildingItem, UnifiedAssetItem } from '../../models/assetModels';
import { logCatch } from '../../utils/devWarn';
import UilIcon from '../common/UilIcon';
import ThemeIcon from '../common/ThemeIcon';
import PackIcon from '../common/PackIcon';
import EntityIdBadge from '../common/EntityIdBadge';
import ResourceIcon from '../common/ResourceIcon';
import ServiceIcon from '../common/ServiceIcon';
import { getCategoryVisual, getEfficiencyFactorIcon, getFactorDisplayLabel, getProfitabilityTierColor } from '../../utils/iconLibrary';
import {
  formatCurrency,
  formatDensityLabel,
  formatEffectString,
  formatLeisureType,
  formatNumber,
  formatProfitabilityTier,
  formatResourceLabel,
  formatStoragePair,
  formatStorageWeight,
  pluralize,
} from '../../utils/formatters';

const ResourceChip: React.FC<{
  name: string;
  type: 'in' | 'out' | 'stored';
}> = ({ name, type }) => {
  const badgeColor = type === 'in' ? '#38bdf8' : type === 'out' ? '#4ade80' : '#fbbf24';
  const badgeBg =
    type === 'in'
      ? 'rgba(56, 189, 248, 0.15)'
      : type === 'out'
      ? 'rgba(74, 222, 128, 0.15)'
      : 'rgba(251, 191, 36, 0.15)';
  const border =
    type === 'in'
      ? '1rem solid rgba(56, 189, 248, 0.4)'
      : type === 'out'
      ? '1rem solid rgba(74, 222, 128, 0.4)'
      : '1rem solid rgba(251, 191, 36, 0.4)';

  const displayRes = formatResourceLabel(name);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '2rem 6rem',
        borderRadius: '4rem',
        background: badgeBg,
        border,
        color: badgeColor,
        fontSize: '11rem',
        fontWeight: 600,
        margin: '2rem',
        whiteSpace: 'nowrap',
      }}
      title={`${type.toUpperCase()}: ${displayRes}`}
    >
      <ResourceIcon resource={name} sizeRem={18} />
      <span style={{ marginLeft: '4rem' }}>{displayRes}</span>
    </div>
  );
};

const getEffectIcon = (text: string): string => {
  const t = text.toLowerCase();
  if (t.includes('well-being') || t.includes('wellbeing')) return 'Media/Game/Icons/Wellbeing.svg';
  if (t.includes('attractiveness') || t.includes('tourism')) return 'Media/Game/Icons/Tourism.svg';
  if (t.includes('entertainment')) return 'Media/Game/Icons/Entertainment.svg';
  if (t.includes('meal')) return 'Media/Game/Icons/Meals.svg';
  if (t.includes('recreation') || t.includes('outdoor')) return 'Media/Game/Icons/ParksAndRecreation.svg';
  if (t.includes('relaxation')) return 'Media/Game/Icons/Relaxation.svg';
  if (t.includes('crime')) return 'Media/Game/Icons/Crime.svg';
  if (t.includes('health') || t.includes('medical') || t.includes('patient') || t.includes('ambulance')) return 'Media/Game/Icons/Healthcare.svg';
  if (t.includes('efficiency')) return 'Media/Game/Icons/Efficiency.svg';
  if (t.includes('student') || t.includes('education') || t.includes('graduation')) return 'Media/Game/Icons/Graduation.svg';
  if (t.includes('park')) return 'Media/Game/Icons/ParksAndRecreation.svg';
  if (t.includes('fire')) return 'Media/Game/Icons/FireSafety.svg';
  if (t.includes('police')) return 'Media/Game/Icons/Police.svg';
  if (t.includes('garbage') || t.includes('waste')) return 'Media/Game/Icons/Garbage.svg';
  if (t.includes('hearse') || t.includes('deathcare') || t.includes('cemetery')) return 'Media/Game/Icons/Deathcare.svg';
  if (t.includes('parked') || t.includes('parking') || t.includes('car') || t.includes('vehicle')) return 'Media/Game/Icons/Car.svg';
  if (t.includes('pollution')) return 'Media/Game/Icons/GroundPollution.svg';
  if (t.includes('noise')) return 'Media/Game/Icons/NoisePollution.svg';
  return 'Media/Game/Icons/Notifications.svg';
};

const formatModifierText = (raw: string, isCity = false): string => {
  if (!raw) return '';
  const cleaned = formatEffectString(raw);
  const m = cleaned.match(/^([A-Za-z\- ]+):\s*0%?\s*to\s*\+?([\d\.]+)(%?)(\s*\(([\d\.]+)m radius\))?/i);
  if (m) {
    let typeName = m[1].trim();
    if (typeName.toLowerCase() === 'wellbeing') typeName = 'Well-Being';
    const num = parseFloat(m[2]);
    const isPct = m[3] === '%';
    const radius = m[5];

    let valStr: string;
    if (isPct) {
      valStr = `+${Math.round(num > 1 ? num : num * 100)}%`;
    } else if (num < 1 && num > 0) {
      valStr = `+${Math.round(num * 100)}%`;
    } else {
      valStr = `+${Math.round(num)}`;
    }

    if (radius) {
      return `${valStr} ${typeName} within ${radius} m`;
    } else if (isCity) {
      return `${valStr} ${typeName} (city-wide)`;
    } else {
      return `${valStr} ${typeName}`;
    }
  }
  return cleaned;
};

export interface SubBuildingUpgradeCardProps {
  sub: SubBuildingItem;
  isExpanded: boolean;
  onToggleExpand: (key: string, e: React.MouseEvent) => void;
  onFocusEntity: (entityKey: string) => void;
  onRebuildEntity?: (entityKey: string) => void;
  translate: (key: string, fallback?: string) => string | null;
}

export const SubBuildingUpgradeCard: React.FC<SubBuildingUpgradeCardProps> = ({
  sub,
  isExpanded,
  onToggleExpand,
  onFocusEntity,
  onRebuildEntity,
  translate,
}) => {
  const prefab = sub.prefabName || sub.name;
  let locName = translate(`Assets.NAME[${prefab}]`);
  if (!locName || locName === `Assets.NAME[${prefab}]`) {
    locName = sub.name && !sub.name.includes('_Ext') && !sub.name.includes('_Sub') ? sub.name : (sub.prefabName || sub.name);
  }
  let locDesc = translate(`Assets.DESCRIPTION[${prefab}]`);
  if (!locDesc || locDesc === `Assets.DESCRIPTION[${prefab}]`) {
    locDesc = sub.description || '';
  }

  return (
    <div className="bam-upgrade-card" style={{ marginBottom: '4rem' }}>
      <div
        className="bam-upgrade-item"
        onClick={(e) => onToggleExpand(sub.entityKey, e)}
        style={{ cursor: 'pointer' }}
        title={isExpanded ? 'Click to collapse sub-building details' : 'Click to expand sub-building info'}
      >
        <div className="bam-upgrade-item-left" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 180rem', minWidth: 0, maxWidth: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', marginRight: '6rem' }}>
            <UilIcon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} sizeRem={10} style={{ color: '#90caf9' }} />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', marginRight: '6rem' }}>
            <EntityIdBadge
              entityKey={sub.entityKey}
              label="UPG "
              variant="upg"
              title="Upgrade Sub-Building - Click to Open in SceneExplorer"
            />
          </span>
          <span className="bam-upgrade-name" style={{ fontWeight: 600, color: '#f3f4f6', marginRight: '6rem', wordBreak: 'break-word' }}>{locName}</span>
          {sub.prefabName && sub.prefabName !== locName && (
            <span style={{ fontSize: '9rem', color: '#9ca3af', fontFamily: 'monospace', marginRight: '6rem', wordBreak: 'break-word', maxWidth: '100%' }}>
              {sub.prefabName}
            </span>
          )}
          <span className="bam-upgrade-type" style={{ marginRight: '6rem' }}>{sub.type}</span>
          {Boolean(sub.upkeep && sub.upkeep > 0) && (
            <span className="bam-upgrade-benefit" style={{ color: '#ffb74d', marginRight: '6rem' }}>
              {formatCurrency(sub.upkeep, '/mo')}
            </span>
          )}
          {sub.isDestroyed && (
            <span className="bam-status-pill error" style={{ padding: '1rem 4rem', fontSize: '8rem', marginRight: '6rem' }}>
              {`Destroyed${(sub.damagePercent ?? 0) > 0 ? ` (${Math.round(sub.damagePercent!)}%)` : ''}`}
            </span>
          )}
          {sub.isDamaged && !sub.isDestroyed && (
            <span className="bam-status-pill warn" style={{ padding: '1rem 4rem', fontSize: '8rem', marginRight: '6rem' }}>
              {`Damaged${(sub.damagePercent ?? 0) > 0 ? ` · ${sub.damagePercent! % 1 === 0 ? Math.round(sub.damagePercent!) : sub.damagePercent!.toFixed(1)}%` : ''}`}
            </span>
          )}
          {sub.benefit && (
            <span className="bam-upgrade-benefit" style={{ display: 'flex', alignItems: 'center', maxWidth: '100%', wordBreak: 'break-word' }}>
              <img src={getEffectIcon(sub.benefit)} style={{ width: '11rem', height: '11rem', marginRight: '4rem', flexShrink: 0 }} alt="" />
              <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{formatEffectString(sub.benefit)}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0, marginLeft: 'auto', marginTop: '2rem', marginBottom: '2rem' }}>
          {(sub.isDamaged || sub.isDestroyed) && onRebuildEntity && sub.entityKey && (
            <button
              className="bam-action-btn repair"
              style={{ padding: '2rem 6rem', fontSize: '9rem', marginRight: '4rem' }}
              onClick={(e) => {
                e.stopPropagation();
                onRebuildEntity(sub.entityKey);
              }}
              title="Repair damaged or destroyed sub-building"
            >
              <UilIcon name="Tools" sizeRem={9} style={{ marginRight: '2rem' }} />
              Repair
            </button>
          )}
          <button
            className="bam-action-btn go"
            style={{ padding: '2rem 6rem', fontSize: '9rem' }}
            onClick={(e) => {
              e.stopPropagation();
              onFocusEntity(sub.entityKey);
            }}
            title="Focus camera on this upgrade sub-building"
          >
            <UilIcon name="Location" sizeRem={9} style={{ marginRight: '2rem' }} />
            Inspect Sub-building
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '6rem 12rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '0 0 4rem 4rem',
            borderLeft: '2rem solid #60a5fa',
            margin: '0 0 4rem 0',
            display: 'flex',
            flexDirection: 'column',
            fontSize: '11rem',
          }}
        >
          {locDesc && (
            <div style={{ color: '#d1d5db', fontStyle: 'italic', lineHeight: 1.3, marginBottom: '4rem' }}>
              {locDesc}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: '2rem' }}>
            {Boolean(sub.upkeep && sub.upkeep > 0) && (
              <div style={{ marginRight: '12rem', marginBottom: '4rem' }}>
                <span style={{ color: '#9ca3af' }}>Monthly Upkeep: </span>
                <span style={{ color: '#ffb74d', fontWeight: 600 }}>{formatCurrency(sub.upkeep, '/mo')}</span>
              </div>
            )}
            {Boolean(sub.cost && sub.cost > 0) && (
              <div style={{ marginRight: '12rem', marginBottom: '4rem' }}>
                <span style={{ color: '#9ca3af' }}>Construction Cost: </span>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>{formatCurrency(sub.cost)}</span>
              </div>
            )}
            {Boolean(sub.workers && sub.workers > 0) && (
              <div style={{ marginRight: '12rem', marginBottom: '4rem' }}>
                <span style={{ color: '#9ca3af' }}>Workers: </span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{formatNumber(sub.workers!)}</span>
              </div>
            )}
            {sub.benefit && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginRight: '12rem', marginBottom: '4rem' }}>
                <span style={{ color: '#9ca3af', marginRight: '6rem' }}>Capacity / Benefits: </span>
                {sub.benefit.split(', ').map((rawB, bIdx) => {
                  const b = formatModifierText(rawB, false);
                  const icon = getEffectIcon(b);
                  return (
                    <span key={`benefit-${sub.entityKey || sub.name || 'sub'}-${rawB}-${bIdx}`} style={{ display: 'flex', alignItems: 'center', marginRight: '6rem', marginBottom: '2rem', color: '#ffd54f', fontWeight: 600, background: 'rgba(255, 213, 79, 0.1)', padding: '1rem 5rem', borderRadius: '3rem' }}>
                      {icon && <img src={icon} style={{ width: '11rem', height: '11rem', marginRight: '3rem' }} alt="" />}
                      <span>{b}</span>
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ marginBottom: '4rem' }}>
              <span style={{ color: '#9ca3af' }}>Sub-Building Entity: </span>
              <span style={{ color: '#e5e7eb', fontFamily: 'monospace' }}>{sub.entityKey}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export interface InspectorDrawerProps {
  item: UnifiedAssetItem;
  densityColor: string;
  happyVal: number;
  happyColor: string;
  hasUpgrades: boolean;
  buildingCardOrder: string[];
  hiddenBuildingCards: Set<string>;
  collapsedBldCards: Set<string>;
  setCollapsedBldCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  buildingDraggedCardId: string | null;
  buildingDragOverCardId: string | null;
  buildingCardsContainerRef: React.RefObject<HTMLDivElement>;
  handleBuildingCardMouseDown: (e: React.MouseEvent, cardId: string) => void;
  moveBuildingCard: (cardId: string, dir: -1 | 1) => void;
  resetBuildingCardLayout: () => void;
  toggleBldCardCollapse: (cardId: string, e?: React.MouseEvent) => void;
  bldEffFilter: 'all' | 'pos' | 'neg';
  setBldEffFilter: React.Dispatch<React.SetStateAction<'all' | 'pos' | 'neg'>>;
  bldEffLimit: number;
  setBldEffLimit: React.Dispatch<React.SetStateAction<number>>;
  bldHappyFilter: 'all' | 'pos' | 'neg';
  setBldHappyFilter: React.Dispatch<React.SetStateAction<'all' | 'pos' | 'neg'>>;
  bldHappyLimit: number;
  setBldHappyLimit: React.Dispatch<React.SetStateAction<number>>;
  upgradeDisplayMode: 'both' | 'card' | 'rows';
  setUpgradeDisplayMode: React.Dispatch<React.SetStateAction<'both' | 'card' | 'rows'>>;
  isUpgradesOpen: boolean;
  toggleUpgrades: (id: string, e: React.MouseEvent) => void;
  expandedSubBuildings: Record<string, boolean>;
  toggleSubBuildingExpand: (key: string, e: React.MouseEvent) => void;
  focusEntity: (entityKey: string) => void;
  cloneBuilding: (entityKey: string) => void;
  rebuildBuilding: (entityKey: string) => void;
  renameAsset: (entityKey: string, newName: string) => void;
  plopPrefab: (prefabKey: string) => void;
  showTools: boolean;
  translate: (key: string, fallback?: string) => string | null;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  item,
  densityColor,
  happyVal,
  happyColor,
  hasUpgrades,
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
  isUpgradesOpen,
  toggleUpgrades,
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const commitRename = () => {
    setIsRenaming(false);
    const trimmed = renameDraft.trim();
    if (item.entityKey && trimmed !== '' && trimmed !== item.name) {
      renameAsset(item.entityKey, trimmed);
    }
  };
  const renderSubBuildingItem = (sub: SubBuildingItem) => (
    <SubBuildingUpgradeCard
      key={sub.entityKey || sub.prefabName || sub.name}
      sub={sub}
      isExpanded={!!expandedSubBuildings[sub.entityKey]}
      onToggleExpand={toggleSubBuildingExpand}
      onFocusEntity={focusEntity}
      onRebuildEntity={rebuildBuilding}
      translate={translate}
    />
  );

  return (
    <div className="bam-row-expanded-panel">
            {/* Modular Building Detail Cards with Reordering */}
            {(() => {
              const renderBldCardHeader = (cardId: string, title: string, badge?: React.ReactNode, icon?: string) => {
                const safeCardOrder = Array.isArray(buildingCardOrder) ? buildingCardOrder : [];
                const visibleCards = safeCardOrder.filter((c) => !hiddenBuildingCards.has(c));
                const idx = visibleCards.indexOf(cardId);
                const canMoveLeft = idx > 0;
                const canMoveRight = idx >= 0 && idx < visibleCards.length - 1;
                const isCardCollapsed = collapsedBldCards.has(cardId);

                return (
                  <div
                    className="bam-dash-card-header"
                    onMouseDown={(e) => handleBuildingCardMouseDown(e, cardId)}
                    onDoubleClick={(e) => toggleBldCardCollapse(cardId, e)}
                    title="Drag header to reorder card (Double-click or chevron to collapse/expand)"
                    style={{ cursor: 'grab' }}
                  >
                    <div className="bam-dash-card-title-group" style={{ display: 'flex', alignItems: 'center', color: '#38bdf8' }}>
                      <button
                        type="button"
                        className="bam-card-collapse-btn"
                        onClick={(e) => toggleBldCardCollapse(cardId, e)}
                        onDoubleClick={(e) => e.stopPropagation()}
                        title={isCardCollapsed ? 'Expand card' : 'Collapse card'}
                      >
                        <UilIcon name={isCardCollapsed ? 'ChevronRight' : 'ChevronDown'} sizeRem={10} style={{ color: '#90caf9' }} />
                      </button>
                      {icon && <UilIcon name={icon as any} sizeRem={13} style={{ color: '#38bdf8' }} />}
                      <span className="bam-dash-card-title" title={title}>{title}</span>
                    </div>
                    <div className="bam-dash-card-header-actions" style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                      {badge}
                      <div className="bam-card-reorder-group">
                        <button
                          className={`bam-card-reorder-btn ${!canMoveLeft ? 'disabled' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canMoveLeft) return;
                            moveBuildingCard(cardId, -1);
                          }}
                          title="Move card left"
                        >
                          <UilIcon name="ArrowLeft" sizeRem={9} style={{ color: '#81d4fa' }} />
                        </button>
                        <button
                          className={`bam-card-reorder-btn ${!canMoveRight ? 'disabled' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canMoveRight) return;
                            moveBuildingCard(cardId, 1);
                          }}
                          title="Move card right"
                        >
                          <UilIcon name="ArrowRight" sizeRem={9} style={{ color: '#81d4fa' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              };

              const bldCardRenderers: Record<string, () => React.ReactNode> = {
                identity: () => (
                  <div
                    key="identity"
                    data-card-id="identity"
                    className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('identity') ? 'collapsed' : ''} ${buildingDraggedCardId === 'identity' ? 'dragging' : ''} ${
                      buildingDragOverCardId === 'identity' ? 'drag-over' : ''
                    }`}
                  >
                    {renderBldCardHeader(
                      'identity',
                      'Identity & Location',
                      <span className="bam-dash-card-badge">{item.district || 'City-wide'}</span>,
                      'Location'
                    )}
                    {!collapsedBldCards.has('identity') && (
                      <div className="bam-bld-card-body">
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">Entity Key</span>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            {item.companyEntityKey ? (
                              <>
                                <span style={{ display: 'flex', marginRight: '6rem' }}>
                                  <EntityIdBadge
                                    entityKey={item.companyEntityKey}
                                    label="CO "
                                    variant="co"
                                    title="Company Entity - Click to Open in SceneExplorer"
                                  />
                                </span>
                                <EntityIdBadge
                                  entityKey={item.entityKey}
                                  label="BLD "
                                  variant="bld"
                                  title="Building Entity - Click to Open in SceneExplorer"
                                />
                              </>
                            ) : (
                              <EntityIdBadge
                                entityKey={item.entityKey || item.id}
                                label={item.isPlaced ? 'BLD ' : 'CAT '}
                                variant={item.isPlaced ? 'bld' : 'default'}
                                title={item.isPlaced ? 'Building Entity - Click to Open in SceneExplorer' : 'Prefab Catalog Asset'}
                              />
                            )}
                          </div>
                        </div>
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">{item.isPlaced ? 'Address / Label' : 'Asset Name'}</span>
                          <div className="bam-detail-value" style={{ display: 'flex', alignItems: 'center', fontWeight: 700, color: '#ffffff' }}>
                            {isRenaming ? (
                              <input
                                className="bam-asset-rename-input"
                                type="text"
                                value={renameDraft}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') commitRename();
                                  if (e.key === 'Escape') setIsRenaming(false);
                                }}
                              />
                            ) : (
                              <>
                                <span>{item.name}</span>
                                {item.isPlaced && item.entityKey && (
                                  <button
                                    type="button"
                                    className="bam-asset-rename-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenameDraft(item.name || '');
                                      setIsRenaming(true);
                                    }}
                                    title="Rename building"
                                  >
                                    <UilIcon name="Edit" sizeRem={10} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {item.roadName && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Road Access</span>
                            <span className="bam-detail-value" style={{ color: '#81c784', fontWeight: 600 }}>
                              {item.roadName}
                            </span>
                          </div>
                        )}
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">Prefab Asset</span>
                          <span className="bam-detail-value">{item.secondaryName || item.prefabName || '—'}</span>
                        </div>
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">District</span>
                          <span className="bam-detail-value">{item.district || 'City-wide'}</span>
                        </div>
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">Theme</span>
                          <span className="bam-detail-value" style={{ display: 'flex', alignItems: 'center' }}>
                            {item.theme && item.theme !== 'Unknown' ? (
                              <>
                                <ThemeIcon theme={item.theme} themeIcon={item.themeIcon} sizeRem={14} />
                                <span style={{ marginLeft: '4rem' }}>{item.theme}</span>
                              </>
                            ) : (
                              <span style={{ color: '#78909c' }}>
                                {item.assetPack && item.assetPack !== 'Base Game' ? item.assetPack : 'Standard / Neutral'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">Asset Pack / DLC</span>
                          <span className="bam-detail-value" style={{ display: 'flex', alignItems: 'center' }}>
                            <PackIcon pack={item.assetPack} packIcon={item.assetPackIcon} sizeRem={14} />
                            <span style={{ marginLeft: '4rem' }}>{item.assetPack || 'Base Game'}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ),

                zoning: () => (
                  <div
                    key="zoning"
                    data-card-id="zoning"
                    className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('zoning') ? 'collapsed' : ''} ${buildingDraggedCardId === 'zoning' ? 'dragging' : ''} ${
                      buildingDragOverCardId === 'zoning' ? 'drag-over' : ''
                    }`}
                  >
                    {renderBldCardHeader(
                      'zoning',
                      'Specs & Zoning',
                      (() => {
                        const cv = getCategoryVisual(item.category, item.subCategory);
                        return (
                          <span
                            className="bam-dash-card-badge"
                            style={{ color: cv.color, background: cv.bg, borderColor: cv.border }}
                          >
                            {item.category}
                          </span>
                        );
                      })(),
                      'Building'
                    )}
                    {!collapsedBldCards.has('zoning') && (
                      <div className="bam-bld-card-body">
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">Category</span>
                          <span
                            className="bam-detail-value"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              color: getCategoryVisual(item.category, item.subCategory).color,
                              fontWeight: 600,
                            }}
                          >
                            <img
                              src={getCategoryVisual(item.category, item.subCategory).iconPath}
                              alt=""
                              style={{ width: '12rem', height: '12rem', objectFit: 'contain', marginRight: '4rem' }}
                            />
                            <span>{item.category}{item.subCategory ? ` / ${item.subCategory}` : ''}</span>
                          </span>
                        </div>
                        {item.level > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Building Level</span>
                            <span className="bam-detail-value" style={{ fontWeight: 600 }}>Level {item.level}</span>
                          </div>
                        )}
                        {item.company && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Company / Brand</span>
                            <span className="bam-detail-value" style={{ color: '#38bdf8', fontWeight: 600 }}>
                              {item.company}
                            </span>
                          </div>
                        )}
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">Classification</span>
                          <span className="bam-detail-value">{item.isPlaced ? 'Standard Placed' : 'Catalog Asset'}</span>
                        </div>
                        {(item.constructionCost ?? 0) > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Construction Cost</span>
                            <span className="bam-detail-value" style={{ color: '#4ade80', fontWeight: 600 }}>
                              {formatCurrency(item.constructionCost)}
                            </span>
                          </div>
                        )}
                        {item.lotDimensions && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Lot Dimensions</span>
                            <span className="bam-detail-value" style={{ fontWeight: 600, color: '#fbc02d' }}>
                              {item.lotDimensions.replace('x', ' × ')}
                            </span>
                          </div>
                        )}
                        {item.roadLandValue !== undefined && item.roadLandValue > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Street Land Value</span>
                            <span className="bam-detail-value" style={{ color: '#66bb6a', fontWeight: 600 }}>
                              {formatCurrency(item.roadLandValue, ' / m²')}
                            </span>
                          </div>
                        )}
                        {Boolean(item.parkingCapacity) && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Parking Facility</span>
                            <span className="bam-detail-value" style={{ color: '#4dd0e1', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                              <UilIcon name="Car" sizeRem={12} style={{ color: '#4dd0e1', marginRight: '4rem' }} />
                              <span>{`${formatNumber(item.parkedVehicles ?? 0)} / ${formatNumber(item.parkingCapacity ?? 0)} spaces (${Math.round(((item.parkedVehicles ?? 0) / (item.parkingCapacity || 1)) * 100)}%)`}</span>
                            </span>
                          </div>
                        )}
                        {item.isHistorical && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Preservation</span>
                            <span className="bam-detail-value" style={{ color: '#ba68c8', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                              <UilIcon name="District" sizeRem={11} style={{ color: '#ba68c8', marginRight: '4rem' }} />
                              <span>Historical Preserved</span>
                            </span>
                          </div>
                        )}
                        {(() => {
                          const dmg = Math.max(0, Math.min(100, item.damagePercent ?? 0));
                          const hasDamage = dmg > 0 || Boolean(item.needsRepair || item.isDamaged);
                          const dmgText = dmg % 1 === 0 ? `${Math.round(dmg)}%` : `${dmg.toFixed(1)}%`;
                          return (
                            <>
                              <div className="bam-detail-item">
                                <span className="bam-detail-label">Structural State</span>
                                <span
                                  className="bam-detail-value"
                                  style={{
                                    color: hasDamage ? '#ef5350' : '#81c784',
                                    fontWeight: 600,
                                  }}
                                >
                                  {dmg > 0
                                    ? `Damaged (${dmgText})`
                                    : hasDamage
                                    ? 'Needs Repair / Damaged'
                                    : 'Operational / Sound'}
                                </span>
                              </div>
                              {dmg > 0 && (
                                <div className="bam-detail-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                                    <span className="bam-detail-label">Building Damage</span>
                                    <span
                                      className="bam-detail-value"
                                      style={{
                                        color: dmg >= 50 ? '#ef5350' : '#ffa726',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {dmgText}
                                    </span>
                                  </div>
                                  <div style={{ width: '100%', height: '5rem', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3rem', overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(2, dmg))}%`,
                                        height: '100%',
                                        background: dmg >= 50 ? '#ef5350' : '#ffa726',
                                        borderRadius: '3rem',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {item.isPlaced && item.category !== 'Residential' && (item.citizenPresence ?? 0) > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Activity / Foot Traffic</span>
                            <span className="bam-detail-value" style={{ color: '#38bdf8', fontWeight: 600 }}>
                              {Math.round(((item.citizenPresence ?? 0) / 255) * 100)}% ({item.citizenPresence ?? 0}/255)
                            </span>
                          </div>
                        )}
                        {item.isPlaced && item.level > 0 && !item.isSignature && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Level Progress</span>
                            <span className="bam-detail-value" style={{ color: '#ffd54f', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                              {item.level >= 5 ? (
                                <>
                                  <UilIcon name="Star" sizeRem={11} style={{ color: '#ffd54f', marginRight: '4rem' }} />
                                  <span>Max Level (5 / 5)</span>
                                </>
                              ) : (item.maxCondition ?? 0) > 0 && (item.maxCondition ?? 0) < 100000000 ? (
                                <span>
                                  {`${Math.max(-100, Math.min(100, Math.round(item.buildingCondition ?? 0)))}% to Level ${item.level + 1}`}
                                </span>
                              ) : (
                                <span>{`Progress to Level ${item.level + 1}`}</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ),

                operations: () => {
                  const title = item.category === 'Residential'
                    ? 'Household & Living Specs'
                    : item.category === 'Service'
                    ? 'Service Operations'
                    : item.category === 'Storage'
                    ? 'Storage & Cargo Inventory'
                    : 'Resources & Supply Chain';
                  const icon = item.category === 'Residential'
                    ? 'Happy'
                    : item.category === 'Service'
                    ? 'Shield'
                    : 'Layers';

                  const storedList = Array.isArray(item.storedResources) ? item.storedResources : [];

                  return (
                    <div
                      key="operations"
                      data-card-id="operations"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('operations') ? 'collapsed' : ''} ${buildingDraggedCardId === 'operations' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'operations' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader('operations', title, undefined, icon)}
                      {!collapsedBldCards.has('operations') && (
                        <div className="bam-bld-card-body">
                          {item.category === 'Residential' ? (
                            <>
                              <div className="bam-detail-item">
                                <span className="bam-detail-label">Housing Density:</span>
                                <span className="bam-detail-value" style={{ color: densityColor, fontWeight: 600 }}>
                                  {item.density ? formatDensityLabel(item.density) : 'Standard Residential'}
                                </span>
                              </div>
                              {(item.residents ?? 0) > 0 && (
                                <div className="bam-detail-item">
                                  <span className="bam-detail-label">Total Residents:</span>
                                  <span className="bam-detail-value" style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    {pluralize(item.residents ?? 0, 'citizen')}
                                  </span>
                                </div>
                              )}
                              {(item.rentPaid ?? 0) > 0 && (
                                <div className="bam-detail-item">
                                  <span className="bam-detail-label">Monthly Rent:</span>
                                  <span className="bam-detail-value">
                                    {formatCurrency(item.rentPaid, '/mo')}
                                  </span>
                                </div>
                              )}
                              {happyVal >= 0 && (
                                <div className="bam-detail-item">
                                  <span className="bam-detail-label">Resident Satisfaction:</span>
                                  <span className="bam-detail-value" style={{ color: happyColor, fontWeight: 700 }}>
                                    {happyVal}%
                                  </span>
                                </div>
                              )}
                              <div className="bam-detail-item">
                                <span className="bam-detail-label">Building Level:</span>
                                <span className="bam-detail-value">{item.level > 0 ? `Level ${item.level} of 5` : 'Level 1'}</span>
                              </div>
                              {/* Mixed-Use Dual Inspector Commercial Workforce */}
                              {(item.isMixedUse || Boolean(item.company)) && (
                                <div className="bam-mixed-tenant-card">
                                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4rem' }}>
                                    <UilIcon name="Building" sizeRem={12} style={{ color: '#38bdf8', marginRight: '4rem' }} />
                                    <span style={{ fontWeight: 700, fontSize: '11rem', color: '#38bdf8' }}>Commercial Ground Tenant</span>
                                  </div>
                                  <div className="bam-detail-item">
                                    <span className="bam-detail-label">Tenant Brand:</span>
                                    <span className="bam-detail-value" style={{ fontWeight: 600, color: '#ffffff' }}>
                                      {item.company || 'Commercial Retail Shop'}
                                    </span>
                                  </div>
                                  <div className="bam-detail-item">
                                    <span className="bam-detail-label">Commercial Workforce:</span>
                                    <span className="bam-detail-value">
                                      {formatNumber(item.commercialOccupied ?? 0)} / {formatNumber(item.commercialCapacity ?? 0)} workers
                                    </span>
                                  </div>
                                  {item.profitabilityTier && (
                                    <div className="bam-detail-item">
                                      <span className="bam-detail-label">Profitability:</span>
                                      <span className="bam-detail-value" style={{ color: getProfitabilityTierColor(item.profitabilityTier), fontWeight: 600 }}>
                                        {formatProfitabilityTier(item.profitabilityTier).label}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : item.category === 'Service' ? (
                            <>
                              <div className="bam-detail-item">
                                <span className="bam-detail-label">Service Type:</span>
                                <span className="bam-detail-value" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                  <ServiceIcon service={item.subCategory} sizeRem={16} />
                                  <span style={{ marginLeft: '4rem' }}>{item.subCategory || 'Municipal Service'}</span>
                                </span>
                              </div>
                              {(item.serviceCapacity ?? 0) > 0 && (
                                <div className="bam-detail-item">
                                  <span className="bam-detail-label">Capacity Limit:</span>
                                  <span className="bam-detail-value">
                                    {`${formatNumber(item.serviceUsage ?? 0)} / ${formatNumber(item.serviceCapacity ?? 0)}${item.serviceUnit ? ` ${item.serviceUnit}` : ' units'}`}
                                  </span>
                                </div>
                              )}
                              {(item.vehiclesMax ?? 0) > 0 && (
                                <div className="bam-detail-item">
                                  <span className="bam-detail-label">Assigned Fleet:</span>
                                  <span className="bam-detail-value" style={{ color: '#ffd54f', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                    <UilIcon name="Car" sizeRem={12} style={{ color: '#ffd54f', marginRight: '4rem' }} />
                                    <span>{`${item.vehicles ?? 0} / ${item.vehiclesMax} vehicles`}</span>
                                  </span>
                                </div>
                              )}
                              {(item.maintenanceCost ?? 0) > 0 && (
                                <div className="bam-detail-item">
                                  <span className="bam-detail-label">Operating Budget:</span>
                                  <span className="bam-detail-value" style={{ color: '#ef5350' }}>
                                    {formatCurrency(item.maintenanceCost, '/mo')}
                                  </span>
                                </div>
                              )}
                              {/* Public Transport & Cargo Hub Operations */}
                              {(item.isTransitHub || item.isCargoHub || (item.transitLines ?? 0) > 0 || (item.waitingPassengers ?? 0) > 0) && (
                                <div className="bam-transit-hub-card">
                                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4rem' }}>
                                    <UilIcon name="Car" sizeRem={12} style={{ color: '#ffb74d', marginRight: '4rem' }} />
                                    <span style={{ fontWeight: 700, fontSize: '11rem', color: '#ffb74d' }}>
                                      {item.isCargoHub ? 'Cargo Transport Hub Operations' : 'Public Transport Operations'}
                                    </span>
                                  </div>
                                  <div className="bam-detail-item">
                                    <span className="bam-detail-label">Connected Transit Lines:</span>
                                    <span className="bam-detail-value" style={{ color: '#81d4fa', fontWeight: 600 }}>
                                      {pluralize(item.transitLines ?? 0, 'active route')}
                                    </span>
                                  </div>
                                  <div className="bam-detail-item">
                                    <span className="bam-detail-label">{item.isCargoHub ? 'Cargo Stored:' : 'Waiting Passengers:'}</span>
                                    <span className="bam-detail-value" style={{ color: '#ffd54f', fontWeight: 700 }}>
                                      {formatNumber(item.waitingPassengers ?? item.serviceUsage ?? 0)} {item.serviceUnit || (item.isCargoHub ? 't Cargo' : 'passengers')}
                                    </span>
                                  </div>
                                  {(item.averageWaitTime ?? 0) > 0 && (
                                    <div className="bam-detail-item">
                                      <span className="bam-detail-label">Average Wait Time:</span>
                                      <span className="bam-detail-value">{item.averageWaitTime}s</span>
                                    </div>
                                  )}
                                  {(item.stationComfort ?? 0) > 0 && (
                                    <div className="bam-detail-item">
                                      <span className="bam-detail-label">Station Comfort:</span>
                                      <span className="bam-detail-value" style={{ color: '#81c784' }}>{item.stationComfort}%</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Inputs (factories/extractors; hidden for pure Storage warehouses) */}
                              {item.category !== 'Storage' && (
                                <div className="bam-detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                  <span className="bam-detail-label" style={{ marginBottom: '3rem' }}>Input Materials Consumed:</span>
                                  {Array.isArray(item.inputResources) && item.inputResources.length > 0 ? (
                                    <div className="bam-resource-chips-wrap">
                                      {item.inputResources.filter(Boolean).map((res) => (
                                        <ResourceChip key={res} name={res} type="in" />
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="bam-detail-value" style={{ color: '#78909c', fontSize: '10rem' }}>
                                      None (Primary Producer)
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Outputs / Handled Storage Goods */}
                              <div className="bam-detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: item.category === 'Storage' ? '0' : '4rem' }}>
                                <span className="bam-detail-label" style={{ marginBottom: '3rem' }}>
                                  {item.category === 'Storage'
                                    ? item.isPlaced
                                      ? 'Handled / Stored Resources:'
                                      : 'Eligible Storage Goods:'
                                    : 'Output Goods Produced / Sold:'}
                                </span>
                                {Array.isArray(item.outputResources) && item.outputResources.length > 0 ? (
                                  <div className="bam-resource-chips-wrap">
                                    {item.outputResources.filter(Boolean).map((res) => (
                                      <ResourceChip key={res} name={res} type="out" />
                                    ))}
                                  </div>
                                ) : item.resource ? (
                                  <div className="bam-resource-chips-wrap">
                                    <ResourceChip name={item.resource} type="out" />
                                  </div>
                                ) : (
                                  <span className="bam-detail-value" style={{ color: '#78909c', fontSize: '10rem' }}>
                                    {item.category === 'Storage' && item.isPlaced && !item.company
                                      ? 'Vacant Warehouse (Available for Rent)'
                                      : 'Standard Commercial / Service'}
                                  </span>
                                )}
                              </div>

                              {/* Physical Resource Storage */}
                              {((item.storageAmount ?? 0) > 0 || (item.storageCapacity ?? 0) > 0) && (
                                <div className="bam-detail-item" style={{ marginTop: '6rem' }}>
                                  <span className="bam-detail-label">Resource Storage:</span>
                                  <span className="bam-detail-value" style={{ color: '#ffd54f', fontWeight: 600 }}>
                                    {formatStoragePair(item.storageAmount, item.storageCapacity)}
                                  </span>
                                </div>
                              )}

                              {/* Stored Inventory Breakdown */}
                              {storedList.length > 0 && (() => {
                                const renderStoredRow = (sr: (typeof storedList)[number], srIdx: number) => (
                                  <div key={`${sr.name}-${srIdx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11rem', padding: '2rem 6rem', marginBottom: '3rem', background: 'rgba(255,255,255,0.03)', borderRadius: '3rem' }}>
                                    <span style={{ color: '#eceff1', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                      <ResourceIcon resource={sr.name} sizeRem={14} />
                                      <span style={{ marginLeft: '5rem' }}>{formatResourceLabel(sr.name)}</span>
                                    </span>
                                    <span style={{ color: '#ffd54f', fontWeight: 700 }}>
                                      {formatStorageWeight(sr.amount, sr.weight)}
                                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10rem', marginLeft: '4rem' }}>({sr.type})</span>
                                    </span>
                                  </div>
                                );
                                return (
                                  <div className="bam-detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: '6rem', width: '100%' }}>
                                    <span className="bam-detail-label" style={{ marginBottom: '4rem' }}>
                                      {`Stored Inventory Breakdown (${pluralize(storedList.length, 'item')}):`}
                                    </span>
                                    {storedList.length > 4 ? (
                                      <Scrollable vertical={true} trackVisibility="scrollable" className="bam-card-scroll-area" style={{ maxHeight: '160rem' }}>
                                        <div className="bam-resource-breakdown-list" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                          {storedList.map(renderStoredRow)}
                                        </div>
                                      </Scrollable>
                                    ) : (
                                      <div className="bam-resource-breakdown-list" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        {storedList.map(renderStoredRow)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },

                performance: () => (
                  <div
                    key="performance"
                    data-card-id="performance"
                    className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('performance') ? 'collapsed' : ''} ${buildingDraggedCardId === 'performance' ? 'dragging' : ''} ${
                      buildingDragOverCardId === 'performance' ? 'drag-over' : ''
                    }`}
                  >
                    {renderBldCardHeader(
                      'performance',
                      'Performance & Utilities',
                      <span className="bam-dash-card-badge">{item.efficiency >= 0 ? `${item.efficiency}% eff` : (item.isPlaced ? 'Active' : 'Prefab')}</span>,
                      'Thunder'
                    )}
                    {!collapsedBldCards.has('performance') && (
                      <div className="bam-bld-card-body">
                        <div className="bam-detail-item">
                          <span className="bam-detail-label">
                            {item.category === 'Residential'
                              ? (item.isPlaced ? 'Resident Households' : 'Expected Households')
                              : (item.isPlaced ? 'Workers / Staff' : 'Workforce Capacity')}
                          </span>
                          <span className="bam-detail-value" style={{ fontWeight: 700 }}>
                            {item.capacity > 0
                              ? `${formatNumber(item.occupied ?? 0)} / ${formatNumber(item.capacity ?? 0)} (${Math.round((item.occupied / item.capacity) * 100)}%)`
                              : item.isPlaced
                              ? `${formatNumber(item.occupied ?? 0)}`
                              : 'Zoned (Assigned upon move-in)'}
                          </span>
                        </div>
                        {!item.isPlaced && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Construction Cost</span>
                            <span className="bam-detail-value" style={{ color: (item.constructionCost ?? 0) > 0 ? '#81c784' : '#90a4ae', fontWeight: 600 }}>
                              {(item.constructionCost ?? 0) > 0 ? formatCurrency(item.constructionCost!) : 'Zoned (Private Developer)'}
                            </span>
                          </div>
                        )}
                        {!item.isPlaced && (item.electricityConsumption ?? 0) === 0 && (item.waterConsumption ?? 0) === 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Grid Utilities</span>
                            <span className="bam-detail-value" style={{ color: '#90a4ae', fontStyle: 'italic', fontSize: '11rem' }}>
                              Calculated dynamically upon plot construction
                            </span>
                          </div>
                        )}
                        {item.capacity > 0 && (
                          <div className="bam-detail-bar-wrap">
                            <div
                              className="bam-detail-bar-fill"
                              style={{
                                width: `${Math.min(100, Math.round((item.occupied / item.capacity) * 100))}%`,
                                background:
                                  item.occupied >= item.capacity
                                    ? '#81c784'
                                    : item.occupied > 0
                                    ? '#4fc3f7'
                                    : '#78909c',
                              }}
                            />
                          </div>
                        )}
                        {item.isPlaced && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Efficiency</span>
                            <span
                              className="bam-detail-value"
                              style={{
                                color:
                                  item.efficiency >= 85
                                    ? '#81c784'
                                    : item.efficiency >= 60
                                    ? '#4fc3f7'
                                    : item.efficiency >= 0
                                    ? '#ef5350'
                                    : '#90a4ae',
                                fontWeight: 700,
                              }}
                            >
                              {item.efficiency >= 0 ? `${item.efficiency}%` : 'N/A'}
                            </span>
                          </div>
                        )}
                        {item.category === 'Residential' && happyVal >= 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Resident Happiness</span>
                            <span className="bam-detail-value" style={{ color: happyColor, fontWeight: 700 }}>
                              {happyVal}%
                            </span>
                          </div>
                        )}
                        {(item.companyVehiclesMax ?? 0) > 0 ? (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Delivery Fleet</span>
                            <span className="bam-detail-value" style={{ color: '#ffd54f', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                              <UilIcon name="Car" sizeRem={12} style={{ color: '#ffd54f', marginRight: '4rem' }} />
                              <span>{`${item.companyVehicles ?? 0} / ${item.companyVehiclesMax} in use (${Math.round(((item.companyVehicles ?? 0) / (item.companyVehiclesMax || 1)) * 100)}%)`}</span>
                            </span>
                          </div>
                        ) : (item.vehiclesMax ?? 0) > 0 ? (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Active Service Fleet</span>
                            <span className="bam-detail-value" style={{ color: '#ffd54f', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                              <UilIcon name="Car" sizeRem={12} style={{ color: '#ffd54f', marginRight: '4rem' }} />
                              <span>{`${item.vehicles ?? 0} / ${item.vehiclesMax} vehicles`}</span>
                            </span>
                          </div>
                        ) : null}
                        {(item.electricityConsumption ?? 0) !== 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">
                              {(item.electricityConsumption ?? 0) < 0 ? 'Electricity Output' : 'Electricity Usage'}
                            </span>
                            <span
                              className="bam-detail-value"
                              style={{
                                color: (item.electricityConsumption ?? 0) < 0 ? '#66bb6a' : '#ffd54f',
                                fontWeight: 600,
                              }}
                            >
                              {(item.electricityConsumption ?? 0) < 0
                                ? `+${formatNumber(Math.abs(item.electricityConsumption!))} kW`
                                : `${formatNumber(item.electricityConsumption ?? 0)} kW`}
                            </span>
                          </div>
                        )}
                        {(item.waterConsumption ?? 0) > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Water &amp; Sewage</span>
                            <span className="bam-detail-value" style={{ color: '#4fc3f7', fontWeight: 600 }}>
                              {formatNumber(item.waterConsumption ?? 0)} m³/mo
                            </span>
                          </div>
                        )}
                        {(item.garbageAccumulation ?? 0) > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Garbage Output</span>
                            <span className="bam-detail-value" style={{ color: '#b0bec5' }}>
                              {(item.garbageAccumulation ?? 0) < 100
                                ? `${formatNumber(Math.round(item.garbageAccumulation ?? 0))} kg/mo`
                                : `${formatNumber((item.garbageAccumulation ?? 0) / 1000, 1)} t/mo`}
                            </span>
                          </div>
                        )}
                        {Boolean(item.mailSending) && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Mail Sending</span>
                            <span className="bam-detail-value">{pluralize(item.mailSending ?? 0, 'letter')}</span>
                          </div>
                        )}
                        {Boolean(item.mailReceiving) && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Mail Receiving</span>
                            <span className="bam-detail-value">{pluralize(item.mailReceiving ?? 0, 'letter')}</span>
                          </div>
                        )}
                        {item.isPlaced && item.crimeProbability !== undefined && item.crimeProbability >= 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Crime Risk</span>
                            <span
                              className="bam-detail-value"
                              style={{
                                color:
                                  (item.crimeProbability ?? 0) > 2000
                                    ? '#ef5350'
                                    : (item.crimeProbability ?? 0) > 500
                                    ? '#ffa726'
                                    : '#4fc3f7',
                                fontWeight: 600,
                              }}
                            >
                              {(item.crimeProbability ?? 0) > 2000
                                ? 'High'
                                : (item.crimeProbability ?? 0) > 500
                                ? 'Moderate'
                                : 'Low'}{' '}
                              ({formatNumber(Math.round(item.crimeProbability ?? 0))} pts)
                            </span>
                          </div>
                        )}
                        {(item.maintenanceCost ?? 0) > 0 && (
                          <div className="bam-detail-item">
                            <span className="bam-detail-label">Maintenance Cost</span>
                            <span className="bam-detail-value" style={{ color: '#ef5350', fontWeight: 600 }}>
                              {formatCurrency(item.maintenanceCost, '/mo')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ),

                economics: () => {
                  if (item.category === 'Residential') {
                    const wealthColor =
                      item.householdWealth === 'Wealthy'
                        ? '#81c784'
                        : item.householdWealth === 'Comfortable'
                        ? '#4fc3f7'
                        : item.householdWealth === 'Modest'
                        ? '#ffd54f'
                        : item.householdWealth === 'Poor'
                        ? '#ffa726'
                        : '#ef5350';
                    const hasHouseholds = item.isPlaced && (item.occupied ?? 0) > 0;

                    return (
                      <div
                        key="economics"
                        data-card-id="economics"
                        className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('economics') ? 'collapsed' : ''} ${buildingDraggedCardId === 'economics' ? 'dragging' : ''} ${
                          buildingDragOverCardId === 'economics' ? 'drag-over' : ''
                        }`}
                      >
                        {renderBldCardHeader(
                          'economics',
                          'Household Wealth & Living Finances',
                          item.householdWealth ? (
                            <span
                              className="bam-profit-tier-badge"
                              style={{
                                color: wealthColor,
                                borderColor: wealthColor,
                              }}
                            >
                              Wealth: {item.householdWealth}
                            </span>
                          ) : null,
                          'Money'
                        )}
                        {!collapsedBldCards.has('economics') && (
                          <div className="bam-bld-card-body">
                            {!hasHouseholds ? (
                              <div style={{ fontSize: '11rem', color: '#90a4ae', padding: '6rem 2rem' }}>
                                {item.isPlaced
                                  ? `Vacant property (0 / ${item.capacity ?? 0} households occupied). Household finances populate once residents move in.`
                                  : `Catalog prefab (${item.capacity ?? 0} household capacity). Place in city to track household finances.`}
                              </div>
                            ) : (
                              <>
                                <div className="bam-economics-grid">
                                  <div className="bam-econ-card">
                                    <span className="bam-econ-card-label">Average Income</span>
                                    <span className="bam-econ-card-value" style={{ color: '#81c784' }}>
                                      {formatCurrency(item.householdIncome ?? 0)}{' '}
                                      <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                    </span>
                                  </div>
                                  <div className="bam-econ-card">
                                    <span className="bam-econ-card-label">Average Rent</span>
                                    <span className="bam-econ-card-value" style={{ color: '#38bdf8' }}>
                                      {formatCurrency(item.householdRent ?? 0)}{' '}
                                      <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                    </span>
                                  </div>
                                  <div className="bam-econ-card">
                                    <span className="bam-econ-card-label">Building Upkeep</span>
                                    <span className="bam-econ-card-value" style={{ color: '#ffb74d' }}>
                                      {formatCurrency(item.householdUpkeep ?? 0)}{' '}
                                      <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                    </span>
                                  </div>
                                  <div className="bam-econ-card">
                                    <span className="bam-econ-card-label">Resource Cost</span>
                                    <span className="bam-econ-card-value" style={{ color: '#80cbc4' }}>
                                      {formatCurrency(item.householdResourceCost ?? 0)}{' '}
                                      <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="bam-econ-costs-bar">
                                  {(item.householdFees ?? 0) > 0 && (
                                    <div className="bam-econ-cost-item">
                                      <span className="bam-econ-cost-label">Service Fees:</span>
                                      <span className="bam-econ-cost-val">
                                        {formatCurrency(item.householdFees ?? 0, '/mo')}
                                      </span>
                                    </div>
                                  )}
                                  <div className="bam-econ-cost-item">
                                    <span className="bam-econ-cost-label">Total Rent:</span>
                                    <span className="bam-econ-cost-val">
                                      {formatCurrency(item.totalRent ?? item.householdRent ?? 0, '/mo')}
                                    </span>
                                  </div>
                                  <div className="bam-econ-cost-item">
                                    <span className="bam-econ-cost-label">Rent / Household:</span>
                                    <span className="bam-econ-cost-val">
                                      {formatCurrency(item.rentPerRenter ?? item.householdRent ?? 0, '/mo')}
                                    </span>
                                  </div>
                                  <div className="bam-econ-cost-item">
                                    <span className="bam-econ-cost-label">Occupancy:</span>
                                    <span className="bam-econ-cost-val">
                                      {formatNumber(item.occupied ?? 0)} / {formatNumber(item.capacity ?? 0)} HH
                                    </span>
                                  </div>
                                  {item.pets !== undefined && item.pets > 0 && (
                                    <div className="bam-econ-cost-item" style={{ marginLeft: 'auto' }}>
                                      <span className="bam-econ-cost-label">Pets:</span>
                                      <span className="bam-econ-cost-val" style={{ color: '#ffd54f' }}>
                                        {pluralize(item.pets, 'pet')}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    marginTop: '6rem',
                                    padding: '6rem 10rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '4rem',
                                    fontSize: '10rem',
                                    color: '#eceff1',
                                  }}
                                >
                                  <span style={{ marginRight: '10rem', marginBottom: '2rem' }}>
                                    <strong>Level:</strong> {item.level || 1}
                                  </span>
                                  {Boolean(item.lotSize) && (
                                    <span style={{ marginRight: '10rem', marginBottom: '2rem' }}>
                                      <strong>Lot Cells:</strong> {item.lotSize}
                                    </span>
                                  )}
                                  {item.spaceMultiplier !== undefined && item.spaceMultiplier > 0 && (
                                    <span style={{ marginRight: '10rem', marginBottom: '2rem' }}>
                                      <strong>Space Mult:</strong> {item.spaceMultiplier.toFixed(2).replace(/\.?0+$/, '')}
                                    </span>
                                  )}
                                  {item.baseRent !== undefined && item.baseRent > 0 && (
                                    <span style={{ marginRight: '10rem', marginBottom: '2rem' }}>
                                      <strong>Base Rent:</strong> {formatCurrency(item.baseRent)}
                                    </span>
                                  )}
                                  {item.landValueBase !== undefined && item.landValueBase > 0 && (
                                    <span style={{ marginRight: '10rem', marginBottom: '2rem' }}>
                                      <strong>Road Land Value:</strong> {formatCurrency(item.landValueBase, '/m²')}
                                    </span>
                                  )}
                                  {item.landValueModifier !== undefined && item.landValueModifier > 0 && (
                                    <span style={{ marginBottom: '2rem' }}>
                                      <strong>Land Value Mod:</strong> {item.landValueModifier.toFixed(2).replace(/\.?0+$/, '')}
                                    </span>
                                  )}
                                </div>
                                {/* Mixed-Use Commercial Shopkeeper Financials */}
                                {(item.isMixedUse || Boolean(item.company) || (item.income ?? 0) > 0) && (
                                  <div className="bam-mixed-tenant-card">
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4rem' }}>
                                      <UilIcon name="Money" sizeRem={12} style={{ color: '#81c784', marginRight: '4rem' }} />
                                      <span style={{ fontWeight: 700, fontSize: '11rem', color: '#81c784' }}>
                                        Commercial Shopkeeper Economics ({item.company || 'Ground Retail'})
                                      </span>
                                    </div>
                                    <div className="bam-economics-grid">
                                      <div className="bam-econ-card">
                                        <span className="bam-econ-card-label">Monthly Income</span>
                                        <span className="bam-econ-card-value" style={{ color: '#81c784' }}>
                                          {formatCurrency(item.income ?? 0)}{' '}
                                          <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                        </span>
                                      </div>
                                      <div className="bam-econ-card">
                                        <span className="bam-econ-card-label">Monthly Net Profit</span>
                                        <span
                                          className="bam-econ-card-value"
                                          style={{
                                            color: (item.monthlyProfit ?? 0) >= 0 ? '#81c784' : '#ef5350',
                                          }}
                                        >
                                          {formatCurrency(item.monthlyProfit ?? 0)}{' '}
                                          <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                        </span>
                                      </div>
                                      <div className="bam-econ-card">
                                        <span className="bam-econ-card-label">Customers</span>
                                        <span className="bam-econ-card-value">
                                          {formatNumber(item.customers ?? 0)}{' '}
                                          <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="bam-econ-costs-bar" style={{ marginTop: '4rem' }}>
                                      <div className="bam-econ-cost-item">
                                        <span className="bam-econ-cost-label">Shop Wages:</span>
                                        <span className="bam-econ-cost-val">{formatCurrency(item.wagePaid ?? 0)}</span>
                                      </div>
                                      <div className="bam-econ-cost-item">
                                        <span className="bam-econ-cost-label">Shop Rent:</span>
                                        <span className="bam-econ-cost-val">{formatCurrency(item.rentPaid ?? 0)}</span>
                                      </div>
                                      <div className="bam-econ-cost-item">
                                        <span className="bam-econ-cost-label">Taxes:</span>
                                        <span className="bam-econ-cost-val">{formatCurrency(item.taxPaid ?? 0)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (
                    item.category !== 'Service' &&
                    (item.company ||
                      item.profitabilityTier ||
                      (item.income ?? 0) > 0 ||
                      (item.netWorth ?? 0) !== 0 ||
                      (item.monthlyProfit ?? 0) !== 0 ||
                      (item.wagePaid ?? 0) > 0 ||
                      (item.rentPaid ?? 0) > 0 ||
                      (item.taxPaid ?? 0) > 0 ||
                      (item.inputCost ?? 0) > 0)
                  ) {
                    const tierInfo = formatProfitabilityTier(item.profitabilityTier);
                    const tierColor = getProfitabilityTierColor(item.profitabilityTier);

                    return (
                      <div
                        key="economics"
                        data-card-id="economics"
                        className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('economics') ? 'collapsed' : ''} ${buildingDraggedCardId === 'economics' ? 'dragging' : ''} ${
                          buildingDragOverCardId === 'economics' ? 'drag-over' : ''
                        }`}
                      >
                        {renderBldCardHeader(
                          'economics',
                          `Business Economics${item.company ? ` - ${item.company}` : ''}`,
                          item.profitabilityTier ? (
                            <span
                              className="bam-profit-tier-badge"
                              style={{
                                color: tierColor,
                                borderColor: tierColor,
                              }}
                            >
                              {tierInfo.label}
                              {item.profitMargin !== undefined
                                ? ` (${item.profitMargin > 0 ? '+' : ''}${item.profitMargin}%)`
                                : ''}
                            </span>
                          ) : null,
                          'Money'
                        )}
                        {!collapsedBldCards.has('economics') && (
                          <div className="bam-bld-card-body">
                            <div className="bam-economics-grid">
                              <div className="bam-econ-card">
                                <span className="bam-econ-card-label">Monthly Income</span>
                                <span className="bam-econ-card-value" style={{ color: '#81c784' }}>
                                  {formatCurrency(item.income ?? 0)}{' '}
                                  <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                </span>
                              </div>
                              <div className="bam-econ-card">
                                <span className="bam-econ-card-label">Monthly Net Profit</span>
                                <span
                                  className="bam-econ-card-value"
                                  style={{
                                    color: (item.monthlyProfit ?? 0) >= 0 ? '#81c784' : '#ef5350',
                                  }}
                                >
                                  {formatCurrency(item.monthlyProfit ?? 0)}{' '}
                                  <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                </span>
                              </div>
                              <div className="bam-econ-card">
                                <span className="bam-econ-card-label">Bank Balance / Worth</span>
                                <span
                                  className="bam-econ-card-value"
                                  style={{ color: (item.netWorth ?? 0) >= 0 ? '#38bdf8' : '#ef5350' }}
                                >
                                  {formatCurrency(item.netWorth ?? 0)}
                                </span>
                              </div>
                              <div className="bam-econ-card">
                                <span className="bam-econ-card-label">Customers</span>
                                <span className="bam-econ-card-value">
                                  {formatNumber(item.customers ?? 0)}{' '}
                                  <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                  {item.currentCustomers !== undefined && item.currentCustomers > 0 && (
                                    <span style={{ fontSize: '8.5rem', color: '#81d4fa', marginLeft: '4rem', opacity: 0.85 }}>
                                      ({pluralize(item.currentCustomers, 'shopper')})
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Operating Costs with All Utilities & Fees Paid */}
                            <div className="bam-econ-costs-bar">
                              <div className="bam-econ-cost-item">
                                <span className="bam-econ-cost-label">Wages:</span>
                                <span className="bam-econ-cost-val">
                                  {formatCurrency(item.wagePaid ?? 0)}
                                </span>
                              </div>
                              <div className="bam-econ-cost-item">
                                <span className="bam-econ-cost-label">Rent:</span>
                                <span className="bam-econ-cost-val">
                                  {formatCurrency(item.rentPaid ?? 0)}
                                </span>
                              </div>
                              <div className="bam-econ-cost-item">
                                <span className="bam-econ-cost-label">Taxes:</span>
                                <span className="bam-econ-cost-val">
                                  {formatCurrency(item.taxPaid ?? 0)}
                                </span>
                              </div>
                              <div className="bam-econ-cost-item">
                                <span className="bam-econ-cost-label">Input Goods:</span>
                                <span className="bam-econ-cost-val">
                                  {formatCurrency(item.inputCost ?? 0)}
                                </span>
                              </div>
                              {(item.electricityPaid ?? 0) > 0 && (
                                <div className="bam-econ-cost-item">
                                  <span className="bam-econ-cost-label">Electricity Fee:</span>
                                  <span className="bam-econ-cost-val" style={{ color: '#ffd54f' }}>
                                    {formatCurrency(item.electricityPaid ?? 0)}
                                  </span>
                                </div>
                              )}
                              {(item.waterPaid ?? 0) > 0 && (
                                <div className="bam-econ-cost-item">
                                  <span className="bam-econ-cost-label">Water Fee:</span>
                                  <span className="bam-econ-cost-val" style={{ color: '#4fc3f7' }}>
                                    {formatCurrency(item.waterPaid ?? 0)}
                                  </span>
                                </div>
                              )}
                              {(item.sewagePaid ?? 0) > 0 && (
                                <div className="bam-econ-cost-item">
                                  <span className="bam-econ-cost-label">Sewage Fee:</span>
                                  <span className="bam-econ-cost-val" style={{ color: '#bcaaa4' }}>
                                    {formatCurrency(item.sewagePaid ?? 0)}
                                  </span>
                                </div>
                              )}
                              {(item.garbagePaid ?? 0) > 0 && (
                                <div className="bam-econ-cost-item">
                                  <span className="bam-econ-cost-label">Garbage Fee:</span>
                                  <span className="bam-econ-cost-val" style={{ color: '#ffb74d' }}>
                                    {formatCurrency(item.garbagePaid ?? 0)}
                                  </span>
                                </div>
                              )}
                              {item.tradePartner && (
                                <div className="bam-econ-cost-item" style={{ marginLeft: 'auto' }}>
                                  <span className="bam-econ-cost-label">Supplier:</span>
                                  <span className="bam-econ-cost-val" style={{ color: '#ffd54f' }}>
                                    {item.tradePartner}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  const upkeepAmount = (item.totalUpkeep ?? 0) > 0
                    ? item.totalUpkeep!
                    : (item.maintenanceCost ?? 0) + (item.wagePaid ?? 0);
                  const fallbackLandVal = item.roadLandValue || item.landValueBase || 0;
                  const fallbackBadge = item.isPlaced
                    ? upkeepAmount > 0
                      ? formatCurrency(upkeepAmount, '/mo')
                      : item.category === 'Service'
                      ? 'Municipal'
                      : 'Vacant'
                    : 'Prefab';

                  return (
                    <div
                      key="economics"
                      data-card-id="economics"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('economics') ? 'collapsed' : ''} ${buildingDraggedCardId === 'economics' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'economics' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'economics',
                        item.category === 'Service' ? 'Service Finances & Upkeep' : 'Building Finances & Upkeep',
                        <span
                          className="bam-profit-tier-badge"
                          style={{
                            color: upkeepAmount > 0 ? '#ffb74d' : '#90a4ae',
                            borderColor: upkeepAmount > 0 ? 'rgba(255, 183, 77, 0.4)' : 'rgba(144, 164, 174, 0.35)',
                          }}
                        >
                          {fallbackBadge}
                        </span>,
                        'Money'
                      )}
                      {!collapsedBldCards.has('economics') && (
                        <div className="bam-bld-card-body">
                          <div className="bam-economics-grid">
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Monthly Upkeep</span>
                              <span className="bam-econ-card-value" style={{ color: upkeepAmount > 0 ? '#ffb74d' : '#90a4ae' }}>
                                {formatCurrency(upkeepAmount)}{' '}
                                <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                              </span>
                            </div>
                            {item.category === 'Service' && ((item.maintenanceCost ?? 0) > 0 || (item.wagePaid ?? 0) > 0) && (
                              <>
                                <div className="bam-econ-card">
                                  <span className="bam-econ-card-label">Facility Maintenance</span>
                                  <span className="bam-econ-card-value" style={{ color: '#ffd54f' }}>
                                    {formatCurrency(item.maintenanceCost ?? 0)}{' '}
                                    <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                  </span>
                                </div>
                                <div className="bam-econ-card">
                                  <span className="bam-econ-card-label">Employee Wages</span>
                                  <span className="bam-econ-card-value" style={{ color: '#81d4fa' }}>
                                    {formatCurrency(item.wagePaid ?? 0)}{' '}
                                    <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                                  </span>
                                </div>
                              </>
                            )}
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Construction Cost</span>
                              <span className="bam-econ-card-value" style={{ color: (item.constructionCost ?? 0) > 0 ? '#81c784' : '#90a4ae' }}>
                                {(item.constructionCost ?? 0) > 0 ? formatCurrency(item.constructionCost!) : 'Private Zone'}
                              </span>
                            </div>
                            {(item.taxRate ?? 0) > 0 && (
                              <div className="bam-econ-card">
                                <span className="bam-econ-card-label">Tax Rate</span>
                                <span className="bam-econ-card-value" style={{ color: '#4fc3f7' }}>
                                  {item.taxRate}%
                                </span>
                              </div>
                            )}
                            {fallbackLandVal > 0 && (
                              <div className="bam-econ-card">
                                <span className="bam-econ-card-label">Road Land Value</span>
                                <span className="bam-econ-card-value" style={{ color: '#ffd54f' }}>
                                  {formatCurrency(fallbackLandVal, '/m²')}
                                </span>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '10.5rem', color: '#90a4ae', marginTop: '6rem' }}>
                            {!item.isPlaced
                              ? `Catalog ${(item.category || '').toLowerCase()} prefab — company operating revenue populates after placement and occupancy.`
                              : item.category === 'Service'
                              ? 'City municipal service building funded by city operating budget.'
                              : `Vacant ${(item.category || '').toLowerCase()} building — company revenue, wages, and taxes populate once a tenant occupies.`}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },

                education: () => {
                  if (!Array.isArray(item.educationTiers) || item.educationTiers.length === 0) {
                    return null;
                  }

                  const isRes = item.category === 'Residential';
                  const totalFilled = item.educationTiers.reduce((s, t) => s + t.filled, 0);
                  const totalCapacity = item.educationTiers.reduce((s, t) => s + t.total, 0);
                  const tierColors = ['#ef5350', '#ffa726', '#66bb6a', '#26c6da', '#42a5f5'];

                  return (
                    <div
                      key="education"
                      data-card-id="education"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('education') ? 'collapsed' : ''} ${buildingDraggedCardId === 'education' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'education' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'education',
                        isRes ? 'Resident Education Distribution' : 'Worker & Workforce Education',
                        <span className="bam-dash-card-badge">
                          {isRes
                            ? pluralize(totalFilled, 'Resident')
                            : `${formatNumber(totalFilled)} / ${formatNumber(totalCapacity)} Workers (${totalCapacity > 0 ? Math.round((totalFilled / totalCapacity) * 100) : 0}%)`}
                        </span>,
                        'Graduation'
                      )}
                      {!collapsedBldCards.has('education') && (
                        <div className="bam-bld-card-body">
                          <div className="bam-edu-grid">
                            {item.educationTiers.map((tier, idx) => {
                              const color = tierColors[idx] || '#81d4fa';
                              const fillPct = isRes
                                ? totalFilled > 0
                                  ? Math.round((tier.filled / totalFilled) * 100)
                                  : 0
                                : tier.total > 0
                                ? Math.round((tier.filled / tier.total) * 100)
                                : 0;
                              const barWidth = isRes ? fillPct : Math.min(100, fillPct);

                              return (
                                <div key={tier.level} className="bam-edu-row">
                                  <span className="bam-edu-label">
                                    <span className="bam-edu-dot" style={{ background: color }} />
                                    <span>{tier.name}</span>
                                  </span>
                                  <div className="bam-edu-bar-track">
                                    <div
                                      className="bam-edu-bar-fill"
                                      style={{
                                        width: `${barWidth}%`,
                                        background: color,
                                      }}
                                    />
                                  </div>
                                  <span className="bam-edu-val">
                                    {isRes ? (
                                      `${formatNumber(tier.filled)} res. (${fillPct}%)`
                                    ) : tier.total > 0 ? (
                                      `${formatNumber(tier.filled)} / ${formatNumber(tier.total)} (${fillPct}%)`
                                    ) : (
                                      `${pluralize(tier.filled, 'worker')}`
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },

                parking: () => {
                  if ((item.parkingCapacity ?? 0) <= 0) return null;

                  return (
                    <div
                      key="parking"
                      data-card-id="parking"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('parking') ? 'collapsed' : ''} ${buildingDraggedCardId === 'parking' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'parking' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'parking',
                        'Parking & Mobility Operations',
                        <span
                          className="bam-profit-tier-badge"
                          style={{
                            color: '#38bdf8',
                            borderColor: 'rgba(56, 189, 248, 0.4)',
                          }}
                        >
                          Fee: {item.parkingFee !== undefined && item.parkingFee > 0 ? formatCurrency(item.parkingFee, '/hr') : 'Free'}
                        </span>,
                        'Car'
                      )}
                      {!collapsedBldCards.has('parking') && (
                        <div className="bam-bld-card-body">
                          <div className="bam-economics-grid">
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Parked Vehicles</span>
                              <span className="bam-econ-card-value" style={{ color: '#38bdf8' }}>
                                {`${formatNumber(item.parkedVehicles ?? 0)} / ${formatNumber(item.parkingCapacity ?? 0)} cars`}
                              </span>
                            </div>
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Available Spaces</span>
                              <span
                                className="bam-econ-card-value"
                                style={{
                                  color:
                                    Math.max(0, (item.parkingCapacity ?? 0) - (item.parkedVehicles ?? 0)) > 0
                                      ? '#81c784'
                                      : '#ef5350',
                                }}
                              >
                                {`${formatNumber(Math.max(0, (item.parkingCapacity ?? 0) - (item.parkedVehicles ?? 0)))} free`}
                              </span>
                            </div>
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Comfort Factor</span>
                              <span className="bam-econ-card-value" style={{ color: '#ffd54f' }}>
                                {item.parkingComfort ?? 70}{' '}
                                <span style={{ fontSize: '9rem', opacity: 0.7 }}>pts</span>
                              </span>
                            </div>
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Total Monthly Upkeep</span>
                              <span className="bam-econ-card-value" style={{ color: '#ffb74d' }}>
                                {formatCurrency(
                                  (item.totalUpkeep ?? 0) > 0
                                    ? item.totalUpkeep!
                                    : (item.maintenanceCost ?? 0)
                                )}{' '}
                                <span style={{ fontSize: '9rem', opacity: 0.7 }}>/mo</span>
                              </span>
                            </div>
                          </div>
                          <div className="bam-econ-costs-bar">
                            {(item.wagePaid ?? 0) > 0 && (
                              <div className="bam-econ-cost-item">
                                <span className="bam-econ-cost-label">Staff Wages:</span>
                                <span className="bam-econ-cost-val">
                                  {formatCurrency(item.wagePaid ?? 0, '/mo')}
                                </span>
                              </div>
                            )}
                            <div className="bam-econ-cost-item">
                              <span className="bam-econ-cost-label">Facility Upkeep:</span>
                              <span className="bam-econ-cost-val">
                                {formatCurrency(item.maintenanceCost ?? 0, '/mo')}
                              </span>
                            </div>
                            <div className="bam-econ-cost-item">
                              <span className="bam-econ-cost-label">Hourly Fee:</span>
                              <span className="bam-econ-cost-val" style={{ color: '#81c784' }}>
                                {(item.parkingFee ?? 0) > 0 ? formatCurrency(item.parkingFee ?? 0, '/hr') : 'Free'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },

                parks: () => {
                  if (
                    item.subCategory !== 'Parks & Recreation' &&
                    (item.parkMaintenance ?? -1) < 0 &&
                    (item.recreation ?? 0) <= 0 &&
                    (item.attractiveness ?? 0) <= 0
                  ) {
                    return null;
                  }

                  return (
                    <div
                      key="parks"
                      data-card-id="parks"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('parks') ? 'collapsed' : ''} ${buildingDraggedCardId === 'parks' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'parks' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'parks',
                        'Parks, Recreation & Attractions',
                        item.parkMaintenance !== undefined && item.parkMaintenance >= 0 ? (
                          <span
                            className="bam-profit-tier-badge"
                            style={{
                              color:
                                item.parkMaintenance >= 80
                                  ? '#81c784'
                                  : item.parkMaintenance >= 50
                                  ? '#ffd54f'
                                  : '#ef5350',
                              borderColor:
                                item.parkMaintenance >= 80
                                  ? 'rgba(129, 199, 132, 0.4)'
                                  : 'rgba(239, 83, 80, 0.4)',
                            }}
                          >
                            Maintenance: {item.parkMaintenance}%
                          </span>
                        ) : null,
                        'Tree'
                      )}
                      {!collapsedBldCards.has('parks') && (
                        <div className="bam-bld-card-body">
                          <div className="bam-economics-grid">
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Park Maintenance</span>
                              <span
                                className="bam-econ-card-value"
                                style={{
                                  color:
                                    (item.parkMaintenance ?? 100) >= 80 ? '#81c784' : '#ffd54f',
                                }}
                              >
                                {item.parkMaintenance !== undefined && item.parkMaintenance >= 0
                                  ? `${item.parkMaintenance}%`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Recreation Score</span>
                              <span className="bam-econ-card-value" style={{ color: '#4fc3f7' }}>
                                +{item.recreation ?? 0}{' '}
                                <span style={{ fontSize: '9rem', opacity: 0.7 }}>
                                  {formatLeisureType(item.leisureType) || 'Outdoor'}
                                </span>
                              </span>
                            </div>
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Attractiveness</span>
                              <span className="bam-econ-card-value" style={{ color: '#ffd54f' }}>
                                {formatNumber(item.attractiveness ?? 0)}{' '}
                                <span style={{ fontSize: '9rem', opacity: 0.7 }}>pts</span>
                              </span>
                            </div>
                            <div className="bam-econ-card">
                              <span className="bam-econ-card-label">Camping Residents</span>
                              <span
                                className="bam-econ-card-value"
                                style={{
                                  color: (item.residents ?? 0) > 0 ? '#ffa726' : '#94a3b8',
                                }}
                              >
                                {formatNumber(item.residents ?? 0)}{' '}
                                <span style={{ fontSize: '9rem', opacity: 0.7 }}>res.</span>
                              </span>
                            </div>
                          </div>
                          <div className="bam-econ-costs-bar">
                            <div className="bam-econ-cost-item">
                              <span className="bam-econ-cost-label">Monthly Upkeep:</span>
                              <span className="bam-econ-cost-val" style={{ color: '#ef5350' }}>
                                {formatCurrency(item.maintenanceCost ?? 0, '/mo')}
                              </span>
                            </div>
                            <div className="bam-econ-cost-item">
                              <span className="bam-econ-cost-label">Visitor Capacity:</span>
                              <span className="bam-econ-cost-val">
                                {formatNumber(item.serviceUsage ?? 0)} / {formatNumber(item.serviceCapacity ?? 0)}
                              </span>
                            </div>
                            {item.residents !== undefined && item.residents > 0 && (
                              <div className="bam-econ-cost-item" style={{ marginLeft: 'auto' }}>
                                <span className="bam-econ-cost-label">Sheltered / Homeless Citizens:</span>
                                <span className="bam-econ-cost-val" style={{ color: '#ffd54f', fontWeight: 700 }}>
                                  {formatNumber(item.residents)} living here
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },

                efficiency: () => {
                  const effFactors = Array.isArray(item.efficiencyFactors) ? item.efficiencyFactors : [];
                  if (effFactors.length === 0 && (!item.isPlaced || (item.efficiency ?? -1) < 0)) return null;

                  const filteredEff = effFactors.filter((ef) => {
                    if (bldEffFilter === 'pos') return ef.percentage > 0;
                    if (bldEffFilter === 'neg') return ef.percentage < 0;
                    return true;
                  });

                  const effGrid = (
                    <div className="bam-eff-factors-grid">
                      {filteredEff.map((ef, efIdx) => {
                        const isPositive = ef.percentage > 0;
                        const changeColor = isPositive
                          ? '#81c784'
                          : ef.percentage >= -10
                          ? '#ffd54f'
                          : '#ef5350';
                        const iconUrl = getEfficiencyFactorIcon(ef.factor);
                        const label = getFactorDisplayLabel(ef.factor, ef.percentage);
                        return (
                          <div key={`${ef.factor}-${efIdx}`} className="bam-eff-factor-chip">
                            <img src={iconUrl} className="bam-eff-factor-icon" alt="" />
                            <span className="bam-eff-factor-label">{label}</span>
                            <span className="bam-eff-factor-delta" style={{ color: changeColor }}>
                              {isPositive ? `+${ef.percentage}%` : `${ef.percentage}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );

                  return (
                    <div
                      key="efficiency"
                      data-card-id="efficiency"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('efficiency') ? 'collapsed' : ''} ${buildingDraggedCardId === 'efficiency' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'efficiency' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'efficiency',
                        'Efficiency Factors Breakdown',
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="bam-dash-card-badge" style={{ marginRight: effFactors.length > 0 ? '6rem' : '0' }}>
                            {effFactors.length > 0 ? `(${pluralize(effFactors.length, 'factor')})` : `${item.efficiency}% baseline`}
                          </span>
                          {effFactors.length > 0 && (
                            <div className="bam-happy-btn-group">
                              <button
                                className={`bam-happy-toggle-btn ${bldEffFilter === 'all' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBldEffFilter('all');
                                }}
                                title="Both positive & negative factors"
                              >
                                +/-
                              </button>
                              <button
                                className={`bam-happy-toggle-btn pos ${bldEffFilter === 'pos' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBldEffFilter('pos');
                                }}
                                title="Positive only"
                              >
                                + Pos
                              </button>
                              <button
                                className={`bam-happy-toggle-btn neg ${bldEffFilter === 'neg' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBldEffFilter('neg');
                                }}
                                title="Negative only"
                              >
                                - Neg
                              </button>
                            </div>
                          )}
                        </div>,
                        'Settings'
                      )}
                      {!collapsedBldCards.has('efficiency') && (
                        <div className="bam-bld-card-body">
                          {effFactors.length === 0 ? (
                            <div style={{ fontSize: '11rem', color: '#81c784', padding: '6rem 2rem' }}>
                              {`Operating at ${item.efficiency}% baseline efficiency — all active operating factors are nominal (no bonuses or penalties).`}
                            </div>
                          ) : filteredEff.length === 0 ? (
                            <div className="bam-happy-empty">No efficiency factors match the selected filter</div>
                          ) : filteredEff.length > 8 ? (
                            <Scrollable vertical={true} trackVisibility="scrollable" className="bam-card-scroll-area">
                              {effGrid}
                            </Scrollable>
                          ) : (
                            effGrid
                          )}
                        </div>
                      )}
                    </div>
                  );
                },

                happiness: () => {
                  const happyList = Array.isArray(item.happinessFactors) ? item.happinessFactors.filter(Boolean) : [];
                  if (!item.isPlaced || happyList.length === 0) {
                    return null;
                  }

                  const filteredHappy = happyList.filter((hf) => {
                    if (bldHappyFilter === 'pos') return hf.percentage > 0;
                    if (bldHappyFilter === 'neg') return hf.percentage < 0;
                    return true;
                  });

                  const happyGrid = (
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {filteredHappy.map((hf, idx) => {
                        const iconUrl = getEfficiencyFactorIcon(hf.factor);
                        const isZero = hf.percentage === 0;
                        const isPos = hf.percentage > 0;
                        const deltaText = isZero ? '0' : isPos ? `+${hf.percentage}` : `${hf.percentage}`;
                        const chipClass = isZero ? 'neu' : isPos ? 'pos' : 'neg';
                        const factorLabel = getFactorDisplayLabel(hf.factor, hf.percentage);

                        return (
                          <div
                            key={`happy-chip-${hf.factor}-${idx}`}
                            className={`bam-happy-chip ${chipClass}`}
                            style={{
                              fontSize: '10rem',
                              padding: '3rem 8rem',
                              borderRadius: '4rem',
                              display: 'flex',
                              alignItems: 'center',
                              marginRight: '6rem',
                              marginBottom: '6rem',
                              color: isZero ? '#90a4ae' : isPos ? '#81c784' : '#ef5350',
                              borderColor: isZero ? 'rgba(255,255,255,0.1)' : undefined,
                            }}
                          >
                            {iconUrl && <img src={iconUrl} style={{ width: '12rem', height: '12rem', marginRight: '6rem' }} alt="" />}
                            <span style={{ marginRight: '6rem' }}>{factorLabel}</span>
                            <span style={{ fontWeight: 700 }}>{deltaText}</span>
                          </div>
                        );
                      })}
                    </div>
                  );

                  return (
                    <div
                      key="happiness"
                      data-card-id="happiness"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('happiness') ? 'collapsed' : ''} ${buildingDraggedCardId === 'happiness' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'happiness' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'happiness',
                        item.category === 'Residential'
                          ? 'Resident Happiness Factors'
                          : 'Worker Happiness Factors',
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="bam-dash-card-badge" style={{ marginRight: '6rem' }}>
                            {`(${pluralize(happyList.length, 'factor')})`}
                          </span>
                          <div className="bam-happy-btn-group">
                            <button
                              className={`bam-happy-toggle-btn ${bldHappyFilter === 'all' ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBldHappyFilter('all');
                              }}
                              title="Both positive & negative factors"
                            >
                              +/-
                            </button>
                            <button
                              className={`bam-happy-toggle-btn pos ${bldHappyFilter === 'pos' ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBldHappyFilter('pos');
                              }}
                              title="Positive only"
                            >
                              + Pos
                            </button>
                            <button
                              className={`bam-happy-toggle-btn neg ${bldHappyFilter === 'neg' ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBldHappyFilter('neg');
                              }}
                              title="Negative only"
                            >
                              - Neg
                            </button>
                          </div>
                        </div>,
                        'Happy'
                      )}
                      {!collapsedBldCards.has('happiness') && (
                        <div className="bam-bld-card-body">
                          {filteredHappy.length === 0 ? (
                            <div className="bam-happy-empty">No factors match the selected filter</div>
                          ) : filteredHappy.length > 8 ? (
                            <Scrollable vertical={true} trackVisibility="scrollable" className="bam-card-scroll-area">
                              {happyGrid}
                            </Scrollable>
                          ) : (
                            happyGrid
                          )}
                        </div>
                      )}
                    </div>
                  );
                },

                upgrades: () => {
                  if (!hasUpgrades || upgradeDisplayMode === 'rows') return null;

                  const upgDrawer = (
                    <div className="bam-upgrades-drawer" style={{ marginLeft: 0 }}>
                      {item.subBuildings!.map(renderSubBuildingItem)}
                    </div>
                  );

                  return (
                    <div
                      key="upgrades"
                      data-card-id="upgrades"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('upgrades') ? 'collapsed' : ''} ${buildingDraggedCardId === 'upgrades' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'upgrades' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'upgrades',
                        'Installed Sub-Building Upgrades',
                        <span className="bam-dash-card-badge">
                          {`(${pluralize(item.subBuildings!.length, 'upgrade')})`}
                        </span>,
                        'Tools'
                      )}
                      {!collapsedBldCards.has('upgrades') && (
                        <div className="bam-bld-card-body">
                          {item.subBuildings!.length > 3 ? (
                            <Scrollable vertical={true} trackVisibility="scrollable" className="bam-card-scroll-area">
                              {upgDrawer}
                            </Scrollable>
                          ) : (
                            upgDrawer
                          )}
                        </div>
                      )}
                    </div>
                  );
                },

                effects: () => {
                  const totalEffectsCount = (item.cityEffects?.length ?? 0) + (item.localEffects?.length ?? 0);
                  if (totalEffectsCount === 0) {
                    return null;
                  }

                  const cityEffectsList = Array.isArray(item.cityEffects) ? item.cityEffects.filter(Boolean) : [];
                  const localEffectsList = Array.isArray(item.localEffects) ? item.localEffects.filter(Boolean) : [];
                  const effectsBody = (
                    <div>
                      {cityEffectsList.length > 0 && (
                        <div style={{ marginBottom: localEffectsList.length > 0 ? '8rem' : '0' }}>
                          <div
                            className="bam-detail-section-title"
                            style={{
                              color: '#ffd54f',
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '6rem',
                            }}
                          >
                            <UilIcon name="Star" sizeRem={12} style={{ color: '#ffd54f', marginRight: '6rem' }} />
                            <span style={{ marginRight: '6rem' }}>City-Wide Modifiers</span>
                            <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                              {`(${pluralize(cityEffectsList.length, 'active buff')})`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {cityEffectsList.map((rawEf, idx) => {
                              const ef = formatModifierText(rawEf, true);
                              const icon = getEffectIcon(ef);
                              return (
                                <div
                                  key={`city-ef-${rawEf}-${idx}`}
                                  style={{
                                    padding: '3rem 8rem',
                                    background: 'rgba(255, 213, 79, 0.1)',
                                    border: '1rem solid rgba(255, 213, 79, 0.35)',
                                    borderRadius: '4rem',
                                    fontSize: '11rem',
                                    color: '#ffe082',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginRight: '6rem',
                                    marginBottom: '6rem',
                                  }}
                                >
                                  {icon && <img src={icon} style={{ width: '13rem', height: '13rem', marginRight: '5rem' }} alt="" />}
                                  <span>{ef}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {localEffectsList.length > 0 && (
                        <div>
                          <div
                            className="bam-detail-section-title"
                            style={{
                              color: '#4fc3f7',
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '6rem',
                            }}
                          >
                            <UilIcon name="District" sizeRem={12} style={{ color: '#4fc3f7', marginRight: '6rem' }} />
                            <span style={{ marginRight: '6rem' }}>Local Radius Auras</span>
                            <span style={{ fontSize: '10rem', color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                              {`(${pluralize(localEffectsList.length, 'local effect')})`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {localEffectsList.map((rawEf, idx) => {
                              const ef = formatModifierText(rawEf, false);
                              const icon = getEffectIcon(ef);
                              return (
                                <div
                                  key={`local-ef-${rawEf}-${idx}`}
                                  style={{
                                    padding: '3rem 8rem',
                                    background: 'rgba(79, 195, 247, 0.1)',
                                    border: '1rem solid rgba(79, 195, 247, 0.35)',
                                    borderRadius: '4rem',
                                    fontSize: '11rem',
                                    color: '#b3e5fc',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginRight: '6rem',
                                    marginBottom: '6rem',
                                  }}
                                >
                                  {icon && <img src={icon} style={{ width: '13rem', height: '13rem', marginRight: '5rem' }} alt="" />}
                                  <span>{ef}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <div
                      key="effects"
                      data-card-id="effects"
                      className={`bam-dash-card bam-bld-card ${collapsedBldCards.has('effects') ? 'collapsed' : ''} ${buildingDraggedCardId === 'effects' ? 'dragging' : ''} ${
                        buildingDragOverCardId === 'effects' ? 'drag-over' : ''
                      }`}
                    >
                      {renderBldCardHeader(
                        'effects',
                        'City-Wide Modifiers & Local Radius Effects',
                        <span className="bam-dash-card-badge">
                          {pluralize(totalEffectsCount, 'effect')}
                        </span>,
                        'Star'
                      )}
                      {!collapsedBldCards.has('effects') && (
                        <div className="bam-bld-card-body">
                          {totalEffectsCount > 8 ? (
                            <Scrollable vertical={true} trackVisibility="scrollable" className="bam-card-scroll-area">
                              {effectsBody}
                            </Scrollable>
                          ) : (
                            effectsBody
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              };

              return (
                <div className="bam-building-cards-container" ref={buildingCardsContainerRef}>
                  {buildingCardOrder
                    .filter((cardId) => !hiddenBuildingCards.has(cardId))
                    .map((cardId) => {
                      const renderer = bldCardRenderers[cardId];
                      return renderer ? renderer() : null;
                    })}
                </div>
              );
            })()}

            {/* Attached Sub-Buildings / Upgrades as Tabular Row Data */}
            {hasUpgrades && (upgradeDisplayMode === 'rows' || upgradeDisplayMode === 'both') && (() => {
              const upgradeItems = item.subBuildings || [];
              const totalUpgradeUpkeep = upgradeItems.reduce((s, sb) => s + (sb?.upkeep || 0), 0);
              const totalUpgradeWorkers = upgradeItems.reduce((s, sb) => s + (sb?.workers || 0), 0);
              const renderUpgradeTableRow = (sub: SubBuildingItem) => {
                const subKey = sub.entityKey || sub.prefabName || sub.name;
                const isSubExpanded = !!expandedSubBuildings[subKey];
                return (
                  <div key={subKey} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1rem solid rgba(255, 255, 255, 0.04)' }}>
                    <div
                      className="bam-upgrades-tr"
                      style={{ cursor: 'pointer', borderBottom: 'none' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSubBuildingExpand(subKey, e);
                      }}
                      title="Click to expand/collapse upgrade module details"
                    >
                      <div className="bam-up-col up-name">
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <UilIcon
                            name={isSubExpanded ? 'ChevronDown' : 'ChevronRight'}
                            sizeRem={10}
                            style={{ color: '#81d4fa', marginRight: '5rem', flexShrink: 0 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span className="bam-up-title">{sub.name}</span>
                            {sub.prefabName && sub.prefabName !== sub.name && (
                              <span className="bam-up-sub">{sub.prefabName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="bam-up-col up-type">
                        <span className="bam-up-type-badge">{sub.type || 'Sub-building'}</span>
                      </div>
                      <div className="bam-up-col up-cost">
                        {(sub.upkeep ?? 0) > 0 && <span className="bam-up-upkeep">{formatCurrency(sub.upkeep, '/mo')}</span>}
                        {(sub.cost ?? 0) > 0 && <span className="bam-up-cost">{formatCurrency(sub.cost)}</span>}
                        {(sub.upkeep ?? 0) <= 0 && (sub.cost ?? 0) <= 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                      </div>
                      <div className="bam-up-col up-benefits">
                        {sub.benefit ? (
                          <span className="bam-up-benefit-chip">{formatEffectString(sub.benefit)}</span>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10rem' }}>Standard service extension</span>
                        )}
                      </div>
                      <div className="bam-up-col up-actions">
                        <button
                          className="bam-action-btn"
                          title="Center camera on this sub-building module"
                          onClick={(e) => {
                            e.stopPropagation();
                            focusEntity(sub.entityKey);
                          }}
                        >
                          <UilIcon name="Location" sizeRem={11} style={{ marginRight: '3rem' }} />
                          <span>Focus</span>
                        </button>
                      </div>
                    </div>
                    {isSubExpanded && (
                      <div className="bam-upgrades-tr-detail">
                        {Boolean(sub.workers && sub.workers > 0) && (
                          <span className="bam-up-detail-pill">
                            {`Workers: ${formatNumber(sub.workers!)}`}
                          </span>
                        )}
                        {Boolean(sub.upkeep && sub.upkeep > 0) && (
                          <span className="bam-up-detail-pill" style={{ color: '#ffb74d' }}>
                            {`Upkeep: ${formatCurrency(sub.upkeep, '/mo')}`}
                          </span>
                        )}
                        {Boolean(sub.cost && sub.cost > 0) && (
                          <span className="bam-up-detail-pill" style={{ color: '#81c784' }}>
                            {`Build Cost: ${formatCurrency(sub.cost)}`}
                          </span>
                        )}
                        {sub.entityKey && (
                          <span className="bam-up-detail-pill" style={{ color: '#90a4ae' }}>
                            {`Entity: ${sub.entityKey}`}
                          </span>
                        )}
                        {(sub.isDamaged || sub.isDestroyed) && (
                          <button
                            className="bam-action-btn repair"
                            style={{ padding: '2rem 6rem', fontSize: '9rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              rebuildBuilding(sub.entityKey);
                            }}
                          >
                            <UilIcon name="Tools" sizeRem={9} style={{ marginRight: '3rem' }} />
                            <span>Repair Module</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="bam-upgrades-row-section">
                  <div
                    className="bam-upgrades-row-header"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUpgrades(item.id, e);
                    }}
                    title={isUpgradesOpen ? 'Collapse service upgrades' : 'Expand service upgrades'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <UilIcon
                        name={isUpgradesOpen ? 'ChevronDown' : 'ChevronRight'}
                        sizeRem={12}
                        style={{ color: '#81d4fa', marginRight: '6rem', flexShrink: 0 }}
                      />
                      <UilIcon name="Tools" sizeRem={13} style={{ color: '#81d4fa', marginRight: '8rem', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '12rem', color: '#eceff1' }}>
                        {`Attached Sub-Building Extensions & Upgrades (${pluralize(upgradeItems.length, 'upgrade')})`}
                      </span>
                    </div>
                    <div className="bam-upgrades-row-summary">
                      {totalUpgradeWorkers > 0 && (
                        <span className="bam-upgrades-summary-stat" style={{ color: '#38bdf8' }}>
                          {`${formatNumber(totalUpgradeWorkers)} workers`}
                        </span>
                      )}
                      {totalUpgradeUpkeep > 0 && (
                        <span className="bam-upgrades-summary-stat" style={{ color: '#ffb74d' }}>
                          {formatCurrency(totalUpgradeUpkeep, '/mo')}
                        </span>
                      )}
                      <span style={{ fontSize: '10rem', color: '#78909c' }}>
                        {isUpgradesOpen ? 'Click to collapse' : 'Click to expand'}
                      </span>
                    </div>
                  </div>
                  {isUpgradesOpen && (
                    <div className="bam-upgrades-table">
                      <div className="bam-upgrades-thead">
                        <div className="bam-up-col up-name">Module Name</div>
                        <div className="bam-up-col up-type">Type</div>
                        <div className="bam-up-col up-cost">Cost / Upkeep</div>
                        <div className="bam-up-col up-benefits">Active Stats &amp; Benefits</div>
                        <div className="bam-up-col up-actions">Actions</div>
                      </div>
                      {upgradeItems.length > 5 ? (
                        <Scrollable vertical={true} trackVisibility="scrollable" className="bam-card-scroll-area" style={{ maxHeight: '220rem' }}>
                          <div className="bam-upgrades-tbody">
                            {upgradeItems.map(renderUpgradeTableRow)}
                          </div>
                        </Scrollable>
                      ) : (
                        <div className="bam-upgrades-tbody">
                          {upgradeItems.map(renderUpgradeTableRow)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Bottom Actions Bar */}
            <div className="bam-detail-actions-bar">
              {item.isPlaced ? (
                <>
                  {item.companyEntityKey ? (
                    <>
                      <button
                        className="bam-action-btn co"
                        onClick={(e) => {
                          e.stopPropagation();
                          focusEntity(item.companyEntityKey!);
                        }}
                        title="Focus camera and inspect Company"
                      >
                        <UilIcon name="Location" sizeRem={12} style={{ marginRight: '4rem' }} />
                        Focus Company
                      </button>
                      <button
                        className="bam-action-btn bld"
                        onClick={(e) => {
                          e.stopPropagation();
                          focusEntity(item.entityKey);
                        }}
                        title="Focus camera and inspect physical Building"
                      >
                        <UilIcon name="Location" sizeRem={12} style={{ marginRight: '4rem' }} />
                        Focus Building
                      </button>
                    </>
                  ) : (
                    <button
                      className="bam-action-btn bld"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusEntity(item.entityKey);
                      }}
                      title="Focus camera and inspect physical Building"
                    >
                      <UilIcon name="Location" sizeRem={12} style={{ marginRight: '4rem' }} />
                      Focus Building
                    </button>
                  )}
                  {(item.needsRepair || item.isDamaged) && (
                    <button
                      className="bam-action-btn repair"
                      onClick={(e) => {
                        e.stopPropagation();
                        rebuildBuilding(item.entityKey);
                      }}
                      title="Repair damage, extinguish fire/flood, clear abandonment & restore efficiency"
                    >
                      <UilIcon name="Tools" sizeRem={12} style={{ marginRight: '4rem' }} />
                      Repair Building
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
                      <UilIcon name="Refresh" sizeRem={12} style={{ marginRight: '4rem', color: '#4dd0e1' }} />
                      Fix Path
                    </button>
                  )}
                  {showTools && (
                    <button
                      className="bam-action-btn clone"
                      onClick={(e) => {
                        e.stopPropagation();
                        cloneBuilding(item.entityKey);
                      }}
                      title="Clone building placement"
                    >
                      <UilIcon name="Copy" sizeRem={12} style={{ marginRight: '4rem' }} />
                      Clone Duplicate
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
                  <UilIcon name="Tools" sizeRem={12} style={{ marginRight: '4rem' }} />
                  Plop Building
                </button>
              )}

              {hasUpgrades && (
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8rem' }}>
                  <span style={{ fontSize: '10rem', color: '#90a4ae', fontWeight: 600, marginRight: '4rem' }}>Upgrades:</span>
                  <button
                    className={`bam-mini-pill-btn${upgradeDisplayMode === 'both' ? ' active' : ''}`}
                    style={{ marginRight: '4rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUpgradeDisplayMode('both');
                      try { bamStorage.setItem('bam_upgrade_display_mode', 'both'); } catch (err) { logCatch('UnifiedAssetExplorer', err); }
                    }}
                    title="Show both modular card and row data view"
                  >
                    Both
                  </button>
                  <button
                    className={`bam-mini-pill-btn${upgradeDisplayMode === 'card' ? ' active' : ''}`}
                    style={{ marginRight: '4rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUpgradeDisplayMode('card');
                      try { bamStorage.setItem('bam_upgrade_display_mode', 'card'); } catch (err) { logCatch('UnifiedAssetExplorer', err); }
                    }}
                    title="Show upgrades as a card only"
                  >
                    Card
                  </button>
                  <button
                    className={`bam-mini-pill-btn${upgradeDisplayMode === 'rows' ? ' active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUpgradeDisplayMode('rows');
                      try { bamStorage.setItem('bam_upgrade_display_mode', 'rows'); } catch (err) { logCatch('UnifiedAssetExplorer', err); }
                    }}
                    title="Show upgrades as row data only"
                  >
                    Row Data
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                <button
                  className="bam-action-btn"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1rem solid rgba(255,255,255,0.12)',
                    color: '#90a4ae',
                    marginRight: '6rem',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const visibleIds = (Array.isArray(buildingCardOrder) ? buildingCardOrder : []).filter((c) => !hiddenBuildingCards.has(c));
                    const allCollapsed = visibleIds.every((id) => collapsedBldCards.has(id));
                    const next = allCollapsed ? new Set<string>() : new Set<string>(visibleIds);
                    setCollapsedBldCards(next);
                    try {
                      bamStorage.setItem('bam_building_collapsed_cards', JSON.stringify(Array.from(next)));
                    } catch (err) { logCatch('UnifiedAssetExplorer', err); }
                  }}
                  title="Collapse or expand all building detail cards"
                >
                  <UilIcon
                    name={(Array.isArray(buildingCardOrder) ? buildingCardOrder : []).filter((c) => !hiddenBuildingCards.has(c)).every((id) => collapsedBldCards.has(id)) ? 'ChevronDown' : 'ChevronRight'}
                    sizeRem={10}
                    style={{ marginRight: '4rem' }}
                  />
                  {(Array.isArray(buildingCardOrder) ? buildingCardOrder : []).filter((c) => !hiddenBuildingCards.has(c)).every((id) => collapsedBldCards.has(id))
                    ? 'Expand Cards'
                    : 'Collapse Cards'}
                </button>
                <button
                  className="bam-action-btn"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1rem solid rgba(255,255,255,0.12)',
                    color: '#90a4ae',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsedBldCards(new Set());
                    try { bamStorage.removeItem('bam_building_collapsed_cards'); } catch (err) { logCatch('UnifiedAssetExplorer', err); }
                    resetBuildingCardLayout();
                  }}
                  title="Reset detail cards to default arrangement"
                >
                  <UilIcon name="Refresh" sizeRem={11} style={{ marginRight: '4rem' }} />
                  Reset Card Order
                </button>
              </div>
            </div>

    </div>
  );
};

export default InspectorDrawer;
