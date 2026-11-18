using System;
using System.Collections.Generic;
using AdvancedBAM.Systems.Dtos;
using AdvancedBAM.Utilities;
using Game.Buildings;
using Game.Citizens;
using Game.Companies;
using Game.Economy;
using Game.Prefabs;
using Unity.Collections;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    public partial class AssetInventorySystem
    {
        private static readonly Resource[] _allResources = (Resource[])System.Enum.GetValues(typeof(Resource));
        private static readonly System.Reflection.PropertyInfo s_avgHappinessSelectedEntityProp =
            typeof(Game.UI.InGame.AverageHappinessSection).GetProperty("selectedEntity", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        private static readonly System.Reflection.FieldInfo s_avgHappinessFactorsField =
            typeof(Game.UI.InGame.AverageHappinessSection).GetField("<happinessFactors>k__BackingField", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        private readonly Dictionary<Entity, string> _districtNameCache = new Dictionary<Entity, string>();
        private readonly Dictionary<Entity, string> _roadNameCache = new Dictionary<Entity, string>();
        private readonly List<Efficiency> _effScratch = new List<Efficiency>(16);
        private readonly int[] _resEduScratch = new int[5];
        private readonly int[] _resEduTotalScratch = new int[5];
        private static readonly int[] _wpFilledScratch = new int[5];
        private static readonly int[] _wpReqScratch = new int[5];
        private readonly HashSet<string> _factorSeenScratch = new HashSet<string>();
        private readonly HashSet<Entity> _routeSeenScratch = new HashSet<Entity>();
        private readonly HashSet<Entity> _upgradeSeenScratch = new HashSet<Entity>();
        private readonly List<string> _benefitsScratch = new List<string>(8);

        private sealed class StaticBuildingDescriptor
        {
            public Entity Prefab;
            public int Level;
            public string Category;
            public string SubCategory;
            public string Name;
            public string SecondaryName;
            public string RoadName;
            public int RoadLandValue;
            public string District;
            public string DistrictKey;
            public string Theme;
            public string ThemeIcon;
            public string AssetPack;
            public string AssetPackIcon;
            public string Density;
            public string ZoneType;
            public string CornerType;
            public string LotDimensions;
            public int LotSize;
            public string Thumbnail;
            public bool IsSignature;
            public bool IsSubBuilding;
            public int ConstructionCost;
        }

        private readonly Dictionary<Entity, StaticBuildingDescriptor> _staticDescriptorCache = new Dictionary<Entity, StaticBuildingDescriptor>(8192);

        public void ClearStaticDescriptorCache()
        {
            _staticDescriptorCache.Clear();
        }

        private void CollectPlacedBuildings(List<UnifiedAssetVm> into)
        {
            var em = EntityManager;
            using (var entities = _placedQuery.ToEntityArray(Allocator.TempJob))
            {
                if (_staticDescriptorCache.Count > entities.Length + 4096)
                {
                    _staticDescriptorCache.Clear();
                }

                for (int i = 0; i < entities.Length; i++)
                {
                    var entity = entities[i];
                    if (entity == Entity.Null ||
                        !em.Exists(entity) ||
                        em.HasComponent<Game.Common.Deleted>(entity) ||
                        em.HasComponent<Game.Tools.Temp>(entity))
                    {
                        continue;
                    }

                    // Sub-buildings owned by another building are rolled into their parent row.
                    if (em.HasComponent<Game.Common.Owner>(entity))
                    {
                        var owner = em.GetComponentData<Game.Common.Owner>(entity).m_Owner;
                        if (owner != Entity.Null && owner != entity) continue;
                    }

                    try
                    {
                        var vm = BuildPlacedRow(entity);
                        if (vm != null && !string.IsNullOrEmpty(vm.EntityKey)) into.Add(vm);
                    }
                    catch (Exception ex)
                    {
                        Mod.Log.Warn($"AssetInventorySystem.CollectPlacedBuildings: Failed building placed VM for entity {entity.Index}:{entity.Version} - {ex.Message}");
                    }
                }
            }
        }

        private UnifiedAssetVm BuildPlacedRow(Entity entity)
        {
            var em = EntityManager;
            var prefab = em.GetComponentData<PrefabRef>(entity).m_Prefab;
            if (prefab == Entity.Null) return null;

            var info = GetPrefabInfo(prefab);
            string key = EntityKey.From(entity);

            UnifiedAssetVm vm;

            if (_staticDescriptorCache.TryGetValue(entity, out var desc) && desc.Prefab == prefab)
            {
                bool damagedOrAbandoned = IsEntityDamagedOrAbandoned(em, entity);
                bool hasBrokenPath = _repairSystem != null && _repairSystem.HasRepairNeedOrLeftovers(entity, "path", includeHierarchy: true);
                int liveLandValue = desc.RoadLandValue;
                if (em.HasComponent<Building>(entity))
                {
                    var bldg = em.GetComponentData<Building>(entity);
                    if (bldg.m_RoadEdge != Entity.Null && em.HasComponent<Game.Net.LandValue>(bldg.m_RoadEdge))
                    {
                        try { liveLandValue = (int)System.Math.Round(em.GetComponentData<Game.Net.LandValue>(bldg.m_RoadEdge).m_LandValue); }
                        catch (System.Exception ex) { Mod.Log.Debug($"Placed read: {ex.Message}"); }
                    }
                }
                string liveDistrict = ResolveDistrict(entity, out string liveDistrictKey);

                vm = new UnifiedAssetVm
                {
                    Id = key,
                    EntityKey = key,
                    PrefabKey = info.Key,
                    PrefabName = info.Name,
                    IsPlaced = true,
                    Category = desc.Category,
                    SubCategory = desc.SubCategory,
                    Name = desc.Name,
                    SecondaryName = desc.SecondaryName,
                    RoadName = desc.RoadName,
                    RoadLandValue = liveLandValue,
                    District = liveDistrict,
                    DistrictKey = liveDistrictKey,
                    Theme = desc.Theme,
                    ThemeIcon = desc.ThemeIcon,
                    AssetPack = desc.AssetPack,
                    AssetPackIcon = desc.AssetPackIcon,
                    Density = desc.Density,
                    ZoneType = desc.ZoneType,
                    Thumbnail = desc.Thumbnail,
                    Level = info.Level,
                    IsSignature = desc.IsSignature,
                    CornerType = desc.CornerType,
                    IsSubBuilding = desc.IsSubBuilding,
                    ConstructionCost = desc.ConstructionCost,
                    LotDimensions = desc.LotDimensions,
                    LotSize = desc.LotSize,
                    NeedsRepair = damagedOrAbandoned,
                    HasBrokenPath = hasBrokenPath,
                    IsDamaged = damagedOrAbandoned,
                    DamagePercent = ComputeEntityDamagePercent(em, entity),
                    IsTurnedOff = em.HasComponent<Building>(entity) && BuildingUtils.CheckOption(em.GetComponentData<Building>(entity), BuildingOption.Inactive),
                };

                if (_nameSystem != null)
                {
                    try
                    {
                        if (_nameSystem.TryGetCustomName(entity, out var customName) && !string.IsNullOrEmpty(customName))
                        {
                            vm.Name = customName;
                        }
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }
            }
            else
            {
                int constructionCost = 0;
                if (em.HasComponent<PlaceableObjectData>(prefab))
                {
                    constructionCost = (int)em.GetComponentData<PlaceableObjectData>(prefab).m_ConstructionCost;
                }
                bool isDamagedInit = IsEntityDamagedOrAbandoned(em, entity);
                bool hasBrokenPathInit = _repairSystem != null && _repairSystem.HasRepairNeedOrLeftovers(entity, "path", includeHierarchy: true);

                vm = new UnifiedAssetVm
                {
                    Id = key,
                    EntityKey = key,
                    PrefabKey = info.Key,
                    PrefabName = info.Name,
                    IsPlaced = true,
                    Category = ResolvePlacedCategory(entity, info),
                    SubCategory = info.SubCategory,
                    SecondaryName = info.Name,
                    Theme = info.Theme,
                    ThemeIcon = info.ThemeIcon,
                    AssetPack = info.AssetPack,
                    AssetPackIcon = info.AssetPackIcon,
                    Density = info.Density,
                    ZoneType = info.ZoneType,
                    Thumbnail = info.Thumbnail,
                    Level = info.Level,
                    IsSignature = info.IsSignature || em.HasComponent<Signature>(entity),
                    CornerType = info.CornerType,
                    IsSubBuilding = info.IsSubBuilding,
                    ConstructionCost = constructionCost,
                    NeedsRepair = isDamagedInit,
                    HasBrokenPath = hasBrokenPathInit,
                    IsDamaged = isDamagedInit,
                    DamagePercent = ComputeEntityDamagePercent(em, entity),
                    IsTurnedOff = em.HasComponent<Building>(entity) && BuildingUtils.CheckOption(em.GetComponentData<Building>(entity), BuildingOption.Inactive),
                };

                // Ensure placed transport / municipal service buildings have proper SubCategory
                if (vm.Category == AssetCategory.Service)
                {
                    if (em.HasComponent<Game.Buildings.TransportDepot>(entity) ||
                        em.HasComponent<Game.Buildings.TransportStation>(entity) ||
                        em.HasComponent<Game.Buildings.PublicTransportStation>(entity) ||
                        em.HasComponent<Game.Buildings.CargoTransportStation>(entity) ||
                        em.HasComponent<Game.Buildings.ParkingFacility>(entity))
                    {
                        if (string.IsNullOrEmpty(vm.SubCategory) || vm.SubCategory == "Other" || vm.SubCategory.ToLowerInvariant().Contains("road"))
                        {
                            vm.SubCategory = "Transportation";
                        }
                    }
                    else if (em.HasComponent<Game.Buildings.PostFacility>(entity))
                    {
                        if (string.IsNullOrEmpty(vm.SubCategory) || vm.SubCategory == "Other")
                        {
                            vm.SubCategory = "Communications";
                        }
                    }
                    else if (em.HasComponent<Game.Buildings.MaintenanceDepot>(entity))
                    {
                        if (string.IsNullOrEmpty(vm.SubCategory) || vm.SubCategory == "Other")
                        {
                            vm.SubCategory = "Roads";
                        }
                    }
                }

                // 1. Real Street Address & Street Land Value from BuildingUtils.GetAddress and bldg.m_RoadEdge
                string fullAddress = string.Empty;
                if (em.HasComponent<Building>(entity))
                {
                    var bldg = em.GetComponentData<Building>(entity);
                    Entity roadEntity = Entity.Null;
                    try
                    {
                        if (BuildingUtils.GetAddress(em, entity, bldg.m_RoadEdge, bldg.m_CurvePosition, out roadEntity, out int streetNumber))
                        {
                            string streetName = ResolveRoadName(roadEntity);
                            if (!string.IsNullOrEmpty(streetName))
                            {
                                fullAddress = streetNumber > 0 ? $"{streetNumber} {streetName}" : streetName;
                            }
                        }
                        else if (roadEntity != Entity.Null)
                        {
                            fullAddress = ResolveRoadName(roadEntity);
                        }
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }

                    if (string.IsNullOrEmpty(fullAddress) && bldg.m_RoadEdge != Entity.Null)
                    {
                        if (em.HasComponent<Game.Net.Aggregated>(bldg.m_RoadEdge))
                        {
                            var agg = em.GetComponentData<Game.Net.Aggregated>(bldg.m_RoadEdge).m_Aggregate;
                            if (agg != Entity.Null) fullAddress = ResolveRoadName(agg);
                        }
                        if (string.IsNullOrEmpty(fullAddress))
                        {
                            fullAddress = ResolveRoadName(bldg.m_RoadEdge);
                        }
                    }

                    if (bldg.m_RoadEdge != Entity.Null && em.HasComponent<Game.Net.LandValue>(bldg.m_RoadEdge))
                    {
                        try
                        {
                            vm.RoadLandValue = (int)System.Math.Round(em.GetComponentData<Game.Net.LandValue>(bldg.m_RoadEdge).m_LandValue);
                        }
                        catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                    }
                }
                vm.RoadName = fullAddress;

                // Resolve building title & subtitle matching Native Selected Info Panel (SIP)
                string prefabDisplayName = !string.IsNullOrEmpty(info.LocalizedName) ? info.LocalizedName : FormatPrefabDisplayName(info.Name);
                string customName = string.Empty;
                bool hasCustomName = false;
                if (_nameSystem != null)
                {
                    try
                    {
                        hasCustomName = _nameSystem.TryGetCustomName(entity, out customName) && !string.IsNullOrEmpty(customName);
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }

                string renderedName = hasCustomName ? customName : ResolveCleanEntityName(entity);
                if (vm.Category == AssetCategory.Residential && !vm.IsSignature && !hasCustomName && !string.IsNullOrEmpty(fullAddress))
                {
                    vm.Name = fullAddress;
                    vm.SecondaryName = prefabDisplayName;
                }
                else if (!hasCustomName && em.HasComponent<SpawnableBuildingData>(prefab) && !vm.IsSignature)
                {
                    bool isGenericRendered = string.IsNullOrEmpty(renderedName)
                                          || renderedName == info.Name
                                          || renderedName == prefabDisplayName
                                          || renderedName == info.SubCategory;
                    if (!isGenericRendered)
                    {
                        vm.Name = renderedName;
                        vm.SecondaryName = !string.IsNullOrEmpty(fullAddress) ? fullAddress : prefabDisplayName;
                    }
                    else if (!string.IsNullOrEmpty(fullAddress))
                    {
                        vm.Name = fullAddress;
                        vm.SecondaryName = prefabDisplayName;
                    }
                    else
                    {
                        vm.Name = prefabDisplayName;
                        vm.SecondaryName = info.Name;
                    }
                }
                else
                {
                    vm.Name = !string.IsNullOrEmpty(renderedName) && renderedName != info.Name ? renderedName : prefabDisplayName;
                    vm.SecondaryName = vm.Name != prefabDisplayName
                        ? prefabDisplayName
                        : info.Name;
                }

                vm.District = ResolveDistrict(entity, out string distKey);
                vm.DistrictKey = distKey;

                // Lot Dimensions from BuildingData on prefab
                if (em.HasComponent<BuildingData>(prefab))
                {
                    try
                    {
                        var bData = em.GetComponentData<BuildingData>(prefab);
                        vm.LotDimensions = $"{bData.m_LotSize.x}x{bData.m_LotSize.y}";
                        vm.LotSize = bData.m_LotSize.x * bData.m_LotSize.y;
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }

                _staticDescriptorCache[entity] = new StaticBuildingDescriptor
                {
                    Prefab = prefab,
                    Level = info.Level,
                    Category = vm.Category,
                    SubCategory = vm.SubCategory,
                    Name = vm.Name,
                    SecondaryName = vm.SecondaryName,
                    RoadName = vm.RoadName,
                    RoadLandValue = vm.RoadLandValue,
                    District = vm.District,
                    DistrictKey = vm.DistrictKey,
                    Theme = vm.Theme,
                    ThemeIcon = vm.ThemeIcon,
                    AssetPack = vm.AssetPack,
                    AssetPackIcon = vm.AssetPackIcon,
                    Density = vm.Density,
                    ZoneType = vm.ZoneType,
                    CornerType = vm.CornerType,
                    LotDimensions = vm.LotDimensions,
                    LotSize = vm.LotSize,
                    Thumbnail = vm.Thumbnail,
                    IsSignature = vm.IsSignature,
                    IsSubBuilding = vm.IsSubBuilding,
                    ConstructionCost = vm.ConstructionCost,
                };
            }
            vm.Efficiency = ReadEfficiency(entity, vm);
            FillOccupancy(entity, vm, info);
            FillServiceMetrics(entity, prefab, vm);
            FillEffects(prefab, vm);
            FillCondition(entity, prefab, vm);

            // Lot Dimensions from BuildingData on prefab (fallback if not cached)
            if (string.IsNullOrEmpty(vm.LotDimensions) && em.HasComponent<BuildingData>(prefab))
            {
                try
                {
                    var bData = em.GetComponentData<BuildingData>(prefab);
                    vm.LotDimensions = $"{bData.m_LotSize.x}x{bData.m_LotSize.y}";
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }

            // Parking facility metrics (capacity, parked cars, fee)
            FillParkingMetrics(entity, vm);

            // Historical building status
            FillHistoricalStatus(entity, vm);

            // Park, Leisure, Attractiveness, and Homeless residents
            FillParkAndLeisureMetrics(entity, prefab, vm);

            // 2. Citizen Presence
            if (em.HasComponent<CitizenPresence>(entity))
            {
                if (em.HasComponent<CitizenPresence>(entity))
            {
                try { vm.CitizenPresence = em.GetComponentData<CitizenPresence>(entity).m_Presence; }
                catch (System.Exception ex) { Mod.Log.Debug($"CitizenPresence read for {entity.Index}: {ex.Message}"); }
            }
            }

            // 3. Attractiveness
            int attractiveness = vm.Attractiveness;
            if (em.HasComponent<AttractionData>(prefab))
            {
                int prefAttr = em.GetComponentData<AttractionData>(prefab).m_Attractiveness;
                if (prefAttr > attractiveness) attractiveness = prefAttr;
            }
            if (em.HasComponent<AttractivenessProvider>(entity))
            {
                var attrProv = em.GetComponentData<AttractivenessProvider>(entity);
                if (attrProv.m_Attractiveness > attractiveness) attractiveness = attrProv.m_Attractiveness;
            }
            vm.Attractiveness = attractiveness;

            // 4. Scan Renters (Residents Happiness, Residential Education, AND Tenant Companies in one pass)
            bool eduPopulated = false;
            if (em.HasBuffer<Renter>(entity))
            {
                var renters = em.GetBuffer<Renter>(entity, true);
                bool isRes = vm.Category == AssetCategory.Residential;
                if (isRes) System.Array.Clear(_resEduScratch, 0, 5);
                int happySum = 0;
                int happyCount = 0;

                for (int r = 0; r < renters.Length; r++)
                {
                    var rEnt = renters[r].m_Renter;
                    if (rEnt == Entity.Null || !em.Exists(rEnt)) continue;

                    // Single-pass Residential Happiness + Education scan
                    if ((isRes || happyCount < 250) &&
                        BamEcsUtils.IsValidMovedInHousehold(em, rEnt, out _) &&
                        em.HasBuffer<HouseholdCitizen>(rEnt))
                    {
                        var citizens = em.GetBuffer<HouseholdCitizen>(rEnt, true);
                        for (int c = 0; c < citizens.Length; c++)
                        {
                            if (!isRes && happyCount >= 250) break;
                            var cEnt = citizens[c].m_Citizen;
                            if (BamEcsUtils.IsLivingCitizen(em, cEnt))
                            {
                                var citData = em.GetComponentData<Citizen>(cEnt);
                                if (happyCount < 250)
                                {
                                    happySum += citData.Happiness;
                                    happyCount++;
                                }
                                if (isRes)
                                {
                                    int lvl = citData.GetEducationLevel();
                                    if (lvl >= 0 && lvl < 5) _resEduScratch[lvl]++;
                                }
                            }
                        }
                    }

                    // Tenant Company Check (Works for Commercial, Industrial, Office, and Mixed Housing)
                    ReadCompanyEntity(em, rEnt, vm);
                }

                if (happyCount > 0)
                {
                    vm.Happiness = (int)System.Math.Round((double)happySum / happyCount);
                }
                else if (vm.Category != AssetCategory.Residential)
                {
                    vm.Happiness = BamEcsUtils.CalculateAverageWorkerHappiness(em, entity, renters);
                }

                if (isRes)
                {
                    int totalCit = _resEduScratch[0] + _resEduScratch[1] + _resEduScratch[2] + _resEduScratch[3] + _resEduScratch[4];
                    if (totalCit > 0)
                    {
                        for (int k = 0; k < 5; k++) _resEduTotalScratch[k] = totalCit;
                        AppendEducationTiers(vm, _resEduScratch, _resEduTotalScratch);
                        eduPopulated = true;
                    }
                }
            }
            else if (vm.Category != AssetCategory.Residential)
            {
                vm.Happiness = BamEcsUtils.CalculateAverageWorkerHappiness(em, entity, default(DynamicBuffer<Renter>));
            }

            // Also check entity directly for CompanyData (Signature companies, extractors, specialized hubs)
            if (em.HasComponent<CompanyData>(entity))
            {
                ReadCompanyEntity(em, entity, vm);
            }

            // Extract Worker & Resident Education Breakdown
            if (!eduPopulated && (vm.Category != AssetCategory.Residential || vm.IsMixedUse))
            {
                // Workplaces (Commercial, Industrial, Office, Storage, Services) & Mixed-Use ground retail fallback
                try
                {
                    System.Array.Clear(_wpFilledScratch, 0, 5);
                    System.Array.Clear(_wpReqScratch, 0, 5);
                    int[] filled = _wpFilledScratch;
                    int[] required = _wpReqScratch;
                    int totalCap = 0;

                    void AccumulateWorkplaces(Entity wpEnt)
                    {
                        if (wpEnt == Entity.Null || !em.Exists(wpEnt)) return;

                        if (em.HasComponent<WorkProvider>(wpEnt))
                        {
                            int maxW = em.GetComponentData<WorkProvider>(wpEnt).m_MaxWorkers;
                            totalCap += maxW;

                            Entity pref = em.HasComponent<PrefabRef>(wpEnt) ? em.GetComponentData<PrefabRef>(wpEnt).m_Prefab : Entity.Null;
                            int bLvl = 1;
                            if (pref != Entity.Null && em.HasComponent<Game.Prefabs.SpawnableBuildingData>(pref))
                            {
                                bLvl = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(pref).m_Level;
                            }
                            else if (em.HasComponent<PrefabRef>(entity))
                            {
                                Entity bPref = em.GetComponentData<PrefabRef>(entity).m_Prefab;
                                if (bPref != Entity.Null && em.HasComponent<Game.Prefabs.SpawnableBuildingData>(bPref))
                                {
                                    bLvl = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(bPref).m_Level;
                                }
                            }

                            var comp = Game.Prefabs.WorkplaceComplexity.Manual;
                            if (pref != Entity.Null && em.HasComponent<Game.Prefabs.WorkplaceData>(pref))
                            {
                                comp = em.GetComponentData<Game.Prefabs.WorkplaceData>(pref).m_Complexity;
                            }
                            else if (em.HasComponent<PrefabRef>(entity))
                            {
                                Entity bPref = em.GetComponentData<PrefabRef>(entity).m_Prefab;
                                if (bPref != Entity.Null && em.HasComponent<Game.Prefabs.WorkplaceData>(bPref))
                                {
                                    comp = em.GetComponentData<Game.Prefabs.WorkplaceData>(bPref).m_Complexity;
                                }
                            }

                            var wData = Game.UI.InGame.EmploymentData.GetWorkplacesData(maxW, bLvl, comp);
                            required[0] += wData.uneducated;
                            required[1] += wData.poorlyEducated;
                            required[2] += wData.educated;
                            required[3] += wData.wellEducated;
                            required[4] += wData.highlyEducated;

                            // Employees filled via native EmploymentData matching
                            if (em.HasBuffer<Employee>(wpEnt))
                            {
                                var emps = em.GetBuffer<Employee>(wpEnt, true);
                                int openPos = System.Math.Max(0, wData.total - emps.Length);
                                var eData = Game.UI.InGame.EmploymentData.GetEmployeesData(emps, openPos);
                                filled[0] += eData.uneducated;
                                filled[1] += eData.poorlyEducated;
                                filled[2] += eData.educated;
                                filled[3] += eData.wellEducated;
                                filled[4] += eData.highlyEducated;
                            }
                        }
                    }

                    if (em.HasBuffer<Renter>(entity))
                    {
                        var renters = em.GetBuffer<Renter>(entity, true);
                        for (int r = -1; r < renters.Length; r++)
                        {
                            Entity wpEnt = r < 0 ? entity : renters[r].m_Renter;
                            AccumulateWorkplaces(wpEnt);
                        }
                    }
                    else
                    {
                        AccumulateWorkplaces(entity);
                    }

                    int totalFilled = filled[0] + filled[1] + filled[2] + filled[3] + filled[4];
                    int totalRequired = required[0] + required[1] + required[2] + required[3] + required[4];

                    if (totalFilled > 0 || totalRequired > 0 || totalCap > 0)
                    {
                        AppendEducationTiers(vm, filled, totalRequired > 0 ? required : filled);
                    }
                    else
                    {
                        FillPrefabWorkplaceEducationTiers(em, prefab, vm);
                    }
                }
                catch (System.Exception ex)
                {
                    Mod.Log.Debug($"Placed read: {ex.Message}");
                }
            }

            bool hasCompanyEntity = !string.IsNullOrEmpty(vm.CompanyEntityKey);

            // 5. Check CommercialProperty / IndustrialProperty only when no company process already populated resources (and never dump building slot pools onto Storage warehouses)
            if (em.HasComponent<CommercialProperty>(entity) && !hasCompanyEntity && vm.OutputResources.Count == 0 && vm.Category != AssetCategory.Storage)
            {
                try
                {
                    var cp = em.GetComponentData<CommercialProperty>(entity);
                    AppendMaskResourcesToOutput(cp.m_Resources, vm);
                }
                catch (System.Exception ex)
                {
                    Mod.Log.Debug($"Placed read: {ex.Message}");
                }
            }

            if (em.HasComponent<IndustrialProperty>(entity) && !hasCompanyEntity && vm.OutputResources.Count == 0 && vm.Category != AssetCategory.Storage)
            {
                try
                {
                    var ip = em.GetComponentData<IndustrialProperty>(entity);
                    AppendMaskResourcesToOutput(ip.m_Resources, vm);
                }
                catch (System.Exception ex)
                {
                    Mod.Log.Debug($"Placed read: {ex.Message}");
                }
            }

            // 5b. Check building prefab/upgrades for direct StorageCompanyData (Cargo Hubs, Post Offices, Service Storage) or IndustrialProcessData
            if (UpgradeUtils.TryGetCombinedComponent<StorageCompanyData>(em, entity, prefab, out var bScd) &&
                bScd.m_StoredResources != Resource.NoResource)
            {
                AppendMaskResourcesToOutput(bScd.m_StoredResources, vm);
            }

            if (em.HasComponent<IndustrialProcessData>(prefab))
            {
                var proc = em.GetComponentData<IndustrialProcessData>(prefab);
                if (proc.m_Input1.m_Resource != Resource.NoResource)
                {
                    string in1 = BamEcsUtils.FormatResourceName(proc.m_Input1.m_Resource);
                    if (!string.IsNullOrEmpty(in1) && !vm.InputResources.Contains(in1)) vm.InputResources.Add(in1);
                }
                if (proc.m_Input2.m_Resource != Resource.NoResource)
                {
                    string in2 = BamEcsUtils.FormatResourceName(proc.m_Input2.m_Resource);
                    if (!string.IsNullOrEmpty(in2) && !vm.InputResources.Contains(in2)) vm.InputResources.Add(in2);
                }
                if (proc.m_Output.m_Resource != Resource.NoResource)
                {
                    string outRes = BamEcsUtils.FormatResourceName(proc.m_Output.m_Resource);
                    if (!string.IsNullOrEmpty(outRes))
                    {
                        if (!vm.OutputResources.Contains(outRes)) vm.OutputResources.Add(outRes);
                        if (string.IsNullOrEmpty(vm.Resource)) vm.Resource = outRes;
                    }
                }
            }

            // For commercial/storage companies, goods bought as inputs without an explicit output are what they handle
            if (vm.OutputResources.Count == 0 && vm.InputResources.Count > 0 && (vm.Category == AssetCategory.Commercial || vm.Category == AssetCategory.Storage))
            {
                for (int i = 0; i < vm.InputResources.Count; i++)
                {
                    string inRes = vm.InputResources[i];
                    if (!vm.OutputResources.Contains(inRes)) vm.OutputResources.Add(inRes);
                }
                if (string.IsNullOrEmpty(vm.Resource)) vm.Resource = vm.InputResources[0];
            }

            // 6. Physical Resource Storage
            Entity storageTarget = Entity.Null;
            if (!string.IsNullOrEmpty(vm.CompanyEntityKey) && EntityKey.TryParse(vm.CompanyEntityKey, out var cTarget) && em.Exists(cTarget))
            {
                storageTarget = cTarget;
            }
            else if (em.HasBuffer<Game.Economy.Resources>(entity))
            {
                storageTarget = entity;
            }

            Game.Prefabs.ResourcePrefabs rPrefabs = default;
            bool hasRPrefabs = false;
            if (_resourceSystem != null)
            {
                try { rPrefabs = _resourceSystem.GetPrefabs(); hasRPrefabs = true; } catch (System.Exception ex) { Mod.Log.Debug($"Placed: GetPrefabs: {ex.Message}"); }
            }

            bool isStorageOrCargo = vm.Category == AssetCategory.Storage || vm.IsCargoHub;

            if (storageTarget != Entity.Null && em.HasBuffer<Game.Economy.Resources>(storageTarget))
            {
                var resBuffer = em.GetBuffer<Game.Economy.Resources>(storageTarget, true);
                double totalStorageKg = 0.0;

                for (int r = 0; r < resBuffer.Length; r++)
                {
                    var res = resBuffer[r].m_Resource;
                    int amt = resBuffer[r].m_Amount;
                    if (res == Resource.NoResource || res == Resource.Money) continue;
                    if (amt <= 0 && !isStorageOrCargo) continue;
                    if (amt < 0) continue;

                    string formattedRes = BamEcsUtils.FormatResourceName(res);
                    bool isSingleEnum = !string.IsNullOrEmpty(formattedRes);

                    if (isSingleEnum)
                    {
                        float unitWeight = hasRPrefabs ? EconomyUtils.GetWeight(em, res, rPrefabs) : (IsPhysicalResource(res) ? 1f : 0f);
                        if (!IsPhysicalResource(res) || unitWeight <= 0f)
                        {
                            // Weightless intangible goods (Software, Telecom, Financial, Media) do not count toward physical tonnage
                            continue;
                        }

                        double kg = amt;
                        totalStorageKg += kg;
                        float weightTons = (float)System.Math.Round(kg / 1000.0, 2);
                        string resType = ResolveStorageResourceType(em, res, hasRPrefabs, rPrefabs);

                        AddOrUpdateStoredResource(vm, formattedRes, amt, weightTons, resType);

                        bool allowStoredAsOutput = isStorageOrCargo || vm.OutputResources.Count == 0;
                        if (allowStoredAsOutput && !vm.OutputResources.Contains(formattedRes) && (isStorageOrCargo || vm.OutputResources.Count < 5))
                        {
                            vm.OutputResources.Add(formattedRes);
                        }
                        if (string.IsNullOrEmpty(vm.Resource)) vm.Resource = formattedRes;
                    }
                    else if ((ulong)res != 0 && amt > 0)
                    {
                        // Composite bitmask from warehouse: decompose each individual physical bit flag
                        bool addedPhysical = false;
                        ulong resVal = (ulong)res;
                        for (int bit = 0; bit < 64; bit++)
                        {
                            ulong mask = 1UL << bit;
                            if ((resVal & mask) != 0)
                            {
                                Resource flag = (Resource)mask;
                                if (flag == Resource.Money || !IsPhysicalResource(flag)) continue;
                                string flagName = BamEcsUtils.FormatResourceName(flag);
                                if (!string.IsNullOrEmpty(flagName))
                                {
                                    float unitWeight = hasRPrefabs ? EconomyUtils.GetWeight(em, flag, rPrefabs) : 1f;
                                    if (unitWeight <= 0f) continue;

                                    addedPhysical = true;
                                    bool allowMaskAsOutput = isStorageOrCargo || vm.OutputResources.Count == 0;
                                    if (allowMaskAsOutput && !vm.OutputResources.Contains(flagName) && (isStorageOrCargo || vm.OutputResources.Count < 5))
                                    {
                                        vm.OutputResources.Add(flagName);
                                    }
                                    if (string.IsNullOrEmpty(vm.Resource)) vm.Resource = flagName;

                                    string flagType = ResolveStorageResourceType(em, flag, hasRPrefabs, rPrefabs);
                                    AddOrUpdateStoredResource(vm, flagName, amt, (float)System.Math.Round(amt / 1000.0, 2), flagType);
                                }
                            }
                        }
                        if (addedPhysical)
                        {
                            totalStorageKg += amt;
                        }
                    }
                }
                vm.StorageAmount = (float)System.Math.Round(totalStorageKg / 1000.0, 2);
            }

            if (vm.StoredResources.Count > 1)
            {
                vm.StoredResources.Sort((a, b) => b.Amount.CompareTo(a.Amount));
            }
            else if (isStorageOrCargo && vm.StoredResources.Count == 0 && hasCompanyEntity && vm.OutputResources.Count > 0 && vm.OutputResources.Count <= 4)
            {
                // Empty rented storage warehouses show their assigned 0 kg resource in vanilla SIP (e.g. "Crude Oil 0 kg")
                for (int i = 0; i < vm.OutputResources.Count; i++)
                {
                    string outName = vm.OutputResources[i];
                    string resType = "Processed Goods";
                    if (System.Enum.TryParse<Resource>(outName.Replace(" ", ""), true, out var resEnum))
                    {
                        resType = ResolveStorageResourceType(em, resEnum, hasRPrefabs, rPrefabs);
                    }
                    vm.StoredResources.Add(new StoredResourceDto
                    {
                        Name = outName,
                        Amount = 0,
                        Weight = 0f,
                        Type = resType
                    });
                }
            }

            // Storage capacity resolution with zoned warehouse formula (skipping weightless Office companies)
            bool isWeightlessOffice = vm.Category == AssetCategory.Office;
            if (!isWeightlessOffice && storageTarget != Entity.Null && em.HasComponent<PrefabRef>(storageTarget))
            {
                var cPrefCheck = em.GetComponentData<PrefabRef>(storageTarget).m_Prefab;
                if (cPrefCheck != Entity.Null && em.HasComponent<IndustrialProcessData>(cPrefCheck))
                {
                    var procCheck = em.GetComponentData<IndustrialProcessData>(cPrefCheck);
                    var outR = procCheck.m_Output.m_Resource;
                    if (outR != Resource.NoResource && !IsPhysicalResource(outR) && procCheck.m_Input1.m_Resource == Resource.NoResource)
                    {
                        float outWeight = hasRPrefabs ? EconomyUtils.GetWeight(em, outR, rPrefabs) : 0f;
                        if (outWeight <= 0f) isWeightlessOffice = true;
                    }
                }
            }

            if (!isWeightlessOffice)
            {
                if (UpgradeUtils.TryGetCombinedComponent<StorageLimitData>(em, entity, prefab, out var bLimitData) && bLimitData.m_Limit > 0)
                {
                    try
                    {
                        if ((vm.Category == AssetCategory.Storage || em.HasComponent<StorageCompanyData>(prefab)) &&
                            em.HasComponent<SpawnableBuildingData>(prefab) && em.HasComponent<BuildingData>(prefab))
                        {
                            var spawnable = em.GetComponentData<SpawnableBuildingData>(prefab);
                            var bData = em.GetComponentData<BuildingData>(prefab);
                            int limitKg = bLimitData.GetAdjustedLimitForWarehouse(spawnable, bData);
                            vm.StorageCapacity = (float)System.Math.Round(limitKg / 1000.0, 2);
                        }
                        else
                        {
                            vm.StorageCapacity = (float)System.Math.Round(bLimitData.m_Limit / 1000.0, 2);
                        }
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }

                if (vm.StorageCapacity <= 0 && storageTarget != Entity.Null && em.HasComponent<PrefabRef>(storageTarget))
                {
                    try
                    {
                        var cPrefab = em.GetComponentData<PrefabRef>(storageTarget).m_Prefab;
                        if (cPrefab != Entity.Null && em.HasComponent<StorageLimitData>(cPrefab))
                        {
                            var cLimitData = em.GetComponentData<StorageLimitData>(cPrefab);
                            if ((vm.Category == AssetCategory.Storage ||
                                 em.HasComponent<Game.Companies.StorageCompany>(storageTarget) ||
                                 em.HasComponent<StorageCompanyData>(cPrefab)) &&
                                em.HasComponent<SpawnableBuildingData>(prefab) &&
                                em.HasComponent<BuildingData>(prefab))
                            {
                                var spawnable = em.GetComponentData<SpawnableBuildingData>(prefab);
                                var bData = em.GetComponentData<BuildingData>(prefab);
                                int limitKg = cLimitData.GetAdjustedLimitForWarehouse(spawnable, bData);
                                vm.StorageCapacity = (float)System.Math.Round(limitKg / 1000.0, 2);
                            }
                            else
                            {
                                vm.StorageCapacity = (float)System.Math.Round(cLimitData.m_Limit / 1000.0, 2);
                            }
                        }
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }
            }

            // 7. Read Utilities & Active Vehicle stats (excluding parked vehicles)
            BamEcsUtils.ExtractUtilities(
                em,
                entity,
                out int elec,
                out int water,
                out int garbage,
                out float crime,
                out int mailSend,
                out int mailRecv);
            vm.ElectricityConsumption = elec;
            vm.WaterConsumption = water;
            vm.GarbageAccumulation = garbage;
            vm.CrimeProbability = crime;
            vm.MailSending = mailSend;
            vm.MailReceiving = mailRecv;
            vm.Vehicles = CountActiveOwnedVehicles(em, entity);

            // Extract Installed Upgrades / Sub-Buildings (display list only; UpgradeUtils already sums active capacities)
            if (em.HasBuffer<InstalledUpgrade>(entity))
            {
                var upgrades = em.GetBuffer<InstalledUpgrade>(entity, true);
                _upgradeSeenScratch.Clear();

                for (int u = 0; u < upgrades.Length; u++)
                {
                    Entity upEnt = upgrades[u].m_Upgrade;
                    if (upEnt == Entity.Null ||
                        !em.Exists(upEnt) ||
                        em.HasComponent<Game.Common.Deleted>(upEnt) ||
                        em.HasComponent<Game.Tools.Temp>(upEnt) ||
                        !_upgradeSeenScratch.Add(upEnt))
                    {
                        continue;
                    }

                    string rawPrefab = string.Empty;
                    string upName = string.Empty;
                    string upType = "Sub-building";
                    int upCost = 0;
                    int upUpkeep = 0;
                    int upWorkers = 0;
                    _benefitsScratch.Clear();
                    var benefits = _benefitsScratch;

                    if (em.HasComponent<PrefabRef>(upEnt))
                    {
                        var upPrefab = em.GetComponentData<PrefabRef>(upEnt).m_Prefab;
                        if (_prefabSystem != null)
                        {
                            rawPrefab = _prefabSystem.GetPrefabName(upPrefab) ?? "";
                        }

                        // Resolve localized human name of sub-building cleanly
                        upName = ResolveCleanEntityName(upEnt);
                        if (string.IsNullOrEmpty(upName) || upName == rawPrefab)
                        {
                            string locTitle = TryGetLocalizedPrefabTitle(upPrefab);
                            if (!string.IsNullOrEmpty(locTitle)) upName = locTitle;
                        }
                        if (string.IsNullOrEmpty(upName) || upName == rawPrefab)
                        {
                            string prefLabel = ResolveCleanEntityName(upPrefab);
                            if (!string.IsNullOrEmpty(prefLabel)) upName = prefLabel;
                        }
                        if (string.IsNullOrEmpty(upName))
                        {
                            upName = FormatPrefabDisplayName(rawPrefab);
                        }

                        // Upkeep & construction cost (prefer ServiceUpkeepData Money, fallback ConsumptionData.m_Upkeep)
                        upUpkeep = GetPrefabMoneyUpkeep(em, upPrefab);
                        if (em.HasComponent<ServiceUpgradeData>(upPrefab))
                        {
                            try { upCost = (int)em.GetComponentData<ServiceUpgradeData>(upPrefab).m_UpgradeCost; } catch (System.Exception ex) { Mod.Log.Warn($"Upgrade cost for {upPrefab.Index}: {ex.Message}"); }
                        }
                        if (em.HasComponent<WorkplaceData>(upPrefab))
                        {
                            try { upWorkers = em.GetComponentData<WorkplaceData>(upPrefab).m_MaxWorkers; } catch (System.Exception ex) { Mod.Log.Warn($"Upgrade workers for {upPrefab.Index}: {ex.Message}"); }
                            if (upWorkers > 0) benefits.Add($"+{upWorkers} Workers");
                        }

                        if (em.HasComponent<ParkingFacilityData>(upPrefab))
                        {
                            upType = "Car Park";
                            var pData = em.GetComponentData<ParkingFacilityData>(upPrefab);
                            if (pData.m_GarageMarkerCapacity > 0)
                            {
                                benefits.Add($"+{pData.m_GarageMarkerCapacity} Parking");
                            }
                            else benefits.Add("+Parking");
                        }
                        if (em.HasComponent<DeathcareFacilityData>(upPrefab))
                        {
                            upType = "Deathcare Extension";
                            var dData = em.GetComponentData<DeathcareFacilityData>(upPrefab);
                            if (dData.m_HearseCapacity > 0) benefits.Add($"+{dData.m_HearseCapacity} Hearses");
                            if (dData.m_StorageCapacity > 0) benefits.Add($"+{dData.m_StorageCapacity} Capacity");
                            if (dData.m_ProcessingRate > 0) benefits.Add($"+{dData.m_ProcessingRate}/mo Processing");
                        }
                        if (em.HasComponent<FireStationData>(upPrefab))
                        {
                            upType = "Engine Bay";
                            var fData = em.GetComponentData<FireStationData>(upPrefab);
                            if (fData.m_FireEngineCapacity > 0) benefits.Add($"+{fData.m_FireEngineCapacity} Engines");
                            if (fData.m_FireHelicopterCapacity > 0) benefits.Add($"+{fData.m_FireHelicopterCapacity} Helis");
                            if (fData.m_DisasterResponseCapacity > 0) benefits.Add($"+{fData.m_DisasterResponseCapacity} Disaster Units");
                        }
                        if (em.HasComponent<HospitalData>(upPrefab))
                        {
                            upType = "Medical Wing";
                            var hData = em.GetComponentData<HospitalData>(upPrefab);
                            if (hData.m_PatientCapacity > 0) benefits.Add($"+{hData.m_PatientCapacity} Patients");
                            if (hData.m_AmbulanceCapacity > 0) benefits.Add($"+{hData.m_AmbulanceCapacity} Ambulances");
                            if (hData.m_MedicalHelicopterCapacity > 0) benefits.Add($"+{hData.m_MedicalHelicopterCapacity} Helis");
                        }
                        if (em.HasComponent<PoliceStationData>(upPrefab))
                        {
                            upType = "Police Extension";
                            var polData = em.GetComponentData<PoliceStationData>(upPrefab);
                            if (polData.m_PatrolCarCapacity > 0) benefits.Add($"+{polData.m_PatrolCarCapacity} Cars");
                            if (polData.m_PoliceHelicopterCapacity > 0) benefits.Add($"+{polData.m_PoliceHelicopterCapacity} Helis");
                            if (polData.m_JailCapacity > 0) benefits.Add($"+{polData.m_JailCapacity} Cells");
                        }
                        if (em.HasComponent<PrisonData>(upPrefab))
                        {
                            upType = "Prison Wing";
                            var prData = em.GetComponentData<PrisonData>(upPrefab);
                            if (prData.m_PrisonVanCapacity > 0) benefits.Add($"+{prData.m_PrisonVanCapacity} Vans");
                            if (prData.m_PrisonerCapacity > 0) benefits.Add($"+{prData.m_PrisonerCapacity} Prisoners");
                        }
                        if (em.HasComponent<SchoolData>(upPrefab))
                        {
                            upType = "School Wing";
                            var sData = em.GetComponentData<SchoolData>(upPrefab);
                            if (sData.m_StudentCapacity > 0) benefits.Add($"+{sData.m_StudentCapacity} Students");
                        }
                        if (em.HasComponent<GarbageFacilityData>(upPrefab))
                        {
                            upType = "Garbage Extension";
                            var gData = em.GetComponentData<GarbageFacilityData>(upPrefab);
                            if (gData.m_VehicleCapacity > 0) benefits.Add($"+{gData.m_VehicleCapacity} Trucks");
                            int garbTons = UnityEngine.Mathf.RoundToInt(gData.m_GarbageCapacity / 1000f);
                            if (garbTons > 0) benefits.Add($"+{garbTons} t Capacity");
                        }
                        if (em.HasComponent<TransportDepotData>(upPrefab))
                        {
                            upType = "Depot Bay";
                            var tData = em.GetComponentData<TransportDepotData>(upPrefab);
                            if (tData.m_VehicleCapacity > 0) benefits.Add($"+{tData.m_VehicleCapacity} Vehicles");
                        }
                        if (em.HasComponent<AttractionData>(upPrefab))
                        {
                            var aData = em.GetComponentData<AttractionData>(upPrefab);
                            if (aData.m_Attractiveness > 0) benefits.Add($"+{aData.m_Attractiveness} Attractiveness");
                        }

                        // Leisure provider on upgrade (e.g. +40 Outdoor Recreation on Rooftop Sports Park)
                        if (em.HasComponent<LeisureProviderData>(upPrefab))
                        {
                            var lpd = em.GetComponentData<LeisureProviderData>(upPrefab);
                            if (lpd.m_Efficiency > 0)
                            {
                                string lName = BamEcsUtils.FormatLeisureType(lpd.m_LeisureType);
                                string leStr = $"+{lpd.m_Efficiency} {lName}";
                                benefits.Add(leStr);
                                if (!vm.LocalEffects.Contains(leStr)) vm.LocalEffects.Add(leStr);
                            }
                        }

                        // Local radius modifiers on upgrade (e.g. +4 Well-Being within 500 m on Rooftop Sports Park)
                        if (em.HasBuffer<LocalModifierData>(upPrefab))
                        {
                            var lmBuf = em.GetBuffer<LocalModifierData>(upPrefab, true);
                            for (int lm = 0; lm < lmBuf.Length; lm++)
                            {
                                string effStr = BamEcsUtils.FormatLocalModifier(lmBuf[lm]);
                                benefits.Add(effStr);
                                if (!vm.LocalEffects.Contains(effStr)) vm.LocalEffects.Add(effStr);
                            }
                        }

                        // City-wide modifiers on upgrade
                        if (em.HasBuffer<CityModifierData>(upPrefab))
                        {
                            var cmBuf = em.GetBuffer<CityModifierData>(upPrefab, true);
                            for (int cm = 0; cm < cmBuf.Length; cm++)
                            {
                                string effStr = BamEcsUtils.FormatCityModifier(cmBuf[cm]);
                                benefits.Add(effStr);
                                if (!vm.CityEffects.Contains(effStr)) vm.CityEffects.Add(effStr);
                            }
                        }
                    }

                    if (string.IsNullOrEmpty(upName)) upName = $"Upgrade #{upEnt.Index}";

                    bool isDestroyed = em.HasComponent<Game.Common.Destroyed>(upEnt);
                    bool isDamaged = IsEntityDamagedOrAbandoned(em, upEnt);
                    float upDamagePercent = ComputeEntityDamagePercent(em, upEnt);
                    if (isDestroyed || isDamaged || upDamagePercent > 0f)
                    {
                        vm.NeedsRepair = true;
                        vm.IsDamaged = true;
                        if (upDamagePercent > vm.DamagePercent)
                        {
                            vm.DamagePercent = upDamagePercent;
                        }
                    }

                    vm.SubBuildings.Add(new SubBuildingVm
                    {
                        EntityKey = EntityKey.From(upEnt),
                        Name = upName,
                        PrefabName = rawPrefab,
                        Type = upType,
                        Benefit = benefits.Count > 0 ? string.Join(", ", benefits) : string.Empty,
                        Upkeep = upUpkeep,
                        Cost = upCost,
                        Workers = upWorkers,
                        IsDamaged = isDamaged || upDamagePercent > 0f,
                        DamagePercent = upDamagePercent,
                        IsDestroyed = isDestroyed
                    });
                }
            }

            // Compute upkeep AFTER ReadCompanyEntity and InstalledUpgrade scan
            FillUpkeepCosts(entity, prefab, vm);

            if (vm.Category == AssetCategory.Residential)
            {
                FillResidentialEconomics(em, entity, prefab, vm);
                FillResidentialHappinessFactors(entity, prefab, vm, info);
            }
            else
            {
                // Vacant commercial/industrial/office/storage buildings with no company and 0 workers
                // can retain stale EmployeeHappiness entries in their ECS Efficiency buffer.
                if (vm.Category != AssetCategory.Service &&
                    string.IsNullOrEmpty(vm.Company) &&
                    vm.Occupied <= 0 &&
                    vm.EfficiencyFactors.Count > 0)
                {
                    int removed = vm.EfficiencyFactors.RemoveAll(f =>
                        string.Equals(f.Factor, "Employee Happiness", System.StringComparison.OrdinalIgnoreCase));
                    if (removed > 0 && vm.Efficiency >= 0)
                    {
                        float combined = 1f;
                        for (int i = 0; i < vm.EfficiencyFactors.Count; i++)
                        {
                            combined *= System.Math.Max(0f, (100f + vm.EfficiencyFactors[i].Percentage) / 100f);
                        }
                        vm.Efficiency = (int)System.Math.Round(combined * 100f);
                    }
                }
                FillWorkplaceHappinessFactors(entity, vm);
            }

            return vm;
        }

        private string ResolvePlacedCategory(Entity entity, PrefabInfo info)
        {
            var em = EntityManager;
            if (em.HasComponent<ResidentialProperty>(entity)) return AssetCategory.Residential;
            if (em.HasComponent<OfficeProperty>(entity)) return AssetCategory.Office;
            if (em.HasComponent<CommercialProperty>(entity)) return AssetCategory.Commercial;
            if (em.HasComponent<IndustrialProperty>(entity))
                return info.Category == AssetCategory.Storage ? AssetCategory.Storage : AssetCategory.Industrial;
            if (em.HasComponent<Game.Buildings.TransportDepot>(entity) ||
                em.HasComponent<Game.Buildings.TransportStation>(entity) ||
                em.HasComponent<Game.Buildings.PublicTransportStation>(entity) ||
                em.HasComponent<Game.Buildings.CargoTransportStation>(entity) ||
                em.HasComponent<Game.Buildings.ParkingFacility>(entity) ||
                em.HasComponent<Game.Buildings.PostFacility>(entity) ||
                em.HasComponent<Game.Buildings.MaintenanceDepot>(entity))
            {
                return AssetCategory.Service;
            }
            return info.Category;
        }

        private string ResolveDistrict(Entity entity, out string districtKey)
        {
            districtKey = string.Empty;
            var em = EntityManager;
            if (!em.HasComponent<Game.Areas.CurrentDistrict>(entity)) return string.Empty;

            var district = em.GetComponentData<Game.Areas.CurrentDistrict>(entity).m_District;
            if (district == Entity.Null) return string.Empty;

            districtKey = EntityKey.From(district);
            if (!_districtNameCache.TryGetValue(district, out var name))
            {
                name = Mod.Log.Guard("DistrictName", () => _nameSystem.GetRenderedLabelName(district), string.Empty) ?? string.Empty;
                _districtNameCache[district] = name;
            }
            return name;
        }

        private int ReadEfficiency(Entity entity, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            if (!em.HasBuffer<Efficiency>(entity)) return -1;
            var effBuf = em.GetBuffer<Efficiency>(entity, true);
            float value = BuildingUtils.GetEfficiency(effBuf);

            _effScratch.Clear();
            for (int e = 0; e < effBuf.Length; e++)
            {
                _effScratch.Add(effBuf[e]);
            }
            _effScratch.Sort();

            float combined = 1f;
            for (int e = 0; e < _effScratch.Count; e++)
            {
                float eff = System.Math.Max(0f, _effScratch[e].m_Efficiency);
                combined *= eff;
                int pctChange = eff == 0f ? -100 : (int)System.Math.Round(100f * eff) - 100;
                if (pctChange != 0)
                {
                    try
                    {
                        string fname = BamEcsUtils.FormatEfficiencyFactor(_effScratch[e].m_Factor);
                        int effCumulative = eff == 0f ? 0 : System.Math.Max(0, (int)System.Math.Round(combined * 100f));
                        vm.EfficiencyFactors.Add(new EfficiencyFactorVm
                        {
                            Factor = fname,
                            Percentage = pctChange,
                            Cumulative = effCumulative
                        });
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }
            }

            return (int)System.Math.Round(value * 100f);
        }

        /// <summary>
        /// Residential: households vs. capacity. Everything else: employees vs. workplaces,
        /// summed across the building itself (services) and every renter company.
        /// </summary>
        private void FillOccupancy(Entity entity, UnifiedAssetVm vm, PrefabInfo info)
        {
            var em = EntityManager;
            int occupied = 0;
            int capacity = 0;

            if (vm.Category == AssetCategory.Residential)
            {
                capacity = info.ResidentialCapacity;
                int residentsCount = 0;
                if (em.HasBuffer<Renter>(entity))
                {
                    var renters = em.GetBuffer<Renter>(entity, true);
                    for (int i = 0; i < renters.Length; i++)
                    {
                        var rEnt = renters[i].m_Renter;
                        if (rEnt == Entity.Null || !em.Exists(rEnt)) continue;
                        if (em.HasComponent<Game.Citizens.Household>(rEnt))
                        {
                            if (!BamEcsUtils.IsValidMovedInHousehold(em, rEnt, out _)) continue;
                            occupied++;
                            if (em.HasBuffer<HouseholdCitizen>(rEnt))
                            {
                                var cits = em.GetBuffer<HouseholdCitizen>(rEnt, true);
                                for (int c = 0; c < cits.Length; c++)
                                {
                                    if (BamEcsUtils.IsLivingCitizen(em, cits[c].m_Citizen))
                                    {
                                        residentsCount++;
                                    }
                                }
                            }
                        }
                        else
                        {
                            int commOcc = 0, commCap = 0;
                            AddWorkforce(rEnt, ref commOcc, ref commCap);
                            if (commCap > 0 || commOcc > 0 || em.HasComponent<CompanyData>(rEnt))
                            {
                                vm.IsMixedUse = true;
                                vm.CommercialOccupied += commOcc;
                                vm.CommercialCapacity += commCap;
                            }
                        }
                    }
                }
                vm.Residents = residentsCount;
                int dirOcc = 0, dirCap = 0;
                AddWorkforce(entity, ref dirOcc, ref dirCap);
                if (dirCap > 0)
                {
                    vm.IsMixedUse = true;
                    vm.CommercialOccupied += dirOcc;
                    vm.CommercialCapacity += dirCap;
                }
                if (!string.IsNullOrEmpty(vm.Company) || (vm.SubCategory != null && vm.SubCategory.IndexOf("Mixed", System.StringComparison.OrdinalIgnoreCase) >= 0))
                {
                    vm.IsMixedUse = true;
                }
            }
            else
            {
                AddWorkforce(entity, ref occupied, ref capacity);
                if (em.HasBuffer<Renter>(entity))
                {
                    var renters = em.GetBuffer<Renter>(entity, true);
                    for (int i = 0; i < renters.Length; i++) AddWorkforce(renters[i].m_Renter, ref occupied, ref capacity);
                }
            }

            vm.Occupied = occupied;
            vm.Capacity = capacity;
        }

        private void AddWorkforce(Entity workplace, ref int employees, ref int maxWorkers)
        {
            BamEcsUtils.AddWorkforce(EntityManager, workplace, ref employees, ref maxWorkers);
        }

        private void FillServiceMetrics(Entity entity, Entity prefab, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            try
            {
                if (em.HasComponent<Game.Buildings.Hospital>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<HospitalData>(em, entity, prefab, out var hospData))
                    {
                        vm.ServiceCapacity = hospData.m_PatientCapacity;
                        vm.ServiceUnit = "Patients";
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = hospData.m_AmbulanceCapacity + hospData.m_MedicalHelicopterCapacity;
                    }
                    if (em.HasBuffer<Game.Buildings.Patient>(entity))
                    {
                        vm.ServiceUsage = em.GetBuffer<Game.Buildings.Patient>(entity, true).Length;
                    }
                }
                else if (em.HasComponent<Game.Buildings.Prison>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<PrisonData>(em, entity, prefab, out var prisData))
                    {
                        vm.ServiceCapacity = prisData.m_PrisonerCapacity;
                        vm.ServiceUnit = "Prisoners";
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = prisData.m_PrisonVanCapacity;
                    }
                    if (em.HasBuffer<Game.Buildings.Occupant>(entity))
                    {
                        vm.ServiceUsage = em.GetBuffer<Game.Buildings.Occupant>(entity, true).Length;
                    }
                }
                else if (em.HasComponent<Game.Buildings.PoliceStation>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<PoliceStationData>(em, entity, prefab, out var polData))
                    {
                        vm.ServiceCapacity = polData.m_JailCapacity;
                        vm.ServiceUnit = "Inmates";
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = polData.m_PatrolCarCapacity + polData.m_PoliceHelicopterCapacity;
                    }
                    if (em.HasBuffer<Game.Buildings.Occupant>(entity))
                    {
                        vm.ServiceUsage = em.GetBuffer<Game.Buildings.Occupant>(entity, true).Length;
                    }
                }
                else if (UpgradeUtils.TryGetCombinedComponent<SchoolData>(em, entity, prefab, out var sd))
                {
                    vm.ServiceCapacity = sd.m_StudentCapacity;
                    vm.ServiceUnit = "Students";
                    if (em.HasBuffer<Game.Buildings.Student>(entity))
                    {
                        vm.ServiceUsage = em.GetBuffer<Game.Buildings.Student>(entity, true).Length;
                    }
                }
                else if (em.HasComponent<Game.Buildings.DeathcareFacility>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<DeathcareFacilityData>(em, entity, prefab, out var dfData))
                    {
                        vm.ServiceCapacity = dfData.m_StorageCapacity;
                        vm.ServiceUnit = "Deceased";
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = dfData.m_HearseCapacity;
                    }
                    var df = em.GetComponentData<Game.Buildings.DeathcareFacility>(entity);
                    int patientBodies = em.HasBuffer<Game.Buildings.Patient>(entity)
                        ? em.GetBuffer<Game.Buildings.Patient>(entity, true).Length
                        : 0;
                    vm.ServiceUsage = df.m_LongTermStoredCount + patientBodies;
                }
                else if (em.HasComponent<Game.Buildings.GarbageFacility>(entity))
                {
                    double garbCapTons = 0.0;
                    double garbUsedTons = 0.0;

                    if (UpgradeUtils.TryGetCombinedComponent<GarbageFacilityData>(em, entity, prefab, out var gfData))
                    {
                        garbCapTons += gfData.m_GarbageCapacity / 1000.0;
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = gfData.m_VehicleCapacity;
                    }
                    if (em.HasBuffer<Resources>(entity))
                    {
                        var resources = em.GetBuffer<Resources>(entity, true);
                        garbUsedTons += EconomyUtils.GetResources(Resource.Garbage, resources) / 1000.0;
                    }

                    // Include Landfill SubArea dynamic storage (on parent building and active InstalledUpgrades)
                    AccumulateSubAreaStorageTons(em, entity, ref garbUsedTons, ref garbCapTons);
                    if (em.HasBuffer<InstalledUpgrade>(entity))
                    {
                        var upgrades = em.GetBuffer<InstalledUpgrade>(entity, true);
                        for (int u = 0; u < upgrades.Length; u++)
                        {
                            if (!BuildingUtils.CheckOption(upgrades[u], BuildingOption.Inactive))
                            {
                                AccumulateSubAreaStorageTons(em, upgrades[u].m_Upgrade, ref garbUsedTons, ref garbCapTons);
                            }
                        }
                    }

                    vm.ServiceCapacity = UnityEngine.Mathf.RoundToInt((float)garbCapTons);
                    vm.ServiceUsage = UnityEngine.Mathf.RoundToInt((float)garbUsedTons);
                    vm.ServiceUnit = "t Garbage";
                }
                else if (em.HasComponent<Game.Buildings.ParkingFacility>(entity))
                {
                    if (vm.ParkingCapacity > 0)
                    {
                        vm.ServiceCapacity = vm.ParkingCapacity;
                        vm.ServiceUsage = vm.ParkedVehicles;
                        vm.ServiceUnit = "cars";
                    }
                }
                else if (em.HasComponent<Game.Buildings.MaintenanceDepot>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<MaintenanceDepotData>(em, entity, prefab, out var mdData))
                    {
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = mdData.m_VehicleCapacity;
                        vm.ServiceCapacity = mdData.m_VehicleCapacity;
                        vm.ServiceUnit = "Vehicles";
                    }
                }
                else if (em.HasComponent<Game.Buildings.FireStation>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<FireStationData>(em, entity, prefab, out var fsData))
                    {
                        if (vm.VehiclesMax == 0)
                        {
                            vm.VehiclesMax = fsData.m_FireEngineCapacity + fsData.m_FireHelicopterCapacity + fsData.m_DisasterResponseCapacity;
                        }
                    }
                }
                else if (em.HasComponent<Game.Buildings.TransportDepot>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<TransportDepotData>(em, entity, prefab, out var tdData))
                    {
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = tdData.m_VehicleCapacity;
                    }
                }
                else if (em.HasComponent<Game.Buildings.WaterPumpingStation>(entity))
                {
                    var pump = em.GetComponentData<Game.Buildings.WaterPumpingStation>(entity);
                    if (vm.ServiceCapacity == 0) vm.ServiceCapacity = pump.m_Capacity;
                    if (vm.ServiceUsage == 0) vm.ServiceUsage = System.Math.Max(0, pump.m_LastProduction);
                    vm.ServiceUnit = "m³/mo.";
                }
                else if (em.HasComponent<Game.Buildings.SewageOutlet>(entity))
                {
                    var outlet = em.GetComponentData<Game.Buildings.SewageOutlet>(entity);
                    if (vm.ServiceCapacity == 0) vm.ServiceCapacity = outlet.m_Capacity;
                    if (vm.ServiceUsage == 0) vm.ServiceUsage = System.Math.Max(0, outlet.m_LastPurified + outlet.m_LastProcessed);
                    vm.ServiceUnit = "m³/mo.";
                }
                else if (em.HasComponent<Game.Buildings.PostFacility>(entity))
                {
                    int mailCap = 0;
                    int mailUsed = 0;
                    if (UpgradeUtils.TryGetCombinedComponent<PostFacilityData>(em, entity, prefab, out var postData))
                    {
                        mailCap += postData.m_MailCapacity;
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = postData.m_PostVanCapacity + postData.m_PostTruckCapacity;
                    }
                    if (em.HasComponent<MailBoxData>(prefab))
                    {
                        mailCap += em.GetComponentData<MailBoxData>(prefab).m_MailCapacity;
                    }
                    if (em.HasBuffer<Resources>(entity))
                    {
                        var resBuf = em.GetBuffer<Resources>(entity, true);
                        mailUsed += EconomyUtils.GetResources(Resource.UnsortedMail, resBuf)
                                  + EconomyUtils.GetResources(Resource.LocalMail, resBuf)
                                  + EconomyUtils.GetResources(Resource.OutgoingMail, resBuf);
                    }
                    if (em.HasComponent<Game.Routes.MailBox>(entity))
                    {
                        mailUsed += em.GetComponentData<Game.Routes.MailBox>(entity).m_MailAmount;
                    }
                    if (mailUsed == 0 && em.HasComponent<MailProducer>(entity))
                    {
                        var mp = em.GetComponentData<MailProducer>(entity);
                        mailUsed = mp.receivingMail + mp.m_SendingMail;
                    }
                    if (vm.ServiceCapacity == 0) vm.ServiceCapacity = mailCap;
                    if (vm.ServiceUsage == 0) vm.ServiceUsage = mailUsed;
                    vm.ServiceUnit = "Letters";
                }
                else if (em.HasComponent<Game.Buildings.TelecomFacility>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<TelecomFacilityData>(em, entity, prefab, out var telecomData))
                    {
                        if (vm.ServiceCapacity == 0) vm.ServiceCapacity = (int)telecomData.m_NetworkCapacity;
                    }
                    vm.ServiceUnit = "GB/s";
                }
                else if (em.HasComponent<Game.Buildings.Park>(entity))
                {
                    if (em.HasBuffer<Game.Buildings.Occupant>(entity))
                    {
                        vm.ServiceUsage = em.GetBuffer<Game.Buildings.Occupant>(entity, true).Length;
                    }
                    vm.ServiceUnit = "Visitors";
                }
                else if (em.HasComponent<Game.Buildings.EmergencyShelter>(entity))
                {
                    if (UpgradeUtils.TryGetCombinedComponent<EmergencyShelterData>(em, entity, prefab, out var shelterData))
                    {
                        if (vm.ServiceCapacity == 0) vm.ServiceCapacity = shelterData.m_ShelterCapacity;
                        if (vm.VehiclesMax == 0) vm.VehiclesMax = shelterData.m_VehicleCapacity;
                    }
                    if (em.HasBuffer<Game.Buildings.Occupant>(entity))
                    {
                        vm.ServiceUsage = em.GetBuffer<Game.Buildings.Occupant>(entity, true).Length;
                    }
                    vm.ServiceUnit = "Sheltered";
                }
                else if (em.HasComponent<Game.Buildings.TransportStation>(entity) || em.HasComponent<Game.Buildings.PublicTransportStation>(entity) || em.HasComponent<Game.Buildings.CargoTransportStation>(entity))
                {
                    bool isPublic = em.HasComponent<Game.Buildings.PublicTransportStation>(entity) || em.HasComponent<PublicTransportStationData>(prefab);
                    bool isCargo = em.HasComponent<Game.Buildings.CargoTransportStation>(entity) || em.HasComponent<CargoTransportStationData>(prefab);
                    vm.IsTransitHub = true;
                    vm.IsCargoHub = isCargo;

                    if (em.HasComponent<Game.Buildings.TransportStation>(entity))
                    {
                        var ts = em.GetComponentData<Game.Buildings.TransportStation>(entity);
                        vm.StationComfort = UnityEngine.Mathf.Round(ts.m_ComfortFactor * 100f);
                    }

                    var uniqueRoutes = _routeSeenScratch;
                    uniqueRoutes.Clear();
                    int totalWaiting = 0;
                    int waitSum = 0;
                    int waitCount = 0;

                    void CheckWaypoint(Entity wp)
                    {
                        if (wp == Entity.Null || !em.Exists(wp)) return;
                        if (em.HasComponent<Game.Routes.CurrentRoute>(wp))
                        {
                            var cr = em.GetComponentData<Game.Routes.CurrentRoute>(wp).m_Route;
                            if (cr != Entity.Null && em.Exists(cr)) uniqueRoutes.Add(cr);
                        }
                        if (em.HasComponent<Game.Routes.WaitingPassengers>(wp))
                        {
                            var wpData = em.GetComponentData<Game.Routes.WaitingPassengers>(wp);
                            totalWaiting += wpData.m_Count;
                            if (wpData.m_AverageWaitingTime > 0)
                            {
                                waitSum += wpData.m_AverageWaitingTime;
                                waitCount++;
                            }
                        }
                    }

                    void ScanConnectedRoutes(Entity target)
                    {
                        if (target == Entity.Null || !em.Exists(target)) return;
                        if (em.HasBuffer<Game.Routes.ConnectedRoute>(target))
                        {
                            var routes = em.GetBuffer<Game.Routes.ConnectedRoute>(target, true);
                            for (int i = 0; i < routes.Length; i++)
                            {
                                CheckWaypoint(routes[i].m_Waypoint);
                            }
                        }
                        if (em.HasComponent<Game.Routes.WaitingPassengers>(target))
                        {
                            var wpData = em.GetComponentData<Game.Routes.WaitingPassengers>(target);
                            totalWaiting += wpData.m_Count;
                            if (wpData.m_AverageWaitingTime > 0)
                            {
                                waitSum += wpData.m_AverageWaitingTime;
                                waitCount++;
                            }
                        }
                    }

                    ScanConnectedRoutes(entity);
                    if (em.HasBuffer<Game.Objects.SubObject>(entity))
                    {
                        var subObjs = em.GetBuffer<Game.Objects.SubObject>(entity, true);
                        for (int s = 0; s < subObjs.Length; s++)
                        {
                            ScanConnectedRoutes(subObjs[s].m_SubObject);
                        }
                    }
                    if (em.HasBuffer<Game.Net.SubLane>(entity))
                    {
                        var subLanes = em.GetBuffer<Game.Net.SubLane>(entity, true);
                        for (int l = 0; l < subLanes.Length; l++)
                        {
                            ScanConnectedRoutes(subLanes[l].m_SubLane);
                        }
                    }
                    if (em.HasBuffer<Game.Buildings.Occupant>(entity))
                    {
                        totalWaiting += em.GetBuffer<Game.Buildings.Occupant>(entity, true).Length;
                    }

                    vm.TransitLines = uniqueRoutes.Count;
                    vm.WaitingPassengers = totalWaiting;
                    vm.AverageWaitTime = waitCount > 0 ? (int)System.Math.Round((double)waitSum / waitCount) : 0;
                    vm.ServiceUsage = totalWaiting;
                    vm.ServiceUnit = isCargo ? "t Cargo" : "Passengers";
                }
                else if (em.HasComponent<Game.Buildings.ElectricityProducer>(entity))
                {
                    var ep = em.GetComponentData<Game.Buildings.ElectricityProducer>(entity);
                    if (vm.ServiceCapacity == 0) vm.ServiceCapacity = ep.m_Capacity;
                    if (vm.ServiceUsage == 0) vm.ServiceUsage = System.Math.Max(0, ep.m_LastProduction);
                    vm.ServiceUnit = "kW";
                }
            }
            catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
        }

        private static void AccumulateSubAreaStorageTons(EntityManager em, Entity ownerEntity, ref double usedTons, ref double capTons)
        {
            if (ownerEntity == Entity.Null || !em.Exists(ownerEntity) || !em.HasBuffer<Game.Areas.SubArea>(ownerEntity)) return;
            var subAreas = em.GetBuffer<Game.Areas.SubArea>(ownerEntity, true);
            for (int sa = 0; sa < subAreas.Length; sa++)
            {
                var areaEnt = subAreas[sa].m_Area;
                if (areaEnt == Entity.Null || !em.Exists(areaEnt) || !em.HasComponent<Game.Areas.Storage>(areaEnt)) continue;
                usedTons += em.GetComponentData<Game.Areas.Storage>(areaEnt).m_Amount / 1000.0;
                if (em.HasComponent<Game.Areas.Geometry>(areaEnt) && em.HasComponent<PrefabRef>(areaEnt))
                {
                    var areaPref = em.GetComponentData<PrefabRef>(areaEnt).m_Prefab;
                    if (areaPref != Entity.Null && em.HasComponent<StorageAreaData>(areaPref))
                    {
                        var geom = em.GetComponentData<Game.Areas.Geometry>(areaEnt);
                        var saData = em.GetComponentData<StorageAreaData>(areaPref);
                        capTons += Game.Areas.AreaUtils.CalculateStorageCapacity(geom, saData) / 1000.0;
                    }
                }
            }
        }

        private static bool IsPhysicalResource(Resource resource)
        {
            switch (resource)
            {
                case Resource.Money:
                case Resource.Software:
                case Resource.Telecom:
                case Resource.Financial:
                case Resource.Media:
                case Resource.Entertainment:
                case Resource.Recreation:
                case Resource.Meals:
                case Resource.Lodging:
                case Resource.NoResource:
                    return false;
                default:
                    return true;
            }
        }

        private void ReadCompanyEntity(EntityManager em, Entity cEnt, UnifiedAssetVm vm)
        {
            if (cEnt == Entity.Null || !em.Exists(cEnt)) return;
            if (em.HasComponent<Game.Citizens.Household>(cEnt)) return;

            bool isAdditionalCompany = !string.IsNullOrEmpty(vm.CompanyEntityKey) && vm.CompanyEntityKey != EntityKey.From(cEnt);

            // Read efficiency from tenant company when building lacks buffer or has no individual factor entries
            if ((vm.Efficiency < 0 || vm.EfficiencyFactors.Count == 0) && em.HasBuffer<Efficiency>(cEnt))
            {
                int prevCount = vm.EfficiencyFactors.Count;
                int compEff = ReadEfficiency(cEnt, vm);
                if (vm.Efficiency < 0 && compEff >= 0)
                {
                    vm.Efficiency = compEff;
                }
                else if (prevCount == 0 && vm.EfficiencyFactors.Count > 0 && compEff >= 0 && compEff != 100)
                {
                    vm.Efficiency = compEff;
                }
            }

            if (string.IsNullOrEmpty(vm.Company) || vm.Company == "Industrial Manufacturing" || vm.Company == "Industrial Processing")
            {
                if (em.HasComponent<CompanyData>(cEnt))
                {
                    vm.CompanyEntityKey = EntityKey.From(cEnt);
                    var compData = em.GetComponentData<CompanyData>(cEnt);
                    if (compData.m_Brand != Entity.Null)
                    {
                        vm.Company = ResolveCleanEntityName(compData.m_Brand);
                    }
                }

                if (string.IsNullOrEmpty(vm.Company) || vm.Company == "Industrial Manufacturing")
                {
                    string entLabel = ResolveCleanEntityName(cEnt);
                    if (!string.IsNullOrEmpty(entLabel) && !entLabel.Equals("Industrial Manufacturing", System.StringComparison.OrdinalIgnoreCase))
                    {
                        vm.Company = entLabel;
                    }
                }

                if ((string.IsNullOrEmpty(vm.Company) || vm.Company == "Industrial Manufacturing") && em.HasComponent<PrefabRef>(cEnt))
                {
                    try
                    {
                        var pEnt = em.GetComponentData<PrefabRef>(cEnt).m_Prefab;
                        string locTitle = TryGetLocalizedPrefabTitle(pEnt);
                        if (!string.IsNullOrEmpty(locTitle) && !locTitle.Equals("Industrial Manufacturing", System.StringComparison.OrdinalIgnoreCase))
                        {
                            vm.Company = locTitle;
                        }
                        else if (_prefabSystem != null)
                        {
                            string pName = _prefabSystem.GetPrefabName(pEnt);
                            if (!string.IsNullOrEmpty(pName) && !pName.Equals("Industrial Manufacturing", System.StringComparison.OrdinalIgnoreCase))
                            {
                                string cleanName = pName.Replace("Industrial_", "").Replace("Commercial_", "").Replace("Office_", "");
                                vm.Company = FormatPrefabDisplayName(cleanName);
                            }
                        }
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }
            }

            if (em.HasComponent<Profitability>(cEnt))
            {
                try
                {
                    var prof = em.GetComponentData<Profitability>(cEnt);
                    int profit = prof.m_Profitability * 2 - 255;
                    vm.ProfitMargin = UnityEngine.Mathf.RoundToInt(((prof.m_Profitability - 127.5f) / 127.5f) * 100f);
                    vm.ProfitabilityTier = profit > 128 ? "Profitable"
                        : profit > 32 ? "Getting By"
                        : profit > -64 ? "Breaking Even"
                        : profit > -182 ? "Losing Money"
                        : "Bankrupt";
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }

            if (em.HasComponent<CompanyStatisticData>(cEnt))
            {
                try
                {
                    var stats = em.GetComponentData<CompanyStatisticData>(cEnt);
                    if (isAdditionalCompany)
                    {
                        vm.Income += stats.m_Income;
                        vm.MonthlyProfit += stats.m_Profit;
                        vm.NetWorth += stats.m_Worth;
                        vm.Customers += stats.m_MonthlyCustomerCount > 0 ? stats.m_MonthlyCustomerCount : stats.m_CurrentNumberOfCustomers;
                        vm.CurrentCustomers += stats.m_CurrentNumberOfCustomers;
                        vm.WagePaid += stats.m_WagePaid;
                        vm.RentPaid += stats.m_RentPaid;
                        vm.TaxPaid += stats.m_TaxPaid;
                        vm.InputCost += stats.m_CostBuyResource;
                        vm.ElectricityPaid += stats.m_ElectricityPaid;
                        vm.WaterPaid += stats.m_WaterPaid;
                        vm.SewagePaid += stats.m_SewagePaid;
                        vm.GarbagePaid += stats.m_GarbagePaid;
                    }
                    else
                    {
                        vm.Income = stats.m_Income;
                        vm.MonthlyProfit = stats.m_Profit;
                        vm.NetWorth = stats.m_Worth;
                        vm.Customers = stats.m_MonthlyCustomerCount > 0 ? stats.m_MonthlyCustomerCount : stats.m_CurrentNumberOfCustomers;
                        vm.CurrentCustomers = stats.m_CurrentNumberOfCustomers;
                        vm.WagePaid = stats.m_WagePaid;
                        vm.RentPaid = stats.m_RentPaid;
                        vm.TaxPaid = stats.m_TaxPaid;
                        vm.InputCost = stats.m_CostBuyResource;
                        vm.ElectricityPaid = stats.m_ElectricityPaid;
                        vm.WaterPaid = stats.m_WaterPaid;
                        vm.SewagePaid = stats.m_SewagePaid;
                        vm.GarbagePaid = stats.m_GarbagePaid;
                    }
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }

            // Company Owned Delivery Vehicles (e.g. Strongarm Mixing 1/5)
            if (cEnt != Entity.Null && em.Exists(cEnt))
            {
                int maxVehicles = 0;
                if (em.HasComponent<TransportCompanyData>(cEnt))
                {
                    maxVehicles = em.GetComponentData<TransportCompanyData>(cEnt).m_MaxTransports;
                }
                else if (em.HasComponent<PrefabRef>(cEnt))
                {
                    Entity cp = em.GetComponentData<PrefabRef>(cEnt).m_Prefab;
                    if (cp != Entity.Null && em.HasComponent<TransportCompanyData>(cp))
                    {
                        maxVehicles = em.GetComponentData<TransportCompanyData>(cp).m_MaxTransports;
                    }
                }

                int inUse = 0;
                if (em.HasBuffer<Game.Vehicles.OwnedVehicle>(cEnt))
                {
                    try
                    {
                        var vBuf = em.GetBuffer<Game.Vehicles.OwnedVehicle>(cEnt, true);
                        for (int v = 0; v < vBuf.Length; v++)
                        {
                            var vehEnt = vBuf[v].m_Vehicle;
                            if (vehEnt != Entity.Null && em.Exists(vehEnt))
                            {
                                if (!em.HasComponent<Game.Vehicles.ParkedCar>(vehEnt) && !em.HasComponent<Game.Vehicles.ParkedTrain>(vehEnt))
                                {
                                    inUse++;
                                }
                            }
                        }
                        if (maxVehicles == 0) maxVehicles = vBuf.Length;
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }

                if (maxVehicles > 0 || inUse > 0)
                {
                    if (isAdditionalCompany)
                    {
                        vm.CompanyVehicles += inUse;
                        vm.CompanyVehiclesMax += maxVehicles;
                    }
                    else
                    {
                        vm.CompanyVehicles = inUse;
                        vm.CompanyVehiclesMax = maxVehicles;
                    }
                }
            }

            if (em.HasComponent<BuyingCompany>(cEnt))
            {
                try
                {
                    var buying = em.GetComponentData<BuyingCompany>(cEnt);
                    var partnerEnt = buying.m_LastTradePartner;
                    if (partnerEnt != Entity.Null && em.Exists(partnerEnt))
                    {
                        string partnerName = string.Empty;
                        if (em.HasComponent<CompanyData>(partnerEnt))
                        {
                            var pComp = em.GetComponentData<CompanyData>(partnerEnt);
                            if (pComp.m_Brand != Entity.Null)
                            {
                                partnerName = ResolveCleanEntityName(pComp.m_Brand);
                            }
                        }
                        if (string.IsNullOrEmpty(partnerName))
                        {
                            partnerName = ResolveCleanEntityName(partnerEnt);
                        }
                        if (string.IsNullOrEmpty(partnerName) && em.HasComponent<PrefabRef>(partnerEnt))
                        {
                            var pRef = em.GetComponentData<PrefabRef>(partnerEnt).m_Prefab;
                            partnerName = TryGetLocalizedPrefabTitle(pRef);
                            if (string.IsNullOrEmpty(partnerName) && _prefabSystem != null)
                            {
                                string rawP = _prefabSystem.GetPrefabName(pRef) ?? string.Empty;
                                rawP = rawP.Replace("Industrial_", "").Replace("Commercial_", "").Replace("Office_", "");
                                partnerName = FormatPrefabDisplayName(rawP);
                            }
                        }
                        if (!string.IsNullOrEmpty(partnerName) && partnerName.StartsWith("Assets.NAME[", System.StringComparison.Ordinal))
                        {
                            partnerName = FormatPrefabDisplayName(partnerName);
                        }
                        vm.TradePartner = partnerName;
                    }
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }

            if (em.HasComponent<PrefabRef>(cEnt))
            {
                var compPrefab = em.GetComponentData<PrefabRef>(cEnt).m_Prefab;
                if (em.HasComponent<IndustrialProcessData>(compPrefab))
                {
                    var proc = em.GetComponentData<IndustrialProcessData>(compPrefab);
                    if (proc.m_Input1.m_Resource != Resource.NoResource)
                    {
                        string in1 = BamEcsUtils.FormatResourceName(proc.m_Input1.m_Resource);
                        if (!string.IsNullOrEmpty(in1) && !vm.InputResources.Contains(in1)) vm.InputResources.Add(in1);
                    }
                    if (proc.m_Input2.m_Resource != Resource.NoResource)
                    {
                        string in2 = BamEcsUtils.FormatResourceName(proc.m_Input2.m_Resource);
                        if (!string.IsNullOrEmpty(in2) && !vm.InputResources.Contains(in2)) vm.InputResources.Add(in2);
                    }
                    if (proc.m_Output.m_Resource != Resource.NoResource)
                    {
                        string outRes = BamEcsUtils.FormatResourceName(proc.m_Output.m_Resource);
                        if (!string.IsNullOrEmpty(outRes))
                        {
                            if (!vm.OutputResources.Contains(outRes)) vm.OutputResources.Add(outRes);
                            if (string.IsNullOrEmpty(vm.Resource)) vm.Resource = outRes;
                        }
                    }
                }

                if (em.HasComponent<StorageCompanyData>(compPrefab))
                {
                    var scd = em.GetComponentData<StorageCompanyData>(compPrefab);
                    AppendMaskResourcesToOutput(scd.m_StoredResources, vm);
                }
            }

            // Populate Tax Rate for company via TaxSystem
            if (_taxSystem != null && !string.IsNullOrEmpty(vm.Resource))
            {
                try
                {
                    string enumCandidate = vm.Resource.Replace(" ", "");
                    if (System.Enum.TryParse<Resource>(enumCandidate, true, out var resEnum) && resEnum != Resource.NoResource)
                    {
                        if (vm.Category == "Industrial" || vm.Category == "Storage")
                            vm.TaxRate = _taxSystem.GetIndustrialTaxRate(resEnum);
                        else if (vm.Category == "Commercial")
                            vm.TaxRate = _taxSystem.GetCommercialTaxRate(resEnum);
                        else if (vm.Category == "Office")
                            vm.TaxRate = _taxSystem.GetOfficeTaxRate(resEnum);
                    }
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }

            // Final fallback for company name if still empty or generic
            if ((string.IsNullOrEmpty(vm.Company) || vm.Company == "Industrial Manufacturing") && !string.IsNullOrEmpty(vm.Resource))
            {
                vm.Company = $"{vm.Resource} Facility";
            }
        }

        private static void AppendMaskResourcesToOutput(Resource maskResource, UnifiedAssetVm vm)
        {
            if (maskResource == Resource.NoResource) return;
            ulong maskVal = (ulong)maskResource;
            for (int bit = 0; bit < 64; bit++)
            {
                ulong bitMask = 1UL << bit;
                if ((maskVal & bitMask) == 0) continue;
                Resource flag = (Resource)bitMask;
                string resName = BamEcsUtils.FormatResourceName(flag);
                if (!string.IsNullOrEmpty(resName) && IsPhysicalResource(flag))
                {
                    if (!vm.OutputResources.Contains(resName)) vm.OutputResources.Add(resName);
                    if (string.IsNullOrEmpty(vm.Resource)) vm.Resource = resName;
                }
            }
        }

        private static string ResolveStorageResourceType(EntityManager em, Resource res, bool hasRPrefabs, Game.Prefabs.ResourcePrefabs rPrefabs)
        {
            if (res == Resource.UnsortedMail || res == Resource.LocalMail || res == Resource.OutgoingMail)
            {
                return "Mail";
            }
            if (hasRPrefabs)
            {
                try
                {
                    Entity rEnt = rPrefabs[res];
                    if (rEnt != Entity.Null && em.HasComponent<ResourceData>(rEnt))
                    {
                        return em.GetComponentData<ResourceData>(rEnt).m_IsMaterial ? "Raw Materials" : "Processed Goods";
                    }
                }
                catch (System.Exception ex)
                {
                    Mod.Log.Debug($"Placed read: {ex.Message}");
                }
            }
            return "Processed Goods";
        }

        private static void AddOrUpdateStoredResource(UnifiedAssetVm vm, string name, int amount, float weightTons, string resType)
        {
            for (int i = 0; i < vm.StoredResources.Count; i++)
            {
                if (vm.StoredResources[i].Name == name)
                {
                    if (amount > vm.StoredResources[i].Amount)
                    {
                        vm.StoredResources[i].Amount = amount;
                        vm.StoredResources[i].Weight = weightTons;
                    }
                    return;
                }
            }
            vm.StoredResources.Add(new StoredResourceDto
            {
                Name = name,
                Amount = amount,
                Weight = weightTons,
                Type = resType
            });
        }

        private void FillEffects(Entity prefab, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            if (em.HasBuffer<CityModifierData>(prefab))
            {
                var cBuf = em.GetBuffer<CityModifierData>(prefab, true);
                for (int i = 0; i < cBuf.Length; i++)
                {
                    string effStr = BamEcsUtils.FormatCityModifier(cBuf[i]);
                    if (!vm.CityEffects.Contains(effStr)) vm.CityEffects.Add(effStr);
                }
            }
            if (em.HasBuffer<LocalModifierData>(prefab))
            {
                var lBuf = em.GetBuffer<LocalModifierData>(prefab, true);
                for (int i = 0; i < lBuf.Length; i++)
                {
                    string effStr = BamEcsUtils.FormatLocalModifier(lBuf[i]);
                    if (!vm.LocalEffects.Contains(effStr)) vm.LocalEffects.Add(effStr);
                }
            }
            if (em.HasComponent<LeisureProviderData>(prefab))
            {
                var lpd = em.GetComponentData<LeisureProviderData>(prefab);
                if (lpd.m_Efficiency > 0)
                {
                    string lName = BamEcsUtils.FormatLeisureType(lpd.m_LeisureType);
                    string effStr = $"+{lpd.m_Efficiency} {lName}";
                    if (!vm.LocalEffects.Contains(effStr)) vm.LocalEffects.Add(effStr);
                }
            }
        }

        private void FillCondition(Entity entity, Entity prefab, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            if (!em.HasComponent<BuildingCondition>(entity)) return;
            if (vm.IsSignature || em.HasComponent<SignatureBuildingData>(prefab) || em.HasComponent<Signature>(entity) || em.HasComponent<Abandoned>(entity))
            {
                return;
            }

            try
            {
                var cond = em.GetComponentData<BuildingCondition>(entity);

                if (em.HasComponent<SpawnableBuildingData>(prefab) && em.HasComponent<BuildingPropertyData>(prefab))
                {
                    var sData = em.GetComponentData<SpawnableBuildingData>(prefab);
                    if (sData.m_Level >= 5)
                    {
                        vm.MaxCondition = 0;
                        vm.BuildingCondition = cond.m_Condition < 0 ? UnityEngine.Mathf.Clamp(cond.m_Condition, -100, 100) : 100;
                        return;
                    }

                    var pData = em.GetComponentData<BuildingPropertyData>(prefab);
                    if (em.HasComponent<ZoneData>(sData.m_ZonePrefab))
                    {
                        var zData = em.GetComponentData<ZoneData>(sData.m_ZonePrefab);
                        Entity cityEntity = _citySystem != null ? _citySystem.City : Entity.Null;
                        if (cityEntity != Entity.Null && em.HasBuffer<Game.City.CityModifier>(cityEntity))
                        {
                            var cityEffects = em.GetBuffer<Game.City.CityModifier>(cityEntity, true);
                            int cost = (int)System.Math.Round((double)BuildingUtils.GetLevelingCost(zData.m_AreaType, pData, sData.m_Level, cityEffects));
                            if (cost >= 1000000000)
                            {
                                vm.MaxCondition = 0;
                                vm.BuildingCondition = cond.m_Condition < 0 ? UnityEngine.Mathf.Clamp(cond.m_Condition, -100, 100) : 100;
                                return;
                            }
                            vm.MaxCondition = cost;
                        }
                    }
                }

                if (vm.MaxCondition > 0)
                {
                    vm.BuildingCondition = UnityEngine.Mathf.Clamp((int)System.Math.Round(((double)cond.m_Condition / vm.MaxCondition) * 100.0), -100, 100);
                }
                else
                {
                    vm.BuildingCondition = UnityEngine.Mathf.Clamp(cond.m_Condition, -100, 100);
                }
            }
            catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
        }

        private void FillResidentialEconomics(EntityManager em, Entity entity, Entity prefab, UnifiedAssetVm vm)
        {
            int hhCount = 0;
            long totalIncome = 0;
            long totalRent = 0;
            long totalUpkeep = 0;
            long totalResourceCost = 0;
            int totalPets = 0;
            long totalWealth = 0;

            if (em.HasBuffer<Renter>(entity))
            {
                var renters = em.GetBuffer<Renter>(entity, true);
                for (int r = 0; r < renters.Length; r++)
                {
                    var rEnt = renters[r].m_Renter;
                    if (rEnt == Entity.Null || !em.Exists(rEnt)) continue;

                    if (BamEcsUtils.IsValidMovedInHousehold(em, rEnt, out var hh))
                    {
                        hhCount++;
                        totalIncome += hh.m_Income;
                        totalUpkeep += System.Math.Abs(hh.m_MoneySpendOnBuildingLevelingLastDay);
                        totalResourceCost += hh.m_ShoppedValuePerDay;

                        if (em.HasBuffer<Resources>(rEnt))
                        {
                            totalWealth += EconomyUtils.GetHouseholdTotalWealth(hh, em.GetBuffer<Resources>(rEnt, true));
                        }
                        else
                        {
                            totalWealth += hh.m_Resources;
                        }

                        if (em.HasComponent<PropertyRenter>(rEnt))
                        {
                            var pr = em.GetComponentData<PropertyRenter>(rEnt);
                            totalRent += pr.m_Rent;
                        }

                        if (em.HasBuffer<HouseholdAnimal>(rEnt))
                        {
                            totalPets += em.GetBuffer<HouseholdAnimal>(rEnt, true).Length;
                        }
                    }
                }
            }

            if (hhCount > 0)
            {
                vm.HouseholdIncome = (int)System.Math.Round((double)totalIncome / hhCount);
                vm.HouseholdRent = (int)System.Math.Round((double)totalRent / hhCount);
                vm.HouseholdUpkeep = (int)System.Math.Round((double)totalUpkeep / hhCount);
                vm.HouseholdResourceCost = (int)System.Math.Round((double)totalResourceCost / hhCount);

                float bldgFees = 0f;
                Entity feeCity = _citySystem != null ? _citySystem.City : Entity.Null;
                if (feeCity != Entity.Null && em.Exists(feeCity) && em.HasBuffer<Game.City.ServiceFee>(feeCity))
                {
                    var feesBuf = em.GetBuffer<Game.City.ServiceFee>(feeCity, true);
                    if (em.HasComponent<ElectricityConsumer>(entity))
                    {
                        bldgFees += em.GetComponentData<ElectricityConsumer>(entity).m_FulfilledConsumption * Game.Simulation.ServiceFeeSystem.GetFee(Game.City.PlayerResource.Electricity, feesBuf);
                    }
                    if (em.HasComponent<WaterConsumer>(entity))
                    {
                        var wc = em.GetComponentData<WaterConsumer>(entity);
                        bldgFees += (wc.m_FulfilledFresh + wc.m_FulfilledSewage) * Game.Simulation.ServiceFeeSystem.GetFee(Game.City.PlayerResource.Water, feesBuf);
                    }
                    if (em.HasComponent<ConsumptionData>(prefab))
                    {
                        bldgFees += em.GetComponentData<ConsumptionData>(prefab).m_GarbageAccumulation * Game.Simulation.ServiceFeeSystem.GetFee(Game.City.PlayerResource.Garbage, feesBuf);
                    }
                }
                vm.HouseholdFees = (int)System.Math.Round(bldgFees / hhCount);
                vm.Pets = totalPets;
                vm.TotalRent = (int)System.Math.Clamp(totalRent, int.MinValue, int.MaxValue);
                vm.RentPerRenter = vm.HouseholdRent;

                long rawAvgWealth = (long)System.Math.Round((double)totalWealth / hhCount);
                int avgWealth = (int)System.Math.Clamp(rawAvgWealth, int.MinValue, int.MaxValue);
                if (!_happinessParameterQuery.IsEmptyIgnoreFilter)
                {
                    try
                    {
                        var hpParams = _happinessParameterQuery.GetSingleton<CitizenHappinessParameterData>();
                        vm.HouseholdWealth = Game.UI.InGame.CitizenUIUtils.GetHouseholdWealthKey(avgWealth, hpParams).ToString();
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
                }
                if (string.IsNullOrEmpty(vm.HouseholdWealth))
                {
                    vm.HouseholdWealth = avgWealth < 0 ? "Wretched"
                        : avgWealth < 1000 ? "Poor"
                        : avgWealth < 3000 ? "Modest"
                        : avgWealth < 6000 ? "Comfortable"
                        : "Wealthy";
                }
            }
            else
            {
                vm.HouseholdFees = 0;
                vm.HouseholdRent = 0;
                vm.TotalRent = 0;
                vm.RentPerRenter = 0;
            }

            // Rent Valuation & Land Value calculation breakdown (from Building.m_RoadEdge, never fake defaults)
            if (em.HasComponent<BuildingData>(prefab))
            {
                var bData = em.GetComponentData<BuildingData>(prefab);
                vm.LotSize = bData.m_LotSize.x * bData.m_LotSize.y;
            }
            if (em.HasComponent<BuildingPropertyData>(prefab))
            {
                var pData = em.GetComponentData<BuildingPropertyData>(prefab);
                vm.SpaceMultiplier = pData.m_SpaceMultiplier > 0 ? pData.m_SpaceMultiplier : 1f;
            }
            else
            {
                vm.SpaceMultiplier = 1f;
            }

            vm.LandValueBase = 0f;
            if (em.HasComponent<Building>(entity))
            {
                var bldg = em.GetComponentData<Building>(entity);
                if (bldg.m_RoadEdge != Entity.Null && em.HasComponent<Game.Net.LandValue>(bldg.m_RoadEdge))
                {
                    vm.LandValueBase = (float)System.Math.Round((double)em.GetComponentData<Game.Net.LandValue>(bldg.m_RoadEdge).m_LandValue, 3);
                }
            }
            vm.LandValueModifier = 0.35f;
            vm.LandValueRate = (float)System.Math.Round(vm.LandValueModifier * vm.LandValueBase, 3);
            vm.BaseRent = vm.TotalRent > 0 ? vm.TotalRent : vm.RentPerRenter;
        }

        private void FillResidentialHappinessFactors(Entity entity, Entity prefab, UnifiedAssetVm vm, PrefabInfo info)
        {
            var em = EntityManager;
            var list = vm.HappinessFactors;
            list.Clear();

            var seen = _factorSeenScratch;
            seen.Clear();

            // 1. Live AverageHappinessSection factor capture if currently selected in vanilla
            if (_avgHappinessSection != null)
            {
                try
                {
                    if (s_avgHappinessSelectedEntityProp != null && s_avgHappinessFactorsField != null)
                    {
                        var sel = (Entity)s_avgHappinessSelectedEntityProp.GetValue(_avgHappinessSection);
                        if (sel == entity)
                        {
                            var nativeList = (Unity.Collections.NativeList<Game.UI.InGame.FactorInfo>)s_avgHappinessFactorsField.GetValue(_avgHappinessSection);
                            if (nativeList.IsCreated && nativeList.Length > 0)
                            {
                                for (int i = 0; i < nativeList.Length; i++)
                                {
                                    var fi = nativeList[i];
                                    string factorName = System.Enum.GetName(typeof(Game.Buildings.BuildingHappinessFactor), fi.factor) ?? $"Factor #{fi.factor}";
                                    string label = DistrictSystem.FormatFactorLabel(factorName, fi.weight);
                                    list.Add(new EfficiencyFactorVm
                                    {
                                        Factor = label,
                                        Percentage = fi.weight
                                    });
                                    seen.Add(label);
                                }
                            }
                        }
                    }
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }

            void AddIfUnseen(string factor, int pct)
            {
                if (!seen.Contains(factor))
                {
                    list.Add(new EfficiencyFactorVm { Factor = factor, Percentage = pct });
                    seen.Add(factor);
                }
            }

            // 2. Comprehensive building simulation using exact vanilla factor names & formulas
            // Spacious homes vs Small homes (Apartment)
            int households = vm.Occupied > 0 ? vm.Occupied : 1;
            float spacePerHh = vm.LotSize > 0 ? (float)vm.LotSize / households : 1f;
            if (vm.Level >= 4 || spacePerHh >= 2f)
            {
                AddIfUnseen("Spacious homes", System.Math.Min(32, 16 + vm.Level * 3));
            }
            else if (spacePerHh < 0.25f && households > 10)
            {
                AddIfUnseen("Small homes", -10);
            }
            else
            {
                AddIfUnseen("Spacious homes", +2);
            }

            // Reliable healthcare coverage (Healthcare)
            bool hasSick = false;
            int sampledResidents = 0;
            if (em.HasBuffer<Renter>(entity))
            {
                var renters = em.GetBuffer<Renter>(entity, true);
                for (int r = 0; r < renters.Length && !hasSick; r++)
                {
                    var rEnt = renters[r].m_Renter;
                    if (BamEcsUtils.IsValidMovedInHousehold(em, rEnt, out _) && em.HasBuffer<HouseholdCitizen>(rEnt))
                    {
                        var cits = em.GetBuffer<HouseholdCitizen>(rEnt, true);
                        for (int c = 0; c < cits.Length; c++)
                        {
                            var cEnt = cits[c].m_Citizen;
                            if (BamEcsUtils.IsLivingCitizen(em, cEnt))
                            {
                                sampledResidents++;
                                if (em.HasComponent<HealthProblem>(cEnt))
                                {
                                    var hp = em.GetComponentData<HealthProblem>(cEnt);
                                    if ((hp.m_Flags & HealthProblemFlags.Sick) != 0) { hasSick = true; break; }
                                }
                            }
                        }
                    }
                }
            }
            if (sampledResidents > 0)
            {
                if (hasSick)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("Healthcare", -4), -4);
                else
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("Healthcare", +12), +12);
            }

            // Shared utility, service, tax & safety checks (never fabricate unset tax/mail/education constants)
            AddBuildingEnvironmentHappinessFactors(entity, vm, AddIfUnseen, includeUnsetTaxFallback: false);

            SortHappinessFactors(list);
        }

        private void FillWorkplaceHappinessFactors(Entity entity, UnifiedAssetVm vm)
        {
            if (vm.Occupied <= 0 && string.IsNullOrEmpty(vm.Company) && vm.Category != AssetCategory.Service)
                return;

            var em = EntityManager;
            var list = vm.HappinessFactors;
            list.Clear();
            var seen = _factorSeenScratch;
            seen.Clear();

            void AddIfUnseen(string factor, int pct)
            {
                if (!seen.Contains(factor))
                {
                    list.Add(new EfficiencyFactorVm { Factor = factor, Percentage = pct });
                    seen.Add(factor);
                }
            }

            if (vm.Capacity > 0)
            {
                if (vm.Occupied >= vm.Capacity)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("MissingWorkers", +4), +4);
                else if (vm.Occupied * 2 < vm.Capacity)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("MissingWorkers", -8), -8);
                else
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("MissingWorkers", -3), -3);
            }

            if (vm.Efficiency >= 105)
            {
                int effBoost = System.Math.Min(15, (vm.Efficiency - 100) / 2);
                AddIfUnseen(BamEcsUtils.FormatFactorLabel("Efficiency", effBoost), effBoost);
            }
            else if (vm.Efficiency >= 95)
            {
                AddIfUnseen(BamEcsUtils.FormatFactorLabel("Efficiency", +4), +4);
            }
            else if (vm.Efficiency >= 0)
            {
                int effDrop = -System.Math.Max(2, (100 - vm.Efficiency) / 3);
                AddIfUnseen(BamEcsUtils.FormatFactorLabel("Efficiency", effDrop), effDrop);
            }

            if (!string.IsNullOrEmpty(vm.ProfitabilityTier))
            {
                if (vm.ProfitMargin >= 10)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("OutputCosts", +5), +5);
                else if (vm.ProfitMargin <= -15)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("InputCosts", -6), -6);
            }

            bool hasSickWorker = false;
            int sampledWorkers = 0;
            void ScanEmployeeHealth(Entity wpEnt)
            {
                if (wpEnt == Entity.Null || !em.Exists(wpEnt) || !em.HasBuffer<Employee>(wpEnt)) return;
                var emps = em.GetBuffer<Employee>(wpEnt, true);
                for (int w = 0; w < emps.Length && sampledWorkers < 40; w++)
                {
                    Entity cEnt = emps[w].m_Worker;
                    if (cEnt == Entity.Null || !em.Exists(cEnt) || !em.HasComponent<Game.Citizens.Citizen>(cEnt) || CitizenUtils.IsDead(em, cEnt)) continue;
                    sampledWorkers++;
                    if (em.HasComponent<HealthProblem>(cEnt) && (em.GetComponentData<HealthProblem>(cEnt).m_Flags & HealthProblemFlags.Sick) != 0)
                    {
                        hasSickWorker = true;
                        return;
                    }
                }
            }
            ScanEmployeeHealth(entity);
            if (!hasSickWorker && sampledWorkers < 40 && em.HasBuffer<Renter>(entity))
            {
                var renters = em.GetBuffer<Renter>(entity, true);
                for (int r = 0; r < renters.Length && !hasSickWorker && sampledWorkers < 40; r++)
                {
                    ScanEmployeeHealth(renters[r].m_Renter);
                }
            }
            if (sampledWorkers > 0)
            {
                AddIfUnseen(BamEcsUtils.FormatFactorLabel("Healthcare", hasSickWorker ? -4 : +6), hasSickWorker ? -4 : +6);
            }

            if (vm.Happiness > 0)
            {
                if (vm.Happiness >= 65)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("Welfare", +5), +5);
                else if (vm.Happiness < 45)
                    AddIfUnseen(BamEcsUtils.FormatFactorLabel("Welfare", -5), -5);
            }

            AddBuildingEnvironmentHappinessFactors(entity, vm, AddIfUnseen, includeUnsetTaxFallback: false);
            SortHappinessFactors(list);
        }

        private void AddBuildingEnvironmentHappinessFactors(
            Entity entity,
            UnifiedAssetVm vm,
            System.Action<string, int> addIfUnseen,
            bool includeUnsetTaxFallback)
        {
            var em = EntityManager;

            if (vm.MailSending > 0 || vm.MailReceiving > 0)
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Mail", +7), +7);

            if (vm.Attractiveness > 8)
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Entertainment", +6), +6);

            if (vm.TaxRate > 12)
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Tax", -(vm.TaxRate - 10)), -(vm.TaxRate - 10));
            else if (vm.TaxRate > 0)
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Tax", +3), +3);
            else if (includeUnsetTaxFallback)
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Tax", -5), -5);

            int upgCount = vm.SubBuildings != null ? vm.SubBuildings.Count : 0;
            if (upgCount > 0)
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Buildings", +upgCount), +upgCount);

            bool elecShortage = false;
            if (em.HasComponent<ElectricityConsumer>(entity))
            {
                var elec = em.GetComponentData<ElectricityConsumer>(entity);
                if (elec.m_FulfilledConsumption < elec.m_WantedConsumption)
                {
                    elecShortage = true;
                    addIfUnseen(BamEcsUtils.FormatFactorLabel("Electricity", -15), -15);
                }
            }
            if (!elecShortage) addIfUnseen(BamEcsUtils.FormatFactorLabel("Electricity", +5), +5);

            bool waterShortage = false;
            bool sewerBackup = false;
            if (em.HasComponent<WaterConsumer>(entity))
            {
                var water = em.GetComponentData<WaterConsumer>(entity);
                if (water.m_FulfilledFresh < water.m_WantedConsumption)
                {
                    waterShortage = true;
                    addIfUnseen(BamEcsUtils.FormatFactorLabel("Water", -15), -15);
                }
                if (water.m_FulfilledSewage < water.m_WantedConsumption)
                {
                    sewerBackup = true;
                    addIfUnseen(BamEcsUtils.FormatFactorLabel("Sewage", -20), -20);
                }
            }
            if (!waterShortage) addIfUnseen(BamEcsUtils.FormatFactorLabel("Water", +5), +5);
            if (!sewerBackup) addIfUnseen(BamEcsUtils.FormatFactorLabel("Sewage", +4), +4);

            bool garbagePile = false;
            if (em.HasComponent<GarbageProducer>(entity))
            {
                var garbage = em.GetComponentData<GarbageProducer>(entity);
                if (garbage.m_Garbage > 300)
                {
                    garbagePile = true;
                    addIfUnseen(BamEcsUtils.FormatFactorLabel("Garbage", -12), -12);
                }
            }
            if (!garbagePile) addIfUnseen(BamEcsUtils.FormatFactorLabel("Garbage", +3), +3);

            bool hasCrimeScene = em.HasComponent<Game.Events.AccidentSite>(entity) &&
                (em.GetComponentData<Game.Events.AccidentSite>(entity).m_Flags & Game.Events.AccidentSiteFlags.CrimeScene) != 0;
            if (hasCrimeScene || vm.CrimeProbability > 5000f)
            {
                int crimePenalty = hasCrimeScene ? -14 : -System.Math.Min(14, (int)((vm.CrimeProbability - 5000f) / 1000f) + 2);
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Crime", crimePenalty), crimePenalty);
            }
            else
            {
                addIfUnseen(BamEcsUtils.FormatFactorLabel("Crime", +4), +4);
            }
        }

        private static void SortHappinessFactors(List<EfficiencyFactorVm> list)
        {
            list.Sort((a, b) =>
            {
                int absA = System.Math.Abs(a.Percentage);
                int absB = System.Math.Abs(b.Percentage);
                if (absA != absB) return absB.CompareTo(absA);
                return string.Compare(a.Factor, b.Factor, System.StringComparison.Ordinal);
            });
        }

        private static readonly string[] s_educationTierNames =
        {
            "Uneducated", "Poorly Educated", "Educated", "Well Educated", "Highly Educated"
        };

        private static void AppendEducationTiers(UnifiedAssetVm vm, int[] filled, int[] totals)
        {
            for (int l = 0; l < 5; l++)
            {
                vm.EducationTiers.Add(new EducationTierDto
                {
                    Level = l,
                    Name = s_educationTierNames[l],
                    Filled = filled[l],
                    Total = totals[l]
                });
            }
        }

        private static void FillPrefabWorkplaceEducationTiers(EntityManager em, Entity prefab, UnifiedAssetVm vm)
        {
            if (prefab == Entity.Null || !em.Exists(prefab) || vm.EducationTiers.Count > 0) return;
            if (!em.HasComponent<Game.Prefabs.WorkplaceData>(prefab)) return;

            var wpData = em.GetComponentData<Game.Prefabs.WorkplaceData>(prefab);
            if (wpData.m_MaxWorkers <= 0) return;

            int level = 1;
            if (em.HasComponent<Game.Prefabs.SpawnableBuildingData>(prefab))
            {
                level = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(prefab).m_Level;
            }

            var wData = Game.UI.InGame.EmploymentData.GetWorkplacesData(wpData.m_MaxWorkers, level, wpData.m_Complexity);
            System.Array.Clear(_wpFilledScratch, 0, 5);
            _wpReqScratch[0] = wData.uneducated;
            _wpReqScratch[1] = wData.poorlyEducated;
            _wpReqScratch[2] = wData.educated;
            _wpReqScratch[3] = wData.wellEducated;
            _wpReqScratch[4] = wData.highlyEducated;
            AppendEducationTiers(vm, _wpFilledScratch, _wpReqScratch);
            if (vm.Capacity == 0) vm.Capacity = wData.total;
        }

        private static readonly List<System.Type> _historicalComponentTypes = new List<System.Type>();
        private static bool _historicalTypeSearched;

        private void FillHistoricalStatus(Entity entity, UnifiedAssetVm vm)
        {
            if (!_historicalTypeSearched)
            {
                _historicalTypeSearched = true;
                foreach (var asm in System.AppDomain.CurrentDomain.GetAssemblies())
                {
                    if (asm == null || asm.IsDynamic) continue;
                    System.Type[] types = null;
                    try
                    {
                        types = asm.GetTypes();
                    }
                    catch (System.Reflection.ReflectionTypeLoadException rtle)
                    {
                        types = rtle.Types;
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }

                    if (types == null) continue;
                    for (int i = 0; i < types.Length; i++)
                    {
                        var t = types[i];
                        if (t == null || !t.IsValueType) continue;
                        if ((t.Name == "Historical" || t.Name == "HistoricalBuilding" || t.Name == "LockLevel" || t.Name == "LevelLocked")
                            && typeof(IComponentData).IsAssignableFrom(t)
                            && !_historicalComponentTypes.Contains(t))
                        {
                            _historicalComponentTypes.Add(t);
                        }
                    }
                }
            }

            for (int i = 0; i < _historicalComponentTypes.Count; i++)
            {
                try
                {
                    if (EntityManager.HasComponent(entity, ComponentType.ReadOnly(_historicalComponentTypes[i])))
                    {
                        vm.IsHistorical = true;
                        return;
                    }
                }
                catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }
            }
        }

        private void FillParkingMetrics(Entity entity, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            int cap = 0;
            int parked = 0;
            int fee = 0;

            try
            {
                int laneCount = 0;
                int pCap = 0;
                int pParked = 0;
                int pFee = 0;
                Game.Vehicles.VehicleUtils.GetParkingData(this, entity, ref laneCount, ref pCap, ref pParked, ref pFee);
                if (pCap > 0)
                {
                    cap = pCap;
                    parked = pParked;
                    fee = pFee;
                }
            }
            catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }

            if (cap == 0)
            {
                if (em.HasComponent<Game.Net.GarageLane>(entity))
                {
                    var gl = em.GetComponentData<Game.Net.GarageLane>(entity);
                    cap += gl.m_VehicleCapacity;
                    parked += gl.m_VehicleCount;
                    if (gl.m_ParkingFee > 0) fee = gl.m_ParkingFee;
                }

                if (em.HasBuffer<Game.Objects.SubObject>(entity))
                {
                    var subObjs = em.GetBuffer<Game.Objects.SubObject>(entity, true);
                    for (int s = 0; s < subObjs.Length; s++)
                    {
                        var sub = subObjs[s].m_SubObject;
                        if (sub != Entity.Null && em.Exists(sub))
                        {
                            if (em.HasComponent<Game.Net.GarageLane>(sub))
                            {
                                var gl = em.GetComponentData<Game.Net.GarageLane>(sub);
                                cap += gl.m_VehicleCapacity;
                                parked += gl.m_VehicleCount;
                                if (gl.m_ParkingFee > 0) fee = gl.m_ParkingFee;
                            }
                            if (em.HasBuffer<Game.Net.SubLane>(sub))
                            {
                                var subLanes = em.GetBuffer<Game.Net.SubLane>(sub, true);
                                for (int l = 0; l < subLanes.Length; l++)
                                {
                                    var lane = subLanes[l].m_SubLane;
                                    if (lane != Entity.Null && em.Exists(lane) && em.HasComponent<Game.Net.GarageLane>(lane))
                                    {
                                        var gl = em.GetComponentData<Game.Net.GarageLane>(lane);
                                        cap += gl.m_VehicleCapacity;
                                        parked += gl.m_VehicleCount;
                                        if (gl.m_ParkingFee > 0) fee = gl.m_ParkingFee;
                                    }
                                }
                            }
                        }
                    }
                }

                if (em.HasBuffer<Game.Net.SubLane>(entity))
                {
                    var subLanes = em.GetBuffer<Game.Net.SubLane>(entity, true);
                    for (int l = 0; l < subLanes.Length; l++)
                    {
                        var lane = subLanes[l].m_SubLane;
                        if (lane != Entity.Null && em.Exists(lane) && em.HasComponent<Game.Net.GarageLane>(lane))
                        {
                            var gl = em.GetComponentData<Game.Net.GarageLane>(lane);
                            cap += gl.m_VehicleCapacity;
                            parked += gl.m_VehicleCount;
                            if (gl.m_ParkingFee > 0) fee = gl.m_ParkingFee;
                        }
                    }
                }
            }

            if (em.HasComponent<PrefabRef>(entity))
            {
                var pref = em.GetComponentData<PrefabRef>(entity).m_Prefab;
                if (UpgradeUtils.TryGetCombinedComponent<ParkingFacilityData>(em, entity, pref, out var pfData))
                {
                    if (cap == 0 && pfData.m_GarageMarkerCapacity > 0) cap = pfData.m_GarageMarkerCapacity;
                    if (vm.ParkingComfort == 0) vm.ParkingComfort = (int)System.Math.Round(pfData.m_ComfortFactor * 100f);
                }
            }
            if (em.HasComponent<Game.Buildings.ParkingFacility>(entity))
            {
                var pf = em.GetComponentData<Game.Buildings.ParkingFacility>(entity);
                if (vm.ParkingComfort == 0) vm.ParkingComfort = (int)System.Math.Round(pf.m_ComfortFactor * 100f);
            }

            if (cap > 0)
            {
                vm.ParkingCapacity = cap;
                vm.ParkedVehicles = parked;
                vm.ParkingFee = fee;
                if (em.HasComponent<Game.Buildings.ParkingFacility>(entity) && vm.SubCategory == "Parking" && vm.ServiceCapacity == 0)
                {
                    vm.ServiceCapacity = cap;
                    vm.ServiceUsage = parked;
                    vm.ServiceUnit = "cars";
                }
            }
        }

        private void FillParkAndLeisureMetrics(Entity entity, Entity prefab, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            if (em.HasComponent<Game.Buildings.Park>(entity))
            {
                var park = em.GetComponentData<Game.Buildings.Park>(entity);
                if (UpgradeUtils.TryGetCombinedComponent<ParkData>(em, entity, prefab, out var parkData) && parkData.m_MaintenancePool > 0)
                {
                    vm.ParkMaintenance = UnityEngine.Mathf.Clamp((int)UnityEngine.Mathf.CeilToInt((float)park.m_Maintenance / (float)parkData.m_MaintenancePool * 100f), 0, 100);
                }
                else
                {
                    vm.ParkMaintenance = 100;
                }
            }

            if (UpgradeUtils.TryGetCombinedComponent<AttractionData>(em, entity, prefab, out var attrData))
            {
                if (attrData.m_Attractiveness > vm.Attractiveness)
                {
                    vm.Attractiveness = attrData.m_Attractiveness;
                }
            }

            if (em.HasComponent<LeisureProviderData>(prefab))
            {
                var lpData = em.GetComponentData<LeisureProviderData>(prefab);
                vm.Recreation = lpData.m_Efficiency;
                vm.LeisureType = BamEcsUtils.FormatLeisureType(lpData.m_LeisureType);
            }
            else if (em.HasComponent<LeisureProviderData>(entity))
            {
                var lpData = em.GetComponentData<LeisureProviderData>(entity);
                vm.Recreation = lpData.m_Efficiency;
                vm.LeisureType = BamEcsUtils.FormatLeisureType(lpData.m_LeisureType);
            }

            // Count living residents / homeless living in park or building (do not overwrite Residential count set in FillOccupancy)
            if (vm.Category != AssetCategory.Residential && em.HasBuffer<Game.Buildings.Renter>(entity))
            {
                var renters = em.GetBuffer<Game.Buildings.Renter>(entity, true);
                int resCount = 0;
                for (int r = 0; r < renters.Length; r++)
                {
                    var hEnt = renters[r].m_Renter;
                    if (BamEcsUtils.IsValidMovedInHousehold(em, hEnt, out _) &&
                        em.HasBuffer<Game.Citizens.HouseholdCitizen>(hEnt))
                    {
                        var hhCits = em.GetBuffer<Game.Citizens.HouseholdCitizen>(hEnt, true);
                        for (int c = 0; c < hhCits.Length; c++)
                        {
                            if (BamEcsUtils.IsLivingCitizen(em, hhCits[c].m_Citizen))
                            {
                                resCount++;
                            }
                        }
                    }
                }
                if (resCount > 0)
                {
                    vm.Residents = resCount;
                }
            }
        }

        private void FillUpkeepCosts(Entity entity, Entity prefab, UnifiedAssetVm vm)
        {
            var em = EntityManager;
            bool isServiceOrPark = vm.Category == AssetCategory.Service || em.HasComponent<Game.Buildings.Park>(entity);
            bool isInactive = em.HasComponent<Building>(entity) &&
                              BuildingUtils.CheckOption(em.GetComponentData<Building>(entity), BuildingOption.Inactive);

            bool hasEconParams = !_economyParameterQuery.IsEmptyIgnoreFilter;
            EconomyParameterData econParams = default;
            if (hasEconParams)
            {
                try { econParams = _economyParameterQuery.GetSingleton<EconomyParameterData>(); } catch { hasEconParams = false; }
            }

            if (isServiceOrPark)
            {
                // City service upkeep matches UpkeepSection / CityServiceUpkeepSystem:
                // ServiceUpkeepData(Money) already includes city service wages; fallback to ConsumptionData.m_Upkeep only if no ServiceUpkeepData exists.
                int totalServiceUpkeep = GetPrefabMoneyUpkeep(em, prefab);
                if (em.HasBuffer<InstalledUpgrade>(entity))
                {
                    var upgrades = em.GetBuffer<InstalledUpgrade>(entity, true);
                    for (int u = 0; u < upgrades.Length; u++)
                    {
                        if (BuildingUtils.CheckOption(upgrades[u], BuildingOption.Inactive)) continue;
                        var upEnt = upgrades[u].m_Upgrade;
                        if (upEnt != Entity.Null && em.Exists(upEnt) && em.HasComponent<PrefabRef>(upEnt))
                        {
                            var upPref = em.GetComponentData<PrefabRef>(upEnt).m_Prefab;
                            totalServiceUpkeep += GetPrefabMoneyUpkeep(em, upPref);
                        }
                    }
                }

                if (isInactive)
                {
                    totalServiceUpkeep = UnityEngine.Mathf.RoundToInt(totalServiceUpkeep * 0.1f);
                }

                // Expose WagePaid for breakdown display using real EconomyParameterData.GetWage(..., cityServiceJob: true),
                // without double-adding onto TotalUpkeep!
                if (vm.WagePaid == 0 && em.HasBuffer<Game.Companies.Employee>(entity))
                {
                    var employees = em.GetBuffer<Game.Companies.Employee>(entity, true);
                    int wageTotal = 0;
                    for (int e = 0; e < employees.Length; e++)
                    {
                        int lvl = employees[e].m_Level;
                        wageTotal += hasEconParams ? econParams.GetWage(lvl, true) : (1000 + lvl * 250);
                    }
                    vm.WagePaid = isInactive ? UnityEngine.Mathf.RoundToInt(wageTotal * 0.1f) : wageTotal;
                }

                vm.MaintenanceCost = totalServiceUpkeep;
                vm.TotalUpkeep = totalServiceUpkeep + vm.WagePaid;
                return;
            }

            // Private zoned / signature commercial, industrial, office, storage buildings
            vm.MaintenanceCost = 0;
            if (vm.Category == AssetCategory.Commercial ||
                vm.Category == AssetCategory.Industrial ||
                vm.Category == AssetCategory.Office ||
                vm.Category == AssetCategory.Storage ||
                vm.Category == "Signature" ||
                vm.IsSignature)
            {
                Entity compEnt = Entity.Null;
                if (!string.IsNullOrEmpty(vm.CompanyEntityKey) && EntityKey.TryParse(vm.CompanyEntityKey, out var parsedComp) && em.Exists(parsedComp))
                {
                    compEnt = parsedComp;
                }
                else if (em.HasComponent<CompanyData>(entity))
                {
                    compEnt = entity;
                }

                if (vm.WagePaid == 0 && compEnt != Entity.Null && em.HasBuffer<Game.Companies.Employee>(compEnt))
                {
                    var employees = em.GetBuffer<Game.Companies.Employee>(compEnt, true);
                    int wageTotal = 0;
                    for (int e = 0; e < employees.Length; e++)
                    {
                        int lvl = employees[e].m_Level;
                        wageTotal += hasEconParams ? econParams.GetWage(lvl, false) : (1000 + lvl * 250);
                    }
                    vm.WagePaid = wageTotal;
                }

                if (vm.RentPaid == 0 && compEnt != Entity.Null && em.HasComponent<PropertyRenter>(compEnt))
                {
                    vm.RentPaid = em.GetComponentData<PropertyRenter>(compEnt).m_Rent;
                }

                vm.TotalUpkeep = vm.WagePaid
                               + vm.RentPaid
                               + vm.ElectricityPaid
                               + vm.WaterPaid
                               + vm.SewagePaid
                               + vm.GarbagePaid
                               + vm.TaxPaid
                               + vm.InputCost;
            }
        }

        private static int GetPrefabMoneyUpkeep(EntityManager em, Entity targetPrefab)
        {
            if (targetPrefab == Entity.Null || !em.Exists(targetPrefab)) return 0;
            if (em.HasBuffer<ServiceUpkeepData>(targetPrefab))
            {
                var suBuf = em.GetBuffer<ServiceUpkeepData>(targetPrefab, true);
                int moneyUpkeep = 0;
                bool hasMoneyEntry = false;
                for (int s = 0; s < suBuf.Length; s++)
                {
                    if (suBuf[s].m_Upkeep.m_Resource == Resource.Money)
                    {
                        moneyUpkeep += suBuf[s].m_Upkeep.m_Amount;
                        hasMoneyEntry = true;
                    }
                }
                if (hasMoneyEntry || suBuf.Length > 0) return moneyUpkeep;
            }
            if (em.HasComponent<ConsumptionData>(targetPrefab))
            {
                return em.GetComponentData<ConsumptionData>(targetPrefab).m_Upkeep;
            }
            return 0;
        }

        private static float ComputeEntityDamagePercent(EntityManager em, Entity ent)
        {
            if (ent == Entity.Null || !em.Exists(ent)) return 0f;
            if (em.HasComponent<Game.Common.Destroyed>(ent)) return 100f;
            if (!em.HasComponent<Game.Objects.Damaged>(ent)) return 0f;

            var damaged = em.GetComponentData<Game.Objects.Damaged>(ent);
            float total = Game.Objects.ObjectUtils.GetTotalDamage(damaged);
            if (total <= 0f)
            {
                total = Unity.Mathematics.math.cmax(damaged.m_Damage);
            }
            float pct = UnityEngine.Mathf.Clamp01(total) * 100f;
            return pct > 0.01f ? (float)System.Math.Round(pct, 1) : 0f;
        }

        private static bool HasNonZeroDamage(Game.Objects.Damaged damaged)
        {
            return damaged.m_Damage.x > 0.01f || damaged.m_Damage.y > 0.01f || damaged.m_Damage.z > 0.01f;
        }

        private bool IsEntityDamagedOrAbandoned(EntityManager em, Entity ent)
        {
            if (ent == Entity.Null || !em.Exists(ent)) return false;
            if (_repairSystem != null && em == EntityManager)
            {
                return _repairSystem.HasRepairNeedOrLeftovers(ent, "all", includeHierarchy: true);
            }
            if (em.HasComponent<Game.Common.Destroyed>(ent) ||
                em.HasComponent<Game.Buildings.RescueTarget>(ent) ||
                em.HasComponent<Abandoned>(ent) ||
                em.HasComponent<Condemned>(ent) ||
                em.HasComponent<Game.Events.OnFire>(ent) ||
                em.HasComponent<Game.Events.Flooded>(ent) ||
                em.HasComponent<Game.Events.FacingWeather>(ent) ||
                em.HasComponent<Game.Events.AccidentSite>(ent))
            {
                return true;
            }
            if (em.HasComponent<Game.Objects.Damaged>(ent) &&
                HasNonZeroDamage(em.GetComponentData<Game.Objects.Damaged>(ent)))
            {
                return true;
            }
            if (em.HasBuffer<Efficiency>(ent))
            {
                var effBuf = em.GetBuffer<Efficiency>(ent, true);
                for (int i = 0; i < effBuf.Length; i++)
                {
                    var factor = effBuf[i].m_Factor;
                    if ((factor == EfficiencyFactor.Destroyed ||
                         factor == EfficiencyFactor.Abandoned ||
                         factor == EfficiencyFactor.Fire) &&
                        effBuf[i].m_Efficiency < 0.999f)
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        private string ResolveRoadName(Entity roadEnt)
        {
            if (roadEnt == Entity.Null || !EntityManager.Exists(roadEnt)) return string.Empty;
            if (_roadNameCache.TryGetValue(roadEnt, out var cached)) return cached;

            string resolved = ResolveCleanEntityName(roadEnt);
            _roadNameCache[roadEnt] = resolved;
            return resolved;
        }

        private string ResolveCleanEntityName(Entity ent)
        {
            if (ent == Entity.Null || !EntityManager.Exists(ent) || _nameSystem == null) return string.Empty;
            string label = string.Empty;
            try
            {
                label = _nameSystem.GetRenderedLabelName(ent) ?? string.Empty;
            }
            catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"Placed read: {ex.Message}");
                    }

            if (!string.IsNullOrEmpty(label) && label.StartsWith("Assets.NAME[", System.StringComparison.Ordinal))
            {
                var dict = Game.SceneFlow.GameManager.instance?.localizationManager?.activeDictionary;
                if (dict != null && dict.TryGetValue(label, out var locVal) &&
                    !string.IsNullOrEmpty(locVal) &&
                    !locVal.StartsWith("Assets.NAME[", System.StringComparison.Ordinal))
                {
                    return locVal;
                }
                if (EntityManager.HasComponent<PrefabRef>(ent))
                {
                    var pref = EntityManager.GetComponentData<PrefabRef>(ent).m_Prefab;
                    string prefTitle = TryGetLocalizedPrefabTitle(pref);
                    if (!string.IsNullOrEmpty(prefTitle)) return prefTitle;
                }
                return FormatPrefabDisplayName(label);
            }

            return label;
        }

        private static int CountActiveOwnedVehicles(EntityManager em, Entity entity)
        {
            int active = CountActiveOwnedVehiclesSingle(em, entity);
            if (em.HasBuffer<InstalledUpgrade>(entity))
            {
                var upgrades = em.GetBuffer<InstalledUpgrade>(entity, true);
                for (int u = 0; u < upgrades.Length; u++)
                {
                    if (!BuildingUtils.CheckOption(upgrades[u], BuildingOption.Inactive))
                    {
                        active += CountActiveOwnedVehiclesSingle(em, upgrades[u].m_Upgrade);
                    }
                }
            }
            return active;
        }

        private static int CountActiveOwnedVehiclesSingle(EntityManager em, Entity target)
        {
            if (target == Entity.Null || !em.Exists(target) || !em.HasBuffer<Game.Vehicles.OwnedVehicle>(target)) return 0;
            int count = 0;
            var vBuf = em.GetBuffer<Game.Vehicles.OwnedVehicle>(target, true);
            for (int i = 0; i < vBuf.Length; i++)
            {
                var veh = vBuf[i].m_Vehicle;
                if (veh != Entity.Null && em.Exists(veh) &&
                    !em.HasComponent<Game.Vehicles.ParkedCar>(veh) &&
                    !em.HasComponent<Game.Vehicles.ParkedTrain>(veh))
                {
                    count++;
                }
            }
            return count;
        }
    }
}
