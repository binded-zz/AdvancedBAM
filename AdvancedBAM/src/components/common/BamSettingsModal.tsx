import { logCatch } from '../../utils/devWarn';
import {
  BAM_VERSION,
  BAM_RELEASE_NAME,
  BAM_AUTHOR,
  BAM_BUILD_YEAR,
  BAM_MOD_ID,
  BAM_PARADOX_MODS_URL,
  BAM_FORUM_THREAD_URL,
  BAM_GITHUB_REPO_URL,
} from '../../core/version';
import React, { useState, useEffect } from 'react';
import { Scrollable } from 'cs2/ui';
import UilIcon from './UilIcon';
import apiSafe, { safeUseValue } from '../../core/apiSafe';
import { happinessFactorCount$, mapCs2HappyCountToLimit } from '../../core/bindings';
import {
  ALL_ZONE_SETTING_STORAGE_KEYS,
  DEFAULT_ZONE_MATRIX_SETTINGS,
  HousingDensityMode,
  ZoneMatrixSettings,
  readHousingDensityMode,
  readZoneMatrixSettings,
  writeHousingDensityMode,
  writeZoneMatrixSetting,
} from '../../utils/zoneMatrixSettings';
import {
  DEFAULT_COLUMN_ORDER,
  ORDER_STORAGE_KEY,
  ColumnKey,
} from '../../hooks/useResizableColumns';
import bamStorage from '../../utils/bamStorage';
import './BamSettingsModal.css';

export interface BamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetWindow: () => void;
  initialTab?: SettingsTab;
}

export type SettingsTab = 'global' | 'assets' | 'matrices' | 'districts' | 'catalog' | 'about';

interface ColumnMeta {
  key: string;
  label: string;
  desc: string;
  fixed?: boolean;
}

const ASSET_COLUMN_METAS: Record<string, ColumnMeta> = {
  name: { key: 'name', label: 'Building Name & Icon', desc: 'Main asset title, address, and thumbnail', fixed: true },
  lotSize: { key: 'lotSize', label: 'Lot Dimensions', desc: 'Dedicated lot dimensions badge (e.g. 4x4, 6x3)' },
  company: { key: 'company', label: 'Company / Brand', desc: 'Commercial brand, company, or facility name' },
  vehicles: { key: 'vehicles', label: 'Fleet / Vehicles', desc: 'Delivery or service vehicles in use vs fleet capacity' },
  resource: { key: 'resource', label: 'Resource Produced / Stored', desc: 'Industrial and commercial input/output goods' },
  storage: { key: 'storage', label: 'Storage Totals', desc: 'Stored goods vs storage capacity in tonnes or kilotonnes' },
  profit: { key: 'profit', label: 'Profit / Financial Tier', desc: 'Profitability margin and wealth tier' },
  service: { key: 'service', label: 'Service Category', desc: 'City service department and type icon' },
  serviceUsage: { key: 'serviceUsage', label: 'Capacity & Vehicle Fleet', desc: 'Service capacity, utilization, and vehicles' },
  maintenance: { key: 'maintenance', label: 'Maintenance', desc: 'Monthly maintenance budget and condition percentage' },
  cat: { key: 'cat', label: 'Category & Subcategory', desc: 'Building zone classification tag' },
  themePack: { key: 'themePack', label: 'Theme & Asset Pack', desc: 'Architectural theme and creator DLC pack' },
  district: { key: 'district', label: 'District Name', desc: 'Assigned municipal district' },
  density: { key: 'density', label: 'Zone Density', desc: 'Residential zoning density (Low, Med, High, Mixed)' },
  level: { key: 'level', label: 'Building Level', desc: 'Level progression (Lv 1 to Lv 5)' },
  occupied: { key: 'occupied', label: 'Occupancy / Workers', desc: 'Households, employees, or tenant count' },
  happiness: { key: 'happiness', label: 'Citizen Happiness', desc: 'Resident and worker well-being score' },
  efficiency: { key: 'efficiency', label: 'Efficiency %', desc: 'Current operational efficiency' },
  status: { key: 'status', label: 'Operational Status', desc: 'Service operational or damaged state' },
  actions: { key: 'actions', label: 'Quick Action Buttons', desc: 'Pin, Relocate, and Info panel buttons' },
};

export const DISTRICT_CARD_METAS: Record<string, { key: string; label: string; desc: string }> = {
  happiness: { key: 'happiness', label: 'Citizen Happiness Factors', desc: 'Average happiness of households with satisfaction & grievance factors.' },
  demographics: { key: 'demographics', label: 'Demographics', desc: 'Age groups, residents, students, tourists, and homeless counts.' },
  workforce: { key: 'workforce', label: 'Workforce & Jobs', desc: 'Worker education levels, employee capacity, and unemployment metrics.' },
  housing: { key: 'housing', label: 'Housing & Zoning', desc: 'Property breakdowns, households, wealth, income, and rent averages.' },
  education: { key: 'education', label: 'Schools & Education', desc: 'Elementary, High School, College, and University capacities and seekers.' },
  utilities: { key: 'utilities', label: 'Utilities & Services', desc: 'Electricity, water, sewage, garbage accumulation, and municipal upkeep.' },
  safety: { key: 'safety', label: 'Land, Health & Safety', desc: 'Land value, crime rates, healthcare, noise pollution, and fire safety.' },
  gamePolicies: { key: 'gamePolicies', label: 'City & District Policies', desc: 'Native game ordinances and policy toggles for the district.' },
  policyPlus: { key: 'policyPlus', label: 'Policy Plus', desc: 'Advanced community policies and custom simulation ordinance controls.' },
};

const DISTRICT_COLUMNS: ColumnMeta[] = [
  { key: 'name', label: 'District Name', desc: 'District title and color badge', fixed: true },
  { key: 'buildings', label: 'Zoning Breakdown', desc: 'Number of zoned and service buildings breakdown' },
  { key: 'citizens', label: 'Pop, Households & Workforce', desc: 'Total citizens, households, happiness, and workers in district' },
  { key: 'avgLevel', label: 'Average Building Level', desc: 'District-wide mean building upgrade level' },
  { key: 'policies', label: 'Active Policies', desc: 'Enacted municipal district policy count' },
  { key: 'actions', label: 'Inspect Actions', desc: 'Buttons to focus district or filter buildings' },
];

const CATALOG_COLUMNS: ColumnMeta[] = [
  { key: 'name', label: 'Prefab Name', desc: 'Prefab asset title and thumbnail', fixed: true },
  { key: 'lotSize', label: 'Lot Dimensions', desc: 'Footprint size on the grid' },
  { key: 'cat', label: 'Category & Type', desc: 'Prefab categorization and zoning type' },
  { key: 'themePack', label: 'Theme & DLC Pack', desc: 'Asset pack or content creator pack' },
  { key: 'level', label: 'Building Level', desc: 'Prefab building level' },
  { key: 'occupied', label: 'Household / Work Capacity', desc: 'Max capacity provided by prefab' },
  { key: 'actions', label: 'Placement Tool', desc: 'Quick placement button' },
];

export type AssetSubPill = 'all' | 'Residential' | 'Commercial' | 'Industrial' | 'Office' | 'Storage' | 'Service' | 'Signature';

const ALL_SUB_PILLS: AssetSubPill[] = [
  'all',
  'Residential',
  'Commercial',
  'Industrial',
  'Office',
  'Storage',
  'Service',
  'Signature',
];

export const PILL_COLUMNS_MAP: Record<AssetSubPill, string[]> = {
  all: [
    'name', 'lotSize', 'cat', 'themePack', 'district', 'level', 'occupied',
    'efficiency', 'maintenance', 'actions',
  ],
  Residential: [
    'name', 'lotSize', 'themePack', 'district', 'density', 'level',
    'occupied', 'happiness', 'actions',
  ],
  Commercial: [
    'name', 'lotSize', 'company', 'resource', 'vehicles', 'profit', 'themePack',
    'district', 'level', 'occupied', 'efficiency', 'actions',
  ],
  Industrial: [
    'name', 'lotSize', 'company', 'resource', 'vehicles', 'profit', 'themePack',
    'district', 'level', 'occupied', 'efficiency', 'actions',
  ],
  Office: [
    'name', 'lotSize', 'company', 'resource', 'vehicles', 'profit', 'themePack',
    'district', 'level', 'occupied', 'efficiency', 'actions',
  ],
  Storage: [
    'name', 'lotSize', 'company', 'resource', 'storage', 'vehicles', 'profit', 'themePack',
    'district', 'level', 'actions',
  ],
  Service: [
    'name', 'lotSize', 'service', 'serviceUsage', 'vehicles', 'maintenance', 'themePack',
    'district', 'occupied', 'efficiency', 'status', 'actions',
  ],
  Signature: [
    'name', 'lotSize', 'cat', 'themePack', 'district', 'level',
    'occupied', 'efficiency', 'actions',
  ],
};

export const PILL_CARDS_MAP: Record<AssetSubPill, string[]> = {
  all: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'parks', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Residential: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'parks', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Commercial: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'parks', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Industrial: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Office: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Storage: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'parks', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Service: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'parks', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
  Signature: [
    'identity', 'zoning', 'operations', 'performance', 'economics', 'education',
    'parking', 'parks', 'efficiency', 'happiness', 'upgrades', 'effects',
  ],
};

export const DEFAULT_BUILDING_CARD_ORDER = [
  'identity',
  'zoning',
  'operations',
  'performance',
  'economics',
  'education',
  'parking',
  'parks',
  'efficiency',
  'happiness',
  'upgrades',
  'effects',
];

const DEFAULT_DISTRICT_COL_ORDER = ['name', 'buildings', 'citizens', 'avgLevel', 'policies', 'actions'];

