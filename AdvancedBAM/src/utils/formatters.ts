import { logCatch } from './devWarn';
/**
 * Centralized text, label, enum, localization fallback, currency, and pluralization formatters.
 * Ensures zero raw PascalCase strings, zero unresolved Assets.NAME[...] keys,
 * consistent currency formatting (-¢1,234), and proper singular/plural grammar.
 */

export type TranslateFn = (id: string, fallback?: string | null) => string | null;

const FORMAT_CACHE_LIMIT = 4096;
function memoizeFormat(cache: Map<string, string>, key: string, compute: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const val = compute();
  if (cache.size >= FORMAT_CACHE_LIMIT) cache.clear();
  cache.set(key, val);
  return val;
}

const _splitPascalCache = new Map<string, string>();
const _resourceLabelCache = new Map<string, string>();
const _leisureTypeCache = new Map<string, string>();
const _factorLabelCache = new Map<string, string>();
const _effectStringCache = new Map<string, string>();

/**
 * Splits PascalCase / camelCase / underscored / hyphenated internal identifiers into clean spaced words.
 * Examples:
 * - "ConvenienceFood" -> "Convenience Food"
 * - "NAOffice" -> "NA Office"
 * - "NotEnoughEmployees" -> "Not Enough Employees"
 */
export function splitPascalCase(raw?: string | null): string {
  if (!raw) return '';
  const rawStr = String(raw);
  return memoizeFormat(_splitPascalCache, rawStr, () => {
    let s = rawStr.trim();
    if (!s) return '';

    // Replace underscores with spaces
    s = s.replace(/_+/g, ' ');
    // Split acronym followed by Capital+lowercase: "NAOffice" -> "NA Office", "TVTower" -> "TV Tower"
    s = s.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
    // Split lowercase/digit followed by Capital: "GettingBy" -> "Getting By"
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    // Collapse multiple spaces
    return s.replace(/\s+/g, ' ').trim();
  });
}

/**
 * Resolves raw CS2 localization keys like "Assets.NAME[Office_SoftwareCompany]" or "Policy.TITLE[...]"
 * using CS2's translate() if available, with a clean human-readable fallback.
 */
export function resolveLocalizedString(raw?: string | null, translate?: TranslateFn): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // Try CS2 localization if it looks like a key (e.g. Assets.NAME[...] or Policy.TITLE[...])
  if (translate && (trimmed.includes('[') || trimmed.includes('.'))) {
    try {
      const translated = translate(trimmed, null);
      if (translated && translated !== trimmed && !translated.includes('[')) {
        return translated.trim();
      }
    } catch {
      // Fall through to clean extraction
    }
  }

  // Extract bracketed payload if unresolved: Assets.NAME[Office_SoftwareCompany] -> Office_SoftwareCompany
  const bracketMatch = trimmed.match(/^[A-Za-z0-9_.]+\[([^\]]+)\]$/);
  if (bracketMatch && bracketMatch[1]) {
    let inner = bracketMatch[1].trim();
    // Try Assets.NAME[...] if another prefix was passed
    if (translate && !trimmed.startsWith('Assets.NAME[')) {
      try {
        const alt = translate(`Assets.NAME[${inner}]`, null);
        if (alt && !alt.includes('[')) return alt.trim();
      } catch (err) { logCatch('formatters', err); }
    }
    // Strip internal category prefixes on company/building prefabs
    inner = inner.replace(/^(Office|Industrial|Commercial|Residential|Extractor|Storage|Service|PP|DP|Policy)_+/i, '');
    return splitPascalCase(inner);
  }

  return trimmed;
}

const RESOURCE_DISPLAY_OVERRIDES: Record<string, string> = {
  noresource: '—',
  none: '—',
  conveniencefood: 'Convenience Food',
  unsortedmail: 'Unsorted Mail',
  localmail: 'Local Mail',
  outgoingmail: 'Outgoing Mail',
  crudeoil: 'Crude Oil',
  petrochemicals: 'Petrochemicals',
  pharmaceuticals: 'Pharmaceuticals',
};

/**
 * Formats any CS2 economy Resource identifier into a clean display label.
 */
