import React from 'react';
import ReactDOM from 'react-dom';
import { Scrollable } from 'cs2/ui';
import { CategoryFilter } from '../../models/assetModels';
import UilIcon from '../common/UilIcon';
import CustomSelect, { CustomSelectOption } from '../common/CustomSelect';
import ThemeIcon from '../common/ThemeIcon';
import PackIcon from '../common/PackIcon';

/* Flyout SVG Icons matching Image 1 design */
const FlyoutAsterisk: React.FC<{ color?: string }> = ({ color = '#38bdf8' }) => (
  <svg width="14rem" height="14rem" viewBox="0 0 24 24" fill={color}>
    <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
  </svg>
);

const StraightCornerIcon: React.FC<{ color?: string }> = ({ color = '#38bdf8' }) => (
  <svg width="15rem" height="15rem" viewBox="0 0 24 24" fill={color}>
    <rect x="5" y="4" width="14" height="8" rx="1.5" fill={color} />
    <path d="M2 18h20M7 18v3M12 18v3M17 18v3" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const LeftCornerIcon: React.FC<{ color?: string }> = ({ color = '#38bdf8' }) => (
  <svg width="15rem" height="15rem" viewBox="0 0 24 24" fill={color}>
    <rect x="10" y="4" width="10" height="8" rx="1.5" fill={color} />
    <path d="M4 4v14a2 2 0 0 0 2 2h14M4 10h-2M4 15h-2M10 20v2M15 20v2M20 20v2" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const RightCornerIcon: React.FC<{ color?: string }> = ({ color = '#38bdf8' }) => (
  <svg width="15rem" height="15rem" viewBox="0 0 24 24" fill={color}>
    <rect x="4" y="4" width="10" height="8" rx="1.5" fill={color} />
    <path d="M20 4v14a2 2 0 0 1-2 2H4M20 10h2M20 15h2M14 20v2M9 20v2M4 20v2" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const SlashCircleIcon: React.FC<{ color?: string }> = ({ color = '#94a3b8' }) => (
  <svg width="15rem" height="15rem" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <circle cx="12" cy="12" r="9" stroke={color} />
    <path d="M6 18L18 6" stroke={color} />
  </svg>
);

const ZoneHomeIcon: React.FC<{ color?: string }> = ({ color = '#66bb6a' }) => (
  <svg width="14rem" height="14rem" viewBox="0 0 24 24" fill={color}>
    <path d="M12 3L3 11h3v9h12v-9h3L12 3zm0 4.5l4 3.5v7h-8v-7l4-3.5z" fill={color} />
  </svg>
);

const ZoneCommercialIcon: React.FC<{ color?: string }> = ({ color = '#42a5f5' }) => (
  <svg width="14rem" height="14rem" viewBox="0 0 24 24" fill={color}>
    <path d="M4 4h16l-2 8H6L4 4zm2 10h12v7H6v-7zm3 2v3h6v-3H9z" fill={color} />
  </svg>
);

const ZoneIndustrialIcon: React.FC<{ color?: string }> = ({ color = '#ffa726' }) => (
  <svg width="14rem" height="14rem" viewBox="0 0 24 24" fill={color}>
    <path d="M3 21h18V9l-6 4V9l-6 4V7L3 11v10zm3-3h2v-2H6v2zm6 0h2v-2h-2v2z" fill={color} />
  </svg>
);

const ZoneOfficeIcon: React.FC<{ color?: string }> = ({ color = '#ab47bc' }) => (
  <svg width="14rem" height="14rem" viewBox="0 0 24 24" fill={color}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" fill={color} />
    <rect x="8" y="6" width="3" height="3" fill="#1e293b" />
    <rect x="13" y="6" width="3" height="3" fill="#1e293b" />
    <rect x="8" y="11" width="3" height="3" fill="#1e293b" />
    <rect x="13" y="11" width="3" height="3" fill="#1e293b" />
    <rect x="8" y="16" width="3" height="3" fill="#1e293b" />
    <rect x="13" y="16" width="3" height="3" fill="#1e293b" />
  </svg>
);

const ZoneServiceIcon: React.FC<{ color?: string }> = ({ color = '#26c6da' }) => (
  <svg width="14rem" height="14rem" viewBox="0 0 24 24" fill={color}>
    <path d="M12 2L2 7v2h20V7L12 2zM4 11v8h3v-8H4zm6 0v8h4v-8h-4zm7 0v8h3v-8h-3zM2 21h20v2H2v-2z" fill={color} />
  </svg>
);

const WithParkingIcon: React.FC<{ color?: string }> = ({ color = '#38bdf8' }) => (
  <svg width="18rem" height="18rem" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', pointerEvents: 'none' }}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M9 17V7h4.2a3 3 0 0 1 0 6H9" />
  </svg>
);

const NoParkingIcon: React.FC<{ color?: string }> = ({ color = '#f87171' }) => (
  <svg width="18rem" height="18rem" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', pointerEvents: 'none' }}>
    <circle cx="12" cy="12" r="9.5" />
    <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
    <path d="M9 16V8h3.8a2.5 2.5 0 0 1 0 5H9" />
  </svg>
);

export interface ExplorerFilterFlyoutProps {
  isBamVisible: boolean;
  showFilterFlyout: boolean;
  isFilterFlyoutOpen: boolean;
  setIsFilterFlyoutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  filterFlyoutPanelRef: React.RefObject<HTMLDivElement>;
  filterFlyoutPos: { x: number; y: number } | null;
  handleFlyoutMouseDown: (e: React.MouseEvent) => void;
  isDraggingFlyout: boolean;
  hasActiveFilters: boolean;
  handleResetFilters: () => void;
  showTooltip: (text: string, e: React.MouseEvent<HTMLElement>) => void;
  hideTooltip: () => void;
  categoryFilter: CategoryFilter;
  setCategoryFilter: (cat: CategoryFilter) => void;
  statusFilter: 'all' | 'damaged' | 'turnedOff';
  setStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'damaged' | 'turnedOff'>>;
  lotWidthFilter: string;
  setLotWidthFilter: React.Dispatch<React.SetStateAction<string>>;
  lotWidthList: string[];
  stepLotWidth: (dir: -1 | 1) => void;
  lotDepthFilter: string;
  setLotDepthFilter: React.Dispatch<React.SetStateAction<string>>;
  lotDepthList: string[];
  stepLotDepth: (dir: -1 | 1) => void;
  levelFilter: string;
  setLevelFilter: React.Dispatch<React.SetStateAction<string>>;
  stepBuildingLevel: (dir: -1 | 1) => void;
  cornerTypeFilter: 'all' | 'left' | 'straight' | 'right';
  setCornerTypeFilter: React.Dispatch<React.SetStateAction<'all' | 'left' | 'straight' | 'right'>>;
  catalogCatFilter: string;
  setCatalogCatFilter: React.Dispatch<React.SetStateAction<string>>;
  signatureCatFilter: string;
  setSignatureCatFilter: React.Dispatch<React.SetStateAction<string>>;
  densityFilter: string;
  setDensityFilter: React.Dispatch<React.SetStateAction<string>>;
  inputResourceFilter: string;
  setInputResourceFilter: React.Dispatch<React.SetStateAction<string>>;
  inputResourceOptions: CustomSelectOption[];
  outputResourceFilter: string;
  setOutputResourceFilter: React.Dispatch<React.SetStateAction<string>>;
  outputResourceOptions: CustomSelectOption[];
  storageHubFilter: string;
  setStorageHubFilter: React.Dispatch<React.SetStateAction<string>>;
  storageHubOptions: CustomSelectOption[];
  storedResourceFilter: string;
  setStoredResourceFilter: React.Dispatch<React.SetStateAction<string>>;
  storedResourceOptions: CustomSelectOption[];
  serviceTypeFilter: string;
  setServiceTypeFilter: React.Dispatch<React.SetStateAction<string>>;
  serviceTypeOptions: CustomSelectOption[];
  parkingFilter: 'all' | 'with' | 'without';
  setParkingFilter: React.Dispatch<React.SetStateAction<'all' | 'with' | 'without'>>;
  signatureOnly: boolean;
  setSignatureOnly: React.Dispatch<React.SetStateAction<boolean>>;
  groupSameName: boolean;
  setGroupSameName: React.Dispatch<React.SetStateAction<boolean>>;
  packFilter: string;
  setPackFilter: React.Dispatch<React.SetStateAction<string>>;
  regionPacks: string[];
  dlcPacks: string[];
  packIconMap: Map<string, string>;
  getPackAbbrev: (p: string) => string;
  getPackFullName: (p: string) => string;
  themeFilter: string;
  setThemeFilter: React.Dispatch<React.SetStateAction<string>>;
  themeIconMap: Map<string, string>;
}

export const ExplorerFilterFlyout: React.FC<ExplorerFilterFlyoutProps> = ({
  isBamVisible,
  showFilterFlyout,
  isFilterFlyoutOpen,
  setIsFilterFlyoutOpen,
  filterFlyoutPanelRef,
  filterFlyoutPos,
  handleFlyoutMouseDown,
  isDraggingFlyout,
  hasActiveFilters,
  handleResetFilters,
  showTooltip,
  hideTooltip,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  lotWidthFilter,
  setLotWidthFilter,
  lotWidthList,
  stepLotWidth,
  lotDepthFilter,
  setLotDepthFilter,
  lotDepthList,
  stepLotDepth,
  levelFilter,
  setLevelFilter,
  stepBuildingLevel,
  cornerTypeFilter,
  setCornerTypeFilter,
  catalogCatFilter,
  setCatalogCatFilter,
  signatureCatFilter,
  setSignatureCatFilter,
  densityFilter,
  setDensityFilter,
  inputResourceFilter,
  setInputResourceFilter,
  inputResourceOptions,
  outputResourceFilter,
  setOutputResourceFilter,
  outputResourceOptions,
  storageHubFilter,
  setStorageHubFilter,
  storageHubOptions,
  storedResourceFilter,
  setStoredResourceFilter,
  storedResourceOptions,
  serviceTypeFilter,
  setServiceTypeFilter,
  serviceTypeOptions,
  parkingFilter,
  setParkingFilter,
  signatureOnly,
  setSignatureOnly,
  groupSameName,
  setGroupSameName,
  packFilter,
  setPackFilter,
  regionPacks,
  dlcPacks,
  packIconMap,
  getPackAbbrev,
  getPackFullName,
  themeFilter,
  setThemeFilter,
  themeIconMap,
}) => {
  if (typeof document === 'undefined' || !isBamVisible || !showFilterFlyout || !isFilterFlyoutOpen) {
    return null;
  }

  return ReactDOM.createPortal(
              <div
                ref={filterFlyoutPanelRef}
                className="bam-filter-flyout-panel free-floating"
                style={{
                  left: `${(filterFlyoutPos || { x: 260, y: 110 }).x}rem`,
                  top: `${(filterFlyoutPos || { x: 260, y: 110 }).y}rem`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="bam-flyout-header"
                  onMouseDown={handleFlyoutMouseDown}
                  style={{ cursor: isDraggingFlyout ? 'grabbing' : 'grab' }}
                >
                  <div className="bam-flyout-header-title">
                    <svg width="12rem" height="12rem" viewBox="0 0 24 24" style={{ marginRight: '6rem', flexShrink: 0 }} fill="#94a3b8">
                      <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z" />
                    </svg>
                    <span className="bam-flyout-title">FILTERS</span>
                  </div>
                  <div className="bam-flyout-actions">
                    {hasActiveFilters && (
                      <button
                        className="bam-flyout-btn-reset"
                        onClick={handleResetFilters}
                        onMouseEnter={(e) => showTooltip('Reset all active filters to default', e)}
                        onMouseLeave={hideTooltip}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      className="bam-flyout-btn-close"
                      onClick={() => {
                        hideTooltip();
                        setIsFilterFlyoutOpen(false);
                      }}
                    >
                      <UilIcon name="Close" sizeRem={11} style={{ color: '#ffffff' }} />
                    </button>
                  </div>
                </div>

                <Scrollable vertical={true} trackVisibility="scrollable" className="bam-filter-flyout-body">
                {/* Row 0: Operational Status (Placed buildings only: All / Damaged / Turned Off) */}
                {categoryFilter !== 'Catalog' && (
                  <div className="bam-flyout-row">
                    <span className="bam-flyout-label">Status</span>
                    <div className="bam-flyout-controls-right">
                      <button
                        className={`bam-flyout-housing-btn${statusFilter === 'all' ? ' active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                      >
                        All
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${statusFilter === 'damaged' ? ' active' : ''}`}
                        style={{ color: statusFilter === 'damaged' ? '#0f172a' : '#ef5350' }}
                        onClick={() => setStatusFilter(statusFilter === 'damaged' ? 'all' : 'damaged')}
                      >
                        Damaged
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${statusFilter === 'turnedOff' ? ' active' : ''}`}
                        style={{ color: statusFilter === 'turnedOff' ? '#0f172a' : '#ffa726' }}
                        onClick={() => setStatusFilter(statusFilter === 'turnedOff' ? 'all' : 'turnedOff')}
                      >
                        Turned Off
                      </button>
                    </div>
                  </div>
                )}

                {/* Row 1: Lot Width */}
                <div className="bam-flyout-row">
                  <span className="bam-flyout-label">Lot Width</span>
                  <div className="bam-flyout-controls-right">
                    <div className="bam-flyout-stepper">
                      <button
                        className="bam-flyout-step-btn"
                        onClick={() => stepLotWidth(-1)}
                        onMouseEnter={(e) => showTooltip('Decrease lot width filter', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <UilIcon name="ChevronDown" sizeRem={10} style={{ color: '#ffffff' }} />
                      </button>
                      <button
                        className="bam-flyout-step-val"
                        onClick={() => setLotWidthFilter(lotWidthFilter === 'All' ? (lotWidthList.find((w) => w !== 'All') || 'All') : 'All')}
                        onMouseEnter={(e) => showTooltip(`Lot Width: ${lotWidthFilter} (Click to reset to All)`, e)}
                        onMouseLeave={hideTooltip}
                      >
                        {lotWidthFilter}
                      </button>
                      <button
                        className="bam-flyout-step-btn"
                        onClick={() => stepLotWidth(1)}
                        onMouseEnter={(e) => showTooltip('Increase lot width filter', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <UilIcon name="ChevronUp" sizeRem={10} style={{ color: '#ffffff' }} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Lot Depth */}
                <div className="bam-flyout-row">
                  <span className="bam-flyout-label">Lot Depth</span>
                  <div className="bam-flyout-controls-right">
                    <div className="bam-flyout-stepper">
                      <button
                        className="bam-flyout-step-btn"
                        onClick={() => stepLotDepth(-1)}
                        onMouseEnter={(e) => showTooltip('Decrease lot depth filter', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <UilIcon name="ChevronDown" sizeRem={10} style={{ color: '#ffffff' }} />
                      </button>
                      <button
                        className="bam-flyout-step-val"
                        onClick={() => setLotDepthFilter(lotDepthFilter === 'All' ? (lotDepthList.find((d) => d !== 'All') || 'All') : 'All')}
                        onMouseEnter={(e) => showTooltip(`Lot Depth: ${lotDepthFilter} (Click to reset to All)`, e)}
                        onMouseLeave={hideTooltip}
                      >
                        {lotDepthFilter}
                      </button>
                      <button
                        className="bam-flyout-step-btn"
                        onClick={() => stepLotDepth(1)}
                        onMouseEnter={(e) => showTooltip('Increase lot depth filter', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <UilIcon name="ChevronUp" sizeRem={10} style={{ color: '#ffffff' }} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Building Level (hidden on Service and Storage which do not have level progression) */}
                {categoryFilter !== 'Service' && categoryFilter !== 'Storage' && (
                  <div className="bam-flyout-row">
                    <span className="bam-flyout-label">Building Level</span>
                    <div className="bam-flyout-controls-right">
                      <div className="bam-flyout-stepper">
                        <button
                          className="bam-flyout-step-btn"
                          onClick={() => stepBuildingLevel(-1)}
                          onMouseEnter={(e) => showTooltip('Decrease building level filter', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <UilIcon name="ChevronDown" sizeRem={10} style={{ color: '#ffffff' }} />
                        </button>
                        <button
                          className="bam-flyout-step-val"
                          onClick={() => setLevelFilter(levelFilter === 'All' ? '1' : 'All')}
                          onMouseEnter={(e) => showTooltip(`Building Level: ${levelFilter === 'All' ? 'All Levels' : `Level ${levelFilter}`} (Click to toggle)`, e)}
                          onMouseLeave={hideTooltip}
                        >
                          {levelFilter === 'All' ? 'All' : `Level ${levelFilter}`}
                        </button>
                        <button
                          className="bam-flyout-step-btn"
                          onClick={() => stepBuildingLevel(1)}
                          onMouseEnter={(e) => showTooltip('Increase building level filter', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <UilIcon name="ChevronUp" sizeRem={10} style={{ color: '#ffffff' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 4: Corner Type (applicable to zoned lots; hidden on Service and Storage) */}
                {categoryFilter !== 'Service' && categoryFilter !== 'Storage' && (
                  <div className="bam-flyout-row">
                    <span className="bam-flyout-label">Corner Type</span>
                    <div className="bam-flyout-controls-right">
                      <button
                        className={`bam-flyout-tile-btn${cornerTypeFilter === 'all' ? ' active' : ''}`}
                        onClick={() => setCornerTypeFilter('all')}
                        onMouseEnter={(e) => showTooltip('Corner Type: All lots (no corner restriction)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <FlyoutAsterisk color={cornerTypeFilter === 'all' ? '#0f172a' : '#38bdf8'} />
                      </button>
                      <button
                        className={`bam-flyout-tile-btn${cornerTypeFilter === 'straight' ? ' active' : ''}`}
                        onClick={() => setCornerTypeFilter('straight')}
                        onMouseEnter={(e) => showTooltip('Corner Type: Straight (Mid-block standard lots)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <StraightCornerIcon color={cornerTypeFilter === 'straight' ? '#0f172a' : '#38bdf8'} />
                      </button>
                      <button
                        className={`bam-flyout-tile-btn${cornerTypeFilter === 'left' ? ' active' : ''}`}
                        onClick={() => setCornerTypeFilter('left')}
                        onMouseEnter={(e) => showTooltip('Corner Type: Left Corner lots', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <LeftCornerIcon color={cornerTypeFilter === 'left' ? '#0f172a' : '#38bdf8'} />
                      </button>
                      <button
                        className={`bam-flyout-tile-btn${cornerTypeFilter === 'right' ? ' active' : ''}`}
                        onClick={() => setCornerTypeFilter('right')}
                        onMouseEnter={(e) => showTooltip('Corner Type: Right Corner lots', e)}
                        onMouseLeave={hideTooltip}
                      >
                        <RightCornerIcon color={cornerTypeFilter === 'right' ? '#0f172a' : '#38bdf8'} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Row 5: Zone Type (on Catalog or Signature, filters within the active tab instead of leaving it) */}
                {(() => {
                  const activeZone =
                    categoryFilter === 'Catalog'
                      ? catalogCatFilter
                      : categoryFilter === 'Signature'
                      ? signatureCatFilter
                      : categoryFilter;
                  const selectZone = (z: CategoryFilter) => {
                    if (categoryFilter === 'Catalog') {
                      setCatalogCatFilter(z === 'All' ? 'All' : catalogCatFilter === z ? 'All' : z);
                    } else if (categoryFilter === 'Signature') {
                      setSignatureCatFilter(z === 'All' ? 'All' : signatureCatFilter === z ? 'All' : z);
                    } else {
                      setCategoryFilter(z === 'All' ? 'All' : categoryFilter === z ? 'All' : z);
                    }
                  };
                  return (
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Zone Type</span>
                      <div className="bam-flyout-controls-right">
                        <button
                          className={`bam-flyout-tile-btn${activeZone === 'All' ? ' active' : ''}`}
                          onClick={() => selectZone('All')}
                          onMouseEnter={(e) => showTooltip('Zone: All zones & categories', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <FlyoutAsterisk color={activeZone === 'All' ? '#0f172a' : '#38bdf8'} />
                        </button>
                        <button
                          className={`bam-flyout-tile-btn${activeZone === 'Residential' ? ' active' : ''}`}
                          onClick={() => selectZone('Residential')}
                          onMouseEnter={(e) => showTooltip('Zone: Residential zones', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <ZoneHomeIcon color={activeZone === 'Residential' ? '#0f172a' : '#66bb6a'} />
                        </button>
                        <button
                          className={`bam-flyout-tile-btn${activeZone === 'Commercial' ? ' active' : ''}`}
                          onClick={() => selectZone('Commercial')}
                          onMouseEnter={(e) => showTooltip('Zone: Commercial zones', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <ZoneCommercialIcon color={activeZone === 'Commercial' ? '#0f172a' : '#42a5f5'} />
                        </button>
                        <button
                          className={`bam-flyout-tile-btn${activeZone === 'Industrial' ? ' active' : ''}`}
                          onClick={() => selectZone('Industrial')}
                          onMouseEnter={(e) => showTooltip('Zone: Industrial & manufacturing zones', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <ZoneIndustrialIcon color={activeZone === 'Industrial' ? '#0f172a' : '#ffa726'} />
                        </button>
                        <button
                          className={`bam-flyout-tile-btn${activeZone === 'Office' ? ' active' : ''}`}
                          onClick={() => selectZone('Office')}
                          onMouseEnter={(e) => showTooltip('Zone: Office zones', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <ZoneOfficeIcon color={activeZone === 'Office' ? '#0f172a' : '#ab47bc'} />
                        </button>
                        <button
                          className={`bam-flyout-tile-btn${activeZone === 'Service' ? ' active' : ''}`}
                          onClick={() => selectZone('Service')}
                          onMouseEnter={(e) => showTooltip('Zone: City Services, civic buildings & utilities', e)}
                          onMouseLeave={hideTooltip}
                        >
                          <ZoneServiceIcon color={activeZone === 'Service' ? '#0f172a' : '#26c6da'} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Housing Zone Type (Not building levels, but Low, Row, Medium, Mixed, Low Rent, High) */}
                {(categoryFilter === 'Residential' || categoryFilter === 'All') && (
                  <div className="bam-flyout-row">
                    <span className="bam-flyout-label">Housing Type</span>
                    <div className="bam-flyout-controls-right">
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'All' ? ' active' : ''}`}
                        onClick={() => setDensityFilter('All')}
                        onMouseEnter={(e) => showTooltip('All Housing Types', e)}
                        onMouseLeave={hideTooltip}
                      >
                        All
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'Low' ? ' active' : ''}`}
                        onClick={() => setDensityFilter(densityFilter === 'Low' ? 'All' : 'Low')}
                        onMouseEnter={(e) => showTooltip('Low Density Housing (Single-Family Detached Homes)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        Low
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'Row' ? ' active' : ''}`}
                        onClick={() => setDensityFilter(densityFilter === 'Row' ? 'All' : 'Row')}
                        onMouseEnter={(e) => showTooltip('Row Housing (Attached Townhomes / Terraces)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        Row
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'Medium' ? ' active' : ''}`}
                        onClick={() => setDensityFilter(densityFilter === 'Medium' ? 'All' : 'Medium')}
                        onMouseEnter={(e) => showTooltip('Medium Density Housing (Multi-Family Apartments)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        Medium
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'Mixed' ? ' active' : ''}`}
                        onClick={() => setDensityFilter(densityFilter === 'Mixed' ? 'All' : 'Mixed')}
                        onMouseEnter={(e) => showTooltip('Mixed Housing (Commercial Ground Floor + Residential Living)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        Mixed
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'Low Rent' ? ' active' : ''}`}
                        onClick={() => setDensityFilter(densityFilter === 'Low Rent' ? 'All' : 'Low Rent')}
                        onMouseEnter={(e) => showTooltip('Low Rent / Low Income Housing (Affordable High-Density Micro-Units)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        Low Rent
                      </button>
                      <button
                        className={`bam-flyout-housing-btn${densityFilter === 'High' ? ' active' : ''}`}
                        onClick={() => setDensityFilter(densityFilter === 'High' ? 'All' : 'High')}
                        onMouseEnter={(e) => showTooltip('High Density Housing (High-Rise Residential Towers)', e)}
                        onMouseLeave={hideTooltip}
                      >
                        High
                      </button>
                    </div>
                  </div>
                )}

                {/* Office Zone Filters: Output Services/Goods & Density */}
                {categoryFilter === 'Office' && (
                  <>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Office Services</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={outputResourceFilter}
                          options={outputResourceOptions}
                          onChange={(val) => setOutputResourceFilter(val)}
                          title="Filter by office software, finance, telecom, or media outputs"
                        />
                      </div>
                    </div>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Office Density</span>
                      <div className="bam-flyout-controls-right">
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'All' ? ' active' : ''}`}
                          onClick={() => setDensityFilter('All')}
                          onMouseEnter={(e) => showTooltip('All Office Densities', e)}
                          onMouseLeave={hideTooltip}
                        >
                          All
                        </button>
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'Low' ? ' active' : ''}`}
                          onClick={() => setDensityFilter(densityFilter === 'Low' ? 'All' : 'Low')}
                          onMouseEnter={(e) => showTooltip('Low Density Offices', e)}
                          onMouseLeave={hideTooltip}
                        >
                          Low Density
                        </button>
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'High' ? ' active' : ''}`}
                          onClick={() => setDensityFilter(densityFilter === 'High' ? 'All' : 'High')}
                          onMouseEnter={(e) => showTooltip('High Density Offices (Office Towers)', e)}
                          onMouseLeave={hideTooltip}
                        >
                          High Density
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Dynamic Zone-Aware Resource & Density Filters */}
                {categoryFilter === 'Industrial' && (
                  <>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Industrial Zone</span>
                      <div className="bam-flyout-controls-right">
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'All' ? ' active' : ''}`}
                          onClick={() => setDensityFilter('All')}
                        >
                          All
                        </button>
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'Manufacturing' ? ' active' : ''}`}
                          onClick={() => setDensityFilter(densityFilter === 'Manufacturing' ? 'All' : 'Manufacturing')}
                        >
                          Manufacturing
                        </button>
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'Specialized' ? ' active' : ''}`}
                          onClick={() => setDensityFilter(densityFilter === 'Specialized' ? 'All' : 'Specialized')}
                        >
                          Specialized
                        </button>
                      </div>
                    </div>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Ingoing (Inputs)</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={inputResourceFilter}
                          options={inputResourceOptions}
                          onChange={(val) => setInputResourceFilter(val)}
                          title="Filter by raw materials & agricultural inputs"
                        />
                      </div>
                    </div>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Outgoing (Products)</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={outputResourceFilter}
                          options={outputResourceOptions}
                          onChange={(val) => setOutputResourceFilter(val)}
                          title="Filter by manufactured products & building materials"
                        />
                      </div>
                    </div>
                  </>
                )}

                {categoryFilter === 'Commercial' && (
                  <>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Commercial Density</span>
                      <div className="bam-flyout-controls-right">
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'All' ? ' active' : ''}`}
                          onClick={() => setDensityFilter('All')}
                        >
                          All
                        </button>
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'Low' ? ' active' : ''}`}
                          onClick={() => setDensityFilter(densityFilter === 'Low' ? 'All' : 'Low')}
                        >
                          Low Density
                        </button>
                        <button
                          className={`bam-flyout-housing-btn${densityFilter === 'High' ? ' active' : ''}`}
                          onClick={() => setDensityFilter(densityFilter === 'High' ? 'All' : 'High')}
                        >
                          High Density
                        </button>
                      </div>
                    </div>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Goods Sold</span>
                    <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                      <CustomSelect
                        value={outputResourceFilter}
                        options={outputResourceOptions}
                        onChange={(val) => setOutputResourceFilter(val)}
                        title="Filter by commercial goods & sold commodities"
                      />
                    </div>
                  </div>
                  </>
                )}

                {categoryFilter === 'Storage' && (
                  <>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Hub / Facility Type</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={storageHubFilter}
                          options={storageHubOptions}
                          onChange={(val) => setStorageHubFilter(val)}
                          title="Filter by storage hub facility type (Warehouse, Silo, Cargo Terminal, etc.)"
                        />
                      </div>
                    </div>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Stored Resource</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={storedResourceFilter}
                          options={storedResourceOptions}
                          onChange={(val) => setStoredResourceFilter(val)}
                          title="Filter by stored cargo & warehouse resources"
                        />
                      </div>
                    </div>
                  </>
                )}

                {categoryFilter === 'Service' && (
                  <div className="bam-flyout-row">
                    <span className="bam-flyout-label">Service Type</span>
                    <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                      <CustomSelect
                        value={serviceTypeFilter}
                        options={serviceTypeOptions}
                        onChange={(val) => setServiceTypeFilter(val)}
                        title="Filter by civic service type"
                      />
                    </div>
                  </div>
                )}

                {categoryFilter === 'All' && (
                  <>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Ingoing Resource</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={inputResourceFilter}
                          options={inputResourceOptions}
                          onChange={(val) => setInputResourceFilter(val)}
                          title="Filter by input resource across all zones"
                        />
                      </div>
                    </div>
                    <div className="bam-flyout-row">
                      <span className="bam-flyout-label">Outgoing Resource</span>
                      <div className="bam-flyout-controls-right" style={{ maxWidth: '280rem' }}>
                        <CustomSelect
                          value={outputResourceFilter}
                          options={outputResourceOptions}
                          onChange={(val) => setOutputResourceFilter(val)}
                          title="Filter by output product across all zones"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Row 6: Extra Filters */}
                <div className="bam-flyout-row">
                  <span className="bam-flyout-label">Extra Filters</span>
                  <div className="bam-flyout-controls-right">
                    <button
                      className={`bam-flyout-tile-btn${parkingFilter === 'with' ? ' active' : ''}`}
                      onClick={() => setParkingFilter(parkingFilter === 'with' ? 'all' : 'with')}
                      onMouseEnter={(e) => showTooltip('Parking: Show buildings WITH parking lots/spaces', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <WithParkingIcon color={parkingFilter === 'with' ? '#0f172a' : '#38bdf8'} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${parkingFilter === 'without' ? ' active' : ''}`}
                      onClick={() => setParkingFilter(parkingFilter === 'without' ? 'all' : 'without')}
                      onMouseEnter={(e) => showTooltip('Parking: Show buildings WITHOUT parking lots/spaces', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <NoParkingIcon color={parkingFilter === 'without' ? '#0f172a' : '#f87171'} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${signatureOnly ? ' active' : ''}`}
                      onClick={() => setSignatureOnly(!signatureOnly)}
                      onMouseEnter={(e) => showTooltip('Signature: Show unique landmark signature buildings only', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <UilIcon name="Star" sizeRem={14} style={{ color: signatureOnly ? '#0f172a' : '#ffd54f' }} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${groupSameName ? ' active' : ''}`}
                      onClick={() => setGroupSameName(!groupSameName)}
                      onMouseEnter={(e) => showTooltip('Group Same Name: Group identical buildings under expandable rows', e)}
                      onMouseLeave={hideTooltip}
                      style={{ width: 'auto', padding: '0 8rem' }}
                    >
                      <UilIcon name="Layers" sizeRem={12} style={{ color: groupSameName ? '#0f172a' : '#4ade80', marginRight: '3rem' }} />
                      <span style={{ fontSize: '10rem', fontWeight: 700, color: groupSameName ? '#0f172a' : '#e2e8f0' }}>Group</span>
                    </button>
                  </div>
                </div>

                {/* Row 7: Pack (Regional & Custom Content Packs) */}
                <div className="bam-flyout-row">
                  <span className="bam-flyout-label">Pack</span>
                  <div className="bam-flyout-controls-right">
                    <button
                      className={`bam-flyout-tile-btn${packFilter === 'All' ? ' active' : ''}`}
                      onClick={() => setPackFilter('All')}
                      onMouseEnter={(e) => showTooltip('Pack: All regional content packs', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <FlyoutAsterisk color={packFilter === 'All' ? '#0f172a' : '#38bdf8'} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${packFilter === 'Base Game' ? ' active' : ''}`}
                      onClick={() => setPackFilter(packFilter === 'Base Game' ? 'All' : 'Base Game')}
                      onMouseEnter={(e) => showTooltip('Pack: Base Game only (No regional pack)', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <PackIcon pack="Base Game" sizeRem={18} />
                    </button>
                    {regionPacks.map((p) => {
                      const isSelected = (packFilter || '').toLowerCase() === String(p || '').toLowerCase();
                      const abbrev = getPackAbbrev(p);
                      const icon = packIconMap.get(p);
                      const fullName = getPackFullName(p);
                      return (
                        <button
                          key={p}
                          className={`bam-flyout-tile-btn${isSelected ? ' active' : ''}`}
                          onClick={() => setPackFilter(isSelected ? 'All' : p)}
                          onMouseEnter={(e) => showTooltip(`Pack: ${fullName} (${abbrev})`, e)}
                          onMouseLeave={hideTooltip}
                        >
                          {icon ? (
                            <PackIcon pack={p} packIcon={icon} sizeRem={18} />
                          ) : (
                            <span>{abbrev}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 8: Theme */}
                <div className="bam-flyout-row">
                  <span className="bam-flyout-label">Theme</span>
                  <div className="bam-flyout-controls-right">
                    <button
                      className={`bam-flyout-tile-btn${themeFilter === 'All' ? ' active' : ''}`}
                      onClick={() => setThemeFilter('All')}
                      onMouseEnter={(e) => showTooltip('Theme: All architectural themes', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <FlyoutAsterisk color={themeFilter === 'All' ? '#0f172a' : '#38bdf8'} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${themeFilter === 'Unknown' ? ' active' : ''}`}
                      onClick={() => setThemeFilter(themeFilter === 'Unknown' ? 'All' : 'Unknown')}
                      onMouseEnter={(e) => showTooltip('Theme: Universal / Global / Neutral (no specific regional theme)', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <UilIcon name="Globe" sizeRem={18} style={{ color: themeFilter === 'Unknown' ? '#0f172a' : '#38bdf8' }} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${themeFilter === 'European' || themeFilter === 'EU' ? ' active' : ''}`}
                      onClick={() => setThemeFilter(themeFilter === 'European' ? 'All' : 'European')}
                      onMouseEnter={(e) => showTooltip('Theme: European architectural theme', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <ThemeIcon theme="European" themeIcon={themeIconMap.get('European')} sizeRem={18} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${themeFilter === 'North American' || themeFilter === 'USA' ? ' active' : ''}`}
                      onClick={() => setThemeFilter(themeFilter === 'North American' ? 'All' : 'North American')}
                      onMouseEnter={(e) => showTooltip('Theme: North American architectural theme', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <ThemeIcon theme="North American" themeIcon={themeIconMap.get('North American')} sizeRem={18} />
                    </button>
                  </div>
                </div>

                {/* Row 9: DLC (Official Paid DLCs & Content Creator Packs) */}
                <div className="bam-flyout-row">
                  <span className="bam-flyout-label">DLC</span>
                  <div className="bam-flyout-controls-right">
                    <button
                      className={`bam-flyout-tile-btn${packFilter === 'All' ? ' active' : ''}`}
                      onClick={() => setPackFilter('All')}
                      onMouseEnter={(e) => showTooltip('DLC: All DLCs & Content Creator Packs', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <FlyoutAsterisk color={packFilter === 'All' ? '#0f172a' : '#38bdf8'} />
                    </button>
                    <button
                      className={`bam-flyout-tile-btn${packFilter === 'Base Game' ? ' active' : ''}`}
                      onClick={() => setPackFilter(packFilter === 'Base Game' ? 'All' : 'Base Game')}
                      onMouseEnter={(e) => showTooltip('DLC: Base Game assets only (No DLC required)', e)}
                      onMouseLeave={hideTooltip}
                    >
                      <PackIcon pack="Base Game" sizeRem={18} />
                    </button>
                    {dlcPacks.map((p) => {
                      const isSelected = (packFilter || '').toLowerCase() === String(p || '').toLowerCase();
                      const fullName = getPackFullName(p);
                      return (
                        <button
                          key={p}
                          className={`bam-flyout-tile-btn ccp${isSelected ? ' active' : ''}`}
                          onClick={() => setPackFilter(isSelected ? 'All' : p)}
                          onMouseEnter={(e) => showTooltip(`DLC: ${fullName}`, e)}
                          onMouseLeave={hideTooltip}
                        >
                          <PackIcon pack={p} packIcon={packIconMap.get(p)} sizeRem={18} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                </Scrollable>
              </div>,
    document.body
  );
};

export default ExplorerFilterFlyout;
