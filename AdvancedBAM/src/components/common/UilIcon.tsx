import React, { useEffect, useState } from 'react';

export type UilStandardIconName =
  | 'Close'
  | 'Cross'
  | 'Refresh'
  | 'Minus'
  | 'Plus'
  | 'Search'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Checkmark'
  | 'Tools'
  | 'Bulldoze'
  | 'Location'
  | 'Building'
  | 'Copy'
  | 'Edit'
  | 'Settings'
  | 'ChevronDown'
  | 'ChevronUp'
  | 'ChevronRight'
  | 'Globe'
  | 'District'
  | 'Layers'
  | 'Star'
  | 'Shield'
  | 'Thunder'
  | 'Fire'
  | 'Water'
  | 'Maximize'
  | 'Restore'
  | 'Trash'
  | 'Happy'
  | 'Neutral'
  | 'Sad'
  | 'Car'
  | 'Tree'
  | 'Filter'
  | 'Graduation'
  | 'Coins'
  | 'Money'
  | 'Info';

interface UilIconProps {
  name?: UilStandardIconName;
  src?: string;
  sizeRem?: number;
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}

const INLINE_FALLBACKS: Record<string, (c: string) => React.ReactNode> = {
  Globe: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  ),
  District: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 2L2 7v2h20V7L12 2zM4 11v8h3v-8H4zm6 0v8h4v-8h-4zm7 0v8h3v-8h-3zM2 21h20v2H2v-2z" />
    </svg>
  ),
  Layers: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9.07l-9-7-9 7 1.63 1.27L12 16z" />
    </svg>
  ),
  Star: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  Shield: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
    </svg>
  ),
  Info: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  ),
  Thunder: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  ),
  Fire: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM12 20c-3.31 0-6-2.69-6-6 0-1.53.5-3.04 1.4-4.29.62.91 1.66 1.5 2.84 1.5 1.88 0 3.4-1.52 3.4-3.4 0-.35-.06-.68-.16-.99 2.45 1.54 4.52 4.49 4.52 7.18 0 3.31-2.69 6-6 6z" />
    </svg>
  ),
  Water: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  Maximize: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={c} strokeWidth="2.5">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke={c} />
    </svg>
  ),
  Restore: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={c} strokeWidth="2.2">
      <rect x="3" y="7" width="13" height="13" rx="2" stroke={c} />
      <path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" stroke={c} />
    </svg>
  ),
  Trash: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  ),
  Happy: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  ),
  Neutral: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M9 14h6v1.5H9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z" />
    </svg>
  ),
  Sad: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 3c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z" />
    </svg>
  ),
  Car: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM7.5 15c-.83 0-1.5-.67-1.5-1.5S6.67 12 7.5 12s1.5.67 1.5 1.5S8.33 15 7.5 15zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  ),
  Tree: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 2L6 11h3l-4 7h6v4h2v-4h6l-4-7h3L12 2z" />
    </svg>
  ),
  Settings: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ),
  ChevronDown: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
  ),
  ChevronUp: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>
  ),
  ChevronRight: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  ),
  Edit: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  ),
  Close: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  ),
  Cross: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  ),
  Refresh: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  ),
  Minus: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M19 13H5v-2h14v2z" />
    </svg>
  ),
  Plus: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  ),
  Search: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  ),
  ArrowLeft: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  ),
  ArrowRight: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  ),
  ArrowUp: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
    </svg>
  ),
  ArrowDown: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
    </svg>
  ),
  Checkmark: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  ),
  Tools: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  ),
  Location: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  ),
  Copy: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  ),
  Bulldoze: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z" />
    </svg>
  ),
  Building: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
    </svg>
  ),
  Filter: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
    </svg>
  ),
  Graduation: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 8.7L4.72 9 12 5.04 19.28 9 12 11.7zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
    </svg>
  ),
  Coins: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
    </svg>
  ),
  Money: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill={c}>
      <path fill={c} d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
    </svg>
  ),
};

export const UilIcon: React.FC<UilIconProps> = ({
  name,
  src,
  sizeRem = 14,
  className = '',
  alt = '',
  style,
}) => {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [src, name]);

  const iconColor = (style?.color as string) || '#38bdf8';

  const containerStyle: React.CSSProperties = {
    width: `${sizeRem}rem`,
    height: `${sizeRem}rem`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: iconColor,
    fill: iconColor,
    ...style,
  };

  // If an inline vector fallback exists for this standard icon name and no custom src is provided,
  // render the vector SVG directly to prevent 404 network spam when UIL mod is not installed.
  if (!src && name && INLINE_FALLBACKS[name]) {
    return (
      <span className={`bam-uil-icon inline-svg ${className}`} style={containerStyle}>
        {INLINE_FALLBACKS[name](iconColor)}
      </span>
    );
  }

  // Resolved path: if src given, use it; otherwise build coui://uil/Standard/{name}.svg
  const iconSrc = src || (name ? `coui://uil/Standard/${name}.svg` : '');

  if (!iconSrc || loadFailed) {
    const fallback = name && INLINE_FALLBACKS[name] ? INLINE_FALLBACKS[name](iconColor) : null;
    return (
      <span className={`bam-uil-icon fallback ${className}`} style={containerStyle}>
        {fallback}
      </span>
    );
  }

  return (
    <span className={`bam-uil-icon ${className}`} style={containerStyle}>
      <img
        src={iconSrc}
        alt={alt || name || 'icon'}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={() => setLoadFailed(true)}
      />
    </span>
  );
};

export default UilIcon;
