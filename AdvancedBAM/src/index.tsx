import { logCatch } from './utils/devWarn';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ModRegistrar } from 'cs2/modding';
import apiSafe, { safeUseValue } from './core/apiSafe';
import { uiPrefs$ } from './core/bindings';
import { hydrateFromPayload, isBamStorageLoaded } from './utils/bamStorage';
import { AssetDataProvider } from './context/AssetDataProvider';
import ToolbarLauncher from './components/ToolbarLauncher';
import BamWindowShell from './components/BamWindowShell';
import UnifiedAssetExplorer from './components/UnifiedAssetExplorer';

// Console relay to CS2 Developer Console (gated behind debug flag to protect React error boundaries)
let isLogging = false;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const isDebugConsole = typeof window !== 'undefined' && Boolean(
  (window as any).__BAM_DEBUG_CONSOLE__ ||
  (window as any).__DEBUG__
);

if (isDebugConsole) {
  console.log = (...args: any[]) => {
    originalLog(...args);
    if (isLogging) return;
    isLogging = true;
    try {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      apiSafe.log(msg);
    } catch (e) {
      originalWarn('[BAM Console Relay] log failed', e);
    }
    isLogging = false;
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    if (isLogging) return;
    isLogging = true;
    try {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      apiSafe.log(`[WARN] ${msg}`);
    } catch (e) {
      originalWarn('[BAM Console Relay] warn failed', e);
    }
    isLogging = false;
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    if (isLogging) return;
    isLogging = true;
    try {
      const msg = args
        .map((a) => (typeof a === 'object' ? (a instanceof Error ? a.stack || a.message : JSON.stringify(a)) : String(a)))
        .join(' ');
      apiSafe.error(msg);
    } catch (e) {
      originalWarn('[BAM Console Relay] error failed', e);
    }
    isLogging = false;
  };
}

import BamSipButton from './components/BamSipButton';

const MainWindow: React.FC = () => {
  const rawUiPrefs = safeUseValue<string>(uiPrefs$, '');
  const [hydratedLoaded, setHydratedLoaded] = useState<boolean>(() => isBamStorageLoaded());
  const [fallbackReady, setFallbackReady] = useState<boolean>(
    () => Boolean((uiPrefs$ as any)?.__stub)
  );

  useEffect(() => {
    if (fallbackReady) return;
    const timer = window.setTimeout(() => setFallbackReady(true), 1500);
    return () => window.clearTimeout(timer);
  }, [fallbackReady]);

  useEffect(() => {
    const res = hydrateFromPayload(rawUiPrefs);
    if (res.loaded) {
      setHydratedLoaded(true);
    }
    if (res.changedAfterHydrate) {
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { source: 'sync' } }));
    }
  }, [rawUiPrefs]);

  if (!hydratedLoaded && !fallbackReady) {
    return null;
  }

  return (
    <AssetDataProvider>
      <BamWindowShell>
        <UnifiedAssetExplorer />
      </BamWindowShell>
    </AssetDataProvider>
  );
};

interface SipSlotPlacement {
  container: HTMLElement;
  beforeEl: HTMLElement | null;
}

/**
 * Resilient DOM finder to locate the action row & power toggle in the native Selected Info Panel.
 * Falls back gracefully to the root section element without crashing React if class names change.
 */
const findSipActionRow = (sectionEl: HTMLElement): SipSlotPlacement => {
  try {
    let powerEl: HTMLElement | null = null;
    let firstButtonParent: HTMLElement | null = null;

    const queue: HTMLElement[] = [sectionEl];
    let steps = 0;
    while (queue.length > 0 && steps < 150) {
      steps++;
      const node = queue.shift()!;
      const cls = typeof node.className === 'string' ? node.className : '';
      if (!powerEl && (cls.includes('out-of-service') || cls.includes('outOfService') || cls.includes('power-toggle'))) {
        powerEl = node;
      }
      if (!firstButtonParent && node.tagName && node.tagName.toLowerCase() === 'button' && node.parentElement) {
        firstButtonParent = node.parentElement;
      }
      const kids = node.children;
      if (kids) {
        for (let i = 0; i < kids.length; i++) {
          const child = kids[i] as HTMLElement;
          if (child && child.id !== 'bam-sip-portal-slot') {
            queue.push(child);
          }
        }
      }
    }

    const container = (powerEl && powerEl.parentElement) || firstButtonParent || sectionEl;
    const beforeEl = powerEl && powerEl.parentElement === container ? powerEl : null;
    return { container, beforeEl };
  } catch (err) {
    if (typeof window !== 'undefined' && (window as any).__BAM_DEBUG_CONSOLE__) {
      logCatch("SipActionRow", err);
    }
    return { container: sectionEl, beforeEl: null };
  }
};