export function formatResourceLabel(raw?: string | null): string {
  if (!raw) return '—';
  const rawStr = String(raw);
  return memoizeFormat(_resourceLabelCache, rawStr, () => {
    let clean = rawStr.trim();
    if (!clean) return '—';

    // Handle "ConvenienceFood Facility" or compound strings
    if (clean.endsWith(' Facility')) {
      const base = clean.slice(0, -' Facility'.length).trim();
      const formattedBase = formatResourceLabel(base);
      return formattedBase === '—' ? 'Facility' : `${formattedBase} Facility`;
    }

    if (clean.toLowerCase().startsWith('c_')) clean = clean.slice(2);
    if (clean.toLowerCase().startsWith('in:')) clean = clean.slice(3).trim();
    if (clean.toLowerCase().startsWith('out:')) clean = clean.slice(4).trim();

    const key = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (RESOURCE_DISPLAY_OVERRIDES[key]) return RESOURCE_DISPLAY_OVERRIDES[key];

    return splitPascalCase(clean);
  });
}

const SUBCATEGORY_OVERRIDES: Record<string, string> = {
  citybeach: 'Beach Recreation',
  cityindoors: 'Indoor Recreation',
  citypark: 'Outdoor Recreation',
  residentiallowrent: 'Low Rent Housing',
  lowrent: 'Low Rent Housing',
  rowhousing: 'Row Housing',
};

/**
 * Formats raw zone or service SubCategory strings (e.g. "Pack9-OfficeHighZone", "UbPr Residential Mixed", "CityBeach").
 */
export function formatSubCategory(raw?: string | null, translate?: TranslateFn): string {
  if (!raw) return '';
  let s = resolveLocalizedString(raw, translate);
  if (!s) return '';

  const compact = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (SUBCATEGORY_OVERRIDES[compact]) return SUBCATEGORY_OVERRIDES[compact];

  // Clean pack prefixes like "Pack9-OfficeHighZone" or "UbPr Residential Mixed"
  s = s.replace(/^Pack\d+[-_\s]*/i, '');
  s = s.replace(/^(UbPr|MP\d+|CP\d+|DLC\d*)[-_\s]+/i, '');
  s = s.replace(/Zone$/i, '');

  // Friendly zone patterns
  const cleanKey = s.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanKey === 'officehigh') return 'High Density Office';
  if (cleanKey === 'officelow') return 'Low Density Office';
  if (cleanKey === 'residentialmixed') return 'Mixed Housing';
  if (cleanKey === 'residentiallowrent') return 'Low Rent Housing';
  if (cleanKey === 'residentialhigh') return 'High Density Housing';
  if (cleanKey === 'residentialmedium') return 'Medium Density Housing';
  if (cleanKey === 'residentialrow') return 'Row Housing';
  if (cleanKey === 'residentiallow') return 'Low Density Housing';
  if (cleanKey === 'commercialhigh') return 'High Density Commercial';
  if (cleanKey === 'commerciallow') return 'Low Density Commercial';

  return splitPascalCase(s.replace(/-+/g, ' '));
}

/**
 * Formats CS2 LeisureType enum names cleanly.
 */
export function formatLeisureType(raw?: string | null): string {
  if (!raw) return '';
  const rawStr = String(raw);
  return memoizeFormat(_leisureTypeCache, rawStr, () => {
    const k = rawStr.trim().toLowerCase().replace(/[^a-z]/g, '');
    switch (k) {
      case 'citypark':
      case 'outdoorrecreation':
        return 'Outdoor Recreation';
      case 'cityindoors':
      case 'indoorrecreation':
        return 'Indoor Recreation';
      case 'citybeach':
      case 'beachrecreation':
        return 'Beach Recreation';
      case 'meals':
        return 'Meals & Dining';
      case 'entertainment':
        return 'Entertainment';
      case 'commercial':
        return 'Commercial Leisure';
      case 'travel':
      case 'sightseeing':
        return 'Sightseeing & Travel';
      default:
        return splitPascalCase(rawStr);
    }
  });
}

/**
 * Formats CS2 ProfitabilityTier into spaced label + CSS class slug matching UnifiedAssetExplorer.css.
 */
