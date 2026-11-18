export type AssetCategory =
  | 'Residential'
  | 'Commercial'
  | 'Industrial'
  | 'Office'
  | 'Storage'
  | 'Service'
  | 'Other';

export type CategoryFilter =
  | 'All'
  | 'Districts'
  | 'ZoneMatrices'
  | 'Housing'
  | 'CommercialMatrix'
  | 'OfficeMatrix'
  | 'IndustrialMatrix'
  | 'StorageMatrix'
  | 'ServiceMatrix'
  | 'SignatureMatrix'
  | 'Residential'
  | 'Commercial'
  | 'Industrial'
  | 'Office'
  | 'Storage'
  | 'Service'
  | 'Signature'
  | 'Catalog';

export interface UnifiedAssetItem {
  id: string;
  entityKey: string;
  companyEntityKey?: string;
  prefabKey: string;
  prefabName: string;
  isPlaced: boolean;
  category: AssetCategory;
  subCategory: string;
  name: string;
  secondaryName: string;
  district: string;
  districtKey: string;
  theme: string;
  themeIcon?: string;
  assetPack?: string;
  assetPackIcon?: string;
  density?: string;
  zoneType?: string;
  company?: string;
  resource?: string;
  inputResources?: string[];
  outputResources?: string[];
  happiness?: number;
  thumbnail: string;
  level: number;
  isSignature: boolean;
  needsRepair: boolean;
  occupied: number;
  capacity: number;
  efficiency: number; // -1 if not applicable
  vehicles?: number;
  vehiclesMax?: number;
  companyVehicles?: number;
  companyVehiclesMax?: number;
  electricityConsumption?: number;
  waterConsumption?: number;
  garbageAccumulation?: number;
  maintenanceCost?: number;
  constructionCost?: number;
  subBuildings?: SubBuildingItem[];
  efficiencyFactors?: EfficiencyFactorItem[];
  happinessFactors?: EfficiencyFactorItem[];
  income?: number;
  monthlyProfit?: number;
  netWorth?: number;
  customers?: number;
  currentCustomers?: number;
  wagePaid?: number;
  rentPaid?: number;
  taxPaid?: number;
  inputCost?: number;
  electricityPaid?: number;
  waterPaid?: number;
  sewagePaid?: number;
  garbagePaid?: number;
  profitMargin?: number;
  profitabilityTier?: string;
  tradePartner?: string;
  educationTiers?: EducationTierItem[];
  serviceUsage?: number;
  serviceCapacity?: number;
  serviceUnit?: string;
  roadName?: string;
  citizenPresence?: number;
  attractiveness?: number;
  storageAmount?: number;
  storageCapacity?: number;
  storedResources?: StoredResourceItem[];
  taxRate?: number;
  crimeProbability?: number;
  mailSending?: number;
  mailReceiving?: number;
  cityEffects?: string[];
  localEffects?: string[];
  buildingCondition?: number;
  maxCondition?: number;
  householdWealth?: string;
  householdIncome?: number;
  householdRent?: number;
  householdUpkeep?: number;
  householdResourceCost?: number;
  householdFees?: number;
  pets?: number;
  totalRent?: number;
  lotSize?: number;
  spaceMultiplier?: number;
  baseRent?: number;
  landValueModifier?: number;
  landValueBase?: number;
  landValueRate?: number;
  rentPerRenter?: number;
  lotDimensions?: string;
  cornerType?: string;
  isSubBuilding?: boolean;
  roadLandValue?: number;
  parkingCapacity?: number;
  parkedVehicles?: number;
  parkingFee?: number;
  parkingComfort?: number;
  parkMaintenance?: number;
  residents?: number;
  recreation?: number;
  leisureType?: string;
  totalUpkeep?: number;
  isHistorical?: boolean;
  isMixedUse?: boolean;
  commercialOccupied?: number;
  commercialCapacity?: number;
  isTransitHub?: boolean;
  isCargoHub?: boolean;
  transitLines?: number;
  waitingPassengers?: number;
  averageWaitTime?: number;
  stationComfort?: number;
  isDamaged?: boolean;
  hasBrokenPath?: boolean;
  damagePercent?: number;
  isTurnedOff?: boolean;
}

