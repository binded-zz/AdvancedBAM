using System.Collections.Generic;

namespace AdvancedBAM.Systems.Dtos
{
    public sealed class InventoryPackMetaVm
    {
        public string Name { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
    }

    public sealed class InventoryStatusVm
    {
        public int Placed { get; set; }
        public int Catalog { get; set; }
        public int ElapsedMs { get; set; }
        public List<InventoryPackMetaVm> Packs { get; set; } = new List<InventoryPackMetaVm>();
    }
    /// <summary>
    /// One row in the Unified Asset Explorer. Placed buildings and unplaced catalog
    /// prefabs share this shape so the UI can filter/sort a single list.
    /// Serialized to camelCase JSON (see Mod.JsonSettings).
    /// Contract mirror: AdvancedBAM/src/models/assetModels.ts -> UnifiedAssetItem.
    /// </summary>
    public sealed class UnifiedAssetVm
    {
        /// <summary>Unique row id: entityKey for placed items, "prefab:" + prefabKey for catalog items.</summary>
        public string Id { get; set; } = string.Empty;

        /// <summary>"index:version" of the placed building. Empty for catalog items.</summary>
        public string EntityKey { get; set; } = string.Empty;

        /// <summary>"index:version" of the tenant company entity, if building has a tenant company.</summary>
        public string CompanyEntityKey { get; set; } = string.Empty;

        /// <summary>"index:version" of the prefab entity. Used by PLOP / CLONE.</summary>
        public string PrefabKey { get; set; } = string.Empty;

        public string PrefabName { get; set; } = string.Empty;
        public bool IsPlaced { get; set; }

        /// <summary>Residential | Commercial | Industrial | Office | Storage | Service | Other</summary>
        public string Category { get; set; } = "Other";