export function formatProfitabilityTier(raw?: string | null): { label: string; cssSlug: string } {
  const k = String(raw || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  switch (k) {
    case 'profitable':
      return { label: 'Profitable', cssSlug: 'profitable' };
    case 'gettingby':
      return { label: 'Getting By', cssSlug: 'gettingby' };
    case 'breakingeven':
    case 'breakeven':
      return { label: 'Breaking Even', cssSlug: 'breakeven' };
    case 'losingmoney':
      return { label: 'Losing Money', cssSlug: 'losingmoney' };
    case 'bankrupt':
      return { label: 'Bankrupt', cssSlug: 'bankrupt' };
    default: {
      const fallback = splitPascalCase(raw) || 'Neutral';
      return { label: fallback, cssSlug: k || 'neutral' };
    }
  }
}

const FACTOR_NAME_MAP: Record<string, string> = {
  // EfficiencyFactor
  destroyed: 'Destroyed',
  abandoned: 'Abandoned',
  disabled: 'Building Disabled',
  fire: 'On Fire',
  servicebudget: 'Service Budget',
  notenoughemployees: 'Not Enough Employees',
  sickemployees: 'Sick Employees',
  employeehappiness: 'Employee Happiness',
  electricitysupply: 'Electricity Supply',
  electricityfee: 'Electricity Fee',
  watersupply: 'Water Supply',
  dirtywater: 'Dirty Water',
  sewagehandling: 'Sewage Handling',
  waterfee: 'Water Fee',
  garbage: 'Garbage Piling Up',
  telecom: 'Telecom Network',
  mail: 'Mail Service',
  materialsupply: 'Material Supply',
  windspeed: 'Wind Speed',
  waterdepth: 'Water Flow / Depth',
  sunintensity: 'Sun Intensity',
  naturalresources: 'Natural Resources',
  citymodifiersoftware: 'City Software Effect',
  citymodifierelectronics: 'City Electronics Effect',
  citymodifierindustrialefficiency: 'Industrial Efficiency Bonus',
  citymodifierofficeefficiency: 'Office Efficiency Bonus',
  citymodifierhospitalefficiency: 'Hospital Efficiency Bonus',
  specializationbonus: 'Specialization Bonus',
  lackofresources: 'Lack of Resources',

  // Happiness / BuildingHappinessFactor
  noisepollution: 'Noise Pollution',
  groundpollution: 'Ground Pollution',
  airpollution: 'Air Pollution',
  waterpollution: 'Water Pollution',
  trafficpenalty: 'Traffic Penalty',
  deathpenalty: 'Deathcare',
  healthcare: 'Healthcare',
  entertainment: 'Entertainment',
  education: 'Education',
  welfare: 'Welfare Coverage',
  leisure: 'Leisure',
  tax: 'Taxation',
  buildings: 'Service Buildings',
  consumption: 'Household Consumption',
  homelessness: 'Homelessness',
  crime: 'Crime Safety',
  apartment: 'Apartment Size',
  wealth: 'Household Wealth',
  uneducatedworkers: 'Uneducated Workforce',
  educatedworkers: 'Educated Workforce',
  missingworkers: 'Missing Workers',
  inputcosts: 'Input Material Costs',
  outputcosts: 'Output Transport Costs',
  customers: 'Customer Access',
  materials: 'Material Availability',
  efficiency: 'Building Efficiency',
};

/**
 * Formats any EfficiencyFactor or HappinessFactor enum/label cleanly, never returning raw PascalCase.
 */
export function formatFactorLabel(raw?: string | null, deltaValue?: number): string {
  if (!raw) return 'Factor';
  const deltaTag = deltaValue === undefined ? '' : deltaValue > 0 ? '+' : deltaValue < 0 ? '-' : '0';
  const rawStr = String(raw);
  const cacheKey = `${rawStr}\0${deltaTag}`;
  return memoizeFormat(_factorLabelCache, cacheKey, () => {
    const trimmed = rawStr.trim();
    if (!trimmed) return 'Factor';

    // If already a human phrase with spaces (e.g. "Spacious homes", "Abundance of entertainment"), keep it!
    if (trimmed.includes(' ')) return trimmed;

    const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key === 'apartment' && deltaValue !== undefined) {
      if (deltaValue > 0) return 'Spacious homes';
      if (deltaValue < 0) return 'Small homes';
      return 'Apartment size';
    }
    if (FACTOR_NAME_MAP[key]) return FACTOR_NAME_MAP[key];

    return splitPascalCase(trimmed);
  });
}

