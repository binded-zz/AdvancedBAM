import React, { useState } from 'react';

interface PackIconProps {
  pack?: string;
  theme?: string;
  iconUrl?: string; // Comma-separated list of thumbnail URLs
  packIcon?: string;
  size?: number;
  sizeRem?: number;
  showLabel?: boolean;
  style?: React.CSSProperties;
}

export const formatPackDisplayName = (pack?: string): string => {
  if (!pack || pack.trim() === '') return 'Base Game';
  const p = pack.trim();
  if (p.toLowerCase() === 'basegame' || p.toLowerCase() === 'base game') return 'Base Game';
  return p;
};

// Official DLC SVGs verified directly in Cities: Skylines 2 Media/DLC/
const OFFICIAL_DLC_SVGS: Record<string, string> = {
  beachproperties: 'Media/DLC/BeachProperties.svg',
  bridgesandports: 'Media/DLC/BridgesAndPorts.svg',
  bridgesports: 'Media/DLC/BridgesAndPorts.svg',
  ccpbridgesandports: 'Media/DLC/BridgesAndPorts.svg',
  citystations: 'Media/DLC/CityStations.svg',
  ccpcitystations: 'Media/DLC/CityStations.svg',
  cs1treasurehunt: 'Media/DLC/CS1TreasureHunt.svg',
  treasurehunt: 'Media/DLC/CS1TreasureHunt.svg',
  downtownmarketset: 'Media/DLC/DowntownMarketSet.svg',
  downtownmarket: 'Media/DLC/DowntownMarketSet.svg',
  dragongate: 'Media/DLC/DragonGate.svg',
  ccpdragongate: 'Media/DLC/DragonGate.svg',
  firstresponse: 'Media/DLC/FirstResponse.svg',
  landmarkbuildings: 'Media/DLC/LandmarkBuildings.svg',
  landmarks: 'Media/DLC/LandmarkBuildings.svg',
  leisurevenues: 'Media/DLC/LeisureVenues.svg',
  mediterraneanheritage: 'Media/DLC/MediterraneanHeritage.svg',
  modernarchitecture: 'Media/DLC/ModernArchitecture.svg',
  ccpmodernarchitecture: 'Media/DLC/ModernArchitecture.svg',
  modernsuburbs: 'Media/DLC/ModernSuburbs.svg',
  newsletter: 'Media/DLC/Newsletter.svg',
  officeevolution: 'Media/DLC/OfficeEvolution.svg',
  ccpofficeevolution: 'Media/DLC/OfficeEvolution.svg',
  parkadventures: 'Media/DLC/ParkAdventures.svg',
  pdxaccount: 'Media/DLC/PDXAccount.svg',
  sanfranciscoset: 'Media/DLC/SanFranciscoSet.svg',
  sanfrancisco: 'Media/DLC/SanFranciscoSet.svg',
  skyscrapers: 'Media/DLC/Skyscrapers.svg',
  supplychains: 'Media/DLC/SupplyChains.svg',
  urbanpromenades: 'Media/DLC/UrbanPromenades.svg',
  ccpurbanpromenades: 'Media/DLC/UrbanPromenades.svg',
  deluxe: 'Media/DLC/LandmarkBuildings.svg',
  preorder: 'Media/DLC/LandmarkBuildings.svg',
};

const resolveOfficialDlcSvg = (pack?: string): string | undefined => {
  if (!pack) return undefined;
  const cleanKey = pack.toLowerCase().trim().replace(/[\s\-_&:]+/g, '');
  if (OFFICIAL_DLC_SVGS[cleanKey]) return OFFICIAL_DLC_SVGS[cleanKey];

  const strippedKey = cleanKey.replace(/^ccp/, '').replace(/^contentcreatorpack/, '').replace(/^pack\d+/, '');
  return OFFICIAL_DLC_SVGS[strippedKey];
};

export const isPaidDlcPack = (pack?: string): boolean => {
  if (!pack) return false;
  const p = pack.toLowerCase().trim();
  if (p === 'base game' || p === 'basegame' || p === 'custom' || p === 'unknown') return false;

  if (resolveOfficialDlcSvg(p)) return true;

  const cleanKey = p.replace(/[\s\-_&:]+/g, '');

  return (
    p.includes('dlc') ||
    p.includes('ccp') ||
    p.includes('creator') ||
    p.includes('deluxe') ||
    p.includes('san francisco') ||
    p.includes('bridge') ||
    p.includes('port') ||
    p.includes('beach') ||
    p.includes('promenade') ||
    p.includes('architecture') ||
    p.includes('urban') ||
    p.includes('modern') ||
    p.includes('landmark') ||
    p.includes('skyscraper') ||
    p.includes('pre-order') ||
    p.includes('mediterranean') ||
    p.includes('leisure') ||
    p.includes('hearth') ||
    p.includes('station') ||
    p.includes('dragon') ||
    p.includes('evolution') ||
    p.includes('downtown market') ||
    p.includes('first response') ||
    p.includes('supply chain') ||
    p.includes('treasure hunt') ||
    cleanKey.includes('station') ||
    cleanKey.includes('dragon') ||
    cleanKey.includes('evolution') ||
    cleanKey.includes('urban') ||
    cleanKey.includes('bridge') ||
    cleanKey.includes('architecture')
  );
};