export const BUILDING_CARD_METAS: Record<string, { key: string; label: string; desc: string }> = {
  identity: {
    key: 'identity',
    label: 'Identity & Location',
    desc: 'Street address, road access, entity keys, prefab asset, district, theme, and DLC pack',
  },
  zoning: {
    key: 'zoning',
    label: 'Specs & Zoning',
    desc: 'Zoning category, density, company brand, lot dimensions, land value, parking facility, condition',
  },
  operations: {
    key: 'operations',
    label: 'Operations & Living / Supply',
    desc: 'Household living specs, tenant details, materials supply chain and per-resource stored tons',
  },
  performance: {
    key: 'performance',
    label: 'Performance & Utilities',
    desc: 'Occupancy, efficiency, delivery fleet in use, electricity, water, garbage, mail, and crime risk',
  },
  economics: {
    key: 'economics',
    label: 'Financials & Economics',
    desc: 'Household living finances, rents, or commercial operating costs, profit, and utility fees paid',
  },
  education: {
    key: 'education',
    label: 'Worker & Resident Education',
    desc: 'Required jobs vs filled positions by education level, worker qualification distribution',
  },
  parking: {
    key: 'parking',
    label: 'Parking & Mobility Operations',
    desc: 'Parked vehicles vs capacity, comfort factor, hourly parking fee and upkeep',
  },
  parks: {
    key: 'parks',
    label: 'Parks & Recreation Operations',
    desc: 'Park maintenance condition, recreation score, attractiveness, camping citizens',
  },
  efficiency: {
    key: 'efficiency',
    label: 'Efficiency Factors Breakdown',
    desc: 'Employee happiness, service inputs, telecommunications, and building condition buffs',
  },
  happiness: {
    key: 'happiness',
    label: 'Citizen Happiness Factors',
    desc: 'All 26 native game simulation happiness and satisfaction influences',
  },
  upgrades: {
    key: 'upgrades',
    label: 'Installed Sub-Building Upgrades',
    desc: 'Sub-building expansions, extra capacity, and installed modules',
  },
  effects: {
    key: 'effects',
    label: 'City Modifiers & Local Radius',
    desc: 'City-wide passive bonuses and local radius auras',
  },
};

const readStoredDistrictViewMode = (): 'cards' | 'compact' => {
  try {
    const val =
      bamStorage.getItem('bam_dist_view_mode') ??
      bamStorage.getItem('bam_district_view_mode');
    return val === 'compact' ? 'compact' : 'cards';
  } catch {
    return 'cards';
  }
};

const readStoredDistrictShowPolicies = (): boolean => {
  try {
    const val =
      bamStorage.getItem('bam_dist_show_policies') ??
      bamStorage.getItem('bam_districts_show_policies');
    return val !== 'false';
  } catch {
    return true;
  }
};

const readStoredHiddenDistrictCards = (): Set<string> => {
  try {
    const saved =
      bamStorage.getItem('bam_dist_hidden_cards') ??
      bamStorage.getItem('bam_districts_hidden_cards') ??
      bamStorage.getItem('bam_district_hidden_cards');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (err) { logCatch('BamSettingsModal', err); }
  return new Set();
};

const readBoolPref = (key: string, fallback = true): boolean => {
  try {
    const val = bamStorage.getItem(key);
    return val === null ? fallback : val === 'true';
  } catch {
    return fallback;
  }
};

const readJsonSet = (key: string): Set<string> => {
  try {
    const saved = bamStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (err) { logCatch('BamSettingsModal', err); }
  return new Set();
};

const readStringArray = (key: string, fallback: string[]): string[] => {
  try {
    const saved = bamStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) { logCatch('BamSettingsModal', err); }
  return [...fallback];
};

const readColumnOrderPref = <T extends string>(key: string, defaults: readonly T[]): T[] => {
  try {
    const saved = bamStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return Array.from(new Set([...parsed, ...defaults])) as T[];
      }
    }
  } catch (err) { logCatch('BamSettingsModal', err); }
  return [...defaults];
};

const handleRoleButtonKeyDown = (e: React.KeyboardEvent, action: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};

