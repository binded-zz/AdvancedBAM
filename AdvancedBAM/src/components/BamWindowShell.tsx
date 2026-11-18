import { logCatch } from '../utils/devWarn';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocalization } from 'cs2/l10n';
import apiSafe, { safeUseValue } from '../core/apiSafe';
import {
  windowVisible$,
  windowRect$,
  happinessFactorCount$,
  happinessFactorFilter$,
  syncCs2HappinessToStorage,
} from '../core/bindings';
import { WindowRect, DEFAULT_WINDOW_RECT, DEFAULT_WINDOW_RECT_JSON, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT, MAX_WINDOW_WIDTH, MAX_WINDOW_HEIGHT } from '../core/windowConstants';
import { getPixelsPerRem } from './dragHelper';
import UilIcon from './common/UilIcon';
import BamSettingsModal, { SettingsTab } from './common/BamSettingsModal';
import bamStorage from '../utils/bamStorage';
import './BamWindowShell.css';

interface BamWindowShellProps {
  children: React.ReactNode;
}

type DragMode =
  | 'none'
  | 'drag'
  | 'resize-right'
  | 'resize-left'
  | 'resize-edge-left'
  | 'resize-edge-right'
  | 'resize-edge-bottom';

const safeNum = (v: number | undefined, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const getViewportSizeRem = (scale: number) => {
  const s = scale > 0 ? scale : 1.0;
  return {
    width: typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth / s : 1920,
    height: typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight / s : 1080,
  };
};

export const BamWindowShell: React.FC<BamWindowShellProps> = ({ children }) => {
  const { translate } = useLocalization();
  const visible = safeUseValue<boolean>(windowVisible$, false);
  const rawRect = safeUseValue<string>(
    windowRect$,
    DEFAULT_WINDOW_RECT_JSON
  );
  const cs2HappyCount = safeUseValue<number>(happinessFactorCount$, 1);
  const cs2HappyFilter = safeUseValue<number>(happinessFactorFilter$, 0);

  useEffect(() => {
    syncCs2HappinessToStorage(cs2HappyCount, cs2HappyFilter);
  }, [cs2HappyCount, cs2HappyFilter]);

  const initialRect: WindowRect = { ...DEFAULT_WINDOW_RECT };
  try {
    const p = JSON.parse(rawRect);
    if (p && typeof p.x === 'number') {
      initialRect.x = safeNum(p.x, DEFAULT_WINDOW_RECT.x);
      initialRect.y = safeNum(p.y, DEFAULT_WINDOW_RECT.y);
      initialRect.width = safeNum(p.width, DEFAULT_WINDOW_RECT.width);
      initialRect.height = safeNum(p.height, DEFAULT_WINDOW_RECT.height);
    }
  } catch (err) { logCatch('BamWindowShell', err); }

  const [rect, setRect] = useState<WindowRect>(initialRect);
  const [collapsed, setCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('global');

  useEffect(() => {
    const handleOpenSettings = (e: any) => {
      const tab = e?.detail?.tab as SettingsTab | undefined;
      if (tab) {
        setSettingsInitialTab(tab);
      }
      setShowGlobalSettings(true);
    };
    const handleSettingsReset = () => {
      const def: WindowRect = { ...DEFAULT_WINDOW_RECT };
      setIsMaximized(false);
      setCollapsed(false);
      apiSafe.setWindowCollapsed(false);
      preMaximizedRectRef.current = null;
      currentRectRef.current = def;
      setRect(def);
      if (containerRef.current) {
        containerRef.current.style.left = `${def.x}rem`;
        containerRef.current.style.top = `${def.y}rem`;
        containerRef.current.style.width = `${def.width}rem`;
        containerRef.current.style.height = `${def.height}rem`;
      }
      try {
        bamStorage.removeItem('bam_pre_maximized_rect');
        apiSafe.saveWindowRect(def.x, def.y, def.width, def.height);
      } catch (err) { logCatch('BamWindowShell', err); }
    };
    window.addEventListener('bam-open-settings', handleOpenSettings as EventListener);
    window.addEventListener('bam-settings-reset', handleSettingsReset);
    return () => {
      window.removeEventListener('bam-open-settings', handleOpenSettings as EventListener);
      window.removeEventListener('bam-settings-reset', handleSettingsReset);
    };
  }, []);

  const prevVisibleRef = useRef(visible);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!wasVisible && visible) {
      setCollapsed(false);
      apiSafe.setWindowCollapsed(false);
    }
  }, [visible]);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentRectRef = useRef<WindowRect>(initialRect);
  const preMaximizedRectRef = useRef<WindowRect | null>(null);
  const isInteractingRef = useRef(false);
  const saveDebounceTimerRef = useRef<number | null>(null);
  const activeDragCleanupRef = useRef<(() => void) | null>(null);

  const dragSessionRef = useRef({
    mode: 'none' as DragMode,
    startX: 0,
    startY: 0,
    ox: DEFAULT_WINDOW_RECT.x,
    oy: DEFAULT_WINDOW_RECT.y,
    ow: DEFAULT_WINDOW_RECT.width,
    oh: DEFAULT_WINDOW_RECT.height,
    scale: 1.0,
  });

  // Clean up any dangling drag/resize listeners or debounce timers on unmount
  useEffect(() => {
    return () => {
      if (activeDragCleanupRef.current) {
        activeDragCleanupRef.current();
        activeDragCleanupRef.current = null;
      }
      if (saveDebounceTimerRef.current !== null) {
        window.clearTimeout(saveDebounceTimerRef.current);
        saveDebounceTimerRef.current = null;
      }
    };
  }, []);

  // Sync external rect when changed by settings or game
  useEffect(() => {
    if (isInteractingRef.current || isMaximized) return;
    try {
      const p = JSON.parse(rawRect);
      if (p && typeof p.x === 'number') {
        const scale = getPixelsPerRem();
        const vp = getViewportSizeRem(scale);

        const clampedW = Math.max(MIN_WINDOW_WIDTH, Math.min(vp.width - 40, safeNum(p.width, DEFAULT_WINDOW_RECT.width)));
        const clampedH = Math.max(MIN_WINDOW_HEIGHT, Math.min(vp.height - 40, safeNum(p.height, DEFAULT_WINDOW_RECT.height)));

        let rawX = safeNum(p.x, DEFAULT_WINDOW_RECT.x);
        let rawY = safeNum(p.y, DEFAULT_WINDOW_RECT.y);

        // Auto-heal off-screen windows back into viewport view
        if (rawX < 10 || rawX + clampedW > vp.width + 10) {
          rawX = DEFAULT_WINDOW_RECT.x;
        }
        if (rawY < 10 || rawY + clampedH > vp.height + 10) {
          rawY = DEFAULT_WINDOW_RECT.y;
        }

        const maxX = Math.max(10, vp.width - clampedW - 10);
        const maxY = Math.max(10, vp.height - clampedH - 10);
        const clampedX = Math.max(10, Math.min(maxX, rawX));
        const clampedY = Math.max(10, Math.min(maxY, rawY));

        const synced: WindowRect = {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH,
        };
        currentRectRef.current = synced;
        setRect(synced);
      }
    } catch (err) { logCatch('BamWindowShell', err); }
  }, [rawRect]);

  // Keep DOM styles rigorously synced to prevent Cohtml stale half-size bugs
  useEffect(() => {
    if (containerRef.current && !isInteractingRef.current) {
      const r = currentRectRef.current;
      containerRef.current.style.left = `${r.x}rem`;
      containerRef.current.style.top = `${r.y}rem`;
      containerRef.current.style.width = `${r.width}rem`;
      containerRef.current.style.height = collapsed ? '44rem' : `${r.height}rem`;
    }
  }, [collapsed, isMaximized, rect]);

  const saveRect = useCallback((newRect: WindowRect) => {
    apiSafe.saveWindowRect(
      Math.round(newRect.x),
      Math.round(newRect.y),
      Math.round(newRect.width),
      Math.round(newRect.height)
    );
  }, []);

  const toggleMaximize = useCallback(() => {
    const scale = getPixelsPerRem();
    const vp = getViewportSizeRem(scale);

    if (isMaximized) {
      // Restore to previous geometry
      const restored = preMaximizedRectRef.current || (() => { try { const s = bamStorage.getItem('bam_pre_maximized_rect'); if (s) { const p = JSON.parse(s); if (p && typeof p.x === 'number') return p as WindowRect; } } catch (e) { logCatch('BamWindowShell', e); } return null; })() || {
        ...DEFAULT_WINDOW_RECT,
      };
      setIsMaximized(false);
      currentRectRef.current = restored;
      setRect(restored);
      if (containerRef.current) {
        containerRef.current.style.left = `${restored.x}rem`;
        containerRef.current.style.top = `${restored.y}rem`;
        containerRef.current.style.width = `${restored.width}rem`;
        containerRef.current.style.height = collapsed ? '44rem' : `${restored.height}rem`;
      }
      saveRect(restored);
    } else {
      // Docked Maximize: Keep in-game left panels (building/district inspector, line manager)
      // and bottom game toolbar (simulation controls, demand bars) uncovered and interactive!
      preMaximizedRectRef.current = { ...currentRectRef.current }; try { bamStorage.setItem('bam_pre_maximized_rect', JSON.stringify(preMaximizedRectRef.current)); } catch (e) { logCatch('BamWindowShell', e); }
      const leftOffset = vp.width > 1600 ? 642 : (vp.width > 1300 ? 580 : (vp.width > 1000 ? 380 : Math.max(20, Math.floor(vp.width * 0.25))));
      const topOffset = 14;
      const bottomOffset = 105;
      const rightOffset = 10;

      const maximizedRect: WindowRect = {
        x: leftOffset,
        y: topOffset,
        width: Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, vp.width - leftOffset - rightOffset)),
        height: Math.max(MIN_WINDOW_HEIGHT, Math.min(MAX_WINDOW_HEIGHT, vp.height - topOffset - bottomOffset)),
      };
      setIsMaximized(true);
      setCollapsed(false);
      currentRectRef.current = maximizedRect;
      setRect(maximizedRect);
      if (containerRef.current) {
        containerRef.current.style.left = `${maximizedRect.x}rem`;
        containerRef.current.style.top = `${maximizedRect.y}rem`;
        containerRef.current.style.width = `${maximizedRect.width}rem`;
        containerRef.current.style.height = `${maximizedRect.height}rem`;
      }
      // Preserve normal saved rect in Settings.coc while maximized
    }
  }, [isMaximized, collapsed, saveRect]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (containerRef.current) {
        containerRef.current.style.height = next ? '44rem' : `${currentRectRef.current.height}rem`;
      }
      apiSafe.setWindowCollapsed(next);
      return next;
    });
  }, []);

  const startDrag = useCallback(
    (e: React.MouseEvent, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();

      const scale = getPixelsPerRem();
      const domRect = containerRef.current ? containerRef.current.getBoundingClientRect() : null;
      const ox = domRect ? domRect.left / scale : currentRectRef.current.x;
      const oy = domRect ? domRect.top / scale : currentRectRef.current.y;
      const ow = domRect ? domRect.width / scale : currentRectRef.current.width;
      const oh = domRect ? domRect.height / scale : currentRectRef.current.height;

      let clearedMaximized = false;

      dragSessionRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        ox,
        oy,
        ow,
        oh,
        scale,
      };

      isInteractingRef.current = true;
      setIsInteracting(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isInteractingRef.current) return;
        const { mode: m, startX, startY, ox: origX, oy: origY, ow: origW, oh: origH, scale: s } =
          dragSessionRef.current;
        if (m === 'none') return;

        const effectiveScale = s > 0 ? s : 1.0;
        const distRem = Math.hypot(
          (moveEvent.clientX - startX) / effectiveScale,
          (moveEvent.clientY - startY) / effectiveScale
        );
        if (isMaximized && !clearedMaximized && distRem > 3) {
          clearedMaximized = true;
          setIsMaximized(false);
        }
        if (m === 'drag' && !clearedMaximized && distRem <= 3) {
          return;
        }
        const dxRem = Math.round((moveEvent.clientX - startX) / effectiveScale);
        const dyRem = Math.round((moveEvent.clientY - startY) / effectiveScale);

        const vp = getViewportSizeRem(effectiveScale);
        const minW = MIN_WINDOW_WIDTH;
        const minH = MIN_WINDOW_HEIGHT;
        const maxW = Math.max(minW, Math.min(MAX_WINDOW_WIDTH, vp.width - 20));
        const maxH = Math.max(minH, Math.min(MAX_WINDOW_HEIGHT, vp.height - 20));

        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (m === 'drag') {
          const maxX = Math.max(10, Math.min(3840, vp.width - origW - 10));
          const maxY = Math.max(10, Math.min(2160, vp.height - (collapsed ? 44 : origH) - 10));
          newX = Math.round(Math.max(10, Math.min(maxX, origX + dxRem)));
          newY = Math.round(Math.max(10, Math.min(maxY, origY + dyRem)));
        } else if (m === 'resize-right') {
          const boundW = Math.max(minW, Math.min(maxW, vp.width - origX - 10));
          const boundH = Math.max(minH, Math.min(maxH, vp.height - origY - 10));
          newW = Math.round(Math.max(minW, Math.min(boundW, origW + dxRem)));
          newH = Math.round(Math.max(minH, Math.min(boundH, origH + dyRem)));
        } else if (m === 'resize-left') {
          const maxDelta = origW - minW;
          const clampedDx = Math.max(-(origX - 10), Math.min(maxDelta, dxRem));
          newX = Math.round(Math.max(10, origX + clampedDx));
          newW = Math.round(Math.max(minW, Math.min(maxW, origW - clampedDx)));
          const boundH = Math.max(minH, Math.min(maxH, vp.height - origY - 10));
          newH = Math.round(Math.max(minH, Math.min(boundH, origH + dyRem)));
        } else if (m === 'resize-edge-left') {
          const maxDelta = origW - minW;
          const clampedDx = Math.max(-(origX - 10), Math.min(maxDelta, dxRem));
          newX = Math.round(Math.max(10, origX + clampedDx));
          newW = Math.round(Math.max(minW, Math.min(maxW, origW - clampedDx)));
        } else if (m === 'resize-edge-right') {
          const boundW = Math.max(minW, Math.min(maxW, vp.width - origX - 10));
          newW = Math.round(Math.max(minW, Math.min(boundW, origW + dxRem)));
        } else if (m === 'resize-edge-bottom') {
          const boundH = Math.max(minH, Math.min(maxH, vp.height - origY - 10));
          newH = Math.round(Math.max(minH, Math.min(boundH, origH + dyRem)));
        }

        const updated: WindowRect = { x: newX, y: newY, width: newW, height: newH };
        currentRectRef.current = updated;

        if (containerRef.current) {
          containerRef.current.style.left = `${newX}rem`;
          containerRef.current.style.top = `${newY}rem`;
          if (m !== 'drag') {
            containerRef.current.style.width = `${newW}rem`;
            if (!collapsed) {
              containerRef.current.style.height = `${newH}rem`;
            }
          }
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();

        window.removeEventListener('mousemove', handleMouseMove, true);
        window.removeEventListener('mouseup', handleMouseUp, true);

        activeDragCleanupRef.current = null;
        isInteractingRef.current = false;
        dragSessionRef.current.mode = 'none';
        setIsInteracting(false);

        const finalRect = { ...currentRectRef.current };
        setRect(finalRect);

        if (mode !== 'drag') {
          if (clearedMaximized) {
            setIsMaximized(false);
          }
        }

        if (clearedMaximized || mode !== 'drag' || !isMaximized) {
          if (saveDebounceTimerRef.current !== null) {
            window.clearTimeout(saveDebounceTimerRef.current);
          }
          saveDebounceTimerRef.current = window.setTimeout(() => {
            saveRect(finalRect);
          }, 300);
        }
      };

      activeDragCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove, true);
        window.removeEventListener('mouseup', handleMouseUp, true);
        activeDragCleanupRef.current = null;
        isInteractingRef.current = false;
        dragSessionRef.current.mode = 'none';
        setIsInteracting(false);
      };
      window.addEventListener('mousemove', handleMouseMove, true);
      window.addEventListener('mouseup', handleMouseUp, true);
    },
    [collapsed, isMaximized, saveRect]
  );

  const [hasOpened, setHasOpened] = useState(visible);
  useEffect(() => {
    if (visible) setHasOpened(true);
  }, [visible]);

  if (!hasOpened && !visible) return null;

  const windowTitle =
    translate('AdvancedBAM.WindowTitle', 'Advanced Building & Asset Manager') ??
    'Advanced Building & Asset Manager';
  const refreshLabel = translate('AdvancedBAM.Header.Refresh', 'Refresh') ?? 'Refresh';
  const closeLabel = translate('AdvancedBAM.Header.Close', 'Close') ?? 'Close';
  const expandLabel = translate('AdvancedBAM.Header.Expand', 'Expand') ?? 'Expand';
  const collapseLabel = translate('AdvancedBAM.Header.Collapse', 'Collapse') ?? 'Collapse';
  const maximizeLabel = isMaximized
    ? (translate('AdvancedBAM.Header.Restore', 'Restore') ?? 'Restore')
    : (translate('AdvancedBAM.Header.Maximize', 'Maximize') ?? 'Maximize');

  const renderedX = currentRectRef.current.x;
  const renderedY = currentRectRef.current.y;
  const renderedW = currentRectRef.current.width;
  const renderedH = currentRectRef.current.height;

  return (
    <div
      ref={containerRef}
      className={`bam-window-root ${isInteracting ? 'bam-interacting' : ''}`}
      style={{
        position: 'absolute',
        left: `${safeNum(renderedX, DEFAULT_WINDOW_RECT.x)}rem`,
        top: `${safeNum(renderedY, DEFAULT_WINDOW_RECT.y)}rem`,
        width: `${safeNum(renderedW, DEFAULT_WINDOW_RECT.width)}rem`,
        height: collapsed ? '44rem' : `${safeNum(renderedH, DEFAULT_WINDOW_RECT.height)}rem`,
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 100000,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="bam-window-header bam-drag-handle"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest('.bam-drag-handle') &&
            !target.closest('button') &&
            !target.closest('input')
          ) {
            startDrag(e, 'drag');
          }
        }}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('input')) {
            toggleCollapse();
          }
        }}
      >
        <div className="bam-header-left">
          <span className="bam-logo-badge">BAM</span>
          <span className="bam-header-title">{windowTitle}</span>
        </div>

        <div className="bam-header-right">
          <button
            className="bam-header-btn"
            onClick={() => apiSafe.requestRefresh()}
            title={refreshLabel}
            aria-label={refreshLabel}
          >
            <UilIcon name="Refresh" sizeRem={13} alt={refreshLabel} />
          </button>
          <button
            className={`bam-header-btn${showGlobalSettings ? ' active' : ''}`}
            onClick={() => {
              setShowGlobalSettings((v) => {
                if (v) setSettingsInitialTab('global');
                return !v;
              });
            }}
            title="BAM Settings"
            aria-label="BAM Settings"
          >
            <UilIcon name="Settings" sizeRem={13} alt="Settings" />
          </button>
          <button
            className="bam-header-btn"
            onClick={toggleCollapse}
            title={collapsed ? expandLabel : collapseLabel}
            aria-label={collapsed ? expandLabel : collapseLabel}
          >
            <UilIcon name={collapsed ? 'Plus' : 'Minus'} sizeRem={13} alt={collapsed ? '+' : '-'} />
          </button>
          <button
            className="bam-header-btn"
            onClick={toggleMaximize}
            title={isMaximized ? 'Restore Window (Normal Size)' : 'Docked Maximize Window'}
            aria-label={isMaximized ? 'Restore Window' : 'Docked Maximize Window'}
          >
            <UilIcon name={isMaximized ? 'Restore' : 'Maximize'} sizeRem={12} alt={maximizeLabel} />
          </button>
          <button
            className="bam-header-btn close"
            onClick={() => apiSafe.setWindowVisible(false)}
            title={closeLabel}
            aria-label={closeLabel}
          >
            <UilIcon name="Close" sizeRem={13} alt={closeLabel} />
          </button>
        </div>
      </div>

      {/* Global Settings Modal */}
      <BamSettingsModal
        isOpen={showGlobalSettings && !collapsed}
        onClose={() => {
          setShowGlobalSettings(false);
          setSettingsInitialTab('global');
        }}
        initialTab={settingsInitialTab}
        onResetWindow={() => {
          setShowGlobalSettings(false);
          setSettingsInitialTab('global');
          setIsMaximized(false);
          preMaximizedRectRef.current = null;
          const def: WindowRect = { ...DEFAULT_WINDOW_RECT };
          setRect(def);
          currentRectRef.current = def;
          try {
            bamStorage.removeItem('bam_pre_maximized_rect');
            apiSafe.saveWindowRect(def.x, def.y, def.width, def.height);
          } catch (err) { logCatch('BamWindowShell', err); }
        }}
      />

      {/* Body - Preserved in DOM across collapse to guarantee instant and 100% complete restoration */}
      <div
        className="bam-window-body"
        style={{ display: collapsed ? 'none' : 'flex' }}
      >
        {children}
      </div>

      {/* Resize Handles & Edge Bars - kept mounted with CSS display toggle for zero-lag Minimize/Restore */}
      {/* Bottom-Right Corner Resize Handle */}
      <div
        className="bam-resize-handle bam-resize-handle-right"
        style={{ display: collapsed ? 'none' : undefined }}
        onMouseDown={(e) => startDrag(e, 'resize-right')}
        title="Resize window"
      >
        <div className="bam-resize-corner right" />
      </div>

      {/* Bottom-Left Corner Resize Handle */}
      <div
        className="bam-resize-handle bam-resize-handle-left"
        style={{ display: collapsed ? 'none' : undefined }}
        onMouseDown={(e) => startDrag(e, 'resize-left')}
        title="Resize window"
      >
        <div className="bam-resize-corner left" />
      </div>

      {/* Left Edge Resize Bar */}
      <div
        className="bam-resize-edge bam-resize-edge-left"
        style={{ display: collapsed ? 'none' : undefined }}
        onMouseDown={(e) => startDrag(e, 'resize-edge-left')}
        title="Drag to resize left edge"
      />

      {/* Right Edge Resize Bar */}
      <div
        className="bam-resize-edge bam-resize-edge-right"
        style={{ display: collapsed ? 'none' : undefined }}
        onMouseDown={(e) => startDrag(e, 'resize-edge-right')}
        title="Drag to resize right edge"
      />

      {/* Bottom Edge Resize Bar */}
      <div
        className="bam-resize-edge bam-resize-edge-bottom"
        style={{ display: collapsed ? 'none' : undefined }}
        onMouseDown={(e) => startDrag(e, 'resize-edge-bottom')}
        title="Drag to resize bottom edge"
      />
    </div>
  );
};

export default BamWindowShell;
