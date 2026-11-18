import React from 'react';
import { useSceneExplorer } from '../../hooks/useSceneExplorer';

interface EntityIdBadgeProps {
  /** The "index:version" entity key string, e.g. "12345:1" */
  entityKey: string;
  /** Optional extra CSS class name for the badge span */
  className?: string;
  /** Optional hover title attribute */
  title?: string;
  /** Optional text prefix displayed before the entity key, e.g. "CO " or "BLD " */
  label?: string;
  /** Optional badge variant for color coding ('co' | 'bld' | 'upg' | 'dist' | 'default') */
  variant?: 'co' | 'bld' | 'upg' | 'dist' | 'default';
  /** Optional extra inline styles merged onto the span */
  style?: React.CSSProperties;
  /** Stop click propagation to parent row (default: true) */
  stopPropagation?: boolean;
}

/**
 * Entity ID badge component matching the ATPM base standard.
 *
 * Visual contract:
 * - When SceneExplorer is installed, hovering reveals pointer cursor and clicking dispatches
 *   the entity directly into SceneExplorer's inspector.
 * - When SceneExplorer is not installed, it renders cleanly as a styled badge with no regressions.
 */
export const EntityIdBadge: React.FC<EntityIdBadgeProps> = ({
  entityKey,
  className = '',
  title,
  label,
  variant,
  style,
  stopPropagation = true,
}) => {
  const { isInstalled, openEntity } = useSceneExplorer();

  if (!entityKey) return null;

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (isInstalled && entityKey && entityKey !== 'city') {
      openEntity(entityKey);
    }
  };

  const autoVariant =
    variant ||
    (label?.trim() === 'CO'
      ? 'co'
      : label?.trim() === 'BLD'
      ? 'bld'
      : label?.trim() === 'UPG'
      ? 'upg'
      : label?.trim() === 'DIST'
      ? 'dist'
      : 'default');

  const defaultTitle = isInstalled
    ? title || `Open ${entityKey} in SceneExplorer`
    : title || `Entity ID: ${entityKey}`;

  const classes = [
    'bam-entity-id-badge',
    `variant-${autoVariant}`,
    isInstalled ? 'scene-explorer-active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      title={defaultTitle}
      style={{
        cursor: isInstalled ? 'pointer' : 'default',
        ...style,
      }}
      onClick={handleClick}
    >
      {label ? `${label}${entityKey}` : entityKey}
    </span>
  );
};

export default EntityIdBadge;
