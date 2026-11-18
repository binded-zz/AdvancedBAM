import React, { useMemo, useState, useEffect } from 'react';
import { Scrollable } from 'cs2/ui';
import { CategoryFilter, DistrictItem, UnifiedAssetItem } from '../../models/assetModels';
import { formatNumber } from '../../utils/formatters';
import PackIcon, { formatPackDisplayName } from './PackIcon';
import ServiceIcon from './ServiceIcon';
import ThemeIcon from './ThemeIcon';
import UilIcon from './UilIcon';
import bamStorage from '../../utils/bamStorage';
import {
  ALL_ZONE_MATRIX_CATEGORIES,
  HousingDensityMode,
  STORAGE_HUB_GROUP_SILO_TANK,
  STORAGE_HUB_GROUP_WAREHOUSE,
  ZoneMatrixCategory,
  ZONE_MATRIX_SETTING_KEYS,
  classifyStorageKind,
  readActiveZoneMatrixCategory,
  readHousingDensityMode,
  readZoneMatrixSettings,
  writeActiveZoneMatrixCategory,
  writeHousingDensityMode,
} from '../../utils/zoneMatrixSettings';
import './ZoneMatrixPanel.css';

export interface ZoneMatrixFilterRequest {
  category?: CategoryFilter;
  density?: string;
  serviceType?: string;
  storageHub?: string;
  storedResource?: string;
  signatureCategory?: string;
  theme?: string;
  pack?: string;
  districtKey?: string;
  signatureOnly?: boolean;
}

export interface ZoneMatrixPanelProps {
  assets: UnifiedAssetItem[];
  districts: DistrictItem[];
  districtKey?: string | null;
  zoneCategory?: ZoneMatrixCategory;
  onChangeZoneCategory?: (cat: ZoneMatrixCategory) => void;
  availableCategories?: ZoneMatrixCategory[];
  includeMixedGroundFloor?: boolean;
  includeIndustrialSpecials?: boolean;
  includeServiceUpgrades?: boolean;
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  compact?: boolean;
  activeDensity?: string;
  activeServiceType?: string;
  activeStorageHub?: string;
  activeSignatureCategory?: string;
  activePack?: string;
  activeTheme?: string;
  onFilterResidential?: (req: ZoneMatrixFilterRequest) => void;
  onFilterAsset?: (req: ZoneMatrixFilterRequest) => void;
  onInspectDistrict?: (districtKey: string) => void;
}

type DetailedDensityBucket = 'low' | 'row' | 'medium' | 'high' | 'lowRent' | 'mixed';

interface BucketAcc {
  size: number;
  active: number;
  free: number;
  placed: number;
  usa: number;
  eu: number;
  otherBase: number;
  packs: Map<string, number>;
  storageAmount: number;
  storageCapacity: number;
  upgrades: number;
}

interface MatrixRowData extends BucketAcc {
  key: string;
  label: string;
  subNote?: string;
  color: string;
  targetCategory?: CategoryFilter;
  filterDensity: string;
  filterServiceType?: string;
  filterStorageHub?: string;
  filterSignatureCategory?: string;
  serviceIcon?: string;
  signatureOnly?: boolean;
}

const ZONE_CATEGORY_META: Record<
  ZoneMatrixCategory,
  {
    label: string;
    shortLabel: string;
    iconPath: string;
    accentColor: string;
    explorerCategory: CategoryFilter;
    explorerBtnLabel: string;
    capacityUnitLabel: string;
    itemNoun: string;
  }
> = {
  housing: {
    label: 'Residential',
    shortLabel: 'Residential',
    iconPath: 'Media/Game/Icons/ZoneResidential.svg',
    accentColor: '#69f0ae',
    explorerCategory: 'Residential',
    explorerBtnLabel: 'View Homes',
    capacityUnitLabel: 'HH',
    itemNoun: 'Residential buildings',
  },
  commercial: {
    label: 'Commercial',
    shortLabel: 'Commercial',
    iconPath: 'Media/Game/Icons/ZoneCommercial.svg',
    accentColor: '#64b5f6',
    explorerCategory: 'Commercial',
    explorerBtnLabel: 'View Commercial',
    capacityUnitLabel: 'Jobs',
    itemNoun: 'Commercial venues',
  },
  office: {
    label: 'Office',
    shortLabel: 'Office',
    iconPath: 'Media/Game/Icons/ZoneOffice.svg',
    accentColor: '#4dd0e1',
    explorerCategory: 'Office',
    explorerBtnLabel: 'View Offices',
    capacityUnitLabel: 'Jobs',
    itemNoun: 'Office buildings',
  },
  industrial: {
    label: 'Industrial',
    shortLabel: 'Industrial',
    iconPath: 'Media/Game/Icons/ZoneIndustrial.svg',
    accentColor: '#ffb74d',
    explorerCategory: 'Industrial',
    explorerBtnLabel: 'View Industry',
    capacityUnitLabel: 'Jobs',
    itemNoun: 'Industrial & storage buildings',
  },
  storage: {
    label: 'Storage',
    shortLabel: 'Storage',
    iconPath: 'Media/Game/Icons/ZoneIndustrialWarehouses.svg',
    accentColor: '#ffd54f',
    explorerCategory: 'Storage',
    explorerBtnLabel: 'View Storage',
    capacityUnitLabel: 'Tonnes',
    itemNoun: 'Storage warehouses & hubs',
  },
  service: {
    label: 'Services',
    shortLabel: 'Services',
    iconPath: 'Media/Game/Icons/Services.svg',
    accentColor: '#ab47bc',
    explorerCategory: 'Service',
    explorerBtnLabel: 'View Services',
    capacityUnitLabel: 'Staff',
    itemNoun: 'Service facilities',
  },
  signature: {
    label: 'Signatures',
    shortLabel: 'Signatures',
    iconPath: 'Media/Game/Icons/Unique.svg',
    accentColor: '#ffd54f',
    explorerCategory: 'Signature',
    explorerBtnLabel: 'View Signatures',
    capacityUnitLabel: 'Slots',
    itemNoun: 'Signature landmarks',
  },
};

interface ServiceDeptDef {
  key: string;
  match: string;
  label: string;
  color: string;
  alwaysCity?: boolean;
}

const SERVICE_DEPT_DEFS: ServiceDeptDef[] = [
  { key: 'svcHealth', match: 'Health & Deathcare', label: 'Health & Deathcare', color: '#f87171', alwaysCity: true },
  { key: 'svcFire', match: 'Fire & Rescue', label: 'Fire & Rescue', color: '#fb923c', alwaysCity: true },
  { key: 'svcPolice', match: 'Police & Administration', label: 'Police & Admin', color: '#60a5fa', alwaysCity: true },
  { key: 'svcEducation', match: 'Education & Research', label: 'Education & Research', color: '#34d399', alwaysCity: true },
  { key: 'svcElectricity', match: 'Electricity', label: 'Electricity', color: '#facc15', alwaysCity: true },
  { key: 'svcWater', match: 'Water & Sewage', label: 'Water & Sewage', color: '#38bdf8', alwaysCity: true },
  { key: 'svcGarbage', match: 'Garbage Management', label: 'Garbage Management', color: '#a3e635', alwaysCity: true },
  { key: 'svcTransport', match: 'Transportation', label: 'Transportation', color: '#2dd4bf', alwaysCity: true },
  { key: 'svcParks', match: 'Parks & Recreation', label: 'Parks & Recreation', color: '#4ade80', alwaysCity: true },
  { key: 'svcComms', match: 'Communications', label: 'Communications', color: '#818cf8' },
  { key: 'svcRoads', match: 'Roads', label: 'Road Maintenance', color: '#cbd5e1' },
  { key: 'svcParking', match: 'Parking', label: 'Parking Facilities', color: '#94a3b8' },
  { key: 'svcCivic', match: 'Civic & Misc', label: 'Civic & Landmarks', color: '#e879f9' },
  { key: 'svcUpgrades', match: 'Service Upgrades', label: 'Service Upgrades', color: '#c084fc' },
];

const SERVICE_DEPT_BY_MATCH = new Map<string, ServiceDeptDef>(
  SERVICE_DEPT_DEFS.map((d) => [d.match.toLowerCase(), d])
);

const MODDED_ZONE_PALETTE = [
  '#2dd4bf',
  '#f472b6',
  '#a78bfa',
  '#facc15',
  '#60a5fa',
  '#fb923c',
  '#34d399',
  '#e879f9',
];

const PACK_DISPLAY_SORT = [
  'nl', 'netherlands', 'dutch',
  'cn', 'china', 'chinese',
  'sw', 'southwest', 'ussw',
  'ne', 'northeast', 'usne',
  'mh', 'modern heritage',
  'fr', 'france', 'french',
  'de', 'germany', 'german',
  'uk', 'united kingdom', 'british',
  'jp', 'japan', 'japanese',
  'ee', 'east europe',
  'up', 'urban promenade',
  'sk', 'skyscraper',
];

function getShortPackAbbrev(pack: string): string {
  const clean = String(pack || '').replace(/^(CCP|DLC|Pack)\s*/i, '').trim();
  const lower = clean.toLowerCase();
  if (lower.includes('urban promenade')) return 'UP';
  if (lower.includes('modern heritage')) return 'MH';
  if (lower.includes('leisure venue')) return 'LV';
  if (lower.includes('dragon gate')) return 'DG';
  if (lower.includes('skyscraper')) return 'SK';
  if (lower.includes('supply chain')) return 'SC';
  if (lower.includes('office evolution')) return 'OE';
  if (lower.includes('san francisco')) return 'SF';
  if (lower.includes('beach propert')) return 'BP';
  if (lower.includes('bridges') || lower.includes('ports')) return 'BP';
  if (lower.includes('city station')) return 'CS';
  if (lower.includes('downtown market')) return 'DM';
  if (lower.includes('first response')) return 'FR';
  if (lower.includes('france') || lower.includes('french')) return 'FR';
  if (lower.includes('germany') || lower.includes('german')) return 'DE';
  if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('british')) return 'UK';
  if (lower.includes('china') || lower.includes('chinese')) return 'CN';
  if (lower.includes('japan') || lower.includes('japanese')) return 'JP';
  if (lower.includes('netherlands') || lower.includes('dutch')) return 'NL';
  if (lower.includes('east europe')) return 'EE';
  if (lower.includes('southwest') || lower.includes('ussw')) return 'SW';
  if (lower.includes('northeast') || lower.includes('usne')) return 'NE';

  const words = clean.split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (clean.length <= 3) return clean.toUpperCase();
  return clean.substring(0, 2).toUpperCase();
}

function classifyResBucket(item: UnifiedAssetItem): DetailedDensityBucket {
  const d = (item.density || '').toLowerCase();
  const sub = (item.subCategory || '').toLowerCase();

  if (d === 'mixed' || d.includes('mixed') || sub.includes('mixed') || (item.isMixedUse && d !== 'low' && d !== 'medium' && d !== 'high')) {
    return 'mixed';
  }
  if (d.includes('rent') || d.includes('income') || sub.includes('rent') || sub.includes('income')) {
    return 'lowRent';
  }
  if (d.includes('row') || sub.includes('row')) {
    return 'row';
  }
  if (d === 'medium' || d === 'mid' || sub.includes('medium')) {
    return 'medium';
  }
  if (d === 'high' || sub.includes('high')) {
    return 'high';
  }
  if (d === 'low' || sub.includes('low')) {
    return 'low';
  }

  const cap = Number.isFinite(item.capacity) ? item.capacity : 0;
  if (cap > 20) return 'high';
  if (cap > 4) return 'medium';
  return 'low';
}

const STANDARD_RES_DENSITY = new Set([
  '',
  'low',
  'row',
  'row housing',
  'medium',
  'mid',
  'high',
  'low rent',
  'mixed',
  'signature',
]);

const STANDARD_COM_DENSITY = new Set(['', 'low', 'medium', 'mid', 'high', 'row', 'mixed', 'signature']);
const STANDARD_OFF_DENSITY = new Set(['', 'low', 'medium', 'mid', 'high', 'mixed', 'signature']);
const STANDARD_IND_DENSITY = new Set(['', 'manufacturing', 'specialized', 'storage', 'signature']);
const STANDARD_STORAGE_DENSITY = new Set(['', 'storage', 'signature']);
const STANDARD_STORAGE_ZONES = new Set(['', 'warehouses & storage', 'storage facility', 'industrial', 'signature building']);

function getCustomZoneLabel(item: UnifiedAssetItem): string {
  return (item.zoneType || item.density || item.subCategory || '').trim() || 'Custom Zone';
}

function classifyThemeGroup(theme?: string): 'usa' | 'eu' | 'other' {
  const t = (theme || '').toLowerCase();
  if (t.startsWith('na') || t.includes('north') || t.includes('usa')) return 'usa';
  if (t.startsWith('eu') || t.includes('europe')) return 'eu';
  return 'other';
}

function emptyBucketAcc(): BucketAcc {
  return {
    size: 0,
    active: 0,
    free: 0,
    placed: 0,
    usa: 0,
    eu: 0,
    otherBase: 0,
    packs: new Map<string, number>(),
    storageAmount: 0,
    storageCapacity: 0,
    upgrades: 0,
  };
}

function addToAcc(
  target: BucketAcc,
  item: UnifiedAssetItem,
  isBasePack: boolean,
  packKey: string,
  capOverride?: number,
  occOverride?: number
) {
  const rawCap = capOverride !== undefined ? capOverride : item.capacity;
  const rawOcc = occOverride !== undefined ? occOverride : item.occupied;
  const cap = Number.isFinite(rawCap) && rawCap > 0 ? rawCap : 0;
  const occ = Number.isFinite(rawOcc) && rawOcc > 0 ? rawOcc : 0;
  target.size += cap;
  target.active += occ;
  target.free += Math.max(0, cap - occ);
  target.placed += 1;

  if (Number.isFinite(item.storageAmount) && (item.storageAmount || 0) > 0) {
    target.storageAmount += item.storageAmount || 0;
  }
  if (Number.isFinite(item.storageCapacity) && (item.storageCapacity || 0) > 0) {
    target.storageCapacity += item.storageCapacity || 0;
  }
  if (Array.isArray(item.subBuildings) && item.subBuildings.length > 0) {
    target.upgrades += item.subBuildings.length;
  }

  if (isBasePack) {
    const tGroup = classifyThemeGroup(item.theme);
    if (tGroup === 'usa') target.usa += 1;
    else if (tGroup === 'eu') target.eu += 1;
    else target.otherBase += 1;
  } else {
    target.packs.set(packKey, (target.packs.get(packKey) || 0) + 1);
  }
}

