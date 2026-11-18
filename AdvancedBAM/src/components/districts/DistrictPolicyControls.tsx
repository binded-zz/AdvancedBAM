import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Scrollable } from 'cs2/ui';
import { useLocalization } from 'cs2/l10n';
import { DistrictPolicyActive, DistrictPolicyMeta, DistrictItem } from '../../models/assetModels';
import {
  getConflictingActivePolicies,
  isPolicyForCity,
  isPolicyForDistrict,
  resolvePolicySliderMax,
} from './policyConfig';
import { formatPolicyDisplayName } from '../../utils/formatters';
import UilIcon from '../common/UilIcon';
import BamCustomSlider from '../common/BamCustomSlider';
import { CustomSelect, CustomSelectOption } from '../common/CustomSelect';
import { getPixelsPerRem } from '../dragHelper';

interface DistrictPolicyControlsProps {
  districtKey: string;
  isCity: boolean;
  policyMetas: DistrictPolicyMeta[];
  activePolicies: DistrictPolicyActive[];
  allDistricts?: DistrictItem[];
  onTogglePolicy: (
    districtKey: string,
    policyKey: string,
    active: boolean,
    adjustment?: number
  ) => void;
  onSetAdjustment: (
    districtKey: string,
    policyKey: string,
    adjustment: number
  ) => void;
  onApplyToAll?: (
    policyKey: string,
    active: boolean,
    adjustment?: number
  ) => void;
  onCopyFrom?: (
    sourceKey: string,
    targetKey: string
  ) => void;
  onResetPolicies?: (
    districtKey: string
  ) => void;
}