export const BamSettingsModal: React.FC<BamSettingsModalProps> = ({
  isOpen,
  onClose,
  onResetWindow,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'global');


  useEffect(() => {
    if (isOpen) {
      if (initialTab && initialTab !== 'global') {
        setActiveTab(initialTab);
      } else {
        try {
          const activeCat = bamStorage.getItem('bam_active_category_view');
          if (
            activeCat === 'ZoneMatrices' ||
            activeCat === 'Housing' ||
            activeCat === 'CommercialMatrix' ||
            activeCat === 'OfficeMatrix' ||
            activeCat === 'IndustrialMatrix' ||
            activeCat === 'StorageMatrix' ||
            activeCat === 'ServiceMatrix' ||
            activeCat === 'SignatureMatrix'
          ) {
            setActiveTab('matrices');
          } else if (activeCat === 'Districts') {
            setActiveTab('districts');
          } else if (activeCat === 'Catalog') {
            setActiveTab('catalog');
          } else if (activeCat && ALL_SUB_PILLS.includes(activeCat as AssetSubPill)) {
            setActiveTab('assets');
            setAssetSubPill(activeCat as AssetSubPill);
          } else if (activeCat === 'All') {
            setActiveTab('assets');
            setAssetSubPill('all');
          }
        } catch (err) { logCatch('BamSettingsModal', err); }
      }
    }
  }, [isOpen, initialTab]);

  // Asset Explorer settings
  const [showLotSize, setShowLotSize] = useState<boolean>(() => {
    try {
      const val = bamStorage.getItem('bam_setting_show_lotsize');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [showUpgrades, setShowUpgrades] = useState<boolean>(() => {
    try {
      const val = bamStorage.getItem('bam_setting_show_upgrades');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [showFilterFlyout, setShowFilterFlyout] = useState<boolean>(() => {
    try {
      const val = bamStorage.getItem('bam_setting_show_filter_flyout');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [showQuickFilterBar, setShowQuickFilterBar] = useState<boolean>(() => {
    try {
      const val = bamStorage.getItem('bam_setting_show_quick_filter_bar');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const [subBuildingTarget, setSubBuildingTarget] = useState<'main' | 'sub'>(() => {
    try {
      const val = bamStorage.getItem('bam_setting_sub_target');
      return val === 'sub' ? 'sub' : 'main';
    } catch {
      return 'main';
    }
  });

  const [defaultEffLimit, setDefaultEffLimit] = useState<number>(() => {
    try {
      const saved = bamStorage.getItem('bam_default_eff_limit');
      return saved !== null ? parseInt(saved, 10) : 10;
    } catch {
      return 10;
    }
  });

  const cs2HappyCount = safeUseValue(happinessFactorCount$, 1);

  const [defaultHappyLimit, setDefaultHappyLimit] = useState<number>(() => {
    try {
      const saved = bamStorage.getItem('bam_default_happy_limit');
      return saved !== null ? parseInt(saved, 10) : mapCs2HappyCountToLimit(cs2HappyCount);
    } catch {
      return mapCs2HappyCountToLimit(cs2HappyCount);
    }
  });

  useEffect(() => {
    const onSettingsChanged = (e: any) => {
      if (e?.detail?.key === 'defaultHappyLimit' && typeof e.detail.value === 'number') {
        setDefaultHappyLimit(e.detail.value);
      }
    };
    window.addEventListener('bam-settings-changed', onSettingsChanged);
    return () => window.removeEventListener('bam-settings-changed', onSettingsChanged);
  }, []);

  const handleDefaultEffLimit = (limit: number) => {
    setDefaultEffLimit(limit);
    try {
      bamStorage.setItem('bam_default_eff_limit', String(limit));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'defaultEffLimit', value: limit } })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const handleDefaultHappyLimit = (limit: number) => {
    setDefaultHappyLimit(limit);
    try {
      bamStorage.setItem('bam_default_happy_limit', String(limit));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'defaultHappyLimit', value: limit } })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  // District View Mode, Policies Toggle & Card Visibility (synced with DistrictsView)
  const [districtViewMode, setDistrictViewMode] = useState<'cards' | 'compact'>(readStoredDistrictViewMode);
  const [showPoliciesInExpanded, setShowPoliciesInExpanded] = useState<boolean>(readStoredDistrictShowPolicies);
  const [hiddenDistrictCards, setHiddenDistrictCards] = useState<Set<string>>(readStoredHiddenDistrictCards);
  const [zoneSettings, setZoneSettings] = useState<ZoneMatrixSettings>(readZoneMatrixSettings);
  const [housingMatrixMode, setHousingMatrixMode] = useState<HousingDensityMode>(readHousingDensityMode);

  const handleResetMatrixSettings = () => {
    try {
      ALL_ZONE_SETTING_STORAGE_KEYS.forEach((k) => {
        bamStorage.removeItem(k);
      });
      setZoneSettings({ ...DEFAULT_ZONE_MATRIX_SETTINGS });
      setHousingMatrixMode('standard');
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'zoneMatricesReset' } }));
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const renderZoneToggleRow = (
    name: string,
    desc: string,
    field: Exclude<keyof ZoneMatrixSettings, 'districtsLayout'>,
    compactHalf = false
  ) => (
    <div key={field} className={compactHalf ? 'bam-setting-card-half' : 'bam-setting-row'}>
      <div className="bam-setting-info">
        <span className="bam-setting-name">{name}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="bam-setting-desc">{desc}</span>
        </div>
      </div>
      <div
        className={`bam-toggle-switch${zoneSettings[field] ? ' checked' : ''}`}
        onClick={() => setZoneSettings(writeZoneMatrixSetting(field, !zoneSettings[field]))}
        onKeyDown={(e) => handleRoleButtonKeyDown(e, () => setZoneSettings(writeZoneMatrixSetting(field, !zoneSettings[field])))}
        role="button"
        tabIndex={0}
      >
        <div className="bam-toggle-slider" />
      </div>
    </div>
  );

  // Sync live state whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setDistrictViewMode(readStoredDistrictViewMode());
    setShowPoliciesInExpanded(readStoredDistrictShowPolicies());
    setHiddenDistrictCards(readStoredHiddenDistrictCards());
    setZoneSettings(readZoneMatrixSettings());
    setHousingMatrixMode(readHousingDensityMode());

    setShowLotSize(readBoolPref('bam_setting_show_lotsize', true));
    setShowUpgrades(readBoolPref('bam_setting_show_upgrades', true));
    setShowFilterFlyout(readBoolPref('bam_setting_show_filter_flyout', true));
    setShowQuickFilterBar(readBoolPref('bam_setting_show_quick_filter_bar', true));
    try {
      setSubBuildingTarget(bamStorage.getItem('bam_setting_sub_target') === 'sub' ? 'sub' : 'main');
      const effSaved = bamStorage.getItem('bam_default_eff_limit');
      const effParsed = effSaved !== null ? parseInt(effSaved, 10) : NaN;
      setDefaultEffLimit(Number.isFinite(effParsed) && effParsed > 0 ? effParsed : 10);
      const happySaved = bamStorage.getItem('bam_default_happy_limit');
      const happyParsed = happySaved !== null ? parseInt(happySaved, 10) : NaN;
      setDefaultHappyLimit(Number.isFinite(happyParsed) && happyParsed > 0 ? happyParsed : mapCs2HappyCountToLimit(cs2HappyCount));
    } catch (err) { logCatch('BamSettingsModal', err); }

    setAssetColumnOrder(readColumnOrderPref<ColumnKey>(ORDER_STORAGE_KEY, DEFAULT_COLUMN_ORDER));
    setHiddenAssetColumns(readJsonSet('bam_hidden_columns_assets'));

    const nextHiddenByPill: Record<string, Set<string>> = {};
    const nextOrderByPill: Record<string, ColumnKey[]> = {};
    ALL_SUB_PILLS.forEach((p) => {
      try {
        const savedHidden = bamStorage.getItem(`bam_hidden_columns_assets_${p}`);
        if (savedHidden) {
          nextHiddenByPill[p] = new Set(JSON.parse(savedHidden));
        }
      } catch (err) { logCatch('BamSettingsModal', err); }
      const orderKey = p === 'all' ? ORDER_STORAGE_KEY : `bam_column_order_${p.toLowerCase()}`;
      nextOrderByPill[p] = readColumnOrderPref<ColumnKey>(orderKey, DEFAULT_COLUMN_ORDER);
    });
    setHiddenColsByPill(nextHiddenByPill);
    setColOrderByPill(nextOrderByPill);

    setDistrictColOrder(readStringArray('bam_district_col_order', DEFAULT_DISTRICT_COL_ORDER));
    setHiddenDistrictColumns(readJsonSet('bam_hidden_columns_districts'));
    setCatalogColOrder(readColumnOrderPref<ColumnKey>('bam_catalog_col_order', CATALOG_COLUMNS.map((c) => c.key as ColumnKey)));
    setHiddenCatalogColumns(readJsonSet('bam_hidden_columns_catalog'));
    setBuildingCardOrder(readStringArray('bam_building_card_order', DEFAULT_BUILDING_CARD_ORDER));
    setHiddenBuildingCards(readJsonSet('bam_building_hidden_cards'));
  }, [isOpen, cs2HappyCount]);

  const handleSetDistrictViewMode = (mode: 'cards' | 'compact') => {
    setDistrictViewMode(mode);
    try {
      bamStorage.setItem('bam_dist_view_mode', mode);
      bamStorage.removeItem('bam_district_view_mode');
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'districtViewMode', value: mode } }));
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const handleToggleShowPolicies = (val: boolean) => {
    setShowPoliciesInExpanded(val);
    try {
      bamStorage.setItem('bam_dist_show_policies', String(val));
      bamStorage.removeItem('bam_districts_show_policies');
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'showPoliciesInExpanded', value: val } }));
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const handleToggleDistrictCard = (cardKey: string) => {
    setHiddenDistrictCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      const arr = Array.from(next);
      try {
        bamStorage.setItem('bam_dist_hidden_cards', JSON.stringify(arr));
        bamStorage.removeItem('bam_districts_hidden_cards');
        bamStorage.removeItem('bam_district_hidden_cards');
        window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'hiddenDistrictCards', value: arr } }));
      } catch (err) { logCatch('BamSettingsModal', err); }
      return next;
    });
  };

  // Column order for Assets Table
  const [assetColumnOrder, setAssetColumnOrder] = useState<ColumnKey[]>(() => {
    try {
      const saved = bamStorage.getItem(ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...parsed, ...DEFAULT_COLUMN_ORDER])) as ColumnKey[];
        }
      }
    } catch (err) { logCatch('BamSettingsModal', err); }
    return [...DEFAULT_COLUMN_ORDER];
  });

  // Hidden columns for Assets Table (Global + Per-Pill)
  const [assetSubPill, setAssetSubPill] = useState<AssetSubPill>('all');
  const [hiddenAssetColumns, setHiddenAssetColumns] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_hidden_columns_assets');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [hiddenColsByPill, setHiddenColsByPill] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {};
    ALL_SUB_PILLS.forEach((p) => {
      try {
        const saved = bamStorage.getItem(`bam_hidden_columns_assets_${p}`);
        if (saved) {
          map[p] = new Set(JSON.parse(saved));
        }
      } catch (err) { logCatch('BamSettingsModal', err); }
    });
    return map;
  });

  // Per-category column order state
  const [colOrderByPill, setColOrderByPill] = useState<Record<string, ColumnKey[]>>(() => {
    const map: Record<string, ColumnKey[]> = {};
    ALL_SUB_PILLS.forEach((p) => {
      try {
        const key = p === 'all' ? ORDER_STORAGE_KEY : `bam_column_order_${p.toLowerCase()}`;
        const saved = bamStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            map[p] = Array.from(new Set([...parsed, ...DEFAULT_COLUMN_ORDER])) as ColumnKey[];
            return;
          }
        }
      } catch (err) { logCatch('BamSettingsModal', err); }
      map[p] = [...DEFAULT_COLUMN_ORDER];
    });
    return map;
  });

  // Hidden columns and order for Districts
  const [districtColOrder, setDistrictColOrder] = useState<string[]>(() => {
    try {
      const saved = bamStorage.getItem('bam_district_col_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) { logCatch('BamSettingsModal', err); }
    return [...DEFAULT_DISTRICT_COL_ORDER];
  });

  const [hiddenDistrictColumns, setHiddenDistrictColumns] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_hidden_columns_districts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Order and hidden columns for Catalog
  const [catalogColOrder, setCatalogColOrder] = useState<ColumnKey[]>(() => {
    try {
      const saved = bamStorage.getItem('bam_catalog_col_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...parsed, ...CATALOG_COLUMNS.map((c) => c.key as ColumnKey)]));
        }
      }
    } catch (err) { logCatch('BamSettingsModal', err); }
    return CATALOG_COLUMNS.map((c) => c.key as ColumnKey);
  });

  const [hiddenCatalogColumns, setHiddenCatalogColumns] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_hidden_columns_catalog');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleToggleUpgrades = (enabled: boolean) => {
    setShowUpgrades(enabled);
    try {
      bamStorage.setItem('bam_setting_show_upgrades', String(enabled));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'showUpgrades', value: enabled } })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const handleToggleFilterFlyout = (enabled: boolean) => {
    setShowFilterFlyout(enabled);
    try {
      bamStorage.setItem('bam_setting_show_filter_flyout', String(enabled));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'showFilterFlyout', value: enabled } })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const handleToggleQuickFilterBar = (enabled: boolean) => {
    setShowQuickFilterBar(enabled);
    try {
      bamStorage.setItem('bam_setting_show_quick_filter_bar', String(enabled));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'showQuickFilterBar', value: enabled } })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const handleSubBuildingTarget = (target: 'main' | 'sub') => {
    setSubBuildingTarget(target);
    try {
      bamStorage.setItem('bam_setting_sub_target', target);
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', { detail: { key: 'subBuildingTarget', value: target } })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const isAssetColVisible = (colKey: string) => {
    if (assetSubPill !== 'all') {
      const pillSet = hiddenColsByPill[assetSubPill];
      if (pillSet) return !pillSet.has(colKey);
    }
    return !hiddenAssetColumns.has(colKey);
  };

  const toggleAssetColumn = (colKey: string) => {
    if (assetSubPill !== 'all') {
      setHiddenColsByPill((prev) => {
        const currPillSet = new Set(prev[assetSubPill] || hiddenAssetColumns);
        if (currPillSet.has(colKey)) {
          currPillSet.delete(colKey);
        } else {
          currPillSet.add(colKey);
        }
        const nextMap = { ...prev, [assetSubPill]: currPillSet };
        try {
          bamStorage.setItem(`bam_hidden_columns_assets_${assetSubPill}`, JSON.stringify(Array.from(currPillSet)));
          window.dispatchEvent(
            new CustomEvent('bam-settings-changed', {
              detail: { key: 'hiddenColumnsPill', pill: assetSubPill, value: Array.from(currPillSet) },
            })
          );
        } catch (err) { logCatch('BamSettingsModal', err); }
        return nextMap;
      });
    } else {
      setHiddenAssetColumns((prev) => {
        const next = new Set(prev);
        if (next.has(colKey)) {
          next.delete(colKey);
        } else {
          next.add(colKey);
        }
        try {
          bamStorage.setItem('bam_hidden_columns_assets', JSON.stringify(Array.from(next)));
          window.dispatchEvent(
            new CustomEvent('bam-settings-changed', {
              detail: { key: 'hiddenColumnsAssets', value: Array.from(next) },
            })
          );
        } catch (err) { logCatch('BamSettingsModal', err); }
        return next;
      });
    }
  };

  const moveAssetColumn = (colKey: ColumnKey, direction: 'up' | 'down') => {
    const currentOrder = colOrderByPill[assetSubPill] || assetColumnOrder;
    const currentPillCols = currentOrder.filter((k) => PILL_COLUMNS_MAP[assetSubPill].includes(k));
    const pillIdx = currentPillCols.indexOf(colKey);
    const targetPillIdx = direction === 'up' ? pillIdx - 1 : pillIdx + 1;
    if (targetPillIdx < 0 || targetPillIdx >= currentPillCols.length) return;

    const targetColKey = currentPillCols[targetPillIdx];
    const fromIdx = currentOrder.indexOf(colKey);
    const toIdx = currentOrder.indexOf(targetColKey);
    if (fromIdx < 0 || toIdx < 0) return;

    const newOrder = [...currentOrder];
    newOrder[fromIdx] = targetColKey;
    newOrder[toIdx] = colKey;

    if (assetSubPill === 'all') {
      setAssetColumnOrder(newOrder);
      setColOrderByPill((prev) => ({ ...prev, all: newOrder }));
      try {
        bamStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(newOrder));
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'columnOrder', value: newOrder },
          })
        );
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'columnOrderPill', pill: 'all', value: newOrder },
          })
        );
      } catch (err) { logCatch('BamSettingsModal', err); }
    } else {
      setColOrderByPill((prev) => ({ ...prev, [assetSubPill]: newOrder }));
      const pillKey = assetSubPill.toLowerCase();
      try {
        bamStorage.setItem(`bam_column_order_${pillKey}`, JSON.stringify(newOrder));
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'columnOrderPill', pill: pillKey, value: newOrder },
          })
        );
      } catch (err) { logCatch('BamSettingsModal', err); }
    }
  };

  const moveDistrictColumn = (colKey: string, direction: 'up' | 'down') => {
    const idx = districtColOrder.indexOf(colKey);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= districtColOrder.length) return;

    const newOrder = [...districtColOrder];
    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    setDistrictColOrder(newOrder);
    try {
      bamStorage.setItem('bam_district_col_order', JSON.stringify(newOrder));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', {
          detail: { key: 'districtColumnOrder', value: newOrder },
        })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const moveCatalogColumn = (colKey: string, direction: 'up' | 'down') => {
    const catalogKeys: ColumnKey[] = CATALOG_COLUMNS.map((c) => c.key as ColumnKey);
    const currentOrder = catalogColOrder.filter((k) => catalogKeys.includes(k));
    catalogKeys.forEach((k) => {
      if (!currentOrder.includes(k)) currentOrder.push(k);
    });

    const pillIdx = currentOrder.indexOf(colKey as ColumnKey);
    const targetPillIdx = direction === 'up' ? pillIdx - 1 : pillIdx + 1;
    if (targetPillIdx < 0 || targetPillIdx >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const temp = newOrder[pillIdx];
    newOrder[pillIdx] = newOrder[targetPillIdx];
    newOrder[targetPillIdx] = temp;

    setCatalogColOrder(newOrder);
    try {
      bamStorage.setItem('bam_catalog_col_order', JSON.stringify(newOrder));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', {
          detail: { key: 'catalogColumnOrder', value: newOrder },
        })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const [buildingCardOrder, setBuildingCardOrder] = useState<string[]>(() => {
    try {
      const saved = bamStorage.getItem('bam_building_card_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) { logCatch('BamSettingsModal', err); }
    return DEFAULT_BUILDING_CARD_ORDER;
  });

  const [hiddenBuildingCards, setHiddenBuildingCards] = useState<Set<string>>(() => {
    try {
      const saved = bamStorage.getItem('bam_building_hidden_cards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (err) { logCatch('BamSettingsModal', err); }
    return new Set();
  });

  const moveBuildingCard = (cardKey: string, direction: 'up' | 'down') => {
    const allowedCards = PILL_CARDS_MAP[assetSubPill] || DEFAULT_BUILDING_CARD_ORDER;
    const currentPillCards = buildingCardOrder.filter((k) => allowedCards.includes(k));
    const pillIdx = currentPillCards.indexOf(cardKey);
    const targetPillIdx = direction === 'up' ? pillIdx - 1 : pillIdx + 1;
    if (targetPillIdx < 0 || targetPillIdx >= currentPillCards.length) return;

    const targetCardKey = currentPillCards[targetPillIdx];
    const fromIdx = buildingCardOrder.indexOf(cardKey);
    const toIdx = buildingCardOrder.indexOf(targetCardKey);
    if (fromIdx < 0 || toIdx < 0) return;

    const newOrder = [...buildingCardOrder];
    newOrder[fromIdx] = targetCardKey;
    newOrder[toIdx] = cardKey;

    setBuildingCardOrder(newOrder);
    try {
      bamStorage.setItem('bam_building_card_order', JSON.stringify(newOrder));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', {
          detail: { key: 'buildingCardOrder', value: newOrder },
        })
      );
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const toggleBuildingCard = (cardKey: string) => {
    setHiddenBuildingCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) {
        next.delete(cardKey);
      } else {
        next.add(cardKey);
      }
      try {
        bamStorage.setItem('bam_building_hidden_cards', JSON.stringify(Array.from(next)));
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'buildingHiddenCards', value: Array.from(next) },
          })
        );
      } catch (err) { logCatch('BamSettingsModal', err); }
      return next;
    });
  };

  const resetBuildingCards = () => {
    setBuildingCardOrder(DEFAULT_BUILDING_CARD_ORDER);
    setHiddenBuildingCards(new Set());
    try {
      bamStorage.removeItem('bam_building_card_order');
      bamStorage.removeItem('bam_building_hidden_cards');
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'buildingCardsReset' } }));
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  const toggleDistrictColumn = (colKey: string) => {
    setHiddenDistrictColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) {
        next.delete(colKey);
      } else {
        next.add(colKey);
      }
      try {
        bamStorage.setItem('bam_hidden_columns_districts', JSON.stringify(Array.from(next)));
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'hiddenColumnsDistricts', value: Array.from(next) },
          })
        );
      } catch (err) { logCatch('BamSettingsModal', err); }
      return next;
    });
  };

  const toggleCatalogColumn = (colKey: string) => {
    setHiddenCatalogColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) {
        next.delete(colKey);
      } else {
        next.add(colKey);
      }
      try {
        bamStorage.setItem('bam_hidden_columns_catalog', JSON.stringify(Array.from(next)));
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'hiddenColumnsCatalog', value: Array.from(next) },
          })
        );
      } catch (err) { logCatch('BamSettingsModal', err); }
      return next;
    });
  };

  const resetAssetColumns = () => {
    if (assetSubPill !== 'all') {
      const pillKey = assetSubPill.toLowerCase();
      try {
        bamStorage.removeItem(`bam_hidden_columns_assets_${assetSubPill}`);
        bamStorage.removeItem(`bam_column_order_${pillKey}`);
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'hiddenColumnsPill', pill: assetSubPill, value: [] },
          })
        );
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: { key: 'columnOrderPill', pill: pillKey, value: [...DEFAULT_COLUMN_ORDER] },
          })
        );
      } catch (err) { logCatch('BamSettingsModal', err); }
      setHiddenColsByPill((prev) => {
        const nextMap = { ...prev };
        delete nextMap[assetSubPill];
        return nextMap;
      });
      setColOrderByPill((prev) => ({ ...prev, [assetSubPill]: [...DEFAULT_COLUMN_ORDER] }));
    } else {
      setAssetColumnOrder([...DEFAULT_COLUMN_ORDER]);
      setColOrderByPill({});
      setHiddenAssetColumns(new Set());
      setHiddenColsByPill({});
      setShowLotSize(true);
      setShowUpgrades(true);
      try {
        bamStorage.removeItem('bam_table_column_widths_v2');
        bamStorage.removeItem('bam_table_column_widths_v3');
        bamStorage.removeItem(ORDER_STORAGE_KEY);
        bamStorage.removeItem('bam_hidden_columns_assets');
        ALL_SUB_PILLS.forEach((p) => {
          bamStorage.removeItem(`bam_hidden_columns_assets_${p}`);
          if (p !== 'all') bamStorage.removeItem(`bam_column_order_${p.toLowerCase()}`);
        });
        bamStorage.setItem('bam_setting_show_lotsize', 'true');
        bamStorage.setItem('bam_setting_show_upgrades', 'true');
        window.dispatchEvent(
          new CustomEvent('bam-settings-changed', {
            detail: {
              key: 'resetColumns',
              columnOrder: [...DEFAULT_COLUMN_ORDER],
              showLotSize: true,
              showUpgrades: true,
            },
          })
        );
        window.dispatchEvent(new CustomEvent('bam-reset-asset-columns'));
      } catch (err) { logCatch('BamSettingsModal', err); }
    }
  };

  const handleFactoryReset = () => {
    try {
      const keysToClear = [
        'bam_table_column_widths_v2',
        'bam_table_column_widths_v3',
        ORDER_STORAGE_KEY,
        'bam_hidden_columns_assets',
        'bam_hidden_columns_districts',
        'bam_hidden_columns_catalog',
        'bam_catalog_col_order',
        'bam_district_col_widths',
        'bam_district_col_order',
        'bam_district_card_order',
        'bam_dist_collapsed_cards',
        'bam_dist_view_mode',
        'bam_district_view_mode',
        'bam_dist_show_policies',
        'bam_districts_show_policies',
        'bam_dist_hidden_cards',
        'bam_districts_hidden_cards',
        'bam_district_hidden_cards',
        'bam_building_card_order',
        'bam_building_hidden_cards',
        'bam_setting_show_lotsize',
        'bam_setting_show_upgrades',
        'bam_setting_show_filter_flyout',
        'bam_setting_show_quick_filter_bar',
        'bam_setting_sub_target',
        'bam_default_eff_limit',
        'bam_default_happy_limit',
        'bam_bld_happy_filter',
        'bam_happy_limit',
        'bam_happy_filter',
        'bam_upgrade_display_mode',
        ...ALL_ZONE_SETTING_STORAGE_KEYS,
      ];
      keysToClear.forEach((k) => bamStorage.removeItem(k));
      ALL_SUB_PILLS.forEach((p) => {
        bamStorage.removeItem(`bam_hidden_columns_assets_${p}`);
        if (p !== 'all') bamStorage.removeItem(`bam_column_order_${p.toLowerCase()}`);
      });
    } catch (err) { logCatch('BamSettingsModal', err); }

    // Reset local modal state live via custom events without reloading CS2 GameUI
    setShowLotSize(true);
    setShowUpgrades(true);
    setShowFilterFlyout(true);
    setShowQuickFilterBar(true);
    const happyDefault = mapCs2HappyCountToLimit(cs2HappyCount);
    setSubBuildingTarget('main');
    setDefaultEffLimit(10);
    setDefaultHappyLimit(happyDefault);
    setDistrictViewMode('cards');
    setShowPoliciesInExpanded(true);
    setHiddenDistrictCards(new Set());
    setZoneSettings({ ...DEFAULT_ZONE_MATRIX_SETTINGS });
    setHousingMatrixMode('standard');
    setAssetColumnOrder([...DEFAULT_COLUMN_ORDER]);
    setHiddenAssetColumns(new Set());
    setHiddenColsByPill({});
    setColOrderByPill({});
    setDistrictColOrder([...DEFAULT_DISTRICT_COL_ORDER]);
    setHiddenDistrictColumns(new Set());
    setCatalogColOrder(CATALOG_COLUMNS.map((c) => c.key as ColumnKey));
    setHiddenCatalogColumns(new Set());
    setBuildingCardOrder(DEFAULT_BUILDING_CARD_ORDER);
    setHiddenBuildingCards(new Set());

    try {
      window.dispatchEvent(new CustomEvent('bam-settings-reset'));
      window.dispatchEvent(new CustomEvent('bam-reset-asset-columns'));
      window.dispatchEvent(
        new CustomEvent('bam-settings-changed', {
          detail: {
            key: 'resetColumns',
            columnOrder: [...DEFAULT_COLUMN_ORDER],
            showLotSize: true,
            showUpgrades: true,
          },
        })
      );
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'buildingCardsReset' } }));
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'showFilterFlyout', value: true } }));
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'showQuickFilterBar', value: true } }));
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'defaultEffLimit', value: 10 } }));
      window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'defaultHappyLimit', value: happyDefault } }));
      window.dispatchEvent(new Event('storage'));
      apiSafe.requestRefresh();
    } catch (err) { logCatch('BamSettingsModal', err); }
  };

  if (!isOpen) return null;

  return (
    <div className="bam-settings-overlay" onClick={onClose}>
      <div className="bam-settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bam-settings-header">
          <div className="bam-settings-header-left">
            <UilIcon name="Settings" sizeRem={13} />
            <span className="bam-settings-title">BAM Settings &amp; Preferences</span>
          </div>
          <button className="bam-settings-close" onClick={onClose} title="Close Settings">
            <UilIcon name="Close" sizeRem={12} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="bam-settings-layout">
          {/* Navigation Sidebar */}
          <div className="bam-settings-sidebar-wrap">
            <Scrollable vertical={true} trackVisibility="scrollable" style={{ flex: 1, minHeight: 0 }}>
              <div className="bam-settings-sidebar">
                <button
                  className={`bam-settings-pill${activeTab === 'global' ? ' active' : ''}`}
                  onClick={() => setActiveTab('global')}
                >
                  <UilIcon name="Globe" sizeRem={14} className="bam-pill-icon" />
                  <span className="bam-pill-label">Global</span>
                </button>
                <button
                  className={`bam-settings-pill${activeTab === 'assets' ? ' active' : ''}`}
                  onClick={() => setActiveTab('assets')}
                >
                  <UilIcon name="Building" sizeRem={14} className="bam-pill-icon" />
                  <span className="bam-pill-label">Assets Table</span>
                </button>

                {/* Sub-groups for Assets Table in sidebar */}
                {activeTab === 'assets' && (
                  <div className="bam-settings-sidebar-subgroup">
                    {ALL_SUB_PILLS.map((pill) => (
                      <button
                        key={pill}
                        className={`bam-settings-subpill-sidebar${assetSubPill === pill ? ' active' : ''}`}
                        onClick={() => {
                          setActiveTab('assets');
                          setAssetSubPill(pill);
                        }}
                      >
                        <span className="bam-subpill-sidebar-label">{pill === 'all' ? 'All Buildings' : pill}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className={`bam-settings-pill${activeTab === 'matrices' ? ' active' : ''}`}
                  onClick={() => setActiveTab('matrices')}
                >
                  <UilIcon name="Layers" sizeRem={14} className="bam-pill-icon" />
                  <span className="bam-pill-label">Matrices</span>
                </button>
                <button
                  className={`bam-settings-pill${activeTab === 'districts' ? ' active' : ''}`}
                  onClick={() => setActiveTab('districts')}
                >
                  <UilIcon name="District" sizeRem={14} className="bam-pill-icon" />
                  <span className="bam-pill-label">Districts</span>
                </button>
                <button
                  className={`bam-settings-pill${activeTab === 'catalog' ? ' active' : ''}`}
                  onClick={() => setActiveTab('catalog')}
                >
                  <UilIcon name="Layers" sizeRem={14} className="bam-pill-icon" />
                  <span className="bam-pill-label">Catalog</span>
                </button>
                <button
                  className={`bam-settings-pill${activeTab === 'about' ? ' active' : ''}`}
                  onClick={() => setActiveTab('about')}
                >
                  <UilIcon name="Info" sizeRem={14} className="bam-pill-icon" />
                  <span className="bam-pill-label">About</span>
                </button>
              </div>
            </Scrollable>
          </div>

          {/* Settings Main Content Area */}
          <div className="bam-settings-pane-wrap">
            <Scrollable vertical={true} trackVisibility="scrollable" className="bam-settings-pane">
              {activeTab === 'global' && (
                <div className="bam-settings-group">
                  <div className="bam-group-title">Global Window &amp; Cache Options</div>
                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Reset Window Position &amp; Size</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="bam-setting-desc">
                          Restores BAM to its default 980 x 640 window dimensions and unmaximizes it.
                        </span>
                      </div>
                    </div>
                    <button className="bam-btn-secondary" onClick={onResetWindow}>
                      Reset Window
                    </button>
                  </div>

                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Reset Building Detail Drawer Cards</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="bam-setting-desc">
                          Restores default order and unhides all 12 building detail drawer cards.
                        </span>
                      </div>
                    </div>
                    <button className="bam-btn-secondary" onClick={resetBuildingCards}>
                      Reset Cards ({buildingCardOrder.length})
                    </button>
                  </div>

                  {/* Factory Reset */}
                  <div className="bam-group-title" style={{ marginTop: '12rem' }}>
                    Danger Zone
                  </div>
                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Factory Reset All BAM Settings</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="bam-setting-desc">
                          Clears all saved column widths, column reordering, hidden columns, dashboard cards, building drawer order, and preferences back to fresh install defaults.
                        </span>
                      </div>
                    </div>
                    <button className="bam-btn-danger" onClick={handleFactoryReset}>
                      Factory Reset
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'assets' && (
                <div className="bam-settings-group">
                  {assetSubPill === 'all' && (
                    <>
                      <div className="bam-group-title">Placed Assets Explorer Options</div>

                      {/* Show Sub-building Upgrades Toggle */}
                      <div className="bam-setting-row">
                        <div className="bam-setting-info">
                          <span className="bam-setting-name">Show Sub-Building Upgrades Badge</span>
                          <span className="bam-setting-desc">
                            Displays the "+X Upgrades" button in building name cells to inspect attached sub-building upgrades.
                          </span>
                        </div>
                        <div
                          className={`bam-toggle-switch${showUpgrades ? ' checked' : ''}`}
                          onClick={() => handleToggleUpgrades(!showUpgrades)}
                          onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleToggleUpgrades(!showUpgrades))}
                          role="button"
                          tabIndex={0}
                          title={showUpgrades ? 'Click to hide Upgrades button' : 'Click to show Upgrades button'}
                        >
                          <div className="bam-toggle-slider" />
                        </div>
                      </div>

                      {/* Show Filters Flyout Toggle */}
                      <div className="bam-setting-row">
                        <div className="bam-setting-info">
                          <span className="bam-setting-name">Show Filters Flyout Button</span>
                          <span className="bam-setting-desc">
                            Displays the floating "Filters" popout button with width, depth, corner, parking, theme, and pack filters.
                          </span>
                        </div>
                        <div
                          className={`bam-toggle-switch${showFilterFlyout ? ' checked' : ''}`}
                          onClick={() => handleToggleFilterFlyout(!showFilterFlyout)}
                          onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleToggleFilterFlyout(!showFilterFlyout))}
                          role="button"
                          tabIndex={0}
                          title={showFilterFlyout ? 'Click to hide flyout' : 'Click to show flyout'}
                        >
                          <div className="bam-toggle-slider" />
                        </div>
                      </div>

                      {/* Show Quick Subbar Controls Toggle */}
                      <div className="bam-setting-row">
                        <div className="bam-setting-info">
                          <span className="bam-setting-name">Show Quick Filter Presets Bar</span>
                          <span className="bam-setting-desc">
                            Displays quick filter preset pills (Favorites, Damaged, Turned Off, Needs Repair, High Wealth, etc.) across the top subbar.
                          </span>
                        </div>
                        <div
                          className={`bam-toggle-switch${showQuickFilterBar ? ' checked' : ''}`}
                          onClick={() => handleToggleQuickFilterBar(!showQuickFilterBar)}
                          onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleToggleQuickFilterBar(!showQuickFilterBar))}
                          role="button"
                          tabIndex={0}
                          title={showQuickFilterBar ? 'Click to hide subbar controls' : 'Click to show subbar controls'}
                        >
                          <div className="bam-toggle-slider" />
                        </div>
                      </div>

                      {/* Sub-Building Focus Target (Cohtml-safe div radio options) */}
                      <div className="bam-setting-row column-layout">
                        <div className="bam-setting-info">
                          <span className="bam-setting-name">BAM Button Click Focus Target</span>
                          <span className="bam-setting-desc">
                            Choose what opens in BAM when clicking the "BAM" button on a sub-building upgrade (e.g. clinic annex, playground, transformer):
                          </span>
                        </div>
                        <div className="bam-radio-group">
                          <div
                            className={`bam-radio-option${subBuildingTarget === 'main' ? ' active' : ''}`}
                            onClick={() => handleSubBuildingTarget('main')}
                            onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleSubBuildingTarget('main'))}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="bam-radio-indicator">
                              <div className="bam-radio-indicator-dot" />
                            </div>
                            <div className="bam-radio-text">
                              <span className="bam-radio-title">Parent Placed Building (Recommended)</span>
                              <span className="bam-radio-hint">
                                Always opens the main property building row and highlights its installed upgrades.
                              </span>
                            </div>
                          </div>

                          <div
                            className={`bam-radio-option${subBuildingTarget === 'sub' ? ' active' : ''}`}
                            onClick={() => handleSubBuildingTarget('sub')}
                            onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleSubBuildingTarget('sub'))}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="bam-radio-indicator">
                              <div className="bam-radio-indicator-dot" />
                            </div>
                            <div className="bam-radio-text">
                              <span className="bam-radio-title">Exact Sub-Building Upgrade Entity</span>
                              <span className="bam-radio-hint">
                                Loads the sub-entity directly if present in the catalog or upgrades list.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Default Row Factors Display Limits */}
                      <div className="bam-setting-row">
                        <div className="bam-setting-info">
                          <span className="bam-setting-name">Default Efficiency Factors Limit</span>
                          <span className="bam-setting-desc">
                            Initial number of efficiency factors displayed when expanding a building row drawer.
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                          {[5, 10, 0].map((lim, idx) => (
                            <button
                              key={lim}
                              className={`bam-settings-subpill${defaultEffLimit === lim ? ' active' : ''}`}
                              onClick={() => handleDefaultEffLimit(lim)}
                              style={{
                                padding: '4rem 10rem',
                                fontSize: '11rem',
                                borderRadius: '4rem',
                                marginRight: idx < 2 ? '4rem' : 0,
                              }}
                            >
                              {lim === 0 ? 'Show All' : `Top ${lim}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bam-setting-row">
                        <div className="bam-setting-info">
                          <span className="bam-setting-name">Default Happiness Factors Limit</span>
                          <span className="bam-setting-desc">
                            Initial number of resident / worker happiness factors displayed in building row details.
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
                          {[5, 10, 0, -1].map((lim, idx) => (
                            <button
                              key={lim}
                              className={`bam-settings-subpill${defaultHappyLimit === lim ? ' active' : ''}`}
                              onClick={() => handleDefaultHappyLimit(lim)}
                              style={{
                                padding: '4rem 10rem',
                                fontSize: '11rem',
                                borderRadius: '4rem',
                                marginRight: idx < 3 ? '4rem' : 0,
                              }}
                            >
                              {lim === 0 ? 'Show All' : lim < 0 ? 'Hide' : `Top ${lim}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Column Visibility & Reordering Header */}
                  <div className="bam-group-title" style={{ marginTop: assetSubPill === 'all' ? '12rem' : '0' }}>
                    {assetSubPill === 'all' ? 'Column Visibility & Order' : `${assetSubPill} Columns & Order`}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '0 0 8rem 0',
                      padding: '0 2rem',
                    }}
                  >
                    <span className="bam-setting-desc" style={{ flex: 1, minWidth: 0, lineHeight: '1.4', marginRight: '12rem' }}>
                      {assetSubPill === 'all'
                        ? 'Reorder columns using the arrow buttons, or toggle their visibility On/Off across all building pages.'
                        : `Configure column order and visibility specifically for the ${assetSubPill} view.`}
                    </span>
                    <button className="bam-btn-secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={resetAssetColumns}>
                      {assetSubPill === 'all' ? 'Reset All Columns' : `Reset ${assetSubPill} Columns`}
                    </button>
                  </div>

                  {/* Column Manager List */}
                  <div className="bam-col-manager-list two-col">
                    {(() => {
                      const currentOrder = colOrderByPill[assetSubPill] || assetColumnOrder;
                      const pillCols = currentOrder.filter((colKey) =>
                        PILL_COLUMNS_MAP[assetSubPill].includes(colKey)
                      );
                      PILL_COLUMNS_MAP[assetSubPill].forEach((colKey) => {
                        const typedKey = colKey as (typeof pillCols)[number];
                        if (!pillCols.includes(typedKey)) {
                          const actIdx = pillCols.indexOf('actions');
                          if (actIdx >= 0) pillCols.splice(actIdx, 0, typedKey);
                          else pillCols.push(typedKey);
                        }
                      });
                      return pillCols.map((colKey, pillIndex) => {
                        const meta = ASSET_COLUMN_METAS[colKey] || {
                          key: colKey,
                          label: colKey,
                          desc: '',
                        };
                        const isVisible = isAssetColVisible(colKey);
                        const isFirst = pillIndex === 0;
                        const isLast = pillIndex === pillCols.length - 1;

                        return (
                          <div key={colKey} className={`bam-col-manager-item${!isVisible ? ' disabled' : ''}`}>
                            <div className="bam-col-drag-handles">
                              <button
                                className={`bam-col-order-btn${isFirst ? ' disabled' : ''}`}
                                onClick={() => !isFirst && moveAssetColumn(colKey, 'up')}
                                title={isFirst ? 'First column' : 'Move column left / up'}
                              >
                                <UilIcon name="ArrowUp" sizeRem={8} />
                              </button>
                              <button
                                className={`bam-col-order-btn${isLast ? ' disabled' : ''}`}
                                onClick={() => !isLast && moveAssetColumn(colKey, 'down')}
                                title={isLast ? 'Last column' : 'Move column right / down'}
                              >
                                <UilIcon name="ArrowDown" sizeRem={8} />
                              </button>
                            </div>

                            <div className="bam-col-meta">
                              <span className="bam-col-title">
                                {meta.label}
                                {meta.fixed && <span className="bam-col-fixed-badge">Fixed Primary</span>}
                              </span>
                              <span className="bam-col-subtitle">{meta.desc}</span>
                            </div>

                            {!meta.fixed ? (
                              <div
                                className={`bam-toggle-switch${isVisible ? ' checked' : ''}`}
                                onClick={() => toggleAssetColumn(colKey)}
                                onKeyDown={(e) => handleRoleButtonKeyDown(e, () => toggleAssetColumn(colKey))}
                                role="button"
                                tabIndex={0}
                                title={isVisible ? `Click to hide ${meta.label}` : `Click to show ${meta.label}`}
                              >
                                <div className="bam-toggle-slider" />
                              </div>
                            ) : (
                              <span style={{ fontSize: '10rem', color: '#64748b', fontWeight: 600 }}>Always Visible</span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Building Detail Drawer Cards Management */}
                  <div className="bam-group-title" style={{ marginTop: '14rem' }}>
                    Building Detail Drawer Cards
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '0 0 8rem 0',
                      padding: '0 2rem',
                    }}
                  >
                    <span className="bam-setting-desc" style={{ flex: 1, minWidth: 0, lineHeight: '1.4', marginRight: '12rem' }}>
                      Reorder building operational cards or toggle visibility. Hidden cards will not be rendered in the expanded row drawer.
                    </span>
                    <button className="bam-btn-secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={resetBuildingCards}>
                      Reset Cards
                    </button>
                  </div>

                  <div className="bam-col-manager-list two-col">
                    {(() => {
                      const allowedCards = PILL_CARDS_MAP[assetSubPill] || DEFAULT_BUILDING_CARD_ORDER;
                      const pillCards = buildingCardOrder.filter((c) => allowedCards.includes(c));
                      return pillCards.map((cardKey, pillIndex) => {
                      const meta = BUILDING_CARD_METAS[cardKey] || { key: cardKey, label: cardKey, desc: '' };
                      const isVisible = !hiddenBuildingCards.has(cardKey);
                      const isFirst = pillIndex === 0;
                      const isLast = pillIndex === pillCards.length - 1;

                      return (
                        <div key={cardKey} className={`bam-col-manager-item${!isVisible ? ' disabled' : ''}`}>
                          <div className="bam-col-drag-handles">
                            <button
                              className={`bam-col-order-btn${isFirst ? ' disabled' : ''}`}
                              onClick={() => !isFirst && moveBuildingCard(cardKey, 'up')}
                              title={isFirst ? 'First card' : 'Move card up / left'}
                            >
                              <UilIcon name="ArrowUp" sizeRem={8} />
                            </button>
                            <button
                              className={`bam-col-order-btn${isLast ? ' disabled' : ''}`}
                              onClick={() => !isLast && moveBuildingCard(cardKey, 'down')}
                              title={isLast ? 'Last card' : 'Move card down / right'}
                            >
                              <UilIcon name="ArrowDown" sizeRem={8} />
                            </button>
                          </div>

                          <div className="bam-col-meta">
                            <span className="bam-col-title">{meta.label}</span>
                            <span className="bam-col-subtitle">{meta.desc}</span>
                          </div>

                          <div
                            className={`bam-toggle-switch${isVisible ? ' checked' : ''}`}
                            onClick={() => toggleBuildingCard(cardKey)}
                            onKeyDown={(e) => handleRoleButtonKeyDown(e, () => toggleBuildingCard(cardKey))}
                            role="button"
                            tabIndex={0}
                            title={isVisible ? `Click to hide ${meta.label}` : `Click to show ${meta.label}`}
                          >
                            <div className="bam-toggle-slider" />
                          </div>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'matrices' && (
                <div className="bam-settings-group">
                  <div className="bam-group-title">Active Matrix Categories</div>
                  <span className="bam-setting-desc" style={{ display: 'block', margin: '0 0 8rem 0' }}>
                    Enable or disable individual Zone, Storage, Services, and Signature Landmark matrices (including modded zones) across Districts and Explorer views.
                  </span>

                  <div className="bam-setting-grid-2col">
                    {renderZoneToggleRow(
                      'Residential',
                      'Low, Row, Medium, High, Low Rent, Mixed & custom Residential mod zones (Default: ON).',
                      'enableHousing',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Commercial',
                      'Low, Medium, High, Row/Mixed, Signatures, Ground-Floor Shops & mod zones (Default: ON).',
                      'enableCommercial',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Office',
                      'Low, Medium, High, Mixed, Signature Offices & custom Office mod zones (Default: ON).',
                      'enableOffice',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Industrial',
                      'Manufacturing, Specialized Extractors, Storage & custom Industrial mod zones (Default: ON).',
                      'enableIndustrial',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Storage',
                      'Warehouses, Depots, Silos, Tanks, Yards, Signature Storage & custom Storage mods (Default: ON).',
                      'enableStorage',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Services',
                      'Health, Fire, Police, Education, Power, Water, Waste, Transit, Parks, Comms & mod services (Default: ON).',
                      'enableService',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Signature Landmarks',
                      'Unique Residential, Commercial, Office, Industrial & mod Signature Landmarks with unlocked library counts (Default: ON).',
                      'enableSignature',
                      true
                    )}
                  </div>

                  <div className="bam-group-title" style={{ marginTop: '8rem' }}>
                    Districts Placement &amp; Display Modes
                  </div>
                  <div className="bam-setting-grid-2col">
                    {renderZoneToggleRow(
                      'Matrices in Districts Details',
                      'Show collapsible matrices inside expanded City-Wide and District rows (Default: ON).',
                      'inDistricts',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Districts Sub-View Switcher',
                      'Add [Districts & Policies | Zoning Matrices] switcher above Districts table (Default: ON).',
                      'subviewMode',
                      true
                    )}
                    <div className="bam-setting-card-half">
                      <div className="bam-setting-info">
                        <span className="bam-setting-name">Districts Details Layout</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="bam-setting-desc">
                            Switch tabs cleanly or stack all enabled matrices vertically.
                          </span>
                        </div>
                      </div>
                      <div className="bam-view-mode-toggle">
                        <button
                          className={`bam-view-mode-btn${zoneSettings.districtsLayout === 'switcher' ? ' active' : ''}`}
                          onClick={() => setZoneSettings(writeZoneMatrixSetting('districtsLayout', 'switcher'))}
                        >
                          Switcher
                        </button>
                        <button
                          className={`bam-view-mode-btn${zoneSettings.districtsLayout === 'stacked' ? ' active' : ''}`}
                          onClick={() => setZoneSettings(writeZoneMatrixSetting('districtsLayout', 'stacked'))}
                        >
                          Stacked
                        </button>
                      </div>
                    </div>
                    <div className="bam-setting-card-half">
                      <div className="bam-setting-info">
                        <span className="bam-setting-name">Housing Density Tier</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="bam-setting-desc">
                            Standard (4 consolidated tiers) or Detailed (6 sub-zone rows).
                          </span>
                        </div>
                      </div>
                      <div className="bam-view-mode-toggle">
                        <button
                          className={`bam-view-mode-btn${housingMatrixMode === 'standard' ? ' active' : ''}`}
                          onClick={() => {
                            writeHousingDensityMode('standard');
                            setHousingMatrixMode('standard');
                          }}
                        >
                          Standard (4)
                        </button>
                        <button
                          className={`bam-view-mode-btn${housingMatrixMode === 'detailed' ? ' active' : ''}`}
                          onClick={() => {
                            writeHousingDensityMode('detailed');
                            setHousingMatrixMode('detailed');
                          }}
                        >
                          Detailed (6)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bam-group-title" style={{ marginTop: '8rem' }}>
                    Top-Level Navigation Matrix Tabs
                  </div>
                  {renderZoneToggleRow(
                    'Unified "Zone Matrices" Top Tab',
                    'Add a single top-level Zone Matrices tab with Housing, Commercial, Office, Industrial, Storage, Services & Signature switchers (Default: ON).',
                    'topTabUnified'
                  )}
                  <div className="bam-setting-grid-2col">
                    {renderZoneToggleRow(
                      'Standalone "Housing" Tab',
                      'Dedicated Housing matrix tab in top nav bar (Default: OFF).',
                      'topTabHousing',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Standalone "Commercial Matrix"',
                      'Dedicated Commercial Matrix tab in top nav bar (Default: OFF).',
                      'topTabCommercial',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Standalone "Office Matrix"',
                      'Dedicated Office Matrix tab in top nav bar (Default: OFF).',
                      'topTabOffice',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Standalone "Industrial Matrix"',
                      'Dedicated Industrial Matrix tab in top nav bar (Default: OFF).',
                      'topTabIndustrial',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Standalone "Storage Matrix"',
                      'Dedicated Storage Matrix tab in top nav bar (Default: OFF).',
                      'topTabStorage',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Standalone "Services Matrix"',
                      'Dedicated Services Matrix tab in top nav bar (Default: OFF).',
                      'topTabService',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Standalone "Signature Matrix"',
                      'Dedicated Signature Landmarks matrix tab in top nav bar (Default: OFF).',
                      'topTabSignature',
                      true
                    )}
                  </div>

                  <div className="bam-group-title" style={{ marginTop: '8rem' }}>
                    Inline Explorer Matrix Headers (Above Tables)
                  </div>
                  <div className="bam-setting-grid-2col">
                    {renderZoneToggleRow(
                      'Header on Residential Tab',
                      'Pin compact Housing Matrix above Residential table (Default: ON).',
                      'inResidential',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Header on Commercial Tab',
                      'Pin compact Commercial Matrix above Commercial table (Default: ON).',
                      'inCommercial',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Header on Office Tab',
                      'Pin compact Office Matrix above Office table (Default: ON).',
                      'inOffice',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Header on Industrial Tab',
                      'Pin compact Industrial Matrix above Industrial table (Default: ON).',
                      'inIndustrial',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Header on Storage Tab',
                      'Pin compact Storage Matrix above Storage table (Default: ON).',
                      'inStorage',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Header on Services Tab',
                      'Pin compact Services Matrix above Services table (Default: ON).',
                      'inService',
                      true
                    )}
                    {renderZoneToggleRow(
                      'Header on Signature Tab',
                      'Pin compact Signature Landmarks Matrix above Signatures table (Default: ON).',
                      'inSignature',
                      true
                    )}
                  </div>

                  <div className="bam-group-title" style={{ marginTop: '8rem' }}>
                    Special Inclusions &amp; Reset
                  </div>
                  {renderZoneToggleRow(
                    'Include Mixed-Use Ground Floor in Commercial Matrix',
                    'Show Mixed Housing downstairs retail shops (commercial jobs) inside the Commercial Matrix (Default: ON).',
                    'includeMixedGroundFloor'
                  )}
                  {renderZoneToggleRow(
                    'Include Extractors & Storage in Industrial Matrix',
                    'Include Specialized Industry extractors and Storage warehouses inside the Industrial Matrix (Default: ON).',
                    'includeIndustrialSpecials'
                  )}
                  {renderZoneToggleRow(
                    'Include Service Upgrades & Extensions in Services Matrix',
                    'Track installed building upgrades (+upg) in Services telemetry and include standalone service sub-buildings (Default: ON).',
                    'includeServiceUpgrades'
                  )}

                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Reset Matrix Settings</span>
                      <span className="bam-setting-desc">
                        Restore all Matrix enables, placements, layouts, and special inclusions to default.
                      </span>
                    </div>
                    <button
                      className="bam-btn-secondary"
                      onClick={handleResetMatrixSettings}
                    >
                      Reset Matrices
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'districts' && (
                <div className="bam-settings-group">
                  <div className="bam-group-title">Districts &amp; Analytics Options</div>

                  {/* District Display Mode & Policy Controls */}
                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Analytics View Display Mode</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="bam-setting-desc">
                          Choose between interactive modular cards or a dense compact statistics grid in the district analytics dashboard.
                        </span>
                      </div>
                    </div>
                    <div className="bam-view-mode-toggle">
                      <button
                        className={`bam-view-mode-btn${districtViewMode === 'cards' ? ' active' : ''}`}
                        onClick={() => handleSetDistrictViewMode('cards')}
                      >
                        Cards
                      </button>
                      <button
                        className={`bam-view-mode-btn${districtViewMode === 'compact' ? ' active' : ''}`}
                        onClick={() => handleSetDistrictViewMode('compact')}
                      >
                        Compact
                      </button>
                    </div>
                  </div>

                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Show Policy Controls</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="bam-setting-desc">
                          Show ordinance toggles and Policy Plus controls when expanding a district row.
                        </span>
                      </div>
                    </div>
                    <div
                      className={`bam-toggle-switch${showPoliciesInExpanded ? ' checked' : ''}`}
                      onClick={() => handleToggleShowPolicies(!showPoliciesInExpanded)}
                      onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleToggleShowPolicies(!showPoliciesInExpanded))}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="bam-toggle-slider" />
                    </div>
                  </div>

                  {/* District Analytics Cards Visibility */}
                  <div className="bam-group-title" style={{ marginTop: '8rem' }}>
                    District Dashboard Cards Visibility
                  </div>
                  <span className="bam-setting-desc" style={{ display: 'block', margin: '0 0 8rem 0' }}>
                    Toggle which analytical cards appear in the district details and city-wide overview.
                  </span>

                  <div className="bam-col-manager-list two-col">
                    {Object.keys(DISTRICT_CARD_METAS).map((cKey) => {
                      const meta = DISTRICT_CARD_METAS[cKey];
                      const isVis = !hiddenDistrictCards.has(cKey);
                      return (
                        <div key={cKey} className={`bam-col-manager-item${!isVis ? ' disabled' : ''}`}>
                          <div className="bam-col-meta">
                            <span className="bam-col-title">{meta.label}</span>
                            <span className="bam-col-subtitle">{meta.desc}</span>
                          </div>
                          <div
                            className={`bam-toggle-switch${isVis ? ' checked' : ''}`}
                            onClick={() => handleToggleDistrictCard(cKey)}
                            onKeyDown={(e) => handleRoleButtonKeyDown(e, () => handleToggleDistrictCard(cKey))}
                            role="button"
                            tabIndex={0}
                            title={isVis ? `Hide ${meta.label}` : `Show ${meta.label}`}
                          >
                            <div className="bam-toggle-slider" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Column Visibility & Order for Districts */}
                  <div className="bam-group-title" style={{ marginTop: '12rem' }}>
                    District Overview Table Columns &amp; Order
                  </div>
                  <span className="bam-setting-desc" style={{ display: 'block', margin: '0 0 8rem 0' }}>
                    Reorder district columns using the arrow buttons, or toggle column visibility On/Off in the district table.
                  </span>

                  <div className="bam-col-manager-list two-col">
                    {(() => {
                      const sortedCols = [...DISTRICT_COLUMNS].sort((a, b) => {
                        const idxA = districtColOrder.indexOf(a.key);
                        const idxB = districtColOrder.indexOf(b.key);
                        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                      });

                      return sortedCols.map((col, index) => {
                        const isVisible = !hiddenDistrictColumns.has(col.key);
                        const isFirst = index === 0;
                        const isLast = index === sortedCols.length - 1;

                        return (
                          <div key={col.key} className={`bam-col-manager-item${!isVisible ? ' disabled' : ''}`}>
                            <div className="bam-col-drag-handles">
                              <button
                                className={`bam-col-order-btn${isFirst ? ' disabled' : ''}`}
                                onClick={() => !isFirst && moveDistrictColumn(col.key, 'up')}
                                title={isFirst ? 'First column' : 'Move column left / up'}
                              >
                                <UilIcon name="ArrowUp" sizeRem={8} />
                              </button>
                              <button
                                className={`bam-col-order-btn${isLast ? ' disabled' : ''}`}
                                onClick={() => !isLast && moveDistrictColumn(col.key, 'down')}
                                title={isLast ? 'Last column' : 'Move column right / down'}
                              >
                                <UilIcon name="ArrowDown" sizeRem={8} />
                              </button>
                            </div>

                            <div className="bam-col-meta">
                              <span className="bam-col-title">
                                {col.label}
                                {col.fixed && <span className="bam-col-fixed-badge">Fixed Primary</span>}
                              </span>
                              <span className="bam-col-subtitle">{col.desc}</span>
                            </div>

                            {!col.fixed ? (
                              <div
                                className={`bam-toggle-switch${isVisible ? ' checked' : ''}`}
                                onClick={() => toggleDistrictColumn(col.key)}
                                onKeyDown={(e) => handleRoleButtonKeyDown(e, () => toggleDistrictColumn(col.key))}
                                role="button"
                                tabIndex={0}
                                title={isVisible ? `Click to hide ${col.label}` : `Click to show ${col.label}`}
                              >
                                <div className="bam-toggle-slider" />
                              </div>
                            ) : (
                              <span style={{ fontSize: '10rem', color: '#64748b', fontWeight: 600 }}>Always Visible</span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="bam-setting-row" style={{ marginTop: '8rem' }}>
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Reset District Table Columns</span>
                      <span className="bam-setting-desc">
                        Restores all district overview table column order, widths and visibility to their defaults.
                      </span>
                    </div>
                    <button
                      className="bam-btn-secondary"
                      onClick={() => {
                        try {
                          const defOrder = [...DEFAULT_DISTRICT_COL_ORDER];
                          bamStorage.removeItem('bam_district_col_widths');
                          bamStorage.removeItem('bam_hidden_columns_districts');
                          bamStorage.setItem('bam_district_col_order', JSON.stringify(defOrder));
                          setHiddenDistrictColumns(new Set());
                          setDistrictColOrder(defOrder);
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'hiddenColumnsDistricts', value: [] } }));
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'districtColumnOrder', value: defOrder } }));
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'districtColWidthsReset' } }));
                          window.dispatchEvent(new Event('storage'));
                        } catch (err) { logCatch('BamSettingsModal', err); }
                      }}
                    >
                      Reset Columns
                    </button>
                  </div>

                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Reset Analytics Card Order</span>
                      <span className="bam-setting-desc">
                        Restores the default arrangement and expand state of analytics cards in the district dashboard.
                      </span>
                    </div>
                    <button
                      className="bam-btn-secondary"
                      onClick={() => {
                        try {
                          bamStorage.removeItem('bam_district_card_order');
                          bamStorage.removeItem('bam_dist_collapsed_cards');
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'districtCardOrderReset' } }));
                          window.dispatchEvent(new Event('storage'));
                          apiSafe.requestRefresh();
                        } catch (err) { logCatch('BamSettingsModal', err); }
                      }}
                    >
                      Reset Cards
                    </button>
                  </div>

                  <div className="bam-setting-row">
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Restore All Hidden Cards</span>
                      <span className="bam-setting-desc">
                        Unhides any analytics cards that were dismissed using the card hide button.
                      </span>
                    </div>
                    <button
                      className="bam-btn-secondary"
                      onClick={() => {
                        try {
                          bamStorage.removeItem('bam_dist_hidden_cards');
                          bamStorage.removeItem('bam_districts_hidden_cards');
                          bamStorage.removeItem('bam_district_hidden_cards');
                          setHiddenDistrictCards(new Set());
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'hiddenDistrictCards', value: [] } }));
                          window.dispatchEvent(new Event('storage'));
                          apiSafe.requestRefresh();
                        } catch (err) { logCatch('BamSettingsModal', err); }
                      }}
                    >
                      Restore Cards
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'catalog' && (
                <div className="bam-settings-group">
                  <div className="bam-group-title">Prefab Catalog Options</div>

                  {/* Column Visibility & Order for Catalog */}
                  <div className="bam-group-title" style={{ marginTop: '4rem' }}>
                    Catalog Table Columns &amp; Order
                  </div>
                  <span className="bam-setting-desc" style={{ display: 'block', margin: '0 0 8rem 0' }}>
                    Reorder prefab catalog columns using the arrow buttons, or toggle visibility On/Off in the catalog table.
                  </span>

                  <div className="bam-col-manager-list two-col">
                    {(() => {
                      const catalogKeys: ColumnKey[] = CATALOG_COLUMNS.map((c) => c.key as ColumnKey);
                      const orderedCatalogCols: ColumnKey[] = catalogColOrder.filter((k) => catalogKeys.includes(k));
                      catalogKeys.forEach((k) => {
                        if (!orderedCatalogCols.includes(k)) orderedCatalogCols.push(k);
                      });

                      return orderedCatalogCols.map((colKey, index) => {
                        const col = CATALOG_COLUMNS.find((c) => c.key === colKey) || {
                          key: colKey,
                          label: colKey,
                          desc: '',
                        };
                        const isVisible = !hiddenCatalogColumns.has(colKey);
                        const isFirst = index === 0;
                        const isLast = index === orderedCatalogCols.length - 1;

                        return (
                          <div key={colKey} className={`bam-col-manager-item${!isVisible ? ' disabled' : ''}`}>
                            <div className="bam-col-drag-handles">
                              <button
                                className={`bam-col-order-btn${isFirst ? ' disabled' : ''}`}
                                onClick={() => !isFirst && moveCatalogColumn(colKey, 'up')}
                                title={isFirst ? 'First column' : 'Move column left / up'}
                              >
                                <UilIcon name="ArrowUp" sizeRem={8} />
                              </button>
                              <button
                                className={`bam-col-order-btn${isLast ? ' disabled' : ''}`}
                                onClick={() => !isLast && moveCatalogColumn(colKey, 'down')}
                                title={isLast ? 'Last column' : 'Move column right / down'}
                              >
                                <UilIcon name="ArrowDown" sizeRem={8} />
                              </button>
                            </div>

                            <div className="bam-col-meta">
                              <span className="bam-col-title">
                                {col.label}
                                {col.fixed && <span className="bam-col-fixed-badge">Fixed Primary</span>}
                              </span>
                              <span className="bam-col-subtitle">{col.desc}</span>
                            </div>

                            {!col.fixed ? (
                              <div
                                className={`bam-toggle-switch${isVisible ? ' checked' : ''}`}
                                onClick={() => toggleCatalogColumn(colKey)}
                                onKeyDown={(e) => handleRoleButtonKeyDown(e, () => toggleCatalogColumn(colKey))}
                                role="button"
                                tabIndex={0}
                                title={isVisible ? `Click to hide ${col.label}` : `Click to show ${col.label}`}
                              >
                                <div className="bam-toggle-slider" />
                              </div>
                            ) : (
                              <span style={{ fontSize: '10rem', color: '#64748b', fontWeight: 600 }}>Always Visible</span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="bam-setting-row" style={{ marginTop: '8rem' }}>
                    <div className="bam-setting-info">
                      <span className="bam-setting-name">Reset Catalog Columns</span>
                      <span className="bam-setting-desc">
                        Restores all prefab catalog table column widths, order, and visibility to default specifications.
                      </span>
                    </div>
                    <button
                      className="bam-btn-secondary"
                      onClick={() => {
                        try {
                          bamStorage.removeItem('bam_table_column_widths_v2');
                          bamStorage.removeItem('bam_table_column_widths_v3');
                          bamStorage.removeItem('bam_hidden_columns_catalog');
                          bamStorage.removeItem('bam_catalog_col_order');
                          setHiddenCatalogColumns(new Set());
                          const defaultCatalogOrder = CATALOG_COLUMNS.map((c) => c.key as ColumnKey);
                          setCatalogColOrder(defaultCatalogOrder);
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'hiddenColumnsCatalog', value: [] } }));
                          window.dispatchEvent(new CustomEvent('bam-settings-changed', { detail: { key: 'catalogColumnOrder', value: defaultCatalogOrder } }));
                          window.dispatchEvent(new CustomEvent('bam-reset-asset-columns'));
                        } catch (err) { logCatch('BamSettingsModal', err); }
                      }}
                    >
                      Reset Columns
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="bam-settings-group">
                  <div className="bam-about-hero">
                    <div className="bam-about-hero-top">
                      <div className="bam-about-logo-badge">
                        <UilIcon name="Building" sizeRem={22} />
                      </div>
                      <div className="bam-about-title-col">
                        <div className="bam-about-title">{BAM_RELEASE_NAME}</div>
                        <div className="bam-about-subtitle">
                          Live Cities: Skylines II ECS explorer, building &amp; zone diagnostics, district policy manager,
                          and catalog plopping suite.
                        </div>
                      </div>
                    </div>
                    <div className="bam-about-badges">
                      <span className="bam-about-badge accent">{`v${BAM_VERSION}`}</span>
                      <span className="bam-about-badge">{`Author: ${BAM_AUTHOR}`}</span>
                      <span className="bam-about-badge">{`Paradox Mods #${BAM_MOD_ID}`}</span>
                      <span className="bam-about-badge">{`Built ${BAM_BUILD_YEAR}`}</span>
                    </div>
                  </div>

                  <div className="bam-group-title">Mod Details &amp; Ecosystem</div>
                  <div className="bam-setting-grid-2col" style={{ marginBottom: '6rem' }}>
                    <div className="bam-about-info-row half">
                      <span className="bam-about-info-key">Version &amp; Author</span>
                      <span className="bam-about-info-val">{`v${BAM_VERSION} by ${BAM_AUTHOR}`}</span>
                    </div>
                    <div className="bam-about-info-row half">
                      <span className="bam-about-info-key">Icon Libraries</span>
                      <span className="bam-about-info-val">UIL (74417), Asset Icon Library (79634)</span>
                    </div>
                  </div>
                  <div className="bam-about-info-row" style={{ marginBottom: '10rem' }}>
                    <span className="bam-about-info-key">Game Options, Keybinds &amp; CSV Exports</span>
                    <span className="bam-about-info-val">CS2 Options -&gt; Advanced Building &amp; Asset Manager</span>
                  </div>

                  <div className="bam-group-title">Core Capabilities</div>
                  <div className="bam-setting-grid-2col" style={{ marginBottom: '6rem' }}>
                    <div className="bam-about-feature-card half">
                      <div className="bam-about-feature-icon">
                        <UilIcon name="Search" sizeRem={14} />
                      </div>
                      <div className="bam-about-feature-body">
                        <div className="bam-about-feature-title">Unified Asset Explorer &amp; Inspector</div>
                        <div className="bam-about-feature-desc">
                          Browse placed buildings, city services, signatures, storage warehouses, and catalog prefabs with
                          custom columns, PLOP/CLONE actions, and breakdowns.
                        </div>
                      </div>
                    </div>
                    <div className="bam-about-feature-card half">
                      <div className="bam-about-feature-icon">
                        <UilIcon name="Layers" sizeRem={14} />
                      </div>
                      <div className="bam-about-feature-body">
                        <div className="bam-about-feature-title">Zone, Services &amp; Signature Matrices</div>
                        <div className="bam-about-feature-desc">
                          Interactive Residential, Commercial, Office, Industrial, Storage, Services &amp; Signature
                          Density x Theme/Pack matrices with click-to-filter drill-downs.
                        </div>
                      </div>
                    </div>
                    <div className="bam-about-feature-card half">
                      <div className="bam-about-feature-icon">
                        <UilIcon name="District" sizeRem={14} />
                      </div>
                      <div className="bam-about-feature-body">
                        <div className="bam-about-feature-title">District Dashboard &amp; Policies</div>
                        <div className="bam-about-feature-desc">
                          Reorderable district cards covering happiness factors, demographics, workforce education, utilities,
                          and fast district/city policy cloning.
                        </div>
                      </div>
                    </div>
                    <div className="bam-about-feature-card half">
                      <div className="bam-about-feature-icon">
                        <UilIcon name="Info" sizeRem={14} />
                      </div>
                      <div className="bam-about-feature-body">
                        <div className="bam-about-feature-title">Shortcuts &amp; Quick Navigation</div>
                        <div className="bam-about-feature-desc">
                          <span>Press </span>
                          <span className="bam-about-shortcut-kbd">/</span>
                          <span> or </span>
                          <span className="bam-about-shortcut-kbd">Ctrl+F</span>
                          <span> to search, </span>
                          <span className="bam-about-shortcut-kbd">Esc</span>
                          <span> to clear/close, or click Open in BAM from any Selected Info Panel.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bam-group-title">Community &amp; Links</div>
                  <div className="bam-about-links-row">
                    <button
                      type="button"
                      className="bam-about-link-btn"
                      onClick={() => apiSafe.openExternalUrl(BAM_PARADOX_MODS_URL)}
                    >
                      <UilIcon name="Globe" sizeRem={13} className="bam-pill-icon" />
                      <span>{`Paradox Mods (#${BAM_MOD_ID})`}</span>
                    </button>
                    <button
                      type="button"
                      className="bam-about-link-btn"
                      onClick={() => apiSafe.openExternalUrl(BAM_FORUM_THREAD_URL)}
                    >
                      <UilIcon name="Info" sizeRem={13} className="bam-pill-icon" />
                      <span>Paradox Forum Thread</span>
                    </button>
                    <button
                      type="button"
                      className="bam-about-link-btn"
                      onClick={() => apiSafe.openExternalUrl(BAM_GITHUB_REPO_URL)}
                    >
                      <UilIcon name="Tools" sizeRem={13} className="bam-pill-icon" />
                      <span>GitHub Repository</span>
                    </button>
                  </div>
                </div>
              )}
            </Scrollable>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BamSettingsModal;