export interface EfficiencyFactorItem {
  factor: string;
  percentage: number;
  cumulative: number;
}

export interface EducationTierItem {
  level: number;
  name: string;
  filled: number;
  total: number;
}

export interface StoredResourceItem {
  name: string;
  amount: number;
  weight: number;
  type: string;
}

export interface SubBuildingItem {
  entityKey: string;
  name: string;
  prefabName?: string;
  type: string;
  benefit: string;
  description?: string;
  upkeep?: number;
  cost?: number;
  workers?: number;
  isDamaged?: boolean;
  damagePercent?: number;
  isDestroyed?: boolean;
}

export interface ServiceStatusCard {
  key: string;
  label: string;
  buildingCount: number;
  avgEfficiency: number;
  usage: number;
  capacity: number;
  unit: string;
}

export interface ServiceStatusPayload {
  cards: ServiceStatusCard[];
}

export interface InventoryPackMeta {
  name: string;
  icon?: string;
}

export const getAssetFavoriteKey = (
  item: Pick<UnifiedAssetItem, 'entityKey' | 'id' | 'prefabName' | 'name'>
): string => item.entityKey || item.id || item.prefabName || item.name || '';

export interface InventoryStatusPayload {
  placed?: number;
  catalog?: number;
  elapsedMs?: number;
  packs?: InventoryPackMeta[];
}

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DistrictPolicyActive {
  key: string;
  adjustment: number;
}

export interface DistrictItem {
  entityKey: string;
  name: string;
  isCity?: boolean;
  cityName?: string;
  residentialCount: number;
  mixedCount?: number;
  commercialCount: number;
  industrialCount: number;
  officeCount: number;
  storageCount: number;
  serviceCount: number;
  totalBuildings: number;
  population: number;
  households: number;
  householdCapacity: number;
  children?: number;
  teens?: number;
  adults?: number;
  seniors?: number;
  students?: number;
  tourists?: number;
  homeless?: number;
  eduUneducated?: number;
  eduPoorlyEducated?: number;
  eduEducated?: number;
  eduWellEducated?: number;
  eduHighlyEducated?: number;
  workers: number;
  maxWorkers: number;
  unemployed?: number;
  unemploymentRate?: number;
  workerUneducated?: number;
  workerPoorlyEducated?: number;
  workerEducated?: number;
  workerWellEducated?: number;
  workerHighlyEducated?: number;
  workplaceUneducated?: number;
  workplacePoorlyEducated?: number;
  workplaceEducated?: number;
  workplaceWellEducated?: number;
  workplaceHighlyEducated?: number;
  openPositions?: number;
  elemCapacity?: number;
  elemEnrolled?: number;
  elemEligible?: number;
  hsCapacity?: number;
  hsEnrolled?: number;
  hsEligible?: number;
  collegeCapacity?: number;
  collegeEnrolled?: number;
  collegeEligible?: number;
  uniCapacity?: number;
  uniEnrolled?: number;
  uniEligible?: number;
  avgHappiness: number;
  avgBuildingLevel: number;
  avgWealth: number;
  avgWealthKey?: string;
  avgIncome?: number;
  avgRent: number;
  avgUpkeep?: number;
  avgResourceCost?: number;
  avgFees?: number;
  totalLandValue?: number;
  landValueSamples?: number;
  totalCrime?: number;
  sick?: number;
  pets?: number;
  area?: number;
  attractiveness?: number;
  avgProfitability?: number;
  avgLandValue?: number;
  storageAmount?: number;
  storageCapacity?: number;
  touristVisits?: number;
  commercialActivity?: number;
  electricityConsumption?: number;
  waterConsumption?: number;
  garbageAccumulation?: number;
  maintenanceCost?: number;
  gameAllCitizens?: number;
  gameEmployees?: number;
  gameTourists?: number;
  gameCommuters?: number;
  gameMovingAway?: number;
  popVerify?: string;
  happinessFactors?: EfficiencyFactorItem[];
  policies: DistrictPolicyActive[];
}

export interface DistrictPolicyMeta {
  entityKey: string;
  name: string;
  icon: string;
  isCity: boolean;
  isDistrict: boolean;
  hasSlider: boolean;
  sliderDefault?: number;
  sliderMin?: number;
  sliderMax?: number;
}
