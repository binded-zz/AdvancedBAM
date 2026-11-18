import React from 'react';

export type QuickPresetId =
  | 'all'
  | 'favorites'
  | 'damaged'
  | 'turnedOff'
  | 'needsRepair'
  | 'abandoned'
  | 'unprofitable'
  | 'overcrowded'
  | 'empty'
  | 'deliveryFleet'
  | 'highWealth'
  | 'mixed';

export interface QuickPresetsBarProps {
  quickPreset: QuickPresetId;
  onSelectPreset: (preset: QuickPresetId) => void;
  favoritesCount: number;
  isCatalog?: boolean;
  onHideBar?: () => void;
}

export const QuickPresetsBar: React.FC<QuickPresetsBarProps> = ({
  quickPreset,
  onSelectPreset,
  favoritesCount,
  isCatalog = false,
  onHideBar,
}) => {
  const allPresets: Array<{ id: QuickPresetId; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: `★ Favorites (${favoritesCount})` },
    { id: 'damaged', label: 'Damaged' },
    { id: 'turnedOff', label: 'Turned Off' },
    { id: 'needsRepair', label: 'Needs Repair' },
    { id: 'abandoned', label: 'Abandoned' },
    { id: 'unprofitable', label: 'Losing Money' },
    { id: 'overcrowded', label: 'At Capacity' },
    { id: 'empty', label: 'Empty' },
    { id: 'deliveryFleet', label: 'Delivery Fleet' },
    { id: 'highWealth', label: 'High Wealth' },
    { id: 'mixed', label: 'Mixed-Use' },
  ];

  const presets = isCatalog
    ? allPresets.filter((p) => p.id === 'all' || p.id === 'favorites')
    : allPresets;

  return (
    <div className="bam-quick-presets-row">
      <span style={{ fontSize: '10rem', color: '#78909c', marginRight: '4rem', fontWeight: 600 }}>
        Quick Presets:
      </span>
      {presets.map((p) => (
        <button
          key={p.id}
          className={`bam-quick-preset-pill ${quickPreset === p.id ? 'active' : ''}`}
          onClick={() => onSelectPreset(p.id)}
        >
          {p.label}
        </button>
      ))}
      {onHideBar && (
        <button
          type="button"
          className="bam-quick-preset-pill"
          style={{
            marginLeft: 'auto',
            color: '#90a4ae',
            borderColor: 'rgba(255, 255, 255, 0.14)',
            padding: '2rem 7rem',
            fontSize: '10rem',
          }}
          onClick={onHideBar}
          title="Hide Quick Presets bar (re-enable anytime in Settings → Explorer UI)"
        >
          ✕ Hide Presets
        </button>
      )}
    </div>
  );
};

export default QuickPresetsBar;
