export interface PolicyItem {
  entityKey: string;
  name: string;
  icon?: string;
  isCity?: boolean;
  isDistrict?: boolean;
  hasSlider?: boolean;
  sliderDefault?: number;
  sliderMin?: number;
  sliderMax?: number;
}

export interface ActivePolicyItem {
  key: string;
  adjustment: number;
}

export const POLICY_CONFLICT_GROUPS: string[][] = [
  // Expanded City Policies (PolicyPlus) - City Policies (PP_)
  ["PP_TaxParadise", "PP_SymbolicTaxes", "PP_FlatTax", "PP_ProgressiveTax", "PP_WealthTax", "PP_OffshoreCrackdown"],
  ["PP_MadeInLocal", "PP_ImportEverything", "PP_WildImports", "PP_FreeTradeZone", "PP_Protectionism", "PP_Reshoring"],
  ["PP_PollutionProsperity", "PP_StrictGreenCity", "PP_SilentIndustry", "PP_CarbonTax", "PP_EmissionZone", "PP_ChaosFreeZone"],
  ["PP_PoliceState", "PP_FriendlyCops", "PP_ToleranceDelinquency", "PP_LightCrimePermit", "PP_ZeroGraffiti", "PP_CommunityTolerance"],
  ["PP_WarOnDrugs", "PP_DrugDecriminalization", "PP_RestorativeJustice", "PP_PrisonComfort"],
  ["PP_BigBrother", "PP_FakeCameras", "PP_DronePolice", "PP_PrivateSecurity"],
  ["PP_UniversalHealthcare", "PP_HealthOnBudget", "PP_PaidER", "PP_Hospitals247", "PP_PublicPlacebo"],
  ["PP_MandatoryUniversity", "PP_SchoolIsOverrated", "PP_FreeUniversity", "PP_NoHomework"],
  ["PP_AggressiveTourism", "PP_AntiTourists", "PP_TouristTax", "PP_InfluencerVisa"],
  ["PP_Austerity", "PP_ServiceBudgetBoost", "PP_BasicIncome", "PP_CityServiceImport"],
  ["PP_AutomationPush", "PP_RobotTax"],
  ["PP_BackyardOil", "PP_ForestProtection", "PP_Rewilding", "PP_QuarryMoratorium", "PP_HeavyIndustrySurge"],
  ["PP_NightFactories", "PP_SilentIndustry", "PP_FourDayIndustry"],

  // Expanded District Policies (PolicyPlus) - District Policies (DP_)
  ["DP_LateNightBars", "DP_NightCurfew", "DP_QuietHoursOrdinance", "DP_StrictNoiseControl", "DP_QuietLiving"],
  ["DP_NightWithoutCops", "DP_PrivateGuards", "DP_VolunteerPatrol", "DP_ZeroToleranceLoitering"],
  ["DP_FreeParkingSaturday", "DP_ResidentOnlyParking", "DP_ParkingMeterUpgrade"],
  ["DP_BuskerPermits", "DP_ZeroToleranceLoitering"],
  ["DP_CompostingProgram", "DP_WasteSortingMandate", "DP_CommunityRecyclingReward", "DP_ToxicFreezone"],

  // Specific fine-grained incompatibilities
  ["PP_FastFines", "PP_ToleranceDelinquency", "PP_LightCrimePermit"],
  ["PP_NightWithoutCops", "PP_PoliceState", "PP_BigBrother"],
  ["PP_StreetRacing", "PP_ZeroGraffiti"],
  ["PP_StartupOrNothing", "PP_SlowLife"],
  ["PP_StartupOrNothing", "PP_MandatoryUniversity"],
  ["PP_PublicPlacebo", "PP_Hospitals247", "PP_SoftVaccineMandate"],
  ["PP_ForcedTelehealth", "PP_Hospitals247"],
  ["PP_InfluencerDoctors", "PP_Hospitals247"],
  ["PP_Libraries247", "PP_SchoolIsOverrated"],
  ["PP_TheaterZeroWaste", "PP_PollutionProsperity"],
  ["PP_RightToRepair", "PP_PollutionProsperity"],
  ["PP_ShareEconomy", "PP_AntiAirbnb"],
  ["PP_MunicipalCasino", "PP_AntiAirbnb", "PP_SlowLife"],
  ["PP_PermanentFestival", "PP_SlowLife", "PP_AntiTourists"],
  ["PP_WhiteNight", "PP_SlowLife"],
  ["PP_SoftApocalypse", "PP_PermanentFestival"],
  ["PP_RentControl", "PP_TaxParadise"],
  ["PP_ConstructionSubsidy", "PP_RepairCulture"],
  ["PP_WorkWeek4Days", "PP_NightFactories"],
  ["PP_FreeDayCare", "PP_HealthOnBudget"],
  ["PP_LateNightBars", "PP_ChaosFreeZone", "PP_SlowLife"],
  ["PP_ElectronicsHub", "PP_RightToRepair"],
  ["PP_FishingOptimization", "PP_StrictGreenCity"],
  ["PP_GigWorkerRights", "PP_ShareEconomy"],
  ["PP_RightToDisconnect", "PP_StartupOrNothing"],
  ["PP_NightCurfew", "PP_WhiteNight", "PP_LateNightBars", "PP_NightWithoutCops", "PP_PermanentFestival"],
  ["PP_VocationalSchools", "PP_MandatoryUniversity"],
  ["PP_FiberForAll", "PP_MegaNetwork5G"],
  ["PP_HeritageProtection", "PP_ConstructionSubsidy"],
  ["PP_StreetArt", "PP_ZeroGraffiti"]
];

export const getConflictingActivePolicies = (
  policyName: string,
  activePolicies: ActivePolicyItem[],
  policyMetas: PolicyItem[]
): string[] => {
  if (!policyName.startsWith('PP_') && !policyName.startsWith('DP_')) return [];

  const activeNames = new Set(
    activePolicies
      .map(ap => {
        const pol = policyMetas.find(p => p.entityKey === ap.key);
        return pol ? pol.name : '';
      })
      .filter(Boolean)
  );

  const conflicts: string[] = [];
  for (const group of POLICY_CONFLICT_GROUPS) {
    if (group.includes(policyName)) {
      for (const other of group) {
        if (other !== policyName && activeNames.has(other)) {
          conflicts.push(other);
        }
      }
    }
  }

  return Array.from(new Set(conflicts));
};

export const isPolicyForCity = (pol: { name: string; isCity?: boolean; isDistrict?: boolean }): boolean => {
  if (pol.name.startsWith('DP_')) return false;
  if (pol.name.startsWith('PP_')) return true;
  return !!pol.isCity;
};

export const isPolicyForDistrict = (pol: { name: string; isCity?: boolean; isDistrict?: boolean }): boolean => {
  if (pol.name.startsWith('PP_')) return false;
  if (pol.name.startsWith('DP_')) return true;
  return !!pol.isDistrict;
};

export const resolvePolicySliderMax = (pol: { name: string; sliderMax?: number }): number => {
  if (typeof pol.sliderMax === 'number' && Number.isFinite(pol.sliderMax) && pol.sliderMax > 1) {
    return pol.sliderMax;
  }
  const lower = (pol.name || '').toLowerCase();
  return lower.includes('parking') || lower.includes('taxi') ? 50 : 100;
};
