import React, { useState } from 'react';

interface ThemeIconProps {
  theme?: string;
  themeIcon?: string;
  sizeRem?: number;
  showLabel?: boolean;
  style?: React.CSSProperties;
}

export const normalizeThemeName = (theme?: string): string => {
  if (!theme || theme.toLowerCase() === 'unknown') return 'Unknown';
  const t = theme.trim();
  if (/^eu|europe/i.test(t)) return 'European';
  if (/^na|north\s*america|usa/i.test(t)) return 'North American';
  return t;
};

export const ThemeIcon: React.FC<ThemeIconProps> = ({
  theme,
  themeIcon,
  sizeRem = 16,
  showLabel = false,
  style,
}) => {
  const [imgError, setImgError] = useState(false);
  const normalized = normalizeThemeName(theme);

  React.useEffect(() => {
    setImgError(false);
  }, [theme, themeIcon]);

  const getThemeUrl = (): string | null => {
    if (imgError) return null;
    if (themeIcon && themeIcon.trim() !== '') {
      const trimmed = themeIcon.trim();
      if (trimmed.includes('://')) return trimmed;
      if (trimmed.startsWith('Media/') || trimmed.startsWith('/Media/')) {
        return trimmed.replace(/^\//, '');
      }
      return trimmed;
    }
    if (normalized === 'European') {
      return 'Media/Game/Themes/European.svg';
    }
    if (normalized === 'North American') {
      return 'Media/Game/Themes/North American.svg';
    }
    return null;
  };

  const url = getThemeUrl();

  const renderFallbackSvg = () => {
    if (normalized === 'European') {
      return (
        <svg
          width={`${sizeRem}rem`}
          height={`${sizeRem}rem`}
          viewBox="0 0 20 20"
          style={{ width: `${sizeRem}rem`, height: `${sizeRem}rem`, display: 'block', pointerEvents: 'none', flexShrink: 0 }}
        >
          <circle cx="10" cy="10" r="9" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.2" />
          <path d="M10 4 L11 7 L14 7 L11.5 9 L12.5 12 L10 10 L7.5 12 L8.5 9 L6 7 L9 7 Z" fill="#fbbf24" />
        </svg>
      );
    }
    if (normalized === 'North American') {
      return (
        <svg
          width={`${sizeRem}rem`}
          height={`${sizeRem}rem`}
          viewBox="0 0 20 20"
          style={{ width: `${sizeRem}rem`, height: `${sizeRem}rem`, display: 'block', pointerEvents: 'none', flexShrink: 0 }}
        >
          <circle cx="10" cy="10" r="9" fill="#991b1b" stroke="#f87171" strokeWidth="1.2" />
          <path d="M5 8h10M5 11h10M5 14h10" stroke="#ffffff" strokeWidth="1.2" />
          <rect x="4" y="5" width="6" height="5" fill="#1e3a8a" />
        </svg>
      );
    }
    return (
      <svg
        width={`${sizeRem}rem`}
        height={`${sizeRem}rem`}
        viewBox="0 0 20 20"
        style={{ width: `${sizeRem}rem`, height: `${sizeRem}rem`, display: 'block', pointerEvents: 'none', flexShrink: 0 }}
      >
        <circle cx="10" cy="10" r="9" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
        <circle cx="10" cy="10" r="4" fill="none" stroke="#94a3b8" strokeWidth="1" />
        <path d="M10 2v16M2 10h16" stroke="#94a3b8" strokeWidth="1" />
      </svg>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        ...style,
      }}
      title={`Theme: ${normalized}`}
    >
      {url && !imgError ? (
        <img
          src={url}
          alt={normalized}
          style={{
            width: `${sizeRem}rem`,
            height: `${sizeRem}rem`,
            objectFit: 'contain',
            display: 'block',
            flexShrink: 0,
            pointerEvents: 'none',
          }}
          onError={() => setImgError(true)}
        />
      ) : (
        renderFallbackSvg()
      )}
      {showLabel && (
        <span style={{ marginLeft: '4rem', fontSize: '11rem', color: '#eceff1' }}>
          {normalized === 'North American' ? 'USA' : normalized === 'European' ? 'EU' : normalized}
        </span>
      )}
    </div>
  );
};

export default ThemeIcon;