export const DistrictPolicyControls: React.FC<DistrictPolicyControlsProps> = ({
  districtKey,
  isCity,
  policyMetas = [],
  activePolicies = [],
  allDistricts = [],
  onTogglePolicy,
  onSetAdjustment,
  onApplyToAll,
  onCopyFrom,
  onResetPolicies,
}) => {
  const { translate } = useLocalization();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active'>('all');
  const [categoryTab, setCategoryTab] = useState<'all' | 'vanilla' | 'policyplus'>('all');
  const [viewMode, setViewMode] = useState<'icon' | 'detailed'>('icon');
  const [activeSliderPolicyKey, setActiveSliderPolicyKey] = useState<string | null>(null);
  const [selectedCopySource, setSelectedCopySource] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const showTooltip = (text: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = getPixelsPerRem();
    setHoveredTooltip({
      text,
      x: (rect.left + rect.width / 2) / scale,
      y: (rect.top - 6) / scale,
    });
  };

  const hideTooltip = () => {
    setHoveredTooltip(null);
  };

  const otherDistricts = useMemo(
    () => (allDistricts || []).filter((d) => d.entityKey !== districtKey && !d.isCity && d.entityKey !== 'city' && d.entityKey !== 'City'),
    [allDistricts, districtKey]
  );

  const currentDistrict = useMemo(() => {
    return (allDistricts || []).find((d) => d.entityKey === districtKey);
  }, [allDistricts, districtKey]);
  const currentDistrictName = currentDistrict?.name || 'this district';

  const selectedSourceDistrict = useMemo(() => {
    return otherDistricts.find((od) => od.entityKey === selectedCopySource);
  }, [otherDistricts, selectedCopySource]);
  const selectedSourceName = selectedSourceDistrict ? selectedSourceDistrict.name : '';

  const copyTooltipText = selectedSourceName
    ? `Copying policies from "${selectedSourceName}" to this district ("${currentDistrictName}")`
    : `Select a source district to copy its policies to this district ("${currentDistrictName}")`;

  const safeMetas = useMemo(() => (Array.isArray(policyMetas) ? policyMetas : []), [policyMetas]);
  const safeActives = useMemo(() => (Array.isArray(activePolicies) ? activePolicies : []), [activePolicies]);

  // Pre-build human-readable policy name lookup for both entityKey and raw name
  const policyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    safeMetas.forEach((pm) => {
      if (!pm) return;
      const clean = formatPolicyDisplayName(pm.name, undefined, translate);
      if (pm.name) map.set(pm.name, clean);
      if (pm.entityKey) map.set(pm.entityKey, clean);
    });
    return map;
  }, [safeMetas, translate]);

  // Check whether Policy Plus mods exist in this game session
  const hasPolicyPlus = useMemo(() => {
    return safeMetas.some((p) => p && p.name && (p.name.startsWith('PP_') || p.name.startsWith('DP_')));
  }, [safeMetas]);

  // Filter applicable policies for this scope (city vs district)
  const applicableMetas = useMemo(() => {
    const filtered = safeMetas.filter((p) => {
      if (!p) return false;
      if (isCity) return isPolicyForCity(p);
      return isPolicyForDistrict(p);
    });
    // Native game policies first, then modded/Policy Plus policies
    return filtered.slice().sort((a, b) => {
      const aName = a.name || '';
      const bName = b.name || '';
      const aMod = aName.startsWith('PP_') || aName.startsWith('DP_') ? 1 : 0;
      const bMod = bName.startsWith('PP_') || bName.startsWith('DP_') ? 1 : 0;
      if (aMod !== bMod) return aMod - bMod;
      return aName.localeCompare(bName);
    });
  }, [safeMetas, isCity]);

  // Filtered list based on search, active status, and category tab
  const displayedPolicies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return applicableMetas.filter((pol) => {
      const rawName = pol.name || '';
      const isPP = rawName.startsWith('PP_') || rawName.startsWith('DP_');
      if (categoryTab === 'vanilla' && isPP) return false;
      if (categoryTab === 'policyplus' && !isPP) return false;

      const activeItem = safeActives.find((ap) => ap && ap.key === pol.entityKey);
      const isActive = !!activeItem;

      if (filterMode === 'active' && !isActive) return false;

      if (q) {
        const displayTitle = formatPolicyDisplayName(rawName, policyNameMap, translate);
        const matchesName = rawName.toLowerCase().includes(q);
        const matchesTitle = displayTitle.toLowerCase().includes(q);
        if (!matchesName && !matchesTitle) return false;
      }

      return true;
    });
  }, [applicableMetas, safeActives, searchQuery, filterMode, categoryTab, policyNameMap, translate]);

  const activeSliderPolicy = useMemo(() => {
    if (!activeSliderPolicyKey) return null;
    return safeMetas.find((p) => p.entityKey === activeSliderPolicyKey) || null;
  }, [activeSliderPolicyKey, safeMetas]);

  const activeSliderAdj = useMemo(() => {
    if (!activeSliderPolicyKey) return 0;
    const item = safeActives.find((ap) => ap.key === activeSliderPolicyKey);
    return item?.adjustment ?? activeSliderPolicy?.sliderDefault ?? 0;
  }, [activeSliderPolicyKey, safeActives, activeSliderPolicy]);

  const copySourceOptions: CustomSelectOption[] = useMemo(() => {
    return [
      { value: '', label: 'Select source district...' },
      ...otherDistricts.map((od) => ({
        value: od.entityKey,
        label: `${od.name} (${od.policies?.length || 0} active)`,
      })),
    ];
  }, [otherDistricts]);

  if (applicableMetas.length === 0) {
    return <div className="bam-no-policies">No policies available for this selection.</div>;
  }

  const activeCount = safeActives.length;

  return (
    <div className="bam-policy-controls-wrap">
      {/* Search and Filter Bar */}
      <div className="bam-policy-toolbar">
        <div className="bam-policy-search-box">
          <input
            type="text"
            className="bam-policy-search-input"
            placeholder="Search policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="bam-search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              x
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="bam-policy-tab-group">
          <button
            className={`bam-policy-tab${categoryTab === 'all' ? ' active' : ''}`}
            onClick={() => setCategoryTab('all')}
          >
            All
          </button>
          <button
            className={`bam-policy-tab${categoryTab === 'vanilla' ? ' active' : ''}`}
            onClick={() => setCategoryTab('vanilla')}
          >
            Standard
          </button>
          {hasPolicyPlus && (
            <button
              className={`bam-policy-tab${categoryTab === 'policyplus' ? ' active' : ''}`}
              onClick={() => setCategoryTab('policyplus')}
            >
              Policy Plus
            </button>
          )}
        </div>

        {/* Status Toggle */}
        <div className="bam-policy-status-toggle-wrap">
          <button
            className={`bam-policy-filter-btn${filterMode === 'all' ? ' active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            {`Available (${applicableMetas.length})`}
          </button>
          <button
            className={`bam-policy-filter-btn${filterMode === 'active' ? ' active' : ''}`}
            onClick={() => setFilterMode('active')}
          >
            {`Active (${activeCount})`}
          </button>
        </div>

        {/* View Mode Toggle: Icon Only vs Detailed Cards */}
        <div className="bam-policy-view-mode-group">
          <button
            className={`bam-view-mode-btn${viewMode === 'icon' ? ' active' : ''}`}
            onClick={() => setViewMode('icon')}
            title="Compact icon grid view"
          >
            Icons
          </button>
          <button
            className={`bam-view-mode-btn${viewMode === 'detailed' ? ' active' : ''}`}
            onClick={() => setViewMode('detailed')}
            title="Detailed cards view with full text"
          >
            Cards
          </button>
        </div>
      </div>

      {/* Preset & Bulk Actions Bar (for individual districts) */}
      {!isCity && (
        <div className="bam-policy-bulk-bar">
          <div className="bam-bulk-copy-group">
            <span className="bam-bulk-label">Copy Policies:</span>
            <CustomSelect
              className="bam-bulk-select"
              value={selectedCopySource}
              options={copySourceOptions}
              onChange={(val) => {
                setSelectedCopySource(val);
                hideTooltip();
              }}
              placeholder="Select source district..."
            />
            <div
              className="bam-bulk-copy-btn-wrap"
              onMouseEnter={(e) => showTooltip(copyTooltipText, e)}
              onMouseLeave={hideTooltip}
              style={{ display: 'flex' }}
              title={copyTooltipText}
            >
              <button
                className={`bam-bulk-action-btn${copiedSuccess ? ' success' : !selectedCopySource ? ' disabled' : ''}`}
                onClick={() => {
                  if (!selectedCopySource && !copiedSuccess) return;
                  if (selectedCopySource && onCopyFrom) {
                    onCopyFrom(selectedCopySource, districtKey);
                    setSelectedCopySource('');
                    setCopiedSuccess(true);
                    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
                    copiedTimerRef.current = window.setTimeout(() => {
                      copiedTimerRef.current = null;
                      setCopiedSuccess(false);
                    }, 2200);
                    hideTooltip();
                  }
                }}
                title={copiedSuccess ? 'Policies copied successfully!' : copyTooltipText}
              >
                {copiedSuccess ? (
                  <>
                    <UilIcon name="Checkmark" sizeRem={10} style={{ marginRight: '4rem', color: '#81c784' }} />
                    <span style={{ color: '#81c784' }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <UilIcon name="Copy" sizeRem={10} style={{ marginRight: '4rem' }} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bam-bulk-reset-group">
            <button
              className={`bam-bulk-reset-btn${safeActives.length === 0 ? ' disabled' : ''}`}
              onClick={() => {
                if (safeActives.length === 0) return;
                if (onResetPolicies) onResetPolicies(districtKey);
              }}
              title="Turn off all active policies for this district"
            >
              <UilIcon name="Trash" sizeRem={10} style={{ marginRight: '4rem' }} />
              <span>{`Reset All (${safeActives.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Slider Drawer for Icon Mode */}
      {viewMode === 'icon' && activeSliderPolicy && (
        <div className="bam-policy-compact-slider-box">
          <div className="bam-slider-header">
            <span className="bam-slider-name">
              {formatPolicyDisplayName(activeSliderPolicy.name, policyNameMap, translate)}
            </span>
            <div className="bam-slider-header-actions">
              {!isCity && onApplyToAll && (
                <button
                  className="bam-slider-apply-all-btn"
                  onClick={() => {
                    onApplyToAll(activeSliderPolicy.entityKey, true, activeSliderAdj);
                  }}
                  title="Apply this policy with current setting to ALL districts"
                >
                  Apply All
                </button>
              )}
              <button
                className="bam-slider-deactivate-btn"
                onClick={() => {
                  onTogglePolicy(districtKey, activeSliderPolicy.entityKey, false, activeSliderAdj);
                  setActiveSliderPolicyKey(null);
                }}
                title="Deactivate this policy"
              >
                Turn Off
              </button>
              <button
                className="bam-slider-close"
                onClick={() => setActiveSliderPolicyKey(null)}
                title="Keep value and close slider"
              >
                ✓ Done
              </button>
            </div>
          </div>
          <BamCustomSlider
            value={activeSliderAdj}
            min={activeSliderPolicy.sliderMin ?? 0}
            max={resolvePolicySliderMax(activeSliderPolicy)}
            step={1}
            onChange={(val) => onSetAdjustment(districtKey, activeSliderPolicy.entityKey, val)}
          />
        </div>
      )}

      {/* Policies Display (Bounded inside Cohtml-safe Scrollable) */}
      {displayedPolicies.length === 0 ? (
        <div className="bam-no-policies">
          {filterMode === 'active'
            ? 'No policies are currently active. Switch to "Available" to browse and activate.'
            : 'No matching policies found.'}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '320rem',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <Scrollable vertical={true} trackVisibility="scrollable" style={{ maxHeight: '320rem' }}>
            {viewMode === 'icon' ? (
              /* ICON-ONLY COMPACT GRID */
              <div className="bam-policies-icon-grid">
                {displayedPolicies.map((pol) => {
                  const activeItem = safeActives.find((ap) => ap.key === pol.entityKey);
                  const isActive = !!activeItem;
                  const currentAdj = activeItem?.adjustment ?? pol.sliderDefault ?? 0;
                  const conflicts = getConflictingActivePolicies(pol.name, safeActives, safeMetas);
                  const hasConflict = !isActive && conflicts.length > 0;

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
                    pol.hasSlider && isActive ? ' (or click slider icon to adjust value)' : ''
                  }`;

                  const isSelectedForSlider = activeSliderPolicyKey === pol.entityKey;

                  return (
                    <div key={pol.entityKey} className="bam-policy-icon-tile-wrap">
                      <button
                        className={`bam-policy-icon-tile${isActive ? ' active' : ''}${
                          hasConflict ? ' conflict disabled' : ''
                        }${isSelectedForSlider ? ' slider-selected' : ''}`}
                        title={tooltip}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasConflict) return;
                          onTogglePolicy(districtKey, pol.entityKey, !isActive, currentAdj);
                          if (!isActive && pol.hasSlider) {
                            setActiveSliderPolicyKey(pol.entityKey);
                          } else if (isActive && isSelectedForSlider) {
                            setActiveSliderPolicyKey(null);
                          }
                        }}
                      >
                        {pol.icon ? (
                          <img src={pol.icon} className="bam-policy-tile-img" alt={title} />
                        ) : (
                          <span className="bam-policy-tile-initials">{title.substring(0, 3)}</span>
                        )}
                        {pol.hasSlider && isActive && (
                          <span
                            className="bam-policy-tile-slider-badge"
                            title="Adjust policy slider"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSliderPolicyKey(isSelectedForSlider ? null : pol.entityKey);
                            }}
                          >
                            <svg
                              width="8rem"
                              height="8rem"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#eceff1"
                              strokeWidth="2.5"
                            >
                              <line x1="4" y1="7" x2="20" y2="7" />
                              <circle cx="8" cy="7" r="2.5" fill="#4fc3f7" stroke="none" />
                              <line x1="4" y1="17" x2="20" y2="17" />
                              <circle cx="16" cy="17" r="2.5" fill="#4fc3f7" stroke="none" />
                            </svg>
                          </span>
                        )}
                      </button>
                      <span className="bam-policy-tile-caption" title={title}>
                        {title}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DETAILED CARDS VIEW */
              <div className="bam-policies-grid">
                {displayedPolicies.map((pol) => {
                  const activeItem = safeActives.find((ap) => ap.key === pol.entityKey);
                  const isActive = !!activeItem;
                  const currentAdj = activeItem?.adjustment ?? pol.sliderDefault ?? 0;

                  const conflicts = getConflictingActivePolicies(pol.name, safeActives, safeMetas);
                  const hasConflict = !isActive && conflicts.length > 0;

                  const descKey = `Policy.DESCRIPTION[${pol.name}]`;
                  const title = formatPolicyDisplayName(pol.name, policyNameMap, translate);
                  const rawDesc = translate(descKey, '') ?? '';
                  const desc = rawDesc && !rawDesc.includes('[') ? rawDesc : '';
                  const conflictLabels = conflicts.map((c) =>
                    formatPolicyDisplayName(c, policyNameMap, translate)
                  );

                  return (
                    <div
                      key={pol.entityKey}
                      className={`bam-policy-card${isActive ? ' active' : ''}${
                        hasConflict ? ' conflict' : ''
                      }`}
                    >
                      <div className="bam-policy-header">
                        {pol.icon && <img src={pol.icon} className="bam-policy-icon" alt="" />}
                        <div className="bam-policy-info">
                          <span className="bam-policy-title">{title}</span>
                          {hasConflict ? (
                            <span className="bam-policy-conflict-warn">
                              Incompatible with: {conflictLabels.join(', ')}
                            </span>
                          ) : (
                            desc && <span className="bam-policy-desc">{desc}</span>
                          )}
                        </div>
                        <div className="bam-policy-card-actions">
                          {!isCity && onApplyToAll && (
                            <button
                              className="bam-policy-apply-all-btn"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onApplyToAll(pol.entityKey, true, currentAdj);
                              }}
                              title={`Apply ${title} with current settings to ALL districts across the city`}
                            >
                              Apply All
                            </button>
                          )}
                          <button
                            className={`bam-policy-toggle-btn${isActive ? ' on' : ''}${
                              hasConflict ? ' disabled' : ''
                            }`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasConflict) return;
                              onTogglePolicy(districtKey, pol.entityKey, !isActive, currentAdj);
                            }}
                            title={
                              hasConflict
                                ? `Blocked: Incompatible with ${conflictLabels.join(', ')}`
                                : isActive
                                ? 'Deactivate policy'
                                : 'Activate policy'
                            }
                          >
                            <UilIcon
                              name={isActive ? 'Checkmark' : hasConflict ? 'Cross' : 'Plus'}
                              sizeRem={11}
                              style={{ marginRight: '4rem' }}
                            />
                            <span>{isActive ? 'Active' : hasConflict ? 'Blocked' : 'Off'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Slider controls if policy has an adjustable slider and is active */}
                      {pol.hasSlider && isActive && (
                        <div
                          className="bam-policy-slider-box"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bam-policy-slider-label-row">
                            <span>Adjustment:</span>
                            <span className="bam-policy-slider-val">{Math.round(currentAdj)}</span>
                            <span className="bam-policy-slider-range">
                              ({pol.sliderMin ?? 0} - {resolvePolicySliderMax(pol)})
                            </span>
                          </div>
                          <BamCustomSlider
                            value={currentAdj}
                            min={pol.sliderMin ?? 0}
                            max={resolvePolicySliderMax(pol)}
                            step={1}
                            onChange={(val) => onSetAdjustment(districtKey, pol.entityKey, val)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Scrollable>
        </div>
      )}

      {/* Floating In-Game Style Tooltip Directly Over Hovered Elements */}
      {typeof document !== 'undefined' &&
        hoveredTooltip &&
        ReactDOM.createPortal(
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

export default DistrictPolicyControls;
