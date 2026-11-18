import { formatFactorLabel } from './formatters';

export const EFF_FACTOR_LABELS: Record<string, string> = {
  EmployeeHappiness: 'Employee Happiness',
  NotEnoughEmployees: 'Not Enough Employees',
  SickEmployees: 'Sick Employees',
  ElectricitySupply: 'Electricity Supply',
  ElectricityFee: 'Electricity Fee',
  WaterSupply: 'Water Supply',
  DirtyWater: 'Dirty Water',
  SewageHandling: 'Sewage Handling',
  WaterFee: 'Water Fee',
  MaterialSupply: 'Material Supply',
  NaturalResources: 'Natural Resources',
  ServiceBudget: 'Service Budget',
  LackOfResources: 'Lack of Resources',
  SunIntensity: 'Sun Intensity',
  WindSpeed: 'Wind Speed',
  WaterDepth: 'Water Flow / Depth',
  Disabled: 'Building Disabled',
  CityModifierSoftware: 'City Software Effect',
  CityModifierElectronics: 'City Electronics Effect',
  CityModifierIndustrialEfficiency: 'Industrial Efficiency Bonus',
  CityModifierOfficeEfficiency: 'Office Efficiency Bonus',
  CityModifierHospitalEfficiency: 'Hospital Efficiency Bonus',
  SpecializationBonus: 'Specialization Bonus',
  NoisePollution: 'Noise Pollution',
  GroundPollution: 'Ground Pollution',
  AirPollution: 'Air Pollution',
  WaterPollution: 'Water Pollution',
  TrafficPenalty: 'Traffic Penalty',
  DeathPenalty: 'Deathcare Access',
  Healthcare: 'Healthcare',
  Entertainment: 'Entertainment',
  Education: 'Education',
  Mail: 'Mail Service',
  Welfare: 'Welfare',
  Leisure: 'Leisure',
  Tax: 'Taxation',
  Buildings: 'Buildings',
  Consumption: 'Consumption',
  Homelessness: 'Homelessness',
  Telecom: 'Telecom Network',
  Crime: 'Crime Safety',
  Apartment: 'Apartment Size',
  Wealth: 'Household Wealth',
  UneducatedWorkers: 'Uneducated Workforce',
  EducatedWorkers: 'Educated Workforce',
  MissingWorkers: 'Missing Workers',
  InputCosts: 'Input Material Costs',
  OutputCosts: 'Output Transport Costs',
  Customers: 'Customer Access',
  Materials: 'Material Availability',
  Efficiency: 'Building Efficiency',
};

export const getFactorDisplayLabel = (factorName?: string, deltaValue?: number): string => {
  if (!factorName) return 'Factor';
  if (EFF_FACTOR_LABELS[factorName]) return EFF_FACTOR_LABELS[factorName];
  return formatFactorLabel(factorName, deltaValue);
};

export const getEfficiencyFactorIcon = (factorName: string): string => {
  if (!factorName) return 'Media/Game/Icons/Notifications.svg';
  const n = factorName.toLowerCase();
  if (n.includes('worker') || n.includes('employee') || n.includes('staff'))
    return 'Media/Game/Icons/Workers.svg';
  if (n.includes('electric') || n.includes('power'))
    return 'Media/Game/Icons/Electricity.svg';
  if (n.includes('water') || n.includes('sewage'))
    return 'Media/Game/Icons/Water.svg';
  if (n.includes('garbage') || n.includes('waste'))
    return 'Media/Game/Icons/Garbage.svg';
  if (n.includes('mail'))
    return 'Media/Game/Icons/PostService.svg';
  if (n.includes('crime'))
    return 'Media/Game/Icons/Police.svg';
  if (n.includes('transport') || n.includes('access') || n.includes('traffic'))
    return 'Media/Game/Icons/Traffic.svg';
  if (n.includes('road') || n.includes('network'))
    return 'Media/Game/Icons/Roads.svg';
  if (n.includes('healthcare') || n.includes('hospital') || n.includes('sick'))
    return 'Media/Game/Icons/Healthcare.svg';
  if (n.includes('education') || n.includes('school') || n.includes('university') || n.includes('college'))
    return 'Media/Game/Icons/Education.svg';
  if (n.includes('wealth'))
    return 'Media/Game/Icons/CitizenWealth.svg';
  if (n.includes('park') || n.includes('entertainment') || n.includes('attraction') || n.includes('leisure') || n.includes('apartment') || n.includes('building'))
    return 'Media/Game/Icons/ParksAndRecreation.svg';
  if (n.includes('welfare') || n.includes('wellbeing'))
    return 'Media/Game/Icons/Wellbeing.svg';
  if (n.includes('fire'))
    return 'Media/Game/Icons/FireSafety.svg';
  if (n.includes('deathcare') || n.includes('death') || n.includes('cemetery') || n.includes('crematorium'))
    return 'Media/Game/Icons/Deathcare.svg';
  if (n.includes('police'))
    return 'Media/Game/Icons/Police.svg';
  if (n.includes('telecom') || n.includes('network'))
    return 'Media/Game/Resources/Telecom.svg';
  if (n.includes('pollution') || n.includes('noise'))
    return 'Media/Game/Icons/Pollution.svg';
  if (n.includes('tax') || n.includes('consumption'))
    return 'Media/Game/Icons/Economy.svg';
  return 'Media/Game/Icons/Notifications.svg';
};