const extendSelectedInfoSections = (sections: any) => {
  if (!sections) return sections;
  const OriginalActions = sections['Game.UI.InGame.ActionsSection'];
  if (OriginalActions && !(OriginalActions as any).__bamWrapped) {
    const WrappedActions: React.FC<any> = (props: any) => {
      const markerRef = useRef<HTMLSpanElement | null>(null);
      const slotRef = useRef<HTMLDivElement | null>(null);
      const [portalSlot, setPortalSlot] = useState<HTMLDivElement | null>(null);
      const [useInlineFallback, setUseInlineFallback] = useState(false);

      useLayoutEffect(() => {
        try {
          const marker = markerRef.current;
          if (!marker) return;

          const sectionEl = marker.previousElementSibling as HTMLElement | null;
          if (!sectionEl) {
            if (slotRef.current) {
              if (slotRef.current.parentElement) {
                slotRef.current.parentElement.removeChild(slotRef.current);
              }
              slotRef.current = null;
              setPortalSlot(null);
            }
            if (!useInlineFallback) {
              setUseInlineFallback(true);
            }
            return;
          }

          if (slotRef.current && slotRef.current.isConnected && sectionEl.contains(slotRef.current)) {
            if (useInlineFallback) {
              setUseInlineFallback(false);
            }
            if (portalSlot !== slotRef.current) {
              setPortalSlot(slotRef.current);
            }
            return;
          }

          const { container: rowContainer, beforeEl } = findSipActionRow(sectionEl);

          let slot = slotRef.current;
          if (!slot) {
            slot = document.createElement('div');
            slot.id = 'bam-sip-portal-slot';
            slot.style.display = 'flex';
            slot.style.alignItems = 'center';
            slot.style.flexShrink = '0';
            slotRef.current = slot;
          }

          if (beforeEl && beforeEl.parentElement === rowContainer) {
            if (slot.parentElement !== rowContainer || slot.nextElementSibling !== beforeEl) {
              rowContainer.insertBefore(slot, beforeEl);
            }
          } else if (slot.parentElement !== rowContainer) {
            rowContainer.appendChild(slot);
          }

          if (useInlineFallback) {
            setUseInlineFallback(false);
          }
          if (portalSlot !== slot) {
            setPortalSlot(slot);
          }
        } catch (err) {
          if (typeof window !== 'undefined' && (window as any).__BAM_DEBUG_CONSOLE__) {
            logCatch("SipLayoutEffect", err);
          }
          setUseInlineFallback(true);
        }
      });

      useLayoutEffect(() => {
        return () => {
          try {
            if (slotRef.current && slotRef.current.parentElement) {
              slotRef.current.parentElement.removeChild(slotRef.current);
            }
          } catch (err) { logCatch('SipSlotCleanup', err); }
          slotRef.current = null;
        };
      }, []);

      return (
        <>
          <OriginalActions {...props} />
          <span ref={markerRef} style={{ display: 'none' }} />
          {portalSlot ? ReactDOM.createPortal(<BamSipButton />, portalSlot) : null}
          {!portalSlot && useInlineFallback ? <BamSipButton /> : null}
        </>
      );
    };
    (WrappedActions as any).__bamWrapped = true;
    sections['Game.UI.InGame.ActionsSection'] = WrappedActions;
  }

  return sections;
};

const register: ModRegistrar = (moduleRegistry) => {
  moduleRegistry.append('GameTopLeft', ToolbarLauncher);
  moduleRegistry.append('Game', MainWindow);
  try {
    moduleRegistry.extend(
      'game-ui/game/components/selected-info-panel/selected-info-sections/selected-info-sections.tsx',
      'selectedInfoSectionComponents',
      extendSelectedInfoSections
    );
  } catch (err) {
    console.error('Failed to extend selectedInfoSectionComponents:', err);
  }
};

export default register;