function mergeAccList(sources: BucketAcc[]): BucketAcc {
  const merged = emptyBucketAcc();
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s];
    merged.size += src.size;
    merged.active += src.active;
    merged.free += src.free;
    merged.placed += src.placed;
    merged.usa += src.usa;
    merged.eu += src.eu;
    merged.otherBase += src.otherBase;
    merged.storageAmount += src.storageAmount;
    merged.storageCapacity += src.storageCapacity;
    merged.upgrades += src.upgrades;
    src.packs.forEach((cnt, pk) => {
      merged.packs.set(pk, (merged.packs.get(pk) || 0) + cnt);
    });
  }
  return merged;
}

function sortPackKeys(packTotals: Map<string, number>): string[] {
  return Array.from(packTotals.keys()).sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const idxA = PACK_DISPLAY_SORT.findIndex((k) => aLower.includes(k));
    const idxB = PACK_DISPLAY_SORT.findIndex((k) => bLower.includes(k));
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
    if (idxA !== -1 && idxB === -1) return -1;
    if (idxA === -1 && idxB !== -1) return 1;
    return (packTotals.get(b) || 0) - (packTotals.get(a) || 0);
  });
}

function formatTonnesShort(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return '0 t';
  if (val >= 100000) return `${Math.round(val / 1000)} kt`;
  if (val >= 1000) return `${Number((val / 1000).toFixed(2))} kt`;
  return `${Math.round(val)} t`;
}

