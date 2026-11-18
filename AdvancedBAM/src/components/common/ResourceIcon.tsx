import React, { useState } from 'react';

const RESOURCE_ICON_MAP: Record<string, string> = {
  grain: 'Grain',
  vegetables: 'Vegetables',
  cotton: 'Cotton',
  livestock: 'Livestock',
  fish: 'Fish',
  wood: 'Wood',
  ore: 'Ore',
  stone: 'Stone',
  coal: 'Coal',
  oil: 'Oil',
  crudeoil: 'Oil',
  food: 'Food',
  beverages: 'Beverages',
  conveniencefood: 'ConvenienceFood',
  textiles: 'Textiles',
  timber: 'Timber',
  paper: 'Paper',
  furniture: 'Furniture',
  metals: 'Metals',
  steel: 'Steel',
  minerals: 'Minerals',
  concrete: 'Concrete',
  machinery: 'Machinery',
  electronics: 'Electronics',
  vehicles: 'Vehicles',
  petrochemicals: 'Petrochemicals',
  plastics: 'Plastics',
  chemicals: 'Chemicals',
  pharmaceuticals: 'Pharmaceuticals',
  software: 'Software',
  telecom: 'Telecom',
  financial: 'Financial',
  media: 'Media',
  lodging: 'Lodging',
  meals: 'Meals',
  entertainment: 'Entertainment',
  recreation: 'Recreation',
  garbage: 'Garbage',
  electricity: 'Electricity',
  water: 'Water',
  sewage: 'Sewage',
  mail: 'Mail',
  unsortedmail: 'Mail',
  localmail: 'Mail',
  outgoingmail: 'Mail',
  money: 'Money',
};

export const getResourceIconName = (key?: string): string => {
  if (!key) return '';
  let clean = key.trim();
  if (!clean || clean === '—' || clean.toLowerCase() === 'noresource' || clean.toLowerCase() === 'none') {
    return '';
  }
  // Strip common prefixes
  if (clean.toLowerCase().startsWith('c_')) clean = clean.slice(2);
  if (clean.toLowerCase().startsWith('in:')) clean = clean.slice(3).trim();
  if (clean.toLowerCase().startsWith('out:')) clean = clean.slice(4).trim();

  const lookupKey = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!lookupKey || lookupKey === 'noresource' || lookupKey === 'none') return '';
  if (RESOURCE_ICON_MAP[lookupKey]) {
    return RESOURCE_ICON_MAP[lookupKey];
  }

  // PascalCase fallback: "Convenience Food" -> "ConvenienceFood"
  return clean
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
};

export const getResourceDisplayName = (key?: string): string => {
  if (!key) return '—';
  let clean = key.trim();
  if (!clean || clean === '—' || clean.toLowerCase() === 'noresource' || clean.toLowerCase() === 'none') {
    return '—';
  }
  if (clean.toLowerCase().startsWith('c_')) clean = clean.slice(2);
  if (clean.toLowerCase().startsWith('in:')) clean = clean.slice(3).trim();
  if (clean.toLowerCase().startsWith('out:')) clean = clean.slice(4).trim();

  const lookupKey = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lookupKey === 'unsortedmail') return 'Unsorted Mail';
  if (lookupKey === 'localmail') return 'Local Mail';
  if (lookupKey === 'outgoingmail') return 'Outgoing Mail';

  const iconName = getResourceIconName(clean);
  if (iconName) {
    // Add spaces between PascalCase words: "ConvenienceFood" -> "Convenience Food"
    return iconName.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return clean.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
};

export interface ResourceIconProps {
  resource?: string;
  sizeRem?: number;
  showLabel?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const ResourceIcon: React.FC<ResourceIconProps> = ({
  resource,
  sizeRem = 16,
  showLabel = false,
  style,
  className,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const iconName = getResourceIconName(resource);
  const displayName = getResourceDisplayName(resource);

  React.useEffect(() => {
    setImgErr(false);
  }, [resource]);

  if (!iconName) {
    return null;
  }

  const SPECIAL_ICON_MAP: Record<string, string> = {
    Electricity: 'Media/Game/Icons/Electricity.svg',
    Water: 'Media/Game/Icons/Water.svg',
    Sewage: 'Media/Game/Icons/Sewage.svg',
    Money: 'Media/Game/Icons/Money.svg',
    Mail: 'Media/Game/Icons/PostService.svg',
    PostService: 'Media/Game/Icons/PostService.svg',
  };

  const iconSrc = SPECIAL_ICON_MAP[iconName] || `Media/Game/Resources/${iconName}.svg`;

  const renderFallback = () => (
    <div
      style={{
        width: `${sizeRem}rem`,
        height: `${sizeRem}rem`,
        borderRadius: '3rem',
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1rem solid rgba(255, 255, 255, 0.2)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(8, Math.round(sizeRem * 0.55))}rem`,
        fontWeight: 700,
        color: '#90caf9',
        flexShrink: 0,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
      title={displayName}
    >
      {iconName.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        ...style,
      }}
      title={`Resource: ${displayName}`}
    >
      {!imgErr ? (
        <img
          src={iconSrc}
          alt={displayName}
          style={{
            width: `${sizeRem}rem`,
            height: `${sizeRem}rem`,
            objectFit: 'contain',
            display: 'block',
            flexShrink: 0,
            pointerEvents: 'none',
          }}
          onError={() => setImgErr(true)}
        />
      ) : (
        renderFallback()
      )}
      {showLabel && (
        <span
          style={{
            marginLeft: '4rem',
            fontSize: '11rem',
            color: '#eceff1',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </span>
      )}
    </div>
  );
};

export default ResourceIcon;