export const getProfitabilityTierColor = (tier?: string): string => {
  switch (tier?.toLowerCase().replace(/[^a-z]/g, '')) {
    case 'profitable':
      return '#4ade80';
    case 'gettingby':
      return '#38bdf8';
    case 'breakingeven':
    case 'breakeven':
      return '#fbbf24';
    case 'losingmoney':
      return '#fb923c';
    case 'bankrupt':
      return '#ef4444';
    default:
      return '#94a3b8';
  }
};

export interface CategoryVisual {
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  activeBorder: string;
  dotColor: string;
  iconPath: string;
}

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  residential: {
    color: '#81c784',
    bg: 'rgba(76, 175, 80, 0.16)',
    border: 'rgba(76, 175, 80, 0.42)',
    activeBg: '#2e7d32',
    activeBorder: '#66bb6a',
    dotColor: '#4caf50',
    iconPath: 'Media/Game/Icons/ZoneResidential.svg',
  },
  housing: {
    color: '#69f0ae',
    bg: 'rgba(16, 185, 129, 0.16)',
    border: 'rgba(16, 185, 129, 0.42)',
    activeBg: '#047857',
    activeBorder: '#34d399',
    dotColor: '#10b981',
    iconPath: 'Media/Game/Icons/ZoneResidential.svg',
  },
  zonematrices: {
    color: '#93c5fd',
    bg: 'rgba(59, 130, 246, 0.16)',
    border: 'rgba(96, 165, 250, 0.44)',
    activeBg: '#1d4ed8',
    activeBorder: '#60a5fa',
    dotColor: '#3b82f6',
    iconPath: 'Media/Game/Icons/Zones.svg',
  },
  commercialmatrix: {
    color: '#64b5f6',
    bg: 'rgba(33, 150, 243, 0.16)',
    border: 'rgba(33, 150, 243, 0.42)',
    activeBg: '#1565c0',
    activeBorder: '#64b5f6',
    dotColor: '#2196f3',
    iconPath: 'Media/Game/Icons/ZoneCommercial.svg',
  },
  officematrix: {
    color: '#4dd0e1',
    bg: 'rgba(0, 229, 255, 0.14)',
    border: 'rgba(0, 229, 255, 0.40)',
    activeBg: '#00838f',
    activeBorder: '#4dd0e1',
    dotColor: '#00bcd4',
    iconPath: 'Media/Game/Icons/ZoneOffice.svg',
  },
  industrialmatrix: {
    color: '#ffb74d',
    bg: 'rgba(255, 152, 0, 0.16)',
    border: 'rgba(255, 152, 0, 0.42)',
    activeBg: '#e65100',
    activeBorder: '#ffb74d',
    dotColor: '#ff9800',
    iconPath: 'Media/Game/Icons/ZoneIndustrial.svg',
  },
  storagematrix: {
    color: '#ffd54f',
    bg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.42)',
    activeBg: '#b45309',
    activeBorder: '#fbbf24',
    dotColor: '#fbbf24',
    iconPath: 'Media/Game/Icons/ZoneIndustrialWarehouses.svg',
  },
  servicematrix: {
    color: '#ce93d8',
    bg: 'rgba(171, 71, 188, 0.16)',
    border: 'rgba(171, 71, 188, 0.42)',
    activeBg: '#7b1fa2',
    activeBorder: '#ba68c8',
    dotColor: '#ab47bc',
    iconPath: 'Media/Game/Icons/Services.svg',
  },
  signaturematrix: {
    color: '#ffd54f',
    bg: 'rgba(245, 127, 23, 0.18)',
    border: 'rgba(245, 158, 11, 0.48)',
    activeBg: '#b45309',
    activeBorder: '#f59e0b',
    dotColor: '#f59e0b',
    iconPath: 'Media/Game/Icons/Unique.svg',
  },
  commercial: {
    color: '#64b5f6',
    bg: 'rgba(33, 150, 243, 0.16)',
    border: 'rgba(33, 150, 243, 0.42)',
    activeBg: '#1565c0',
    activeBorder: '#42a5f5',
    dotColor: '#2196f3',
    iconPath: 'Media/Game/Icons/ZoneCommercial.svg',
  },
  industrial: {
    color: '#ffb74d',
    bg: 'rgba(255, 152, 0, 0.16)',
    border: 'rgba(255, 152, 0, 0.42)',
    activeBg: '#e65100',
    activeBorder: '#ffa726',
    dotColor: '#ff9800',
    iconPath: 'Media/Game/Icons/ZoneIndustrial.svg',
  },
  office: {
    color: '#4dd0e1',
    bg: 'rgba(0, 229, 255, 0.14)',
    border: 'rgba(0, 229, 255, 0.40)',
    activeBg: '#00838f',
    activeBorder: '#26c6da',
    dotColor: '#00e5ff',
    iconPath: 'Media/Game/Icons/ZoneOffice.svg',
  },
  storage: {
    color: '#ffd54f',
    bg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.42)',
    activeBg: '#b45309',
    activeBorder: '#fbbf24',
    dotColor: '#fbbf24',
    iconPath: 'Media/Game/Icons/ZoneIndustrialWarehouses.svg',
  },
  service: {
    color: '#ce93d8',
    bg: 'rgba(171, 71, 188, 0.16)',
    border: 'rgba(171, 71, 188, 0.42)',
    activeBg: '#7b1fa2',
    activeBorder: '#ba68c8',
    dotColor: '#ab47bc',
    iconPath: 'Media/Game/Icons/Services.svg',
  },
  signature: {
    color: '#ffd54f',
    bg: 'rgba(245, 127, 23, 0.18)',
    border: 'rgba(245, 158, 11, 0.48)',
    activeBg: '#b45309',
    activeBorder: '#f59e0b',
    dotColor: '#f59e0b',
    iconPath: 'Media/Game/Icons/Unique.svg',
  },
  districts: {
    color: '#7dd3fc',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.40)',
    activeBg: '#0284c7',
    activeBorder: '#38bdf8',
    dotColor: '#38bdf8',
    iconPath: 'Media/Game/Icons/Districts.svg',
  },
  catalog: {
    color: '#93c5fd',
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.40)',
    activeBg: '#1d4ed8',
    activeBorder: '#60a5fa',
    dotColor: '#60a5fa',
    iconPath: 'Media/Game/Icons/Zones.svg',
  },
  all: {
    color: '#b0bec5',
    bg: 'rgba(148, 163, 184, 0.14)',
    border: 'rgba(148, 163, 184, 0.35)',
    activeBg: '#0288d1',
    activeBorder: '#29b6f6',
    dotColor: '#29b6f6',
    iconPath: 'Media/Game/Icons/City.svg',
  },
};

export const getCategoryVisual = (category?: string, subCategory?: string): CategoryVisual => {
  const key = (category || '').toLowerCase().trim();
  if (CATEGORY_VISUALS[key]) return CATEGORY_VISUALS[key];
  const sub = (subCategory || '').toLowerCase();
  if (sub.includes('mixed')) {
    return {
      color: '#b388ff',
      bg: 'rgba(179, 136, 255, 0.16)',
      border: 'rgba(179, 136, 255, 0.42)',
      activeBg: '#5e35b1',
      activeBorder: '#b388ff',
      dotColor: '#b388ff',
      iconPath: 'Media/Game/Icons/ZoneResidentialMixed.svg',
    };
  }
  return CATEGORY_VISUALS.all;
};