export const normalizeUrl = (u: string): string => {
  if (!u) return '';
  const trimmed = u.trim();
  if (trimmed.includes('://')) return trimmed;
  // If it's a relative path like Media/DLC/ or Media/Game/, keep it relative.
  // Cohtml resolves relative paths from assetdb://gameui/ directly.
  if (trimmed.startsWith('Media/') || trimmed.startsWith('/Media/')) {
    return trimmed.replace(/^\//, '');
  }
  return trimmed;
};

export const PackIcon: React.FC<PackIconProps> = ({
  pack,
  theme,
  iconUrl,
  packIcon,
  size = 20,
  sizeRem,
  showLabel = false,
  style,
}) => {
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const actualSize = sizeRem ?? size ?? 20;

  const effectivePack = formatPackDisplayName(pack);
  const isBase =
    effectivePack.toLowerCase().trim() === 'base game' ||
    effectivePack.toLowerCase().trim() === 'basegame' ||
    !pack;

  let rawUrl = iconUrl || packIcon;
  const officialSvg = resolveOfficialDlcSvg(effectivePack);

  // 1. Base Game official icon
  if (isBase && !rawUrl) {
    rawUrl = 'coui://uil/Colored/BaseGame.svg';
  } else if (!rawUrl && officialSvg) {
    // 2. Official DLC known SVG in Media/DLC/
    rawUrl = officialSvg;
  } else if (!isBase && !rawUrl && isPaidDlcPack(effectivePack)) {
    // 3. Fallback DLC SVG
    rawUrl = 'Media/DLC/DLCFallback.svg';
  }

  const renderFallback = () => {
    let svgContent: React.ReactNode = null;

    if (isBase) {
      svgContent = (
        <svg
          width={`${actualSize}rem`}
          height={`${actualSize}rem`}
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: `${actualSize}rem`, height: `${actualSize}rem`, display: 'block', pointerEvents: 'none', flexShrink: 0 }}
        >
          <circle cx="10" cy="10" r="8.5" fill="#344a5f" stroke="#a0b0c0" strokeWidth="1.2" />
          <path d="M6 13V9h8v4H6zm4-7.5L5.5 9h9L10 5.5z" fill="#a0b0c0" />
        </svg>
      );
    } else {
      const isDlc = isPaidDlcPack(effectivePack);

      if (isDlc) {
        // Gold star — official paid DLC
        svgContent = (
          <svg
            width={`${actualSize}rem`}
            height={`${actualSize}rem`}
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: `${actualSize}rem`, height: `${actualSize}rem`, display: 'block', pointerEvents: 'none', flexShrink: 0 }}
          >
            <circle cx="10" cy="10" r="8.5" fill="#194a80" stroke="#ffd024" strokeWidth="1.2" />
            <polygon
              points="10,4.5 11.6,8.2 15.6,8.2 12.3,10.6 13.5,14.5 10,12.2 6.5,14.5 7.7,10.6 4.4,8.2 8.4,8.2"
              fill="#ffd024"
            />
          </svg>
        );
      } else {
        // Puzzle-piece — PDX mod / custom user pack
        svgContent = (
          <svg
            width={`${actualSize}rem`}
            height={`${actualSize}rem`}
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: `${actualSize}rem`, height: `${actualSize}rem`, display: 'block', pointerEvents: 'none', flexShrink: 0 }}
          >
            <circle cx="10" cy="10" r="8.5" fill="#2a3a55" stroke="#7ec8e3" strokeWidth="1.2" />
            <path
              d="M13 7h-1V6a1 1 0 0 0-2 0v1H9a1 1 0 0 0-1 1v1H7a1 1 0 1 0 0 2h1v1a1 1 0 0 0 1 1h1v1a1 1 0 0 0 2 0v-1h1a1 1 0 0 0 1-1v-1h1a1 1 0 1 0 0-2h-1V8a1 1 0 0 0-1-1z"
              fill="#7ec8e3"
            />
          </svg>
        );
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${actualSize}rem`,
          height: `${actualSize}rem`,
          flexShrink: 0,
          pointerEvents: 'none',
          ...style,
        }}
        title={effectivePack || theme || 'Unknown Pack'}
      >
        {svgContent}
      </div>
    );
  };

  if (!rawUrl) {
    return renderFallback();
  }

  const urls = rawUrl
    .split(',')
    .map((u) => normalizeUrl(u))
    .filter((u) => Boolean(u) && !failedUrls[u]);

  if (urls.length === 0) {
    return renderFallback();
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        pointerEvents: 'none',
        ...style,
      }}
      title={effectivePack || theme || 'Pack Icon'}
    >
      {urls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={effectivePack}
          style={{
            width: `${actualSize}rem`,
            height: `${actualSize}rem`,
            objectFit: 'contain',
            display: 'block',
            flexShrink: 0,
            pointerEvents: 'none',
          }}
          onError={() => {
            setFailedUrls((prev) => ({ ...prev, [url]: true }));
          }}
        />
      ))}
      {showLabel && (
        <span
          style={{
            marginLeft: '5rem',
            fontSize: '11rem',
            color: '#eceff1',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '120rem',
          }}
        >
          {effectivePack}
        </span>
      )}
    </div>
  );
};

export default PackIcon;