const MODIFIER_TYPE_LABELS: Record<string, string> = {
  attractiveness: 'Attractiveness',
  wellbeing: 'Wellbeing',
  crimeaccumulation: 'Crime Accumulation',
  forestfirehazard: 'Forest Fire Hazard',
  forestfireresponsetime: 'Forest Fire Response Time',
  disasterwarningtime: 'Disaster Warning Time',
  disasterdamagerate: 'Disaster Damage Rate',
  industrialefficiency: 'Industrial Efficiency',
  officeefficiency: 'Office Efficiency',
  hospitalefficiency: 'Hospital Efficiency',
  universitygraduation: 'University Graduation',
  collegegraduation: 'College Graduation',
  universityinterest: 'University Interest',
  collegeinterest: 'College Interest',
  importcost: 'Import Cost',
  exportcost: 'Export Cost',
  loaninterest: 'Loan Interest',
  buildinglevelingcost: 'Building Leveling Cost',
  cityservicebuildingbaseupkeepcost: 'Service Upkeep Cost',
  parkentertainment: 'Park Entertainment',
  entertainment: 'Entertainment',
  telecomcapacity: 'Telecom Capacity',
  diseaseprobability: 'Disease Probability',
  recoveryfailchange: 'Hospital Recovery Failure',
  oreresourceamount: 'Ore Resource Yield',
  oilresourceamount: 'Oil Resource Yield',
  taxistartingfee: 'Taxi Starting Fee',
  citybeach: 'Beach Recreation',
  cityindoors: 'Indoor Recreation',
  citypark: 'Outdoor Recreation',
};

/**
 * Cleans CityEffects, LocalEffects, and SubBuilding benefit strings.
 * Fixes "-25% Crime Reduction" double-negative and formats raw Catalog modifier strings like "+0.05 OfficeEfficiency".
 */
export function formatEffectString(raw?: string | null): string {
  if (!raw) return '';
  const rawStr = String(raw);
  return memoizeFormat(_effectStringCache, rawStr, () => {
    let s = rawStr.trim();
    if (!s) return '';

    // Fix double-negative from older C# payloads: "-25% Crime Reduction" -> "-25% Crime Accumulation"
    s = s.replace(/(-[\d.,]+%?)\s+Crime Reduction\b/gi, '$1 Crime Accumulation');
    s = s.replace(/(-[\d.,]+%?)\s+Fire Hazard Reduction\b/gi, '$1 Forest Fire Hazard');

    // Fix raw Catalog decimal modifier format: "+0.05 OfficeEfficiency" -> "+5% Office Efficiency"
    const catalogRawMatch = s.match(/^([+-]?\d+\.\d+)\s+([A-Za-z]+)$/);
    if (catalogRawMatch) {
      const num = parseFloat(catalogRawMatch[1]);
      const rawType = catalogRawMatch[2];
      const typeKey = rawType.toLowerCase();
      const label = MODIFIER_TYPE_LABELS[typeKey] || splitPascalCase(rawType);
      if (!isNaN(num) && Math.abs(num) <= 2) {
        const pct = Math.round(num * 100);
        const sign = pct > 0 ? '+' : '';
        return `${sign}${pct}% ${label}`;
      }
      return `${catalogRawMatch[1]} ${label}`;
    }

    // Replace any trailing or embedded raw PascalCase modifier/leisure tokens
    return s.replace(/\b([A-Z][a-z]+(?:[A-Z][a-z0-9]+)+)\b/g, (token) => {
      const tk = token.toLowerCase();
      return MODIFIER_TYPE_LABELS[tk] || splitPascalCase(token);
    });
  });
}

/**
 * Formats a District/City policy key (e.g. "PP_TaxParadise", "DP_CombustionEngineBan") into a human title.
 */
export function formatPolicyDisplayName(
  rawKey?: string | null,
  policyNameByKey?: Map<string, string>,
  translate?: TranslateFn
): string {
  if (!rawKey) return '';
  const trimmed = String(rawKey).trim();
  if (policyNameByKey && policyNameByKey.has(trimmed)) {
    const mapped = policyNameByKey.get(trimmed)!;
    if (mapped && !mapped.startsWith('PP_') && !mapped.startsWith('DP_')) return mapped;
  }

  if (translate) {
    try {
      const t1 = translate(`Policy.TITLE[${trimmed}]`, null);
      if (t1 && !t1.includes('[')) return t1;
    } catch (err) { logCatch('formatters', err); }
  }

  const stripped = trimmed.replace(/^(PP|DP|Policy)_+/i, '');
  return splitPascalCase(stripped);
}

/**
 * Cohtml-safe number formatter with thousands separators (Cohtml lacks full ICU Intl support).
 */
export function formatNumber(amount?: number | null, maxDecimals?: number): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0';
  const fixed =
    typeof maxDecimals === 'number' && maxDecimals >= 0
      ? num.toFixed(maxDecimals)
      : String(num);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
}

/**
 * Formats a storage quantity up to 2 decimals with trailing zeroes trimmed (e.g. 0.1, 2.16, 100).
 */
export function formatStorageTrimmed(value: number, maxDecimals: number = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return '0';
  const rounded = Number(num.toFixed(maxDecimals));
  if (Math.abs(rounded) < 1e-9) return '0';
  const parts = String(rounded).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
}

