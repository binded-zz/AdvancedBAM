import React, { useEffect, useState } from 'react';
import { UnifiedAssetItem } from '../../models/assetModels';
import UilIcon from './UilIcon';

interface AssetThumbnailProps {
  item: UnifiedAssetItem;
  sizeRem?: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  Residential: 'Media/Game/Icons/ZoneResidential.svg',
  Commercial: 'Media/Game/Icons/ZoneCommercial.svg',
  Industrial: 'Media/Game/Icons/ZoneIndustrial.svg',
  Office: 'Media/Game/Icons/ZoneOffice.svg',
  Storage: 'Media/Game/Icons/ZoneExtractors.svg',
  Service: 'Media/Game/Icons/Services.svg',
  Signature: 'Media/Game/Icons/Wellbeing.svg',
};

const CATEGORY_COLORS: Record<string, string> = {
  Residential: '#4caf50',
  Commercial: '#2196f3',
  Industrial: '#ff9800',
  Office: '#00bcd4',
  Storage: '#795548',
  Service: '#9c27b0',
  Signature: '#f57f17',
};

export const AssetThumbnail: React.FC<AssetThumbnailProps> = ({ item, sizeRem = 28 }) => {
  // Candidate thumbnail source URLs in fallback order:
  // 1. Primary: Game thumbnail from ImageSystem (if present)
  // 2. Secondary: AssetIconLibrary thumbnail (coui://ail/{prefabName}.png)
  // 3. Tertiary: Category SVG icon
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    setAttempt(0);
  }, [item.id, item.thumbnail, item.category]);

  const resolveSource = (step: number): string | null => {
    if (step === 0) {
      if (item.thumbnail && item.thumbnail.trim() !== '') {
        const thumb = item.thumbnail.trim();
        if (thumb.includes('://')) return thumb;
        if (thumb.startsWith('Media/') || thumb.startsWith('/Media/')) {
          return thumb.replace(/^\//, '');
        }
        return `coui://ui-game/${thumb.replace(/^\//, '')}`;
      }
      // If no game thumbnail, immediately fallback to official category SVG
      const catIcon = CATEGORY_ICONS[item.category];
      if (catIcon) return catIcon;
      return null;
    }
    if (step === 1) {
      // Primary thumbnail failed to load, fallback to category icon
      const catIcon = CATEGORY_ICONS[item.category];
      if (catIcon) return catIcon;
    }
    return null;
  };

  const currentSrc = resolveSource(attempt);

  const containerStyle: React.CSSProperties = {
    width: `${sizeRem}rem`,
    height: `${sizeRem}rem`,
    minWidth: `${sizeRem}rem`,
    minHeight: `${sizeRem}rem`,
    borderRadius: '4rem',
    background: 'rgba(0, 0, 0, 0.35)',
    border: '1rem solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: '8rem',
    flexShrink: 0,
  };

  if (!currentSrc || attempt >= 3) {
    const color = CATEGORY_COLORS[item.category] || '#607d8b';
    const initial = (item.name || item.prefabName || '?').charAt(0).toUpperCase();

    return (
      <div style={{ ...containerStyle, borderLeft: `2rem solid ${color}` }}>
        <span style={{ fontSize: '11rem', fontWeight: 700, color }}>{initial}</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <img
        src={currentSrc}
        alt={item.name}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={() => setAttempt((prev) => prev + 1)}
      />
    </div>
  );
};

export default AssetThumbnail;