function formatCurrencyCompact(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return '$0';
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 10000) return `$${Math.round(val / 1000)}K`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${Math.round(val)}`;
}

export const ZoneMatrixPanel: React.FC<ZoneMatrixPanelProps> = ({
  assets,
  districts,
  districtKey,
  zoneCategory = 'housing',
  onChangeZoneCategory,
  availableCategories,
  includeMixedGroundFloor: propIncludeMixed,
  includeIndustrialSpecials: propIncludeIndSpecials,
  includeServiceUpgrades: propIncludeServiceUpgrades,
  title,
  collapsible = true,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  compact = false,
  activeDensity,
  activeServiceType,
  activeStorageHub,
  activeSignatureCategory,
  activePack,
  activeTheme,
  onFilterResidential,
  onFilterAsset,
  onInspectDistrict,
}) => {
  const collapsedStorageKey = compact ? 'bam_zone_matrix_inline_collapsed' : `bam_zone_matrix_collapsed_${zoneCategory}`;
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      const saved = bamStorage.getItem(collapsedStorageKey);
      if (saved === '1' || saved === 'true') return true;
      if (saved === '0' || saved === 'false') return false;
    } catch {
      // ignore storage read error
    }
    return defaultCollapsed;
  });

  useEffect(() => {
    try {
      const saved = bamStorage.getItem(collapsedStorageKey);
      if (saved === '1' || saved === 'true') setInternalCollapsed(true);
      else if (saved === '0' || saved === 'false') setInternalCollapsed(false);
    } catch {
      // ignore
    }
  }, [collapsedStorageKey]);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const [matrixMode, setMatrixMode] = useState<HousingDensityMode>(readHousingDensityMode);
  const [specialSettings, setSpecialSettings] = useState(() => readZoneMatrixSettings());
  type MatrixSortField = 'label' | 'size' | 'active' | 'free' | 'placed';
  const [matrixSortField, setMatrixSortField] = useState<MatrixSortField | null>(null);
  const [matrixSortDir, setMatrixSortDir] = useState<'asc' | 'desc'>('desc');

  const handleMatrixSort = (field: MatrixSortField, e: React.MouseEvent) => {
    e.stopPropagation();
    if (matrixSortField === field) {
      setMatrixSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setMatrixSortField(field);
      setMatrixSortDir(field === 'label' ? 'asc' : 'desc');
    }
  };

  const includeMixedGroundFloor =
    propIncludeMixed !== undefined ? propIncludeMixed : specialSettings.includeMixedGroundFloor;
  const includeIndustrialSpecials =
    propIncludeIndSpecials !== undefined ? propIncludeIndSpecials : specialSettings.includeIndustrialSpecials;
  const includeServiceUpgrades =
    propIncludeServiceUpgrades !== undefined ? propIncludeServiceUpgrades : specialSettings.includeServiceUpgrades;

  useEffect(() => {
    const onChanged = (e: any) => {
      const k = e?.detail?.key;
      if (k === 'housingMatrixMode' || k === ZONE_MATRIX_SETTING_KEYS.matrixMode) {
        setMatrixMode(readHousingDensityMode());
      } else {
        setSpecialSettings(readZoneMatrixSettings());
      }
    };
    const onReset = () => {
      setMatrixMode('standard');
      setSpecialSettings(readZoneMatrixSettings());
      setInternalCollapsed(defaultCollapsed);
    };
    window.addEventListener('bam-settings-changed', onChanged);
    window.addEventListener('bam-settings-reset', onReset);
    window.addEventListener('storage', onReset);
    return () => {
      window.removeEventListener('bam-settings-changed', onChanged);
      window.removeEventListener('bam-settings-reset', onReset);
      window.removeEventListener('storage', onReset);
    };
  }, []);

  const handleToggleMode = (nextMode: HousingDensityMode, e: React.MouseEvent) => {
    e.stopPropagation();
    setMatrixMode(nextMode);
    writeHousingDensityMode(nextMode);
  };

  const handleHeaderToggle = () => {
    if (!collapsible) return;
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((v) => {
        const next = !v;
        try {
          bamStorage.setItem(collapsedStorageKey, next ? '1' : '0');
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  const scopedDistrict = useMemo<DistrictItem | undefined>(() => {
    const list = Array.isArray(districts) ? districts : [];
    if (districtKey && districtKey !== '' && districtKey !== 'city') {
      return list.find((d) => d && d.entityKey === districtKey);
    }
    return list.find((d) => d && (d.entityKey === 'city' || d.isCity));
  }, [districts, districtKey]);

  const catMeta = ZONE_CATEGORY_META[zoneCategory] || ZONE_CATEGORY_META.housing;

  const matrixStats = useMemo(() => {
    const packTotals = new Map<string, number>();
    const packIconMap = new Map<string, string>();
    const customBuckets = new Map<string, BucketAcc>();

    let usaThemeExact = 'North American';
    let euThemeExact = 'European';
    let foundUsaExact = false;
    let foundEuExact = false;

    let effSum = 0;
    let effCount = 0;
    let vacantLots = 0;
    let totalTaxPaid = 0;
    let extractorCount = 0;
    let totalMaintenanceCost = 0;
    let fleetActive = 0;
    let fleetMax = 0;
    let needsRepairCount = 0;
    let totalUpgrades = 0;
    let storageJobsSize = 0;
    let storageJobsActive = 0;
    let emptyStorageCount = 0;
    let sigCatalogUniqueCount = 0;
    let sigPlacedUniqueCount = 0;
    let sigCityBuffCount = 0;
    let sigTotalEffects = 0;
    let sigResHHActive = 0;
    let sigResHHSize = 0;
    let sigJobsActive = 0;
    let sigJobsSize = 0;

    const recordPackAndTheme = (item: UnifiedAssetItem): { isBasePack: boolean; rawPack: string } => {
      const rawPack = (item.assetPack || '').trim();
      const dispPack = formatPackDisplayName(rawPack);
      const isBasePack = dispPack === 'Base Game';

      if (isBasePack) {
        const tg = classifyThemeGroup(item.theme);
        if (tg === 'usa' && !foundUsaExact && item.theme) {
          usaThemeExact = item.theme;
          foundUsaExact = true;
        } else if (tg === 'eu' && !foundEuExact && item.theme) {
          euThemeExact = item.theme;
          foundEuExact = true;
        }
      } else {
        packTotals.set(rawPack, (packTotals.get(rawPack) || 0) + 1);
        if (item.assetPackIcon && !packIconMap.has(rawPack)) {
          packIconMap.set(rawPack, item.assetPackIcon);
        }
      }
      return { isBasePack, rawPack };
    };

    const getOrCreateCustom = (label: string): BucketAcc => {
      let b = customBuckets.get(label);
      if (!b) {
        b = emptyBucketAcc();
        customBuckets.set(label, b);
      }
      return b;
    };

    const appendCustomRows = (targetRows: MatrixRowData[]) => {
      const customEntries = Array.from(customBuckets.entries()).sort((a, b) => b[1].placed - a[1].placed);
      for (let idx = 0; idx < customEntries.length; idx++) {
        const [zLabel, bAcc] = customEntries[idx];
        const isSvc = zoneCategory === 'service';
        targetRows.push({
          key: isSvc ? `svc:${zLabel}` : `zone:${zLabel}`,
          label: zLabel,
          subNote: isSvc
            ? includeServiceUpgrades && bAcc.upgrades > 0
              ? `Mod • +${bAcc.upgrades} upg`
              : 'Mod Service'
            : 'Mod Zone',
          color: MODDED_ZONE_PALETTE[idx % MODDED_ZONE_PALETTE.length],
          filterDensity: isSvc ? 'All' : `zone:${zLabel}`,
          filterServiceType: isSvc ? zLabel : undefined,
          serviceIcon: isSvc ? zLabel : undefined,
          ...bAcc,
        });
      }
    };

    const isDistrictScoped = Boolean(districtKey && districtKey !== '' && districtKey !== 'city');
    const isUnassignedScope = districtKey === '__unassigned__';
    const matchesDistScope = (dKey?: string) =>
      !isDistrictScoped || (isUnassignedScope ? !dKey || dKey.trim() === '' : dKey === districtKey);
    const assetList = Array.isArray(assets) ? assets : [];
    const rows: MatrixRowData[] = [];
    const totalSources: BucketAcc[] = [];

    if (zoneCategory === 'housing') {
      const buckets: Record<DetailedDensityBucket, BucketAcc> = {
        low: emptyBucketAcc(),
        row: emptyBucketAcc(),
        medium: emptyBucketAcc(),
        high: emptyBucketAcc(),
        lowRent: emptyBucketAcc(),
        mixed: emptyBucketAcc(),
      };

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isPlaced || item.category !== 'Residential') continue;
        if (!matchesDistScope(item.districtKey)) continue;

        const { isBasePack, rawPack } = recordPackAndTheme(item);
        const dLower = (item.density || '').toLowerCase().trim();
        if (dLower && !STANDARD_RES_DENSITY.has(dLower)) {
          const zLabel = getCustomZoneLabel(item);
          addToAcc(getOrCreateCustom(zLabel), item, isBasePack, rawPack);
        } else {
          const bucketKey = classifyResBucket(item);
          addToAcc(buckets[bucketKey], item, isBasePack, rawPack);
        }
      }

      totalSources.push(
        buckets.low,
        buckets.row,
        buckets.medium,
        buckets.high,
        buckets.lowRent,
        buckets.mixed
      );
      customBuckets.forEach((b) => totalSources.push(b));

      if (matrixMode === 'standard') {
        const medMerged = mergeAccList([buckets.medium, buckets.row]);
        const highMerged = mergeAccList([buckets.high, buckets.lowRent]);

        rows.push({
          key: 'low',
          label: 'Low Density',
          color: '#8bdb46',
          filterDensity: 'Low',
          ...buckets.low,
        });
        rows.push({
          key: 'medium',
          label: 'Medium Density',
          subNote: buckets.row.placed > 0 ? `+${buckets.row.placed} Row` : undefined,
          color: '#50b8e9',
          filterDensity: buckets.row.placed > 0 ? 'MediumAll' : 'Medium',
          ...medMerged,
        });
        rows.push({
          key: 'high',
          label: 'High Density',
          subNote: buckets.lowRent.placed > 0 ? `+${buckets.lowRent.placed} LR` : undefined,
          color: '#f59e0b',
          filterDensity: buckets.lowRent.placed > 0 ? 'HighAll' : 'High',
          ...highMerged,
        });
        rows.push({
          key: 'mixed',
          label: 'Mixed Density',
          color: '#b388ff',
          filterDensity: 'Mixed',
          ...buckets.mixed,
        });
      } else {
        rows.push({
          key: 'low',
          label: 'Low Density',
          color: '#8bdb46',
          filterDensity: 'Low',
          ...buckets.low,
        });
        rows.push({
          key: 'row',
          label: 'Row Housing',
          color: '#22d3ee',
          filterDensity: 'Row',
          ...buckets.row,
        });
        rows.push({
          key: 'medium',
          label: 'Medium Density',
          color: '#50b8e9',
          filterDensity: 'Medium',
          ...buckets.medium,
        });
        rows.push({
          key: 'high',
          label: 'High Density',
          color: '#f59e0b',
          filterDensity: 'High',
          ...buckets.high,
        });
        rows.push({
          key: 'lowRent',
          label: 'Low Rent',
          color: '#fb7185',
          filterDensity: 'Low Rent',
          ...buckets.lowRent,
        });
        rows.push({
          key: 'mixed',
          label: 'Mixed Density',
          color: '#b388ff',
          filterDensity: 'Mixed',
          ...buckets.mixed,
        });
      }

      appendCustomRows(rows);
    } else if (zoneCategory === 'commercial') {
      const lowB = emptyBucketAcc();
      const medB = emptyBucketAcc();
      const highB = emptyBucketAcc();
      const rowMixedB = emptyBucketAcc();
      const otherUnzonedB = emptyBucketAcc();
      const sigB = emptyBucketAcc();
      const mixedGroundB = emptyBucketAcc();

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isPlaced) continue;
        if (!matchesDistScope(item.districtKey)) continue;

        if (item.category === 'Commercial') {
          if (Number.isFinite(item.efficiency) && item.efficiency >= 0) {
            effSum += item.efficiency;
            effCount += 1;
          }
          if (!item.capacity || item.capacity <= 0) vacantLots += 1;
          if (Number.isFinite(item.taxPaid) && (item.taxPaid || 0) > 0) {
            totalTaxPaid += item.taxPaid || 0;
          }

          const { isBasePack, rawPack } = recordPackAndTheme(item);
          if (item.isSignature) {
            addToAcc(sigB, item, isBasePack, rawPack);
            continue;
          }
          const dLower = (item.density || '').toLowerCase().trim();
          const subLower = (item.subCategory || '').toLowerCase();
          if (dLower === 'low') addToAcc(lowB, item, isBasePack, rawPack);
          else if (dLower === 'medium' || dLower === 'mid') addToAcc(medB, item, isBasePack, rawPack);
          else if (dLower === 'high') addToAcc(highB, item, isBasePack, rawPack);
          else if (dLower === 'row' || dLower === 'mixed') addToAcc(rowMixedB, item, isBasePack, rawPack);
          else if (dLower && !STANDARD_COM_DENSITY.has(dLower)) {
            const zLabel = getCustomZoneLabel(item);
            addToAcc(getOrCreateCustom(zLabel), item, isBasePack, rawPack);
          } else if (subLower.includes('high')) addToAcc(highB, item, isBasePack, rawPack);
          else if (subLower.includes('medium')) addToAcc(medB, item, isBasePack, rawPack);
          else if (subLower.includes('low')) addToAcc(lowB, item, isBasePack, rawPack);
          else addToAcc(otherUnzonedB, item, isBasePack, rawPack);
        } else if (
          includeMixedGroundFloor &&
          item.category === 'Residential' &&
          (item.isMixedUse || (item.commercialCapacity || 0) > 0)
        ) {
          const { isBasePack, rawPack } = recordPackAndTheme(item);
          addToAcc(
            mixedGroundB,
            item,
            isBasePack,
            rawPack,
            item.commercialCapacity || 0,
            item.commercialOccupied || 0
          );
        }
      }

      totalSources.push(lowB, medB, highB, rowMixedB, otherUnzonedB, sigB);
      if (includeMixedGroundFloor) totalSources.push(mixedGroundB);
      customBuckets.forEach((b) => totalSources.push(b));

      rows.push({
        key: 'comLow',
        label: 'Low Density',
        color: '#64b5f6',
        filterDensity: 'Low',
        ...lowB,
      });
      if (medB.placed > 0) {
        rows.push({
          key: 'comMed',
          label: 'Medium Density',
          color: '#38bdf8',
          filterDensity: 'Medium',
          ...medB,
        });
      }
      rows.push({
        key: 'comHigh',
        label: 'High Density',
        color: '#3b82f6',
        filterDensity: 'High',
        ...highB,
      });
      if (rowMixedB.placed > 0) {
        rows.push({
          key: 'comRowMixed',
          label: 'Row / Mixed Business',
          color: '#818cf8',
          filterDensity: 'RowOrMixed',
          ...rowMixedB,
        });
      }
      appendCustomRows(rows);
      if (otherUnzonedB.placed > 0) {
        rows.push({
          key: 'comOther',
          label: 'Other Commercial',
          color: '#94a3b8',
          filterDensity: 'All',
          ...otherUnzonedB,
        });
      }
      if (sigB.placed > 0) {
        rows.push({
          key: 'comSig',
          label: 'Signature Venues',
          color: '#fbbf24',
          filterDensity: 'Signature',
          signatureOnly: true,
          ...sigB,
        });
      }
      if (includeMixedGroundFloor && mixedGroundB.placed > 0) {
        rows.push({
          key: 'comMixedGround',
          label: 'Mixed-Use Ground Floor',
          subNote: 'Downstairs Shops',
          color: '#c084fc',
          targetCategory: 'Residential',
          filterDensity: 'Mixed',
          ...mixedGroundB,
        });
      }
    } else if (zoneCategory === 'office') {
      const lowB = emptyBucketAcc();
      const medB = emptyBucketAcc();
      const highB = emptyBucketAcc();
      const mixedB = emptyBucketAcc();
      const otherUnzonedB = emptyBucketAcc();
      const sigB = emptyBucketAcc();

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isPlaced || item.category !== 'Office') continue;
        if (!matchesDistScope(item.districtKey)) continue;

        if (Number.isFinite(item.efficiency) && item.efficiency >= 0) {
          effSum += item.efficiency;
          effCount += 1;
        }
        if (!item.capacity || item.capacity <= 0) vacantLots += 1;
        if (Number.isFinite(item.taxPaid) && (item.taxPaid || 0) > 0) {
          totalTaxPaid += item.taxPaid || 0;
        }

        const { isBasePack, rawPack } = recordPackAndTheme(item);
        if (item.isSignature) {
          addToAcc(sigB, item, isBasePack, rawPack);
          continue;
        }
        const dLower = (item.density || '').toLowerCase().trim();
        const subLower = (item.subCategory || '').toLowerCase();
        if (dLower === 'low') addToAcc(lowB, item, isBasePack, rawPack);
        else if (dLower === 'medium' || dLower === 'mid') addToAcc(medB, item, isBasePack, rawPack);
        else if (dLower === 'high') addToAcc(highB, item, isBasePack, rawPack);
        else if (dLower === 'mixed') addToAcc(mixedB, item, isBasePack, rawPack);
        else if (dLower && !STANDARD_OFF_DENSITY.has(dLower)) {
          const zLabel = getCustomZoneLabel(item);
          addToAcc(getOrCreateCustom(zLabel), item, isBasePack, rawPack);
        } else if (subLower.includes('high')) addToAcc(highB, item, isBasePack, rawPack);
        else if (subLower.includes('medium')) addToAcc(medB, item, isBasePack, rawPack);
        else if (subLower.includes('low')) addToAcc(lowB, item, isBasePack, rawPack);
        else addToAcc(otherUnzonedB, item, isBasePack, rawPack);
      }

      totalSources.push(lowB, medB, highB, mixedB, otherUnzonedB, sigB);
      customBuckets.forEach((b) => totalSources.push(b));

      rows.push({
        key: 'offLow',
        label: 'Low Density',
        color: '#22d3ee',
        filterDensity: 'Low',
        ...lowB,
      });
      if (medB.placed > 0) {
        rows.push({
          key: 'offMed',
          label: 'Medium Density',
          color: '#06b6d4',
          filterDensity: 'Medium',
          ...medB,
        });
      }
      rows.push({
        key: 'offHigh',
        label: 'High Density',
        color: '#0ea5e9',
        filterDensity: 'High',
        ...highB,
      });
      if (mixedB.placed > 0) {
        rows.push({
          key: 'offMixed',
          label: 'Mixed Office',
          color: '#818cf8',
          filterDensity: 'Mixed',
          ...mixedB,
        });
      }
      appendCustomRows(rows);
      if (otherUnzonedB.placed > 0) {
        rows.push({
          key: 'offOther',
          label: 'Other Office',
          color: '#94a3b8',
          filterDensity: 'All',
          ...otherUnzonedB,
        });
      }
      if (sigB.placed > 0) {
        rows.push({
          key: 'offSig',
          label: 'Signature Offices',
          color: '#fbbf24',
          filterDensity: 'Signature',
          signatureOnly: true,
          ...sigB,
        });
      }
    } else if (zoneCategory === 'industrial') {
      // Industrial (+ Specialized Extractors + Warehouses & Storage)
      const mfgB = emptyBucketAcc();
      const specB = emptyBucketAcc();
      const storageB = emptyBucketAcc();
      const sigB = emptyBucketAcc();

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isPlaced) continue;
        const isStor = item.category === 'Storage';
        const isInd = item.category === 'Industrial';
        if (!isInd && !(includeIndustrialSpecials && isStor)) continue;
        if (!matchesDistScope(item.districtKey)) continue;

        const dLower = (item.density || '').toLowerCase().trim();
        const subLower = (item.subCategory || '').toLowerCase();
        const isSpecializedInd = !item.isSignature && !isStor && (dLower === 'specialized' || subLower.includes('specialized'));
        const isStorageDensityInd = !item.isSignature && !isStor && dLower === 'storage';
        if (isSpecializedInd) {
          extractorCount += 1;
        }
        if ((isSpecializedInd || isStorageDensityInd) && !includeIndustrialSpecials) {
          continue;
        }

        if (Number.isFinite(item.efficiency) && item.efficiency >= 0) {
          effSum += item.efficiency;
          effCount += 1;
        }
        if (!isStor && (!item.capacity || item.capacity <= 0)) vacantLots += 1;
        if (Number.isFinite(item.taxPaid) && (item.taxPaid || 0) > 0) {
          totalTaxPaid += item.taxPaid || 0;
        }

        const { isBasePack, rawPack } = recordPackAndTheme(item);
        if (item.isSignature) {
          addToAcc(sigB, item, isBasePack, rawPack);
          continue;
        }
        if (isStor) {
          addToAcc(storageB, item, isBasePack, rawPack);
          continue;
        }
        if (isSpecializedInd) {
          addToAcc(specB, item, isBasePack, rawPack);
        } else if (isStorageDensityInd) {
          addToAcc(storageB, item, isBasePack, rawPack);
        } else if (dLower === 'manufacturing' || dLower === '') {
          addToAcc(mfgB, item, isBasePack, rawPack);
        } else if (!STANDARD_IND_DENSITY.has(dLower)) {
          const zLabel = getCustomZoneLabel(item);
          addToAcc(getOrCreateCustom(zLabel), item, isBasePack, rawPack);
        } else {
          addToAcc(mfgB, item, isBasePack, rawPack);
        }
      }

      totalSources.push(mfgB, sigB);
      if (includeIndustrialSpecials) totalSources.push(specB, storageB);
      customBuckets.forEach((b) => totalSources.push(b));

      rows.push({
        key: 'indMfg',
        label: 'Manufacturing',
        color: '#ffb74d',
        filterDensity: 'Manufacturing',
        ...mfgB,
      });
      if (includeIndustrialSpecials && specB.placed > 0) {
        rows.push({
          key: 'indSpec',
          label: 'Specialized Industry',
          subNote: 'Extractors',
          color: '#fb923c',
          filterDensity: 'Specialized',
          ...specB,
        });
      }
      if (includeIndustrialSpecials && storageB.placed > 0) {
        rows.push({
          key: 'indStorage',
          label: 'Warehouses & Storage',
          subNote:
            storageB.storageCapacity > 0
              ? `${formatTonnesShort(storageB.storageAmount)} / ${formatTonnesShort(storageB.storageCapacity)}`
              : 'Cargo Hubs',
          color: '#f59e0b',
          targetCategory: 'Storage',
          filterDensity: 'All',
          ...storageB,
        });
      }
      appendCustomRows(rows);
      if (sigB.placed > 0) {
        rows.push({
          key: 'indSig',
          label: 'Signature Industry',
          color: '#fbbf24',
          filterDensity: 'Signature',
          signatureOnly: true,
          ...sigB,
        });
      }
    } else if (zoneCategory === 'storage') {
      const whB = emptyBucketAcc();
      const siloB = emptyBucketAcc();
      const sigB = emptyBucketAcc();

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isPlaced || item.category !== 'Storage') continue;
        if (!matchesDistScope(item.districtKey)) continue;

        if (Number.isFinite(item.efficiency) && item.efficiency >= 0) {
          effSum += item.efficiency;
          effCount += 1;
        }
        const jobCap = Number.isFinite(item.capacity) && item.capacity > 0 ? item.capacity : 0;
        const jobOcc = Number.isFinite(item.occupied) && item.occupied > 0 ? item.occupied : 0;
        storageJobsSize += jobCap;
        storageJobsActive += jobOcc;

        const storCapT =
          Number.isFinite(item.storageCapacity) && (item.storageCapacity || 0) > 0
            ? Math.round(item.storageCapacity!)
            : 0;
        const storOccT =
          Number.isFinite(item.storageAmount) && (item.storageAmount || 0) > 0
            ? Math.round(item.storageAmount!)
            : 0;
        if (storOccT <= 0) emptyStorageCount += 1;

        const { isBasePack, rawPack } = recordPackAndTheme(item);
        if (item.isSignature) {
          addToAcc(sigB, item, isBasePack, rawPack, storCapT, storOccT);
          continue;
        }
        const dLower = (item.density || '').toLowerCase().trim();
        const zLower = (item.zoneType || '').toLowerCase().trim();
        if (
          (dLower && !STANDARD_STORAGE_DENSITY.has(dLower)) ||
          (zLower && !STANDARD_STORAGE_ZONES.has(zLower))
        ) {
          const zLabel = getCustomZoneLabel(item);
          addToAcc(getOrCreateCustom(zLabel), item, isBasePack, rawPack, storCapT, storOccT);
        } else if (classifyStorageKind(item) === 'silo_tank') {
          addToAcc(siloB, item, isBasePack, rawPack, storCapT, storOccT);
        } else {
          addToAcc(whB, item, isBasePack, rawPack, storCapT, storOccT);
        }
      }

      totalSources.push(whB, siloB, sigB);
      customBuckets.forEach((b) => totalSources.push(b));

      rows.push({
        key: 'storWh',
        label: STORAGE_HUB_GROUP_WAREHOUSE,
        color: '#ffd54f',
        filterDensity: 'All',
        filterStorageHub: STORAGE_HUB_GROUP_WAREHOUSE,
        ...whB,
      });
      if (siloB.placed > 0) {
        rows.push({
          key: 'storSilo',
          label: STORAGE_HUB_GROUP_SILO_TANK,
          color: '#fb923c',
          filterDensity: 'All',
          filterStorageHub: STORAGE_HUB_GROUP_SILO_TANK,
          ...siloB,
        });
      }
      appendCustomRows(rows);
      if (sigB.placed > 0) {
        rows.push({
          key: 'storSig',
          label: 'Signature Storage',
          color: '#fbbf24',
          filterDensity: 'Signature',
          signatureOnly: true,
          ...sigB,
        });
      }
    } else if (zoneCategory === 'service') {
      const deptBuckets = new Map<string, BucketAcc>();
      SERVICE_DEPT_DEFS.forEach((d) => deptBuckets.set(d.key, emptyBucketAcc()));
      const otherSvcB = emptyBucketAcc();

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isPlaced || item.category !== 'Service') continue;
        if (!matchesDistScope(item.districtKey)) continue;
        if (!includeServiceUpgrades && (item.isSubBuilding || item.subCategory === 'Service Upgrades')) {
          continue;
        }

        if (Number.isFinite(item.efficiency) && item.efficiency >= 0) {
          effSum += item.efficiency;
          effCount += 1;
        }
        if (Number.isFinite(item.maintenanceCost) && (item.maintenanceCost || 0) > 0) {
          totalMaintenanceCost += item.maintenanceCost || 0;
        }
        if (Number.isFinite(item.vehicles) && (item.vehicles || 0) > 0) {
          fleetActive += item.vehicles || 0;
        }
        if (Number.isFinite(item.vehiclesMax) && (item.vehiclesMax || 0) > 0) {
          fleetMax += item.vehiclesMax || 0;
        }
        if (item.needsRepair || item.isDamaged) {
          needsRepairCount += 1;
        }
        if (includeServiceUpgrades && Array.isArray(item.subBuildings) && item.subBuildings.length > 0) {
          totalUpgrades += item.subBuildings.length;
        }

        const { isBasePack, rawPack } = recordPackAndTheme(item);
        const rawSub = (item.subCategory || '').trim();
        const def = rawSub ? SERVICE_DEPT_BY_MATCH.get(rawSub.toLowerCase()) : undefined;
        if (def) {
          addToAcc(deptBuckets.get(def.key)!, item, isBasePack, rawPack);
        } else if (!rawSub || rawSub.toLowerCase() === 'other') {
          addToAcc(otherSvcB, item, isBasePack, rawPack);
        } else {
          addToAcc(getOrCreateCustom(rawSub), item, isBasePack, rawPack);
        }
      }

      deptBuckets.forEach((b) => totalSources.push(b));
      totalSources.push(otherSvcB);
      customBuckets.forEach((b) => totalSources.push(b));

      const anyPlacedInScope = totalSources.some((b) => b.placed > 0);
      for (let idx = 0; idx < SERVICE_DEPT_DEFS.length; idx++) {
        const def = SERVICE_DEPT_DEFS[idx];
        const b = deptBuckets.get(def.key)!;
        const showEmpty = isDistrictScoped ? !anyPlacedInScope && idx < 4 : Boolean(def.alwaysCity);
        if (b.placed > 0 || showEmpty) {
          rows.push({
            key: def.key,
            label: def.label,
            subNote: includeServiceUpgrades && b.upgrades > 0 ? `+${b.upgrades} upg` : undefined,
            color: def.color,
            filterDensity: 'All',
            filterServiceType: def.match,
            serviceIcon: def.match,
            ...b,
          });
        }
      }

      appendCustomRows(rows);

      if (otherSvcB.placed > 0) {
        rows.push({
          key: 'svcOther',
          label: 'Other Services',
          subNote: includeServiceUpgrades && otherSvcB.upgrades > 0 ? `+${otherSvcB.upgrades} upg` : undefined,
          color: '#94a3b8',
          filterDensity: 'All',
          filterServiceType: 'Other',
          serviceIcon: 'Services',
          ...otherSvcB,
        });
      }
    } else if (zoneCategory === 'signature') {
      const resB = emptyBucketAcc();
      const comB = emptyBucketAcc();
      const offB = emptyBucketAcc();
      const indB = emptyBucketAcc();
      const storB = emptyBucketAcc();
      const svcB = emptyBucketAcc();
      const otherB = emptyBucketAcc();
      const catalogSigPrefabs = new Set<string>();
      const placedSigPrefabs = new Set<string>();

      for (let i = 0; i < assetList.length; i++) {
        const item = assetList[i];
        if (!item || !item.isSignature) continue;
        const pk = item.prefabKey || item.prefabName || item.id;
        if (!item.isPlaced) {
          if (pk) catalogSigPrefabs.add(pk);
          continue;
        }
        if (!matchesDistScope(item.districtKey)) continue;
        if (pk) placedSigPrefabs.add(pk);

        if (Number.isFinite(item.efficiency) && item.efficiency >= 0) {
          effSum += item.efficiency;
          effCount += 1;
        }
        const cityEffLen = Array.isArray(item.cityEffects) ? item.cityEffects.length : 0;
        const localEffLen = Array.isArray(item.localEffects) ? item.localEffects.length : 0;
        if (cityEffLen > 0) sigCityBuffCount += 1;
        sigTotalEffects += cityEffLen + localEffLen;

        const cap = Number.isFinite(item.capacity) && item.capacity > 0 ? item.capacity : 0;
        const occ = Number.isFinite(item.occupied) && item.occupied > 0 ? item.occupied : 0;
        const { isBasePack, rawPack } = recordPackAndTheme(item);

        if (item.category === 'Residential') {
          sigResHHActive += occ;
          sigResHHSize += cap;
          addToAcc(resB, item, isBasePack, rawPack);
        } else if (item.category === 'Commercial') {
          sigJobsActive += occ;
          sigJobsSize += cap;
          addToAcc(comB, item, isBasePack, rawPack);
        } else if (item.category === 'Office') {
          sigJobsActive += occ;
          sigJobsSize += cap;
          addToAcc(offB, item, isBasePack, rawPack);
        } else if (item.category === 'Industrial') {
          sigJobsActive += occ;
          sigJobsSize += cap;
          addToAcc(indB, item, isBasePack, rawPack);
        } else if (item.category === 'Storage') {
          sigJobsActive += occ;
          sigJobsSize += cap;
          addToAcc(storB, item, isBasePack, rawPack);
        } else if (item.category === 'Service') {
          sigJobsActive += occ;
          sigJobsSize += cap;
          addToAcc(svcB, item, isBasePack, rawPack);
        } else {
          addToAcc(otherB, item, isBasePack, rawPack);
        }
      }

      sigCatalogUniqueCount = catalogSigPrefabs.size;
      sigPlacedUniqueCount = placedSigPrefabs.size;
      totalSources.push(resB, comB, offB, indB, storB, svcB, otherB);

      rows.push({
        key: 'sigRes',
        label: 'Residential Signatures',
        subNote: resB.placed > 0 ? 'HH' : undefined,
        color: '#69f0ae',
        targetCategory: 'Signature',
        filterDensity: 'All',
        filterSignatureCategory: 'Residential',
        ...resB,
      });
      rows.push({
        key: 'sigCom',
        label: 'Commercial Signatures',
        subNote: comB.placed > 0 ? 'Jobs' : undefined,
        color: '#64b5f6',
        targetCategory: 'Signature',
        filterDensity: 'All',
        filterSignatureCategory: 'Commercial',
        ...comB,
      });
      rows.push({
        key: 'sigOff',
        label: 'Office Signatures',
        subNote: offB.placed > 0 ? 'Jobs' : undefined,
        color: '#4dd0e1',
        targetCategory: 'Signature',
        filterDensity: 'All',
        filterSignatureCategory: 'Office',
        ...offB,
      });
      rows.push({
        key: 'sigInd',
        label: 'Industrial Signatures',
        subNote: indB.placed > 0 ? 'Jobs' : undefined,
        color: '#ffb74d',
        targetCategory: 'Signature',
        filterDensity: 'All',
        filterSignatureCategory: 'Industrial',
        ...indB,
      });
      if (storB.placed > 0) {
        rows.push({
          key: 'sigStor',
          label: 'Storage Signatures',
          color: '#ffd54f',
          targetCategory: 'Signature',
          filterDensity: 'All',
          filterSignatureCategory: 'Storage',
          ...storB,
        });
      }
      if (svcB.placed > 0) {
        rows.push({
          key: 'sigSvc',
          label: 'Service Signatures',
          color: '#ce93d8',
          targetCategory: 'Signature',
          filterDensity: 'All',
          filterSignatureCategory: 'Service',
          ...svcB,
        });
      }
      if (otherB.placed > 0) {
        rows.push({
          key: 'sigOther',
          label: 'Other Landmarks',
          color: '#94a3b8',
          targetCategory: 'Signature',
          filterDensity: 'All',
          filterSignatureCategory: 'All',
          ...otherB,
        });
      }
    }

    const totalAcc = mergeAccList(totalSources);
    const packColumns = sortPackKeys(packTotals);
    const totalRow: MatrixRowData = {
      key: 'total',
      label: 'Total',
      color: '#f8fafc',
      filterDensity: 'All',
      filterSignatureCategory: zoneCategory === 'signature' ? 'All' : undefined,
      ...totalAcc,
    };

    return {
      rows,
      totalRow,
      packColumns,
      packIconMap,
      usaThemeExact,
      euThemeExact,
      showOtherBaseCol: totalAcc.otherBase > 0,
      avgEff: effCount > 0 ? Math.round(effSum / effCount) : -1,
      vacantLots,
      totalTaxPaid,
      extractorCount,
      totalMaintenanceCost,
      fleetActive,
      fleetMax,
      needsRepairCount,
      totalUpgrades,
      storageJobsSize,
      storageJobsActive,
      emptyStorageCount,
      sigCatalogUniqueCount,
      sigPlacedUniqueCount,
      sigCityBuffCount,
      sigTotalEffects,
      sigResHHActive,
      sigResHHSize,
      sigJobsActive,
      sigJobsSize,
      mixedGroundCap: rows.find((r) => r.key === 'comMixedGround')?.size || 0,
      mixedGroundActive: rows.find((r) => r.key === 'comMixedGround')?.active || 0,
      mixedGroundPlaced: rows.find((r) => r.key === 'comMixedGround')?.placed || 0,
      storageAmount: totalAcc.storageAmount,
      storageCapacity: totalAcc.storageCapacity,
    };
  }, [assets, districtKey, zoneCategory, matrixMode, includeMixedGroundFloor, includeIndustrialSpecials, includeServiceUpgrades]);

  const totalOccPct =
    matrixStats.totalRow.size > 0
      ? Math.round((matrixStats.totalRow.active / matrixStats.totalRow.size) * 100)
      : 0;

  const avgHappiness = scopedDistrict && (scopedDistrict.population ?? 0) > 0 ? Math.round(scopedDistrict.avgHappiness || 0) : -1;
  const happyColor =
    avgHappiness >= 70 ? '#8bdb46' : avgHappiness >= 40 ? '#50b8e9' : avgHappiness >= 0 ? '#ef5350' : '#78909c';
  const unempRate = scopedDistrict ? scopedDistrict.unemploymentRate || 0 : 0;
  const unempColor = unempRate > 10 ? '#ef5350' : unempRate > 5 ? '#ffb74d' : '#8bdb46';
  const homelessCount = scopedDistrict ? scopedDistrict.homeless || 0 : 0;
  const hhDenom = Math.max(1, matrixStats.totalRow.active + homelessCount);
  const homelessPct = ((homelessCount / hhDenom) * 100).toFixed(1);

  const effColor =
    matrixStats.avgEff >= 95 ? '#8bdb46' : matrixStats.avgEff >= 75 ? '#50b8e9' : matrixStats.avgEff >= 0 ? '#ef5350' : '#78909c';

  const scopeTargetKey = districtKey && districtKey !== 'city' ? districtKey : '';
  const scopePrefix =
    districtKey === '__unassigned__'
      ? 'Unassigned (No District)'
      : scopedDistrict && districtKey && districtKey !== 'city'
        ? scopedDistrict.name
        : 'City-Wide';
  const defaultTitle =
    zoneCategory === 'service'
      ? `${scopePrefix} Services & Pack Matrix`
      : zoneCategory === 'storage'
        ? `${scopePrefix} Storage & Pack Matrix`
        : zoneCategory === 'signature'
          ? `${scopePrefix} Signature Landmarks & Pack Matrix`
          : scopePrefix === 'City-Wide'
            ? `City-Wide ${catMeta.label} Density & Pack Matrix`
            : `${scopePrefix} ${catMeta.label} & Pack Matrix`;
  const panelHeading = title || defaultTitle;

  const emitFilter = onFilterAsset || onFilterResidential;

  const triggerFilter = (req: ZoneMatrixFilterRequest, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!emitFilter) return;
    emitFilter({
      category: req.category || catMeta.explorerCategory,
      districtKey: scopeTargetKey,
      ...req,
    });
  };

  const renderRail = () => {
    if (zoneCategory === 'housing') {
      return (
        <div className="bam-zm-rail">
          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Happiness</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: happyColor }}>
                {avgHappiness >= 0 ? `${avgHappiness}%` : '—'}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Unemployment</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: unempColor }}>
                {scopedDistrict ? `${unempRate.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Homeless</span>
            <div className="bam-zm-rail-val-row">
              <span
                className="bam-zm-rail-val"
                style={{ color: homelessCount > 100 ? '#ef5350' : '#eceff1' }}
              >
                {formatNumber(homelessCount)}
              </span>
              <span className="bam-zm-rail-sub">{`(${homelessPct}%)`}</span>
            </div>
          </div>

          <div
            className="bam-zm-rail-item"
            title={
              scopedDistrict
                ? `Residential Buildings Sum: ${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}\nEngine District Households: ${formatNumber(scopedDistrict.households || 0)} / ${formatNumber(scopedDistrict.householdCapacity || 0)}`
                : undefined
            }
          >
            <span className="bam-zm-rail-label">Total Households</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#4fc3f7' }}>
                {`${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${totalOccPct}%)`}</span>
            </div>
          </div>
        </div>
      );
    }

    if (zoneCategory === 'commercial') {
      return (
        <div className="bam-zm-rail">
          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Avg Efficiency</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: effColor }}>
                {matrixStats.avgEff >= 0 ? `${matrixStats.avgEff}%` : '—'}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Vacant Venues</span>
            <div className="bam-zm-rail-val-row">
              <span
                className="bam-zm-rail-val"
                style={{ color: matrixStats.vacantLots > 0 ? '#ffb74d' : '#eceff1' }}
              >
                {formatNumber(matrixStats.vacantLots)}
              </span>
              <span className="bam-zm-rail-sub">unleased</span>
            </div>
          </div>

          {includeMixedGroundFloor && matrixStats.mixedGroundPlaced > 0 ? (
            <div className="bam-zm-rail-item" title="Downstairs commercial shops inside Mixed-Use Residential buildings">
              <span className="bam-zm-rail-label">Mixed Shops</span>
              <div className="bam-zm-rail-val-row">
                <span className="bam-zm-rail-val" style={{ color: '#c084fc' }}>
                  {`${formatNumber(matrixStats.mixedGroundActive)} / ${formatNumber(matrixStats.mixedGroundCap)}`}
                </span>
                <span className="bam-zm-rail-sub">{`(${matrixStats.mixedGroundPlaced})`}</span>
              </div>
            </div>
          ) : (
            <div className="bam-zm-rail-item">
              <span className="bam-zm-rail-label">Tax Revenue</span>
              <div className="bam-zm-rail-val-row">
                <span className="bam-zm-rail-val" style={{ color: '#8bdb46' }}>
                  {formatCurrencyCompact(matrixStats.totalTaxPaid)}
                </span>
              </div>
            </div>
          )}

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Total Workplaces</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#64b5f6' }}>
                {`${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${totalOccPct}%)`}</span>
            </div>
          </div>
        </div>
      );
    }

    if (zoneCategory === 'office') {
      return (
        <div className="bam-zm-rail">
          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Avg Efficiency</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: effColor }}>
                {matrixStats.avgEff >= 0 ? `${matrixStats.avgEff}%` : '—'}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Tax Revenue</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#8bdb46' }}>
                {formatCurrencyCompact(matrixStats.totalTaxPaid)}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Vacant Lots</span>
            <div className="bam-zm-rail-val-row">
              <span
                className="bam-zm-rail-val"
                style={{ color: matrixStats.vacantLots > 0 ? '#ffb74d' : '#eceff1' }}
              >
                {formatNumber(matrixStats.vacantLots)}
              </span>
              <span className="bam-zm-rail-sub">unleased</span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Total Workplaces</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#4dd0e1' }}>
                {`${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${totalOccPct}%)`}</span>
            </div>
          </div>
        </div>
      );
    }

    if (zoneCategory === 'service') {
      const fleetVal =
        matrixStats.fleetMax > 0
          ? `${formatNumber(matrixStats.fleetActive)} / ${formatNumber(matrixStats.fleetMax)}`
          : includeServiceUpgrades
            ? formatNumber(matrixStats.totalUpgrades)
            : formatNumber(matrixStats.needsRepairCount);
      const fleetLabel =
        matrixStats.fleetMax > 0
          ? includeServiceUpgrades && matrixStats.totalUpgrades > 0
            ? 'Fleet & Upgr.'
            : 'Service Fleet'
          : includeServiceUpgrades
            ? 'Upgrades'
            : 'Needs Repair';
      const fleetSub =
        matrixStats.fleetMax > 0
          ? includeServiceUpgrades && matrixStats.totalUpgrades > 0
            ? `(+${matrixStats.totalUpgrades} upg)`
            : 'vehicles'
          : includeServiceUpgrades
            ? 'installed'
            : 'damaged';

      return (
        <div className="bam-zm-rail">
          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Avg Efficiency</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: effColor }}>
                {matrixStats.avgEff >= 0 ? `${matrixStats.avgEff}%` : '—'}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Monthly Upkeep</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#f472b6' }}>
                {formatCurrencyCompact(matrixStats.totalMaintenanceCost)}
              </span>
              <span className="bam-zm-rail-sub">/mo</span>
            </div>
          </div>

          <div
            className="bam-zm-rail-item"
            title={
              includeServiceUpgrades
                ? `Active fleet: ${matrixStats.fleetActive}/${matrixStats.fleetMax} • Installed upgrades: ${matrixStats.totalUpgrades} • Damaged: ${matrixStats.needsRepairCount}`
                : `Active fleet: ${matrixStats.fleetActive}/${matrixStats.fleetMax} • Damaged: ${matrixStats.needsRepairCount}`
            }
          >
            <span className="bam-zm-rail-label">{fleetLabel}</span>
            <div className="bam-zm-rail-val-row">
              <span
                className="bam-zm-rail-val"
                style={{
                  color:
                    matrixStats.fleetMax === 0 && !includeServiceUpgrades && matrixStats.needsRepairCount > 0
                      ? '#ef5350'
                      : '#2dd4bf',
                }}
              >
                {fleetVal}
              </span>
              <span className="bam-zm-rail-sub">{fleetSub}</span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Total Staff</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#ce93d8' }}>
                {`${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${totalOccPct}%)`}</span>
            </div>
          </div>
        </div>
      );
    }

    if (zoneCategory === 'storage') {
      const jobsPct =
        matrixStats.storageJobsSize > 0
          ? Math.round((matrixStats.storageJobsActive / matrixStats.storageJobsSize) * 100)
          : 0;
      return (
        <div className="bam-zm-rail">
          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Avg Efficiency</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: effColor }}>
                {matrixStats.avgEff >= 0 ? `${matrixStats.avgEff}%` : '—'}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Cargo Stored</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#ffd54f' }}>
                {formatTonnesShort(matrixStats.totalRow.active)}
              </span>
              <span className="bam-zm-rail-sub">
                {`/ ${formatTonnesShort(matrixStats.totalRow.size)} (${totalOccPct}%)`}
              </span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Empty Hubs</span>
            <div className="bam-zm-rail-val-row">
              <span
                className="bam-zm-rail-val"
                style={{ color: matrixStats.emptyStorageCount > 0 ? '#ffb74d' : '#eceff1' }}
              >
                {formatNumber(matrixStats.emptyStorageCount)}
              </span>
              <span className="bam-zm-rail-sub">idle</span>
            </div>
          </div>

          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Staffed Jobs</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#4dd0e1' }}>
                {`${formatNumber(matrixStats.storageJobsActive)} / ${formatNumber(matrixStats.storageJobsSize)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${jobsPct}%)`}</span>
            </div>
          </div>
        </div>
      );
    }

    if (zoneCategory === 'signature') {
      const unlockedPct =
        matrixStats.sigCatalogUniqueCount > 0
          ? Math.round((matrixStats.sigPlacedUniqueCount / matrixStats.sigCatalogUniqueCount) * 100)
          : 0;
      return (
        <div className="bam-zm-rail">
          <div className="bam-zm-rail-item">
            <span className="bam-zm-rail-label">Avg Efficiency</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: effColor }}>
                {matrixStats.avgEff >= 0 ? `${matrixStats.avgEff}%` : '—'}
              </span>
            </div>
          </div>

          <div
            className="bam-zm-rail-item"
            title={`Unique signature prefabs placed in scope: ${matrixStats.sigPlacedUniqueCount} of ${matrixStats.sigCatalogUniqueCount} loaded signature landmarks`}
          >
            <span className="bam-zm-rail-label">Unique Built</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#ffd54f' }}>
                {`${formatNumber(matrixStats.sigPlacedUniqueCount)} / ${formatNumber(matrixStats.sigCatalogUniqueCount)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${unlockedPct}%)`}</span>
            </div>
          </div>

          <div
            className="bam-zm-rail-item"
            title={`${matrixStats.sigCityBuffCount} placed landmarks grant city-wide buffs (${matrixStats.sigTotalEffects} total city & local modifiers)`}
          >
            <span className="bam-zm-rail-label">City Buffs</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#4ade80' }}>
                {formatNumber(matrixStats.sigCityBuffCount)}
              </span>
              <span className="bam-zm-rail-sub">
                {matrixStats.sigTotalEffects > 0 ? `${matrixStats.sigTotalEffects} perks` : 'landmarks'}
              </span>
            </div>
          </div>

          <div
            className="bam-zm-rail-item"
            title={`Residential HH: ${formatNumber(matrixStats.sigResHHActive)} / ${formatNumber(matrixStats.sigResHHSize)} • Commercial/Office/Industrial Jobs: ${formatNumber(matrixStats.sigJobsActive)} / ${formatNumber(matrixStats.sigJobsSize)}`}
          >
            <span className="bam-zm-rail-label">Total Occupants</span>
            <div className="bam-zm-rail-val-row">
              <span className="bam-zm-rail-val" style={{ color: '#fbbf24' }}>
                {`${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}`}
              </span>
              <span className="bam-zm-rail-sub">{`(${totalOccPct}%)`}</span>
            </div>
          </div>
        </div>
      );
    }

    // Industrial
    return (
      <div className="bam-zm-rail">
        <div className="bam-zm-rail-item">
          <span className="bam-zm-rail-label">Avg Efficiency</span>
          <div className="bam-zm-rail-val-row">
            <span className="bam-zm-rail-val" style={{ color: effColor }}>
              {matrixStats.avgEff >= 0 ? `${matrixStats.avgEff}%` : '—'}
            </span>
          </div>
        </div>

        <div className="bam-zm-rail-item">
          <span className="bam-zm-rail-label">
            {matrixStats.storageCapacity > 0 ? 'Cargo Stored' : 'Tax Revenue'}
          </span>
          <div className="bam-zm-rail-val-row">
            <span className="bam-zm-rail-val" style={{ color: '#ffb74d' }}>
              {matrixStats.storageCapacity > 0
                ? formatTonnesShort(matrixStats.storageAmount)
                : formatCurrencyCompact(matrixStats.totalTaxPaid)}
            </span>
            {matrixStats.storageCapacity > 0 && (
              <span className="bam-zm-rail-sub">{`/ ${formatTonnesShort(matrixStats.storageCapacity)}`}</span>
            )}
          </div>
        </div>

        <div className="bam-zm-rail-item">
          <span className="bam-zm-rail-label">
            {matrixStats.extractorCount > 0 ? 'Extractors' : 'Vacant Lots'}
          </span>
          <div className="bam-zm-rail-val-row">
            <span className="bam-zm-rail-val" style={{ color: '#fb923c' }}>
              {matrixStats.extractorCount > 0
                ? formatNumber(matrixStats.extractorCount)
                : formatNumber(matrixStats.vacantLots)}
            </span>
            <span className="bam-zm-rail-sub">
              {matrixStats.extractorCount > 0 ? 'sites' : 'unleased'}
            </span>
          </div>
        </div>

        <div className="bam-zm-rail-item">
          <span className="bam-zm-rail-label">Total Workplaces</span>
          <div className="bam-zm-rail-val-row">
            <span className="bam-zm-rail-val" style={{ color: '#ffb74d' }}>
              {`${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)}`}
            </span>
            <span className="bam-zm-rail-sub">{`(${totalOccPct}%)`}</span>
          </div>
        </div>
      </div>
    );
  };

  const colHdrs =
    zoneCategory === 'housing'
      ? {
          firstCol: 'Zone Density',
          size: 'Units',
          active: 'Occupied',
          free: 'Vacant',
          placed: 'Bldgs',
          sizeTip: 'Total household unit capacity across placed residential buildings',
          activeTip: 'Occupied residential households (excludes downstairs commercial tenants)',
          freeTip: 'Vacant residential household units',
        }
      : zoneCategory === 'service'
        ? {
            firstCol: 'Service Department',
            size: 'Staff Cap',
            active: 'Staffed',
            free: 'Open',
            placed: 'Bldgs',
            sizeTip: 'Total staff capacity across placed service facilities',
            activeTip: 'Employed staff working in service facilities',
            freeTip: 'Open unfilled service staff positions',
          }
        : zoneCategory === 'storage'
          ? {
              firstCol: 'Storage Facility',
              size: 'Cargo Cap',
              active: 'Stored',
              free: 'Free',
              placed: 'Hubs',
              sizeTip: 'Total cargo storage capacity (in tonnes) across placed storage buildings',
              activeTip: 'Cargo tonnage currently stored in warehouses & silos',
              freeTip: 'Remaining available cargo storage capacity (in tonnes)',
            }
          : zoneCategory === 'signature'
            ? {
                firstCol: 'Signature Sector',
                size: 'Capacity',
                active: 'Occupied',
                free: 'Open',
                placed: 'Bldgs',
                sizeTip: 'Household units (Residential) or worker positions (Commercial/Office/Industrial)',
                activeTip: 'Active households or employed workers in placed Signature Landmarks',
                freeTip: 'Vacant household units or open worker slots',
              }
            : {
                firstCol: zoneCategory === 'industrial' ? 'Zone / Facility' : 'Zone Density',
                size: 'Job Cap',
                active: 'Employed',
                free: 'Open',
                placed: 'Bldgs',
                sizeTip: 'Total workplace job capacity across placed buildings',
                activeTip: 'Employed workers actively working in these buildings',
                freeTip: 'Open unfilled job positions',
              };

  const formatMetricCell = (val: number): string =>
    zoneCategory === 'storage' ? formatTonnesShort(val) : formatNumber(val);

  const headerBadgeText =
    zoneCategory === 'storage'
      ? `${formatNumber(matrixStats.totalRow.placed)} Hubs  •  ${formatTonnesShort(matrixStats.totalRow.active)} / ${formatTonnesShort(matrixStats.totalRow.size)} (${totalOccPct}%)`
      : zoneCategory === 'signature'
        ? `${formatNumber(matrixStats.totalRow.placed)} Landmarks  •  ${matrixStats.sigPlacedUniqueCount}/${matrixStats.sigCatalogUniqueCount} Built`
        : `${formatNumber(matrixStats.totalRow.placed)} Bldgs  •  ${formatNumber(matrixStats.totalRow.active)} / ${formatNumber(matrixStats.totalRow.size)} ${catMeta.capacityUnitLabel} (${totalOccPct}%)`;

  return (
    <div className={`bam-zm-panel${compact ? ' compact' : ''}`}>
      {/* Header Bar */}
      <div className="bam-zm-header">
        <div
          className="bam-zm-header-left"
          onClick={handleHeaderToggle}
          title={collapsible ? (isCollapsed ? `Expand ${catMeta.label} Matrix` : `Collapse ${catMeta.label} Matrix`) : undefined}
        >
          {collapsible && (
            <span className="bam-zm-chevron">
              <UilIcon name={isCollapsed ? 'ChevronRight' : 'ChevronDown'} sizeRem={11} />
            </span>
          )}
          <img
            src={catMeta.iconPath}
            className="bam-zone-cat-icon"
            alt=""
            style={{ width: '14rem', height: '14rem', marginRight: '6rem' }}
          />
          <span className="bam-zm-title" style={{ color: catMeta.accentColor }}>
            {panelHeading}
          </span>
          <span className="bam-zm-summary-badge">{headerBadgeText}</span>
        </div>

        <div className="bam-zm-header-right">
          {availableCategories && availableCategories.length > 1 && onChangeZoneCategory && (
            <div className="bam-zone-cat-switcher" onClick={(e) => e.stopPropagation()}>
              {availableCategories.map((cat) => {
                const cMeta = ZONE_CATEGORY_META[cat];
                const isAct = cat === zoneCategory;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`bam-zone-cat-pill${isAct ? ' active' : ''}`}
                    style={isAct ? { borderColor: cMeta.accentColor, color: cMeta.accentColor } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeZoneCategory(cat);
                    }}
                    title={`Switch matrix to ${cMeta.label}`}
                  >
                    <img src={cMeta.iconPath} className="bam-zone-cat-icon" alt="" />
                    <span>{cMeta.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          {zoneCategory === 'housing' && (
            <div className="bam-zm-mode-toggle" title="Switch between 4 Zone Tiers (Low, Med+Row, High+LowRent, Mixed) and 6 Detailed Sub-Zones">
              <button
                type="button"
                className={`bam-zm-mode-btn${matrixMode === 'standard' ? ' active' : ''}`}
                onClick={(e) => handleToggleMode('standard', e)}
              >
                Standard (4)
              </button>
              <button
                type="button"
                className={`bam-zm-mode-btn${matrixMode === 'detailed' ? ' active' : ''}`}
                onClick={(e) => handleToggleMode('detailed', e)}
              >
                Detailed (6)
              </button>
            </div>
          )}

          {onInspectDistrict && scopeTargetKey !== '' && (
            <button
              type="button"
              className="bam-zm-jump-btn"
              style={{ marginRight: '6rem' }}
              onClick={(e) => {
                e.stopPropagation();
                onInspectDistrict(scopeTargetKey);
              }}
              title="Open this district in Districts Overview"
            >
              <UilIcon name="District" sizeRem={10} style={{ marginRight: '4rem' }} />
              <span>District</span>
            </button>
          )}
          {emitFilter && (
            <button
              type="button"
              className="bam-zm-jump-btn"
              onClick={(e) => triggerFilter({ category: catMeta.explorerCategory, density: 'All', theme: 'All', pack: 'All' }, e)}
              title={`Open ${catMeta.explorerCategory} Explorer filtered to this scope`}
            >
              <UilIcon name="Search" sizeRem={10} style={{ marginRight: '4rem' }} />
              <span>{catMeta.explorerBtnLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (() => {
        const useVerticalCompactScroll = compact && matrixStats.rows.length > 5;
        return (
          <div className="bam-zm-body">
            {renderRail()}

            {/* Right Density x Origin/Pack Matrix Table */}
            <div className="bam-zm-matrix-scroll">
              <Scrollable
                horizontal={true}
                vertical={false}
                trackVisibility="scrollable"
                style={{ width: '100%' }}
              >
              <div
                className="bam-zm-matrix-inner"
                style={{
                  minWidth: `${172 + 72 * 4 + (2 + (matrixStats.showOtherBaseCol ? 1 : 0)) * 48 + matrixStats.packColumns.length * 44 + 24}rem`,
                }}
              >
                {/* Header */}
                <div className="bam-zm-thead">
                  <div
                    className="bam-zmc-col-density bam-zm-sortable-th"
                    onClick={(e) => handleMatrixSort('label', e)}
                    title={`Sort by ${colHdrs.firstCol}`}
                  >
                    <span>{colHdrs.firstCol}</span>
                    {matrixSortField === 'label' && (
                      <span className="bam-zm-sort-arrow">
                        <UilIcon name={matrixSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
                      </span>
                    )}
                  </div>
                  <div
                    className="bam-zmc-col-num bam-zm-sortable-th"
                    onClick={(e) => handleMatrixSort('size', e)}
                    title={colHdrs.sizeTip}
                  >
                    <span>{colHdrs.size}</span>
                    {matrixSortField === 'size' && (
                      <span className="bam-zm-sort-arrow">
                        <UilIcon name={matrixSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
                      </span>
                    )}
                  </div>
                  <div
                    className="bam-zmc-col-num bam-zm-sortable-th"
                    onClick={(e) => handleMatrixSort('active', e)}
                    title={colHdrs.activeTip}
                  >
                    <span>{colHdrs.active}</span>
                    {matrixSortField === 'active' && (
                      <span className="bam-zm-sort-arrow">
                        <UilIcon name={matrixSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
                      </span>
                    )}
                  </div>
                  <div
                    className="bam-zmc-col-num bam-zm-sortable-th"
                    onClick={(e) => handleMatrixSort('free', e)}
                    title={colHdrs.freeTip}
                  >
                    <span>{colHdrs.free}</span>
                    {matrixSortField === 'free' && (
                      <span className="bam-zm-sort-arrow">
                        <UilIcon name={matrixSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
                      </span>
                    )}
                  </div>
                  <div
                    className="bam-zmc-col-num bam-zm-sortable-th"
                    onClick={(e) => handleMatrixSort('placed', e)}
                    title={`Total placed ${catMeta.itemNoun}`}
                  >
                    <span>{colHdrs.placed}</span>
                    {matrixSortField === 'placed' && (
                      <span className="bam-zm-sort-arrow">
                        <UilIcon name={matrixSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
                      </span>
                    )}
                  </div>
                  <div
                    className={`bam-zmc-col-theme bam-zmc-pack-hdr${activeTheme === matrixStats.usaThemeExact ? ' active' : ''}`}
                    onClick={(e) =>
                      triggerFilter(
                        {
                          category: catMeta.explorerCategory,
                          density: 'All',
                          theme: matrixStats.usaThemeExact,
                          pack: 'Base Game',
                        },
                        e
                      )
                    }
                    title={`Base Game — North American (USA) ${catMeta.itemNoun} (click to filter)`}
                  >
                    <ThemeIcon theme={matrixStats.usaThemeExact} sizeRem={18} />
                    <span className="bam-zmc-pack-abbrev">USA</span>
                  </div>
                  <div
                    className={`bam-zmc-col-theme bam-zmc-pack-hdr${activeTheme === matrixStats.euThemeExact ? ' active' : ''}`}
                    onClick={(e) =>
                      triggerFilter(
                        {
                          category: catMeta.explorerCategory,
                          density: 'All',
                          theme: matrixStats.euThemeExact,
                          pack: 'Base Game',
                        },
                        e
                      )
                    }
                    title={`Base Game — European (EU) ${catMeta.itemNoun} (click to filter)`}
                  >
                    <ThemeIcon theme={matrixStats.euThemeExact} sizeRem={18} />
                    <span className="bam-zmc-pack-abbrev">EU</span>
                  </div>
                  {matrixStats.showOtherBaseCol && (
                    <div
                      className={`bam-zmc-col-theme bam-zmc-pack-hdr${activePack === 'Base Game' && (!activeTheme || activeTheme === 'All') ? ' active' : ''}`}
                      onClick={(e) =>
                        triggerFilter(
                          {
                            category: catMeta.explorerCategory,
                            density: 'All',
                            theme: 'All',
                            pack: 'Base Game',
                          },
                          e
                        )
                      }
                      title="Base Game buildings without NA/EU theme tag"
                    >
                      <PackIcon pack="Base Game" sizeRem={18} />
                      <span className="bam-zmc-pack-abbrev">Base</span>
                    </div>
                  )}
                  {matrixStats.packColumns.map((pack) => {
                    const isPackActive = activePack && activePack === pack;
                    return (
                      <div
                        key={pack}
                        className={`bam-zmc-col-pack bam-zmc-pack-hdr${isPackActive ? ' active' : ''}`}
                        title={`${pack} (click to filter ${catMeta.itemNoun})`}
                        onClick={(e) =>
                          triggerFilter(
                            {
                              category: catMeta.explorerCategory,
                              density: 'All',
                              theme: 'All',
                              pack,
                            },
                            e
                          )
                        }
                      >
                        <PackIcon
                          pack={pack}
                          packIcon={matrixStats.packIconMap.get(pack)}
                          sizeRem={18}
                        />
                        <span className="bam-zmc-pack-abbrev">{getShortPackAbbrev(pack)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Data Rows + Total Footer */}
                {(() => {
                  const sortedMatrixRows = matrixSortField
                    ? matrixStats.rows.slice().sort((a, b) => {
                        const mult = matrixSortDir === 'asc' ? 1 : -1;
                        if (matrixSortField === 'label') {
                          return mult * (a.label || '').localeCompare(b.label || '');
                        }
                        const vA =
                          matrixSortField === 'size'
                            ? a.size
                            : matrixSortField === 'active'
                              ? a.active
                              : matrixSortField === 'free'
                                ? a.free
                                : a.placed;
                        const vB =
                          matrixSortField === 'size'
                            ? b.size
                            : matrixSortField === 'active'
                              ? b.active
                              : matrixSortField === 'free'
                                ? b.free
                                : b.placed;
                        return vA !== vB ? mult * (vA - vB) : (a.label || '').localeCompare(b.label || '');
                      })
                    : matrixStats.rows;
                  const rowsNode = [...sortedMatrixRows, matrixStats.totalRow].map((row) => {
                  const isTotal = row.key === 'total';
                  const rowCat = row.targetCategory || catMeta.explorerCategory;
                  const isRowActive =
                    !isTotal &&
                    (zoneCategory === 'signature'
                      ? Boolean(
                          row.filterSignatureCategory &&
                            activeSignatureCategory &&
                            activeSignatureCategory !== 'All' &&
                            activeSignatureCategory === row.filterSignatureCategory
                        )
                      : !row.targetCategory &&
                        (zoneCategory === 'service'
                          ? Boolean(
                              row.filterServiceType &&
                                activeServiceType &&
                                activeServiceType !== 'All' &&
                                activeServiceType === row.filterServiceType
                            )
                          : zoneCategory === 'storage' && row.filterStorageHub
                            ? Boolean(activeStorageHub && activeStorageHub === row.filterStorageHub)
                            : Boolean(
                                activeDensity &&
                                  activeDensity !== 'All' &&
                                  activeDensity.toLowerCase() === row.filterDensity.toLowerCase()
                              )));
                  return (
                    <div
                      key={row.key}
                      className={`bam-zm-trow${isTotal ? ' total-row' : ''}${isRowActive ? ' active-row' : ''}`}
                      onClick={() =>
                        triggerFilter({
                          category: rowCat,
                          density: row.filterDensity,
                          serviceType: row.filterServiceType,
                          storageHub: row.filterStorageHub,
                          signatureCategory: row.filterSignatureCategory,
                          signatureOnly: row.signatureOnly,
                          theme: 'All',
                          pack: 'All',
                        })
                      }
                      title={`Click to view ${row.label} in ${rowCat} Explorer`}
                    >
                      <div className="bam-zmc-col-density" style={{ color: row.color }}>
                        {row.serviceIcon ? (
                          <ServiceIcon
                            service={row.serviceIcon}
                            sizeRem={12}
                            style={{ marginRight: '5rem', flexShrink: 0 }}
                          />
                        ) : (
                          <span
                            className="bam-zmc-density-dot"
                            style={{ background: row.color }}
                          />
                        )}
                        <span className="bam-zmc-density-label">{row.label}</span>
                        {row.subNote && (
                          <span className="bam-zmc-density-sub">{`(${row.subNote})`}</span>
                        )}
                      </div>
                      <div className="bam-zmc-col-num">{formatMetricCell(row.size)}</div>
                      <div className="bam-zmc-col-num bam-zmc-val-active">
                        {formatMetricCell(row.active)}
                      </div>
                      <div
                        className={`bam-zmc-col-num ${row.free > 0 ? 'bam-zmc-val-free' : 'bam-zmc-val-muted'}`}
                      >
                        {formatMetricCell(row.free)}
                      </div>
                      <div className="bam-zmc-col-num">{formatNumber(row.placed)}</div>
                      <div
                        className={`bam-zmc-col-theme bam-zmc-cell-clickable${row.usa === 0 ? ' bam-zmc-val-muted' : ''}`}
                        onClick={(e) =>
                          triggerFilter(
                            {
                              category: rowCat,
                              density: row.filterDensity,
                              serviceType: row.filterServiceType,
                              storageHub: row.filterStorageHub,
                              signatureCategory: row.filterSignatureCategory,
                              signatureOnly: row.signatureOnly,
                              theme: matrixStats.usaThemeExact,
                              pack: 'Base Game',
                            },
                            e
                          )
                        }
                        title={`Filter ${row.label} • Base Game USA`}
                      >
                        {formatNumber(row.usa)}
                      </div>
                      <div
                        className={`bam-zmc-col-theme bam-zmc-cell-clickable${row.eu === 0 ? ' bam-zmc-val-muted' : ''}`}
                        onClick={(e) =>
                          triggerFilter(
                            {
                              category: rowCat,
                              density: row.filterDensity,
                              serviceType: row.filterServiceType,
                              storageHub: row.filterStorageHub,
                              signatureCategory: row.filterSignatureCategory,
                              signatureOnly: row.signatureOnly,
                              theme: matrixStats.euThemeExact,
                              pack: 'Base Game',
                            },
                            e
                          )
                        }
                        title={`Filter ${row.label} • Base Game EU`}
                      >
                        {formatNumber(row.eu)}
                      </div>
                      {matrixStats.showOtherBaseCol && (
                        <div
                          className={`bam-zmc-col-theme bam-zmc-cell-clickable${row.otherBase === 0 ? ' bam-zmc-val-muted' : ''}`}
                          onClick={(e) =>
                            triggerFilter(
                              {
                                category: rowCat,
                                density: row.filterDensity,
                                serviceType: row.filterServiceType,
                                storageHub: row.filterStorageHub,
                                signatureCategory: row.filterSignatureCategory,
                                signatureOnly: row.signatureOnly,
                                theme: 'All',
                                pack: 'Base Game',
                              },
                              e
                            )
                          }
                          title={`Filter ${row.label} • Base Game`}
                        >
                          {formatNumber(row.otherBase)}
                        </div>
                      )}
                      {matrixStats.packColumns.map((pack) => {
                        const cnt = row.packs.get(pack) || 0;
                        return (
                          <div
                            key={pack}
                            className={`bam-zmc-col-pack bam-zmc-cell-clickable${cnt === 0 ? ' bam-zmc-val-muted' : ''}`}
                            onClick={(e) =>
                              triggerFilter(
                                {
                                  category: rowCat,
                                  density: row.filterDensity,
                                  serviceType: row.filterServiceType,
                                  storageHub: row.filterStorageHub,
                                  signatureCategory: row.filterSignatureCategory,
                                  signatureOnly: row.signatureOnly,
                                  theme: 'All',
                                  pack,
                                },
                                e
                              )
                            }
                            title={`Filter ${row.label} • ${pack}`}
                          >
                            {formatNumber(cnt)}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
                  return useVerticalCompactScroll ? (
                    <Scrollable vertical={true} horizontal={false} trackVisibility="scrollable" style={{ maxHeight: '116rem', width: '100%' }}>
                      {rowsNode}
                    </Scrollable>
                  ) : (
                    rowsNode
                  );
                })()}
              </div>
            </Scrollable>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export interface ZoneMatrixDashboardPageProps {
  assets: UnifiedAssetItem[];
  districts: DistrictItem[];
  initialCategory?: ZoneMatrixCategory;
  lockedCategory?: boolean;
  enabledCategories?: ZoneMatrixCategory[];
  includeMixedGroundFloor?: boolean;
  includeIndustrialSpecials?: boolean;
  includeServiceUpgrades?: boolean;
  onFilterResidential?: (req: ZoneMatrixFilterRequest) => void;
  onFilterAsset?: (req: ZoneMatrixFilterRequest) => void;
  onInspectDistrict?: (districtKey: string) => void;
}

interface DistrictCatRow {
  district: DistrictItem;
  placed: number;
  size: number;
  active: number;
  free: number;
  effSum: number;
  effCount: number;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
}

export const ZoneMatrixDashboardPage: React.FC<ZoneMatrixDashboardPageProps> = ({
  assets,
  districts,
  initialCategory,
  lockedCategory = false,
  enabledCategories,
  includeMixedGroundFloor: propIncludeMixed,
  includeIndustrialSpecials: propIncludeIndSpecials,
  includeServiceUpgrades: propIncludeServiceUpgrades,
  onFilterResidential,
  onFilterAsset,
  onInspectDistrict,
}) => {
  const effectiveCategories = useMemo<ZoneMatrixCategory[]>(() => {
    if (enabledCategories && enabledCategories.length > 0) return enabledCategories;
    return ALL_ZONE_MATRIX_CATEGORIES;
  }, [enabledCategories]);

  const [activeCategory, setActiveCategory] = useState<ZoneMatrixCategory>(() =>
    initialCategory && effectiveCategories.includes(initialCategory)
      ? initialCategory
      : readActiveZoneMatrixCategory(effectiveCategories)
  );
  const [selectedScopeKey, setSelectedScopeKey] = useState<string>('');
  const [dashSettings, setDashSettings] = useState(() => readZoneMatrixSettings());

  const includeMixed =
    propIncludeMixed !== undefined ? propIncludeMixed : dashSettings.includeMixedGroundFloor;
  const includeIndSpecials =
    propIncludeIndSpecials !== undefined ? propIncludeIndSpecials : dashSettings.includeIndustrialSpecials;
  const includeSvcUpgrades =
    propIncludeServiceUpgrades !== undefined ? propIncludeServiceUpgrades : dashSettings.includeServiceUpgrades;

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (!lockedCategory && !effectiveCategories.includes(activeCategory)) {
      setActiveCategory(effectiveCategories[0] || 'housing');
    }
  }, [effectiveCategories, activeCategory, lockedCategory]);

  useEffect(() => {
    const refresh = () => setDashSettings(readZoneMatrixSettings());
    window.addEventListener('bam-settings-changed', refresh);
    window.addEventListener('bam-settings-reset', refresh);
    return () => {
      window.removeEventListener('bam-settings-changed', refresh);
      window.removeEventListener('bam-settings-reset', refresh);
    };
  }, []);

  const currentCategory: ZoneMatrixCategory = lockedCategory && initialCategory ? initialCategory : activeCategory;
  const catMeta = ZONE_CATEGORY_META[currentCategory] || ZONE_CATEGORY_META.housing;
  const emitFilter = onFilterAsset || onFilterResidential;

  type DistSortField = 'name' | 'active' | 'free' | 'm3' | 'c1' | 'c2' | 'c3' | 'c4';
  const [distSortField, setDistSortField] = useState<DistSortField | null>(null);
  const [distSortDir, setDistSortDir] = useState<'asc' | 'desc'>('desc');

  const handleDistSort = (field: DistSortField) => {
    if (distSortField === field) {
      setDistSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDistSortField(field);
      setDistSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const categoryTotals = useMemo(() => {
    const counts: Record<ZoneMatrixCategory, number> = {
      housing: 0,
      commercial: 0,
      office: 0,
      industrial: 0,
      storage: 0,
      service: 0,
      signature: 0,
    };
    const assetList = Array.isArray(assets) ? assets : [];
    for (let i = 0; i < assetList.length; i++) {
      const a = assetList[i];
      if (!a || !a.isPlaced) continue;
      if (a.isSignature) counts.signature += 1;
      if (a.category === 'Residential') {
        counts.housing += 1;
        if (includeMixed && (a.isMixedUse || (a.commercialCapacity || 0) > 0)) {
          counts.commercial += 1;
        }
      } else if (a.category === 'Commercial') {
        counts.commercial += 1;
      } else if (a.category === 'Office') {
        counts.office += 1;
      } else if (a.category === 'Industrial') {
        counts.industrial += 1;
      } else if (a.category === 'Storage') {
        counts.storage += 1;
        if (includeIndSpecials) counts.industrial += 1;
      } else if (a.category === 'Service') {
        if (includeSvcUpgrades || (!a.isSubBuilding && a.subCategory !== 'Service Upgrades')) {
          counts.service += 1;
        }
      }
    }
    return counts;
  }, [assets, includeMixed, includeIndSpecials, includeSvcUpgrades]);

  const { districtRows, cityWideRow, unassignedRow } = useMemo<{
    districtRows: DistrictCatRow[];
    cityWideRow: DistrictCatRow;
    unassignedRow: DistrictCatRow | null;
  }>(() => {
    const emptyAcc = (): Omit<DistrictCatRow, 'district'> => ({
      placed: 0,
      size: 0,
      active: 0,
      free: 0,
      effSum: 0,
      effCount: 0,
      c1: 0,
      c2: 0,
      c3: 0,
      c4: 0,
    });

    const realDistricts = (Array.isArray(districts) ? districts : []).filter(
      (d) => d && d.entityKey !== 'city' && !d.isCity
    );
    const cityDistrictMeta = (Array.isArray(districts) ? districts : []).find(
      (d) => d && (d.entityKey === 'city' || d.isCity)
    );

    const distCounts = new Map<string, Omit<DistrictCatRow, 'district'>>();
    const cityAcc = emptyAcc();
    const unassignedAcc = emptyAcc();
    const assetList = Array.isArray(assets) ? assets : [];

    const addBucketCounts = (acc: Omit<DistrictCatRow, 'district'>, a: UnifiedAssetItem, useOcc: number) => {
      if (currentCategory === 'housing') {
        const bucket = classifyResBucket(a);
        if (bucket === 'low') acc.c1 += 1;
        else if (bucket === 'medium' || bucket === 'row') acc.c2 += 1;
        else if (bucket === 'high' || bucket === 'lowRent') acc.c3 += 1;
        else acc.c4 += 1;
      } else if (currentCategory === 'commercial') {
        if (a.category === 'Residential') acc.c3 += 1;
        else {
          const dl = (a.density || '').toLowerCase();
          if (dl === 'low') acc.c1 += 1;
          else if (dl === 'high') acc.c2 += 1;
          else acc.c4 += 1;
        }
      } else if (currentCategory === 'office') {
        const dl = (a.density || '').toLowerCase();
        if (a.isSignature) acc.c4 += 1;
        else if (dl === 'low') acc.c1 += 1;
        else if (dl === 'high') acc.c2 += 1;
        else acc.c3 += 1;
      } else if (currentCategory === 'service') {
        const sub = (a.subCategory || '').trim();
        if (
          sub === 'Health & Deathcare' ||
          sub === 'Fire & Rescue' ||
          sub === 'Police & Administration'
        ) {
          acc.c1 += 1;
        } else if (
          sub === 'Education & Research' ||
          sub === 'Parks & Recreation' ||
          sub === 'Civic & Misc'
        ) {
          acc.c2 += 1;
        } else if (
          sub === 'Electricity' ||
          sub === 'Water & Sewage' ||
          sub === 'Garbage Management'
        ) {
          acc.c3 += 1;
        } else {
          acc.c4 += 1;
        }
      } else if (currentCategory === 'storage') {
        const dLower = (a.density || '').toLowerCase().trim();
        const zLower = (a.zoneType || '').toLowerCase().trim();
        const isCustomStorage =
          (dLower && !STANDARD_STORAGE_DENSITY.has(dLower)) ||
          (zLower && !STANDARD_STORAGE_ZONES.has(zLower));
        if (a.isSignature || isCustomStorage) {
          acc.c4 += 1;
        } else if (classifyStorageKind(a) === 'silo_tank') {
          acc.c2 += 1;
        } else {
          acc.c1 += 1;
        }
        if (useOcc <= 0) {
          acc.c3 += 1;
        }
      } else if (currentCategory === 'signature') {
        if (a.category === 'Residential') acc.c1 += 1;
        else if (a.category === 'Commercial') acc.c2 += 1;
        else if (a.category === 'Office') acc.c3 += 1;
        else acc.c4 += 1;
      } else {
        const dl = (a.density || '').toLowerCase();
        const sl = (a.subCategory || '').toLowerCase();
        if (a.category === 'Storage' || dl === 'storage') acc.c3 += 1;
        else if (dl === 'specialized' || sl.includes('specialized')) acc.c2 += 1;
        else if (dl === 'manufacturing' || dl === '') acc.c1 += 1;
        else acc.c4 += 1;
      }
    };

    const accumulateInto = (acc: Omit<DistrictCatRow, 'district'>, a: UnifiedAssetItem, useCap: number, useOcc: number) => {
      acc.placed += 1;
      acc.size += useCap;
      acc.active += useOcc;
      acc.free += Math.max(0, useCap - useOcc);
      if (Number.isFinite(a.efficiency) && a.efficiency >= 0) {
        acc.effSum += a.efficiency;
        acc.effCount += 1;
      }
      addBucketCounts(acc, a, useOcc);
    };

    for (let i = 0; i < assetList.length; i++) {
      const a = assetList[i];
      if (!a || !a.isPlaced) continue;

      let includeItem = false;
      let useCap = Number.isFinite(a.capacity) && a.capacity > 0 ? a.capacity : 0;
      let useOcc = Number.isFinite(a.occupied) && a.occupied > 0 ? a.occupied : 0;

      if (currentCategory === 'housing') {
        includeItem = a.category === 'Residential';
      } else if (currentCategory === 'commercial') {
        if (a.category === 'Commercial') {
          includeItem = true;
        } else if (includeMixed && a.category === 'Residential' && (a.isMixedUse || (a.commercialCapacity || 0) > 0)) {
          includeItem = true;
          useCap = Number.isFinite(a.commercialCapacity) && (a.commercialCapacity || 0) > 0 ? a.commercialCapacity || 0 : 0;
          useOcc = Number.isFinite(a.commercialOccupied) && (a.commercialOccupied || 0) > 0 ? a.commercialOccupied || 0 : 0;
        }
      } else if (currentCategory === 'office') {
        includeItem = a.category === 'Office';
      } else if (currentCategory === 'storage') {
        includeItem = a.category === 'Storage';
        useCap = Number.isFinite(a.storageCapacity) && (a.storageCapacity || 0) > 0 ? Math.round(a.storageCapacity!) : 0;
        useOcc = Number.isFinite(a.storageAmount) && (a.storageAmount || 0) > 0 ? Math.round(a.storageAmount!) : 0;
      } else if (currentCategory === 'service') {
        includeItem =
          a.category === 'Service' &&
          (includeSvcUpgrades || (!a.isSubBuilding && a.subCategory !== 'Service Upgrades'));
      } else if (currentCategory === 'signature') {
        includeItem = Boolean(a.isSignature);
      } else {
        includeItem = a.category === 'Industrial' || (includeIndSpecials && a.category === 'Storage');
      }

      if (!includeItem) continue;

      accumulateInto(cityAcc, a, useCap, useOcc);

      const dKey = a.districtKey || '';
      if (!dKey) {
        accumulateInto(unassignedAcc, a, useCap, useOcc);
      } else {
        let acc = distCounts.get(dKey);
        if (!acc) {
          acc = emptyAcc();
          distCounts.set(dKey, acc);
        }
        accumulateInto(acc, a, useCap, useOcc);
      }
    }

    const sortedDistrictRows = realDistricts
      .map((d) => ({
        district: d,
        ...(distCounts.get(d.entityKey) || emptyAcc()),
      }))
      .sort((a, b) => {
        if (!distSortField) {
          return b.placed - a.placed || b.active - a.active;
        }
        const mult = distSortDir === 'asc' ? 1 : -1;
        if (distSortField === 'name') {
          return mult * (a.district.name || '').localeCompare(b.district.name || '');
        }
        const getMetric3 = (e: DistrictCatRow) =>
          currentCategory === 'housing'
            ? (e.district.population > 0 ? e.district.avgHappiness || 0 : -1)
            : (e.effCount > 0 ? e.effSum / e.effCount : -1);
        const vA =
          distSortField === 'active'
            ? a.active
            : distSortField === 'free'
              ? a.free
              : distSortField === 'm3'
                ? getMetric3(a)
                : distSortField === 'c1'
                  ? a.c1
                  : distSortField === 'c2'
                    ? a.c2
                    : distSortField === 'c3'
                      ? a.c3
                      : a.c4;
        const vB =
          distSortField === 'active'
            ? b.active
            : distSortField === 'free'
              ? b.free
              : distSortField === 'm3'
                ? getMetric3(b)
                : distSortField === 'c1'
                  ? b.c1
                  : distSortField === 'c2'
                    ? b.c2
                    : distSortField === 'c3'
                      ? b.c3
                      : b.c4;
        if (vA !== vB) return mult * (vA - vB);
        return (a.district.name || '').localeCompare(b.district.name || '');
      });

    const citySynthetic: DistrictItem = cityDistrictMeta
      ? { ...cityDistrictMeta, entityKey: '', name: 'City-Wide (All City)', isCity: true }
      : ({
          entityKey: '',
          name: 'City-Wide (All City)',
          isCity: true,
          population: 0,
          avgHappiness: 0,
          policies: [],
        } as unknown as DistrictItem);

    const unassignedSynthetic: DistrictItem = {
      entityKey: '__unassigned__',
      name: 'No District (Unassigned)',
      isCity: false,
      population: 0,
      avgHappiness: 0,
      policies: [],
    } as unknown as DistrictItem;

    return {
      districtRows: sortedDistrictRows,
      cityWideRow: { district: citySynthetic, ...cityAcc },
      unassignedRow: unassignedAcc.placed > 0 ? { district: unassignedSynthetic, ...unassignedAcc } : null,
    };
  }, [assets, districts, currentCategory, includeMixed, includeIndSpecials, includeSvcUpgrades, distSortField, distSortDir]);

  const colLabels = useMemo(() => {
    if (currentCategory === 'housing') {
      return {
        capCol: 'Households',
        m3: 'Happy',
        c1: { name: 'Low', color: '#8bdb46' },
        c2: { name: 'Med', color: '#50b8e9' },
        c3: { name: 'High', color: '#f59e0b' },
        c4: { name: 'Mixed', color: '#b388ff' },
        btn: 'Homes',
      };
    }
    if (currentCategory === 'commercial') {
      return {
        capCol: 'Workplaces',
        m3: 'Avg Eff',
        c1: { name: 'Low', color: '#64b5f6' },
        c2: { name: 'High', color: '#3b82f6' },
        c3: { name: 'Mixed', color: '#c084fc' },
        c4: { name: 'Other', color: '#2dd4bf' },
        btn: 'Stores',
      };
    }
    if (currentCategory === 'office') {
      return {
        capCol: 'Workplaces',
        m3: 'Avg Eff',
        c1: { name: 'Low', color: '#22d3ee' },
        c2: { name: 'High', color: '#0ea5e9' },
        c3: { name: 'Mod/Mix', color: '#2dd4bf' },
        c4: { name: 'Sig', color: '#fbbf24' },
        btn: 'Offices',
      };
    }
    if (currentCategory === 'storage') {
      return {
        capCol: 'Cargo',
        m3: 'Avg Eff',
        c1: { name: 'Wareh.', color: '#ffd54f' },
        c2: { name: 'Silos', color: '#fb923c' },
        c3: { name: 'Idle', color: '#94a3b8' },
        c4: { name: 'Mod/Sig', color: '#2dd4bf' },
        btn: 'Storage',
      };
    }
    if (currentCategory === 'service') {
      return {
        capCol: 'Staff',
        m3: 'Avg Eff',
        c1: { name: 'Civic', color: '#60a5fa' },
        c2: { name: 'Edu/Rec', color: '#34d399' },
        c3: { name: 'Utilities', color: '#facc15' },
        c4: { name: 'Transit+', color: '#2dd4bf' },
        btn: 'Services',
      };
    }
    if (currentCategory === 'signature') {
      return {
        capCol: 'HH & Staff',
        m3: 'Avg Eff',
        c1: { name: 'Res', color: '#69f0ae' },
        c2: { name: 'Com', color: '#64b5f6' },
        c3: { name: 'Off', color: '#4dd0e1' },
        c4: { name: 'Ind+', color: '#ffb74d' },
        btn: 'Signatures',
      };
    }
    return {
      capCol: 'Workplaces',
      m3: 'Avg Eff',
      c1: { name: 'Mfg', color: '#ffb74d' },
      c2: { name: 'Spec', color: '#fb923c' },
      c3: { name: 'Storage', color: '#f59e0b' },
      c4: { name: 'Mod/Sig', color: '#2dd4bf' },
      btn: 'Industry',
    };
  }, [currentCategory]);

  const handleSelectCategory = (cat: ZoneMatrixCategory) => {
    setActiveCategory(cat);
    if (!lockedCategory) {
      writeActiveZoneMatrixCategory(cat);
    }
  };

  return (
    <div className="bam-zm-page">
      {/* Category Switcher Bar (hidden when tab locks to single matrix category) */}
      {!lockedCategory && effectiveCategories.length > 1 && (
        <div className="bam-zone-dash-catbar">
          <span className="bam-zm-scope-label">Matrix:</span>
          {effectiveCategories.map((cat) => {
            const m = ZONE_CATEGORY_META[cat];
            const isAct = currentCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                className={`bam-zone-dash-catbtn${isAct ? ' active' : ''}`}
                style={isAct ? { borderColor: m.accentColor, color: m.accentColor } : undefined}
                onClick={() => handleSelectCategory(cat)}
              >
                <img src={m.iconPath} className="bam-zone-cat-icon" alt="" />
                <span>{m.label}</span>
                <span className="bam-zone-dash-count">{formatNumber(categoryTotals[cat])}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scope Switcher Pills: All City + Districts */}
      <div className="bam-zm-scope-bar">
        <span className="bam-zm-scope-label">Scope:</span>
        <button
          type="button"
          className={`bam-zm-scope-pill${selectedScopeKey === '' ? ' active' : ''}`}
          onClick={() => setSelectedScopeKey('')}
        >
          <span>All City</span>
          <span className="bam-zm-scope-count">
            {formatNumber(cityWideRow.placed)}
          </span>
        </button>
        {unassignedRow && (
          <button
            type="button"
            className={`bam-zm-scope-pill${selectedScopeKey === '__unassigned__' ? ' active' : ''}`}
            onClick={() =>
              setSelectedScopeKey((prev) =>
                prev === '__unassigned__' ? '' : '__unassigned__'
              )
            }
          >
            <span>No District</span>
            <span className="bam-zm-scope-count">{formatNumber(unassignedRow.placed)}</span>
          </button>
        )}
        {districtRows.map((entry) => (
          <button
            key={entry.district.entityKey}
            type="button"
            className={`bam-zm-scope-pill${selectedScopeKey === entry.district.entityKey ? ' active' : ''}`}
            onClick={() =>
              setSelectedScopeKey((prev) =>
                prev === entry.district.entityKey ? '' : entry.district.entityKey
              )
            }
          >
            <span>{entry.district.name}</span>
            <span className="bam-zm-scope-count">{formatNumber(entry.placed)}</span>
          </button>
        ))}
      </div>

      {/* Main Zone Matrix */}
      <ZoneMatrixPanel
        assets={assets}
        districts={districts}
        districtKey={selectedScopeKey || undefined}
        zoneCategory={currentCategory}
        includeMixedGroundFloor={includeMixed}
        includeIndustrialSpecials={includeIndSpecials}
        includeServiceUpgrades={includeSvcUpgrades}
        collapsible={false}
        onFilterAsset={emitFilter}
        onInspectDistrict={onInspectDistrict}
      />

      {/* Per-District Distribution Comparison */}
      <div className="bam-zm-dist-section">
        <div className="bam-zm-dist-title-bar">
          <span className="bam-zm-title" style={{ color: catMeta.accentColor }}>
            {`Per-District ${catMeta.label} Distribution`}
          </span>
          <span className="bam-zm-rail-sub">
            Click a district row to focus matrix scope above
          </span>
        </div>
        <div className="bam-zm-dist-head">
          <div className="bam-zmd-col-name bam-zm-sortable-th" onClick={() => handleDistSort('name')}>
            <span>District</span>
            {distSortField === 'name' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div className="bam-zmd-col-hh bam-zm-sortable-th" onClick={() => handleDistSort('active')}>
            <span>{colLabels.capCol}</span>
            {distSortField === 'active' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div className="bam-zmd-col-num bam-zm-sortable-th" onClick={() => handleDistSort('free')}>
            <span>Free</span>
            {distSortField === 'free' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div className="bam-zmd-col-num bam-zm-sortable-th" onClick={() => handleDistSort('m3')}>
            <span>{colLabels.m3}</span>
            {distSortField === 'm3' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div
            className="bam-zmd-col-num bam-zm-sortable-th"
            style={{ color: colLabels.c1.color }}
            onClick={() => handleDistSort('c1')}
          >
            <span>{colLabels.c1.name}</span>
            {distSortField === 'c1' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div
            className="bam-zmd-col-num bam-zm-sortable-th"
            style={{ color: colLabels.c2.color }}
            onClick={() => handleDistSort('c2')}
          >
            <span>{colLabels.c2.name}</span>
            {distSortField === 'c2' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div
            className="bam-zmd-col-num bam-zm-sortable-th"
            style={{ color: colLabels.c3.color }}
            onClick={() => handleDistSort('c3')}
          >
            <span>{colLabels.c3.name}</span>
            {distSortField === 'c3' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div
            className="bam-zmd-col-num bam-zm-sortable-th"
            style={{ color: colLabels.c4.color }}
            onClick={() => handleDistSort('c4')}
          >
            <span>{colLabels.c4.name}</span>
            {distSortField === 'c4' && (
              <span className="bam-zm-sort-arrow">
                <UilIcon name={distSortDir === 'asc' ? 'ArrowUp' : 'ArrowDown'} sizeRem={8} />
              </span>
            )}
          </div>
          <div className="bam-zmd-col-act">Explorer</div>
        </div>
        <Scrollable vertical={true} trackVisibility="scrollable" style={{ flex: 1, minHeight: 0 }}>
          {(() => {
            const renderComparisonRow = (
              entry: DistrictCatRow,
              kind: 'citywide' | 'unassigned' | 'district'
            ) => {
              const rowKey = kind === 'citywide' ? '__citywide__' : entry.district.entityKey;
              const isSelected =
                kind === 'citywide'
                  ? selectedScopeKey === ''
                  : selectedScopeKey === entry.district.entityKey;
              const m3Val =
                currentCategory === 'housing'
                  ? entry.district.population > 0 || (kind === 'citywide' && entry.size > 0)
                    ? entry.district.population > 0
                      ? `${Math.round(entry.district.avgHappiness || 0)}%`
                      : '—'
                    : '—'
                  : entry.effCount > 0
                    ? `${Math.round(entry.effSum / entry.effCount)}%`
                    : '—';
              const iconColor =
                kind === 'citywide'
                  ? '#38bdf8'
                  : kind === 'unassigned'
                    ? '#ffb74d'
                    : isSelected
                      ? '#38bdf8'
                      : '#78909c';
              return (
                <div
                  key={rowKey}
                  className={`bam-zm-dist-row${kind === 'citywide' ? ' citywide' : kind === 'unassigned' ? ' unassigned' : ''}${isSelected ? ' active' : ''}`}
                  onClick={() => {
                    if (kind === 'citywide') {
                      setSelectedScopeKey('');
                    } else {
                      setSelectedScopeKey((prev) =>
                        prev === entry.district.entityKey ? '' : entry.district.entityKey
                      );
                    }
                  }}
                >
                  <div className="bam-zmd-col-name">
                    <UilIcon
                      name={kind === 'citywide' ? 'Building' : 'District'}
                      sizeRem={11}
                      style={{ color: iconColor, marginRight: '6rem' }}
                    />
                    <span>{entry.district.name}</span>
                  </div>
                  <div className="bam-zmd-col-hh">
                    {currentCategory === 'storage'
                      ? `${formatTonnesShort(entry.active)} / ${formatTonnesShort(entry.size)}`
                      : `${formatNumber(entry.active)} / ${formatNumber(entry.size)}`}
                  </div>
                  <div
                    className={`bam-zmd-col-num ${entry.free > 0 ? 'bam-zmc-val-free' : 'bam-zmc-val-muted'}`}
                  >
                    {currentCategory === 'storage'
                      ? formatTonnesShort(entry.free)
                      : formatNumber(entry.free)}
                  </div>
                  <div className="bam-zmd-col-num">{m3Val}</div>
                  <div className="bam-zmd-col-num">{formatNumber(entry.c1)}</div>
                  <div className="bam-zmd-col-num">{formatNumber(entry.c2)}</div>
                  <div className="bam-zmd-col-num">{formatNumber(entry.c3)}</div>
                  <div className="bam-zmd-col-num">{formatNumber(entry.c4)}</div>
                  <div className="bam-zmd-col-act">
                    {emitFilter && (
                      <button
                        type="button"
                        className="bam-zm-jump-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          emitFilter({
                            category: catMeta.explorerCategory,
                            districtKey: kind === 'citywide' ? '' : entry.district.entityKey,
                            density: 'All',
                            signatureCategory: currentCategory === 'signature' ? 'All' : undefined,
                            theme: 'All',
                            pack: 'All',
                          });
                        }}
                        title={`View ${catMeta.itemNoun} in ${entry.district.name}`}
                      >
                        <span>{colLabels.btn}</span>
                        <UilIcon name="ArrowRight" sizeRem={10} style={{ marginLeft: '4rem' }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <>
                {renderComparisonRow(cityWideRow, 'citywide')}
                {unassignedRow && renderComparisonRow(unassignedRow, 'unassigned')}
                {districtRows.length === 0 ? (
                  <div style={{ padding: '14rem', color: '#78909c', fontSize: '11rem', textAlign: 'center' }}>
                    No districts created in this city yet.
                  </div>
                ) : (
                  districtRows.map((entry) => renderComparisonRow(entry, 'district'))
                )}
              </>
            );
          })()}
        </Scrollable>
      </div>
    </div>
  );
};

export default ZoneMatrixPanel;