/**
 * Formats an amount / capacity storage pair in kt when either side is >= 1,000 t, otherwise in t.
 * Matches CS2 native Selected Info Panel conventions (e.g. "0.1 / 2.16 kt" or "150 / 500 t").
 */
export function formatStoragePair(amountTons?: number | null, capacityTons?: number | null): string {
  const amt = Number.isFinite(Number(amountTons)) ? Math.max(0, Number(amountTons)) : 0;
  const cap = Number.isFinite(Number(capacityTons)) ? Math.max(0, Number(capacityTons)) : 0;
  const useKt = cap >= 1000 || amt >= 1000;
  const unit = useKt ? 'kt' : 't';
  const scale = useKt ? 1000 : 1;

  if (cap > 0) {
    return `${formatStorageTrimmed(amt / scale, 2)} / ${formatStorageTrimmed(cap / scale, 2)} ${unit}`;
  }
  return `${formatStorageTrimmed(amt / scale, 2)} ${unit}`;
}

/**
 * Formats a single storage quantity matching CS2 native unit scaling:
 * < 1,000 kg -> kg, < 1,000 t -> t, >= 1,000 t -> kt (e.g. "Cotton 100 t", "1.5 kt", "450 kg").
 */
export function formatStorageWeight(kgAmount?: number | null, weightTons?: number | null): string {
  const kg = Number.isFinite(Number(kgAmount)) ? Math.max(0, Number(kgAmount)) : 0;
  const tons = Number.isFinite(Number(weightTons)) ? Math.max(0, Number(weightTons)) : kg / 1000;
  if (kg <= 0 && tons <= 0) return '0 kg';
  const roundedKg = Math.round(kg);
  if (roundedKg > 0 && roundedKg < 1000 && tons < 1) {
    return `${formatNumber(roundedKg)} kg`;
  }
  if (tons >= 1000) {
    return `${formatStorageTrimmed(tons / 1000, 2)} kt`;
  }
  return `${formatStorageTrimmed(tons, 2)} t`;
}

/**
 * Formats a tonnage scalar compactly for cards/strips (uses kt at >= 1,000 t).
 */
export function formatStorageTons(tons?: number | null): string {
  const val = Number.isFinite(Number(tons)) ? Math.max(0, Number(tons)) : 0;
  if (val >= 1000) {
    return `${formatStorageTrimmed(val / 1000, 2)} kt`;
  }
  return `${formatStorageTrimmed(val, 2)} t`;
}

/**
 * Formats CS2 currency consistently with '¢' and negative sign BEFORE symbol ("-¢7,215/mo").
 */
export function formatCurrency(amount?: number | null, suffix: string = ''): string {
  const n = Math.round(Number(amount) || 0);
  if (n < 0) {
    return `-¢${formatNumber(Math.abs(n), 0)}${suffix}`;
  }
  return `¢${formatNumber(n, 0)}${suffix}`;
}

/**
 * Formats signed currency ("+¢1,200" / "-¢450" / "¢0").
 */
export function formatSignedCurrency(amount?: number | null, suffix: string = ''): string {
  const n = Math.round(Number(amount) || 0);
  if (n > 0) return `+¢${formatNumber(n, 0)}${suffix}`;
  if (n < 0) return `-¢${formatNumber(Math.abs(n), 0)}${suffix}`;
  return `¢0${suffix}`;
}

/**
 * Clean singular/plural formatter ("1 factor" vs "4 factors", "1 building" vs "12 buildings").
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const n = Number(count) || 0;
  const word = Math.abs(n) === 1 ? singular : (plural || `${singular}s`);
  return `${formatNumber(n, 0)} ${word}`;
}

/**
 * Formats density strings without duplicating "Density" ("Row Housing" instead of "Row Housing Density").
 */
export function formatDensityLabel(density?: string | null): string {
  if (!density) return 'Standard';
  const d = String(density).trim();
  if (!d) return 'Standard';
  const lower = d.toLowerCase();
  if (lower === 'low' || lower === 'medium' || lower === 'high') {
    return `${d.charAt(0).toUpperCase() + d.slice(1)} Density`;
  }
  if (lower.includes('density') || lower.includes('housing') || lower.includes('rent') || lower.includes('mixed')) {
    return splitPascalCase(d);
  }
  return splitPascalCase(d);
}

/**
 * Capitalizes corner type labels ("straight" -> "Straight", "left_corner" -> "Left Corner").
 */
export function formatCornerLabel(corner?: string | null): string {
  if (!corner) return '';
  return splitPascalCase(corner)
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

