import { logCatch } from '../utils/devWarn';
import React, { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { camera, selectedInfo } from 'cs2/bindings';
import { useLocalization } from 'cs2/l10n';
import apiSafe, { safeUseValue } from '../core/apiSafe';
import {
  resolveLocalizedString,
  formatResourceLabel,
  formatSubCategory,
  formatLeisureType,
  formatProfitabilityTier,
  formatFactorLabel,
  formatEffectString,
} from '../utils/formatters';
import {
  unifiedAssets$,
  catalogAssets$,
  serviceStatus$,
  inventoryStatus$,
  rowsPerPage$,
  districtsData$,
  districtPolicies$,
} from '../core/bindings';
import {
  UnifiedAssetItem,
  ServiceStatusCard,
  InventoryStatusPayload,
  DistrictItem,
  DistrictPolicyMeta,
  DistrictPolicyActive,
} from '../models/assetModels';

interface AssetDataContextValue {
  assets: UnifiedAssetItem[];
  serviceCards: ServiceStatusCard[];
  inventoryStatus: InventoryStatusPayload;
  districts: DistrictItem[];
  districtPolicies: DistrictPolicyMeta[];
  rowsPerPage: number;
  focusEntity: (entityKey: string) => void;
  plopPrefab: (prefabKey: string) => void;
  cloneBuilding: (entityKey: string) => void;
  rebuildBuilding: (entityKey: string) => void;
  rebuildAll: (category: string) => void;
  toggleDistrictPolicy: (
    districtKey: string,
    policyKey: string,
    active: boolean,
    adjustment?: number
  ) => void;
  applyPolicyToAllDistricts: (
    policyKey: string,
    active: boolean,
    adjustment?: number
  ) => void;
  copyDistrictPolicies: (
    sourceDistrictKey: string,
    targetDistrictKey: string
  ) => void;
  resetDistrictPolicies: (districtKey: string) => void;
  setDistrictPolicyAdjustment: (
    districtKey: string,
    policyKey: string,
    adjustment: number
  ) => void;
  renameDistrict: (districtKey: string, newName: string) => void;
  renameAsset: (entityKey: string, newName: string) => void;
  refresh: () => void;
}

const AssetDataContext = createContext<AssetDataContextValue | null>(null);

function parseEntityKey(key: string): { index: number; version: number } {
  try {
    const str = String(key || '');
    const delim = str.includes(':') ? ':' : str.includes(',') ? ',' : '';
    const parts = delim === '' ? [str, '0'] : str.split(delim);
    return {
      index: Number(parts[0]) || 0,
      version: Number(parts[1]) || 0,
    };
  } catch {
    return { index: 0, version: 0 };
  }
}

function normalizeAssetsPayload(
  raw: unknown,
  translate: (id: string, fallback?: string | null) => string | null
): UnifiedAssetItem[] {
  try {
    if (!raw || raw === '[]') return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    const result: UnifiedAssetItem[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as UnifiedAssetItem | null | undefined;
      if (!item || typeof item !== 'object') continue;
      if (!item.entityKey && !item.id && !item.prefabKey && !item.name) continue;
      // Clean Level 5 max sentinel (int.MaxValue / 2 = 1073741823) from older C# builds
      const isMaxLevelSentinel = (item.maxCondition ?? 0) >= 1000000000;
      const maxCondition = isMaxLevelSentinel ? 0 : item.maxCondition;
      const buildingCondition = isMaxLevelSentinel ? 100 : item.buildingCondition;

      // Clean older hardcoded 31.556 landValueBase sentinel using real roadLandValue when present
      const isFakeLandValue = item.landValueBase !== undefined && Math.abs(item.landValueBase - 31.556) < 0.01;
      const realLandBase = isFakeLandValue
        ? (item.roadLandValue && item.roadLandValue > 0 ? item.roadLandValue : 0)
        : item.landValueBase;
      const realLandRate = isFakeLandValue
        ? (realLandBase && item.landValueModifier ? Math.round(realLandBase * item.landValueModifier * 100) / 100 : 0)
        : item.landValueRate;

      result.push({
        ...item,
        id: item.id || item.entityKey || item.prefabKey || `asset-${i}`,
        name: item.name ? resolveLocalizedString(item.name, translate) : item.name,
        secondaryName: item.secondaryName ? resolveLocalizedString(item.secondaryName, translate) : item.secondaryName,
        subCategory: item.subCategory ? formatSubCategory(item.subCategory, translate) : item.subCategory,
        company: item.company
          ? (item.company.endsWith(' Facility')
              ? formatResourceLabel(item.company)
              : resolveLocalizedString(item.company, translate))
          : item.company,
        tradePartner: item.tradePartner ? resolveLocalizedString(item.tradePartner, translate) : item.tradePartner,
        profitabilityTier: item.profitabilityTier ? formatProfitabilityTier(item.profitabilityTier).label : item.profitabilityTier,
        leisureType: item.leisureType ? formatLeisureType(item.leisureType) : item.leisureType,
        resource: item.resource ? formatResourceLabel(item.resource) : item.resource,
        inputResources: Array.isArray(item.inputResources)
          ? item.inputResources.map((r) => formatResourceLabel(r)).filter((r) => r && r !== '—')
          : item.inputResources,
        outputResources: Array.isArray(item.outputResources)
          ? item.outputResources.map((r) => formatResourceLabel(r)).filter((r) => r && r !== '—')
          : item.outputResources,
        storedResources: Array.isArray(item.storedResources)
          ? item.storedResources.map((sr) => ({
              ...sr,
              name: formatResourceLabel(sr.name),
            }))
          : item.storedResources,
        efficiencyFactors: Array.isArray(item.efficiencyFactors)
          ? item.efficiencyFactors.map((ef) => ({
              ...ef,
              factor: formatFactorLabel(ef.factor, ef.percentage),
            }))
          : item.efficiencyFactors,
        happinessFactors: Array.isArray(item.happinessFactors)
          ? item.happinessFactors.map((hf) => ({
              ...hf,
              factor: formatFactorLabel(hf.factor, hf.percentage),
            }))
          : item.happinessFactors,
        cityEffects: Array.isArray(item.cityEffects)
          ? item.cityEffects.map((e) => formatEffectString(e))
          : item.cityEffects,
        localEffects: Array.isArray(item.localEffects)
          ? item.localEffects.map((e) => formatEffectString(e))
          : item.localEffects,
        subBuildings: Array.isArray(item.subBuildings)
          ? item.subBuildings.map((sb) => ({
              ...sb,
              name: sb.name ? resolveLocalizedString(sb.name, translate) : sb.name,
              benefit: sb.benefit ? formatEffectString(sb.benefit) : sb.benefit,
            }))
          : item.subBuildings,
        maxCondition,
        buildingCondition,
        landValueBase: realLandBase,
        landValueRate: realLandRate,
      });
    }
    return result;
    } catch {
      return [];
    }
}

export const AssetDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { translate } = useLocalization();
  const rawAssets = safeUseValue<string>(unifiedAssets$, '[]');
  const rawCatalog = safeUseValue<string>(catalogAssets$, '[]');
  const rawServices = safeUseValue<string>(serviceStatus$, '{"cards":[]}');
  const rawStatus = safeUseValue<string>(inventoryStatus$, '{}');
  const rawDistricts = safeUseValue<string>(districtsData$, '[]');
  const rawPolicies = safeUseValue<string>(districtPolicies$, '[]');
  const rowsPerPage = safeUseValue<number>(rowsPerPage$, 50);

  const placedAssetsRaw = useMemo<UnifiedAssetItem[]>(
    () => normalizeAssetsPayload(rawAssets, translate),
    [rawAssets, translate]
  );

  const [optimisticNames, setOptimisticNames] = useState<
    Record<string, { name: string; expiresAt: number }>
  >({});

  useEffect(() => {
    const now = Date.now();
    setOptimisticNames((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const next: Record<string, { name: string; expiresAt: number }> = {};
      let changed = false;
      for (const k of keys) {
        const entry = prev[k];
        if (!entry || now >= entry.expiresAt) {
          changed = true;
          continue;
        }
        const live = placedAssetsRaw.find((a) => a.entityKey === k);
        if (live && live.name === entry.name) {
          changed = true;
          continue;
        }
        next[k] = entry;
      }
      return changed ? next : prev;
    });
  }, [placedAssetsRaw]);

  const placedAssets = useMemo<UnifiedAssetItem[]>(() => {
    const now = Date.now();
    const keys = Object.keys(optimisticNames);
    if (keys.length === 0) return placedAssetsRaw;
    return placedAssetsRaw.map((item) => {
      const opt = item.entityKey ? optimisticNames[item.entityKey] : undefined;
      if (opt && now < opt.expiresAt) {
        return { ...item, name: opt.name };
      }
      return item;
    });
  }, [placedAssetsRaw, optimisticNames]);

  const catalogAssets = useMemo<UnifiedAssetItem[]>(
    () => normalizeAssetsPayload(rawCatalog, translate),
    [rawCatalog, translate]
  );

  const assets = useMemo<UnifiedAssetItem[]>(
    () => (catalogAssets.length > 0 ? [...placedAssets, ...catalogAssets] : placedAssets),
    [placedAssets, catalogAssets]
  );

  const serviceCards = useMemo<ServiceStatusCard[]>(() => {
    try {
      if (!rawServices) return [];
      const parsed = typeof rawServices === 'string' ? JSON.parse(rawServices) : rawServices;
      return parsed && Array.isArray(parsed.cards) ? parsed.cards : [];
    } catch {
      return [];
    }
  }, [rawServices]);

  const inventoryStatus = useMemo<InventoryStatusPayload>(() => {
    try {
      if (!rawStatus) return {};
      return typeof rawStatus === 'string' ? JSON.parse(rawStatus) : rawStatus;
    } catch {
      return {};
    }
  }, [rawStatus]);

  const [optimisticPolicies, setOptimisticPolicies] = useState<
    Record<string, { policies: DistrictPolicyActive[]; expiresAt: number }>
  >({});
  const adjDebounceTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      const timers = adjDebounceTimersRef.current;
      Object.keys(timers).forEach((k) => window.clearTimeout(timers[k]));
    };
  }, []);

  const parsedRawDistricts = useMemo<any[]>(() => {
    try {
      if (!rawDistricts || rawDistricts === '[]') return [];
      const parsed = typeof rawDistricts === 'string' ? JSON.parse(rawDistricts) : rawDistricts;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawDistricts]);

  const lastPopVerifyRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined' || !((window as any).__BAM_DEBUG_CONSOLE__ || (window as any).__DEBUG__)) return;
    const cityRow = parsedRawDistricts.find((d: any) => d && (d.entityKey === 'city' || d.isCity));
    const summary = typeof cityRow?.popVerify === 'string' ? cityRow.popVerify : '';
    if (summary && summary !== lastPopVerifyRef.current) {
      lastPopVerifyRef.current = summary;
      console.log(summary);
    }
  }, [parsedRawDistricts]);

  useEffect(() => {
    const now = Date.now();
    setOptimisticPolicies((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const next: Record<string, { policies: DistrictPolicyActive[]; expiresAt: number }> = {};
      let changed = false;
      for (const dk of keys) {
        const entry = prev[dk];
        if (!entry || now >= entry.expiresAt) {
          changed = true;
          continue;
        }
        const srvDist = parsedRawDistricts.find((d) => d && d.entityKey === dk);
        const srvPols: DistrictPolicyActive[] = Array.isArray(srvDist?.policies) ? srvDist.policies : [];
        const matchesServer =
          srvPols.length === entry.policies.length &&
          entry.policies.every((ep) => {
            const sp = srvPols.find((s) => s.key === ep.key);
            return sp !== undefined && Math.abs((sp.adjustment ?? 0) - (ep.adjustment ?? 0)) < 0.01;
          });
        if (matchesServer) {
          changed = true;
        } else {
          next[dk] = entry;
        }
      }
      return changed ? next : prev;
    });
  }, [parsedRawDistricts]);

  // Automatically expire optimistic overrides on schedule even if rawDistricts hasn't changed,
  // so stale overrides on one district never snap back later when another district is clicked.
  useEffect(() => {
    const keys = Object.keys(optimisticPolicies);
    if (keys.length === 0) return;
    const now = Date.now();
    let earliest = Infinity;
    for (const k of keys) {
      const exp = optimisticPolicies[k]?.expiresAt ?? 0;
      if (exp < earliest) earliest = exp;
    }
    const delay = Math.max(50, earliest - now + 20);
    const tid = window.setTimeout(() => {
      const tNow = Date.now();
      setOptimisticPolicies((prev) => {
        const pKeys = Object.keys(prev);
        if (pKeys.length === 0) return prev;
        const next: Record<string, { policies: DistrictPolicyActive[]; expiresAt: number }> = {};
        let changed = false;
        for (const k of pKeys) {
          if (tNow < prev[k].expiresAt) {
            next[k] = prev[k];
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, delay);
    return () => window.clearTimeout(tid);
  }, [optimisticPolicies]);

  const districts = useMemo<DistrictItem[]>(() => {
    try {
      if (parsedRawDistricts.length === 0) return [];
      const now = Date.now();
      return parsedRawDistricts.map((d: any) => {
        const serverPolicies = Array.isArray(d?.policies) ? d.policies : [];
        const overrideEntry = optimisticPolicies[d.entityKey];
        const overridden = overrideEntry && now < overrideEntry.expiresAt ? overrideEntry.policies : undefined;
        const happinessFactors = Array.isArray(d?.happinessFactors)
          ? d.happinessFactors.map((hf: any) => ({
              ...hf,
              factor: formatFactorLabel(hf.factor, hf.percentage),
            }))
          : d?.happinessFactors;
        return {
          ...d,
          happinessFactors,
          policies: overridden !== undefined ? overridden : serverPolicies,
        };
      });
    } catch {
      return [];
    }
  }, [parsedRawDistricts, optimisticPolicies]);

  const districtsRef = useRef<DistrictItem[]>(districts);
  districtsRef.current = districts;

  const districtPolicies = useMemo<DistrictPolicyMeta[]>(() => {
    try {
      if (!rawPolicies || rawPolicies === '[]') return [];
      const parsed = typeof rawPolicies === 'string' ? JSON.parse(rawPolicies) : rawPolicies;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawPolicies]);

  const focusEntity = (entityKey: string) => {
    try {
      if (entityKey === 'city' || entityKey === 'City') return;
      const { index, version } = parseEntityKey(entityKey);
      if (index > 0) {
        const entity = { index, version };
        if (camera?.focusEntity) camera.focusEntity(entity);
        if (selectedInfo?.selectEntity) selectedInfo.selectEntity(entity);
      }
    } catch (err) { logCatch('AssetDataProvider', err); }
  };

  const plopPrefab = (prefabKey: string) => {
    apiSafe.plopPrefab(prefabKey);
  };

  const cloneBuilding = (entityKey: string) => {
    apiSafe.cloneBuilding(entityKey);
  };

  const rebuildBuilding = (entityKey: string) => {
    apiSafe.rebuildBuilding(entityKey);
  };

  const rebuildAll = (category: string) => {
    apiSafe.rebuildAllBuildings(category);
  };

  const toggleDistrictPolicy = (
    districtKey: string,
    policyKey: string,
    active: boolean,
    adjustment: number = 0
  ) => {
    const now = Date.now();
    setOptimisticPolicies((prev) => {
      const latestDist = districtsRef.current.find((d) => d.entityKey === districtKey);
      const basePols =
        prev[districtKey] && now < prev[districtKey].expiresAt
          ? prev[districtKey].policies
          : latestDist?.policies || [];
      let nextPols: DistrictPolicyActive[];
      if (active) {
        if (!basePols.some((p) => p.key === policyKey)) {
          nextPols = [...basePols, { key: policyKey, adjustment }];
        } else {
          nextPols = basePols.map((p) => (p.key === policyKey ? { ...p, adjustment } : p));
        }
      } else {
        nextPols = basePols.filter((p) => p.key !== policyKey);
      }
      return {
        ...prev,
        [districtKey]: { policies: nextPols, expiresAt: now + 2000 },
      };
    });

    apiSafe.toggleDistrictPolicy(districtKey, policyKey, active, adjustment);
  };

  const applyPolicyToAllDistricts = (
    policyKey: string,
    active: boolean,
    adjustment: number = 0
  ) => {
    const now = Date.now();
    const expiresAt = now + 2000;
    setOptimisticPolicies((prev) => {
      const next = { ...prev };
      for (const d of districtsRef.current) {
        if (!d || d.isCity || d.entityKey === 'city') continue;
        const curPols =
          prev[d.entityKey] && now < prev[d.entityKey].expiresAt
            ? prev[d.entityKey].policies
            : d.policies || [];
        const nextPols = active
          ? curPols.some((p) => p.key === policyKey)
            ? curPols.map((p) => (p.key === policyKey ? { ...p, adjustment } : p))
            : [...curPols, { key: policyKey, adjustment }]
          : curPols.filter((p) => p.key !== policyKey);
        next[d.entityKey] = { policies: nextPols, expiresAt };
      }
      return next;
    });
    apiSafe.applyPolicyToAllDistricts(policyKey, active, adjustment);
  };

  const copyDistrictPolicies = (
    sourceDistrictKey: string,
    targetDistrictKey: string
  ) => {
    const now = Date.now();
    setOptimisticPolicies((prev) => {
      const src = districtsRef.current.find((d) => d.entityKey === sourceDistrictKey);
      const srcPols =
        prev[sourceDistrictKey] && now < prev[sourceDistrictKey].expiresAt
          ? prev[sourceDistrictKey].policies
          : src?.policies;
      if (!srcPols) return prev;
      return {
        ...prev,
        [targetDistrictKey]: { policies: [...srcPols], expiresAt: now + 2000 },
      };
    });
    apiSafe.copyDistrictPolicies(sourceDistrictKey, targetDistrictKey);
  };

  const resetDistrictPolicies = (districtKey: string) => {
    setOptimisticPolicies((prev) => ({
      ...prev,
      [districtKey]: { policies: [], expiresAt: Date.now() + 2000 },
    }));
    apiSafe.resetDistrictPolicies(districtKey);
  };

  const setDistrictPolicyAdjustment = (
    districtKey: string,
    policyKey: string,
    adjustment: number
  ) => {
    const now = Date.now();
    setOptimisticPolicies((prev) => {
      const currentDist = districtsRef.current.find((d) => d.entityKey === districtKey);
      const curPols =
        prev[districtKey] && now < prev[districtKey].expiresAt
          ? prev[districtKey].policies
          : currentDist?.policies || [];
      const nextPols = curPols.some((p) => p.key === policyKey)
        ? curPols.map((p) => (p.key === policyKey ? { ...p, adjustment } : p))
        : [...curPols, { key: policyKey, adjustment }];
      return {
        ...prev,
        [districtKey]: { policies: nextPols, expiresAt: now + 2000 },
      };
    });

    const timerKey = `${districtKey}::${policyKey}`;
    if (adjDebounceTimersRef.current[timerKey]) {
      window.clearTimeout(adjDebounceTimersRef.current[timerKey]);
    }
    adjDebounceTimersRef.current[timerKey] = window.setTimeout(() => {
      delete adjDebounceTimersRef.current[timerKey];
      apiSafe.setDistrictPolicyAdjustment(districtKey, policyKey, adjustment);
    }, 80);
  };

  const renameDistrict = (districtKey: string, newName: string) => {
    apiSafe.renameDistrict(districtKey, newName);
  };

  const renameAsset = (entityKey: string, newName: string) => {
    const trimmed = (newName ?? '').trim();
    if (entityKey && trimmed !== '') {
      const now = Date.now();
      setOptimisticNames((prev) => ({
        ...prev,
        [entityKey]: { name: trimmed, expiresAt: now + 3000 },
      }));
    }
    apiSafe.renameAsset(entityKey, trimmed);
  };

  const refresh = () => {
    lastPopVerifyRef.current = '';
    apiSafe.requestRefresh();
  };

  const value = useMemo<AssetDataContextValue>(
    () => ({
      assets,
      serviceCards,
      inventoryStatus,
      districts,
      districtPolicies,
      rowsPerPage,
      focusEntity,
      plopPrefab,
      cloneBuilding,
      rebuildBuilding,
      rebuildAll,
      toggleDistrictPolicy,
      applyPolicyToAllDistricts,
      copyDistrictPolicies,
      resetDistrictPolicies,
      setDistrictPolicyAdjustment,
      renameDistrict,
      renameAsset,
      refresh,
    }),
    [
      assets,
      serviceCards,
      inventoryStatus,
      districts,
      districtPolicies,
      rowsPerPage,
    ]
  );

  return <AssetDataContext.Provider value={value}>{children}</AssetDataContext.Provider>;
};

export const useAssetData = (): AssetDataContextValue => {
  const ctx = useContext(AssetDataContext);
  if (!ctx) throw new Error('useAssetData must be used within an AssetDataProvider');
  return ctx;
};

export default AssetDataProvider;
