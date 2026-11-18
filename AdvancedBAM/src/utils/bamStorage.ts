import apiSafe from '../core/apiSafe';
import { logCatch } from './devWarn';

export interface HydrateResult {
  loaded: boolean;
  changedAfterHydrate: boolean;
}

const PENDING_WRITE_GRACE_MS = 2000;
const memoryStore = new Map<string, string>();
const pendingWrites = new Map<string, number>();
let hydrated = false;

function safeLocalGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

function safeLocalRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

export function hydrateFromPayload(rawJson: string): HydrateResult {
  if (!rawJson) {
    return { loaded: hydrated, changedAfterHydrate: false };
  }

  let parsed: { loaded?: boolean; prefs?: Record<string, unknown> } | null = null;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    logCatch('bamStorage.hydrateFromPayload', err);
    return { loaded: hydrated, changedAfterHydrate: false };
  }

  if (!parsed || parsed.loaded !== true || !parsed.prefs || typeof parsed.prefs !== 'object') {
    return { loaded: hydrated, changedAfterHydrate: false };
  }

  const now = Date.now();
  for (const [k, exp] of Array.from(pendingWrites.entries())) {
    if (now >= exp) {
      pendingWrites.delete(k);
    }
  }

  const incoming = parsed.prefs;
  const wasHydrated = hydrated;
  let changed = false;

  const incomingKeys = new Set<string>();
  for (const key of Object.keys(incoming)) {
    const rawVal = incoming[key];
    if (typeof rawVal !== 'string') continue;
    incomingKeys.add(key);

    const pendingExpiry = pendingWrites.get(key);
    if (pendingExpiry !== undefined && now < pendingExpiry) {
      if (memoryStore.get(key) === rawVal) {
        pendingWrites.delete(key);
      }
      continue;
    }

    if (memoryStore.get(key) !== rawVal) {
      memoryStore.set(key, rawVal);
      safeLocalSet(key, rawVal);
      changed = true;
    }
  }

  // Only remove keys absent from C# snapshot if C# is pushing a full update
  for (const existingKey of Array.from(memoryStore.keys())) {
    if (!incomingKeys.has(existingKey)) {
      const pendingExpiry = pendingWrites.get(existingKey);
      if (pendingExpiry !== undefined && now < pendingExpiry) {
        continue;
      }
      memoryStore.delete(existingKey);
      safeLocalRemove(existingKey);
      changed = true;
    }
  }

  hydrated = true;
  if (!wasHydrated || changed) {
    try {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('bam-ui-prefs-hydrated'));
      }, 0);
    } catch {
      // Ignore event dispatch failure
    }
  }
  return {
    loaded: true,
    changedAfterHydrate: wasHydrated && changed,
  };
}

export function isBamStorageLoaded(): boolean {
  return hydrated;
}

export const bamStorage = {
  getItem(key: string): string | null {
    if (memoryStore.has(key)) {
      return memoryStore.get(key) ?? null;
    }
    if (!hydrated) {
      return safeLocalGet(key);
    }
    return null;
  },

  setItem(key: string, value: string): void {
    const normalized = String(value);
    const unchanged = hydrated && memoryStore.get(key) === normalized;
    memoryStore.set(key, normalized);
    safeLocalSet(key, normalized);
    if (!unchanged) {
      pendingWrites.set(key, Date.now() + PENDING_WRITE_GRACE_MS);
      apiSafe.setUiPref(key, normalized);
    }
  },

  removeItem(key: string): void {
    const existed = memoryStore.has(key);
    memoryStore.delete(key);
    safeLocalRemove(key);
    if (existed || !hydrated) {
      pendingWrites.set(key, Date.now() + PENDING_WRITE_GRACE_MS);
      apiSafe.removeUiPref(key);
    }
  },

  clearPrefix(prefix: string = 'bam_'): void {
    const expiry = Date.now() + PENDING_WRITE_GRACE_MS;
    for (const key of Array.from(memoryStore.keys())) {
      if (!prefix || key.startsWith(prefix)) {
        pendingWrites.set(key, expiry);
        memoryStore.delete(key);
        safeLocalRemove(key);
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (!prefix || k.startsWith(prefix))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => safeLocalRemove(k));
      }
    } catch {
      // Ignore
    }
    apiSafe.clearUiPrefs(prefix);
  },

  keys(): string[] {
    return Array.from(memoryStore.keys());
  },
};

export default bamStorage;