        /// <summary>e.g. "Healthcare", "High Density", "Metals".</summary>
        public string SubCategory { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;
        public string SecondaryName { get; set; } = string.Empty;
        public string District { get; set; } = string.Empty;
        public string DistrictKey { get; set; } = string.Empty;
        public string Theme { get; set; } = string.Empty;
        public string ThemeIcon { get; set; } = string.Empty;
        public string AssetPack { get; set; } = "Base Game";
        public string AssetPackIcon { get; set; } = string.Empty;
        public string Thumbnail { get; set; } = string.Empty;

        public int Level { get; set; }
        public string Density { get; set; } = string.Empty;
        public string ZoneType { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Resource { get; set; } = string.Empty;
        public List<string> InputResources { get; set; } = new List<string>();
        public List<string> OutputResources { get; set; } = new List<string>();
        public int Happiness { get; set; } = -1;
        public bool IsSignature { get; set; }

        /// <summary>Corner type: "straight", "left", "right", "both", "all"</summary>
        public string CornerType { get; set; } = "straight";

        /// <summary>True when this prefab is a sub-building upgrade or building extension.</summary>
        public bool IsSubBuilding { get; set; }

        /// <summary>True when the building is Destroyed, Abandoned or Condemned (REPAIR is offered).</summary>
        public bool NeedsRepair { get; set; }

        /// <summary>True when the building has a road, pedestrian, car, track, or pathfind connection warning.</summary>
        public bool HasBrokenPath { get; set; }

        /// <summary>Residential: households. Business/Service: employees.</summary>
        public int Occupied { get; set; }

        /// <summary>Residential: household capacity. Business/Service: max workers.</summary>
        public int Capacity { get; set; }

        /// <summary>0-100 building efficiency. -1 when not applicable (catalog items).</summary>
        public int Efficiency { get; set; } = -1;

        /// <summary>Service vehicle metrics (Active / Max).</summary>
        public int Vehicles { get; set; }
        public int VehiclesMax { get; set; }

        /// <summary>Company delivery vehicle fleet (Active / Max).</summary>
        public int CompanyVehicles { get; set; }
        public int CompanyVehiclesMax { get; set; }

        /// <summary>Utilities consumption / accumulation metrics.</summary>
        public int ElectricityConsumption { get; set; }
        public int WaterConsumption { get; set; }
        public int GarbageAccumulation { get; set; }
        public int MaintenanceCost { get; set; }
        public int ConstructionCost { get; set; }

        /// <summary>Installed upgrades / sub-buildings attached to this parent building.</summary>
        public List<SubBuildingVm> SubBuildings { get; set; } = new List<SubBuildingVm>();

        /// <summary>Efficiency factors breakdown from DynamicBuffer<Efficiency>.</summary>
        public List<EfficiencyFactorVm> EfficiencyFactors { get; set; } = new List<EfficiencyFactorVm>();

        /// <summary>Company financials & economics (Commercial, Industrial, Office).</summary>
        public int Income { get; set; }
        public int MonthlyProfit { get; set; }
        public int NetWorth { get; set; }
        public int Customers { get; set; }
        public int CurrentCustomers { get; set; }
        public int WagePaid { get; set; }
        public int RentPaid { get; set; }
        public int TaxPaid { get; set; }
        public int InputCost { get; set; }
        public int ElectricityPaid { get; set; }
        public int WaterPaid { get; set; }
        public int SewagePaid { get; set; }
        public int GarbagePaid { get; set; }
        public int? ProfitMargin { get; set; }
        public string ProfitabilityTier { get; set; } = string.Empty;
        public string TradePartner { get; set; } = string.Empty;

        /// <summary>Worker and resident education breakdown (Uneducated, Poorly, Educated, Well, Highly).</summary>
        public List<EducationTierDto> EducationTiers { get; set; } = new List<EducationTierDto>();

        /// <summary>Per-resource stored amounts with tonnages and raw/processed categories.</summary>
        public List<StoredResourceDto> StoredResources { get; set; } = new List<StoredResourceDto>();

        /// <summary>Service facility specific usage (Patients, Prisoners, Students, Stored waste/bodies).</summary>
        public int ServiceUsage { get; set; }
        public int ServiceCapacity { get; set; }
        public string ServiceUnit { get; set; } = string.Empty;

        /// <summary>Street / Road access name from building's m_RoadEdge.</summary>
        public string RoadName { get; set; } = string.Empty;

        /// <summary>Citizen presence count from CitizenPresence.</summary>
        public int CitizenPresence { get; set; }

        /// <summary>Attractiveness value from AttractivenessProvider / AttractionData.</summary>
        public int Attractiveness { get; set; }

        /// <summary>Physical goods stored in tonnes (supports decimal precision like 13.99 t).</summary>
        public float StorageAmount { get; set; }

        /// <summary>Storage capacity limit in tonnes.</summary>
        public float StorageCapacity { get; set; }

        /// <summary>Tax rate percentage for company or building.</summary>
        public int TaxRate { get; set; }

        /// <summary>Crime probability / risk percentage.</summary>
        public float CrimeProbability { get; set; }

        /// <summary>Mail units produced/sent.</summary>
        public int MailSending { get; set; }

        /// <summary>Mail units received/accumulated.</summary>
        public int MailReceiving { get; set; }

        /// <summary>City-wide modifiers granted by this building (Signature, Unique, Service).</summary>
        public List<string> CityEffects { get; set; } = new List<string>();

        /// <summary>Local radius effects/auras granted by this building.</summary>
        public List<string> LocalEffects { get; set; } = new List<string>();

        /// <summary>Building upgrade/condition progress towards next level.</summary>
        public int BuildingCondition { get; set; }

        /// <summary>Max leveling condition cost required for next level.</summary>
        public int MaxCondition { get; set; }

        /// <summary>Happiness drivers / factors breakdown for residential buildings.</summary>
        public List<EfficiencyFactorVm> HappinessFactors { get; set; } = new List<EfficiencyFactorVm>();

        /// <summary>Residential household financials & living economics.</summary>
        public string HouseholdWealth { get; set; } = string.Empty;
        public int HouseholdIncome { get; set; }
        public int HouseholdRent { get; set; }
        public int HouseholdUpkeep { get; set; }
        public int HouseholdResourceCost { get; set; }
        public int HouseholdFees { get; set; }
        public int Pets { get; set; }

        /// <summary>Rent valuation and calculation breakdown.</summary>
        public int TotalRent { get; set; }
        public int LotSize { get; set; }
        public float SpaceMultiplier { get; set; }
        public float BaseRent { get; set; }
        public float LandValueModifier { get; set; }
        public float LandValueBase { get; set; }
        public float LandValueRate { get; set; }
        public int RentPerRenter { get; set; }

        /// <summary>Dimensions of the building lot (e.g. "4x4") from BuildingData.m_LotSize.</summary>
        public string LotDimensions { get; set; } = string.Empty;

        /// <summary>Direct street/road land value in ¢/sq m from building's road edge.</summary>
        public int RoadLandValue { get; set; }

        /// <summary>Parking facility capacity, current occupied vehicles, and parking fee.</summary>
        public int ParkingCapacity { get; set; }
        public int ParkedVehicles { get; set; }
        public int ParkingFee { get; set; }
        public int ParkingComfort { get; set; }

        /// <summary>Park maintenance level (0-100%). -1 if not a park.</summary>
        public int ParkMaintenance { get; set; } = -1;

        /// <summary>Residents or homeless people living/camping in this park or building.</summary>
        public int Residents { get; set; }

        /// <summary>Recreation/leisure provider value and type.</summary>
        public int Recreation { get; set; }
        public string LeisureType { get; set; } = string.Empty;

        /// <summary>Total monthly upkeep (MaintenanceCost + WagePaid).</summary>
        public int TotalUpkeep { get; set; }

        /// <summary>Historical building preserved flag.</summary>
        public bool IsHistorical { get; set; }

        /// <summary>Mixed-use dual inspection flags and tenant workforce.</summary>
        public bool IsMixedUse { get; set; }
        public int CommercialOccupied { get; set; }
        public int CommercialCapacity { get; set; }

        /// <summary>Public transport and cargo hub operational metrics.</summary>
        public bool IsTransitHub { get; set; }
        public bool IsCargoHub { get; set; }
        public int TransitLines { get; set; }
        public int WaitingPassengers { get; set; }
        public int AverageWaitTime { get; set; }
        public float StationComfort { get; set; }
        /// <summary>Damaged / destroyed status and deactivated / turned off status.</summary>
        public bool IsDamaged { get; set; }
        public float DamagePercent { get; set; }
        public bool IsTurnedOff { get; set; }

        public bool ShouldSerializeDamagePercent() => DamagePercent > 0f;

        public bool ShouldSerializeInputResources() => InputResources != null && InputResources.Count > 0;
        public bool ShouldSerializeOutputResources() => OutputResources != null && OutputResources.Count > 0;
        public bool ShouldSerializeSubBuildings() => SubBuildings != null && SubBuildings.Count > 0;
        public bool ShouldSerializeEfficiencyFactors() => EfficiencyFactors != null && EfficiencyFactors.Count > 0;
        public bool ShouldSerializeEducationTiers() => EducationTiers != null && EducationTiers.Count > 0;
        public bool ShouldSerializeStoredResources() => StoredResources != null && StoredResources.Count > 0;
        public bool ShouldSerializeCityEffects() => CityEffects != null && CityEffects.Count > 0;
        public bool ShouldSerializeLocalEffects() => LocalEffects != null && LocalEffects.Count > 0;
        public bool ShouldSerializeHappinessFactors() => HappinessFactors != null && HappinessFactors.Count > 0;
    }

    /// <summary>One efficiency factor impact on building performance.</summary>
    public sealed class EfficiencyFactorVm
    {
        public string Factor { get; set; } = string.Empty;
        public int Percentage { get; set; }
        public int Cumulative { get; set; }
    }

    /// <summary>One sub-building upgrade installed on a parent building entity.</summary>
    public sealed class SubBuildingVm
    {
        public string EntityKey { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string PrefabName { get; set; } = string.Empty;
        public string Type { get; set; } = "Sub-building";
        public string Benefit { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int Upkeep { get; set; }
        public int Cost { get; set; }
        public int Workers { get; set; }
        public bool IsDamaged { get; set; }
        public float DamagePercent { get; set; }
        public bool IsDestroyed { get; set; }
        public bool ShouldSerializeDamagePercent() => DamagePercent > 0f;
    }

    /// <summary>One card in the Services summary strip.</summary>
    public sealed class ServiceStatusVm
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int BuildingCount { get; set; }
        public int AvgEfficiency { get; set; }

        /// <summary>Usage figure (consumption / employees / patients...).</summary>
        public float Usage { get; set; }

        /// <summary>Capacity figure matching <see cref="Usage"/>.</summary>
        public float Capacity { get; set; }

        /// <summary>Unit label for Usage/Capacity, e.g. "MW", "m3", "Workers".</summary>
        public string Unit { get; set; } = string.Empty;
    }

    public sealed class ServiceStatusPayload
    {
        public List<ServiceStatusVm> Cards { get; set; } = new List<ServiceStatusVm>();
    }

    public sealed class DistrictPolicyActiveVm
    {
        public string Key { get; set; } = string.Empty;
        public float Adjustment { get; set; }
    }

    public sealed class DistrictVm
    {
        public string EntityKey { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsCity { get; set; }
        public string CityName { get; set; } = string.Empty;

        // Zoning & Properties
        public int ResidentialCount { get; set; }
        public int MixedCount { get; set; }
        public int CommercialCount { get; set; }
        public int IndustrialCount { get; set; }
        public int OfficeCount { get; set; }
        public int StorageCount { get; set; }
        public int ServiceCount { get; set; }
        public int TotalBuildings { get; set; }

        // Demographics
        public int Population { get; set; }
        public int Households { get; set; }
        public int HouseholdCapacity { get; set; }
        public int Children { get; set; }
        public int Teens { get; set; }
        public int Adults { get; set; }
        public int Seniors { get; set; }
        public int Students { get; set; }
        public int Tourists { get; set; }
        public int Homeless { get; set; }

        // Education Breakdown
        public int EduUneducated { get; set; }
        public int EduPoorlyEducated { get; set; }
        public int EduEducated { get; set; }
        public int EduWellEducated { get; set; }
        public int EduHighlyEducated { get; set; }

        // Workforce & Employment
        public int Workers { get; set; }
        public int MaxWorkers { get; set; }
        public int Unemployed { get; set; }
        public float UnemploymentRate { get; set; }
        public int WorkerUneducated { get; set; }
        public int WorkerPoorlyEducated { get; set; }
        public int WorkerEducated { get; set; }
        public int WorkerWellEducated { get; set; }
        public int WorkerHighlyEducated { get; set; }
        public int WorkplaceUneducated { get; set; }
        public int WorkplacePoorlyEducated { get; set; }
        public int WorkplaceEducated { get; set; }
        public int WorkplaceWellEducated { get; set; }
        public int WorkplaceHighlyEducated { get; set; }
        public int OpenPositions { get; set; }

        // Schools (Capacity, Enrolled & Eligibility)
        public int ElemCapacity { get; set; }
        public int ElemEnrolled { get; set; }
        public int ElemEligible { get; set; }
        public int HsCapacity { get; set; }
        public int HsEnrolled { get; set; }
        public int HsEligible { get; set; }
        public int CollegeCapacity { get; set; }
        public int CollegeEnrolled { get; set; }
        public int CollegeEligible { get; set; }
        public int UniCapacity { get; set; }
        public int UniEnrolled { get; set; }
        public int UniEligible { get; set; }

        // Economy & Quality of Life
        public int AvgHappiness { get; set; }
        public int AvgBuildingLevel { get; set; }
        public int AvgProfitability { get; set; }
        public double AvgWealth { get; set; }
        public string AvgWealthKey { get; set; } = string.Empty;
        public double AvgIncome { get; set; }
        public double AvgRent { get; set; }
        public double AvgUpkeep { get; set; }
        public double AvgResourceCost { get; set; }
        public double AvgFees { get; set; }
        public float AvgLandValue { get; set; }
        public float TotalLandValue { get; set; }
        public int LandValueSamples { get; set; }
        public float TotalCrime { get; set; }
        public int Sick { get; set; }
        public int Pets { get; set; }
        public float StorageAmount { get; set; }
        public float StorageCapacity { get; set; }

        // Geography, Attractiveness & Commercial Activity
        public double Area { get; set; }
        public int Attractiveness { get; set; }
        public int TouristVisits { get; set; }
        public int CommercialActivity { get; set; }

        // Utilities & Public Services Aggregates
        public int ElectricityConsumption { get; set; }
        public int WaterConsumption { get; set; }
        public int GarbageAccumulation { get; set; }
        public int MaintenanceCost { get; set; }

        // Game-Authoritative City Snapshot Counters
        public int GameAllCitizens { get; set; }
        public int GameEmployees { get; set; }
        public int GameTourists { get; set; }
        public int GameCommuters { get; set; }
        public int GameMovingAway { get; set; }
        public string PopVerify { get; set; } = string.Empty;

        // District Top Happiness Drivers
        public List<EfficiencyFactorVm> HappinessFactors { get; set; } = new List<EfficiencyFactorVm>();

        [Newtonsoft.Json.JsonIgnore] public Unity.Entities.Entity Entity { get; set; }
        [Newtonsoft.Json.JsonIgnore] public int DemographicSamples { get; set; }
        [Newtonsoft.Json.JsonIgnore] public int HappinessSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public int BuildingLevelSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public int SpawnableBuildingCount { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double WealthSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double IncomeSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double RentSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double UpkeepSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double ResourceCostSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double FeesSum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public int EmployableAdults { get; set; }
        [Newtonsoft.Json.JsonIgnore] public double ProfitabilitySum { get; set; }
        [Newtonsoft.Json.JsonIgnore] public int ProfitabilitySamples { get; set; }

        public List<DistrictPolicyActiveVm> Policies { get; set; } = new List<DistrictPolicyActiveVm>();
    }

    public sealed class DistrictPolicyMetaVm
    {
        public string EntityKey { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public bool IsCity { get; set; }
        public bool IsDistrict { get; set; }
        public bool HasSlider { get; set; }
        public float? SliderDefault { get; set; }
        public float? SliderMin { get; set; }
        public float? SliderMax { get; set; }
    }

    public sealed class EducationTierDto
    {
        public int Level { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Filled { get; set; }
        public int Total { get; set; }
    }

    public sealed class StoredResourceDto
    {
        public string Name { get; set; } = string.Empty;
        public int Amount { get; set; }
        public float Weight { get; set; }
        public string Type { get; set; } = "Material";
    }
}
