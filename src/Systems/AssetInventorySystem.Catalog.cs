using System.Collections.Generic;
using AdvancedBAM.Systems.Dtos;
using AdvancedBAM.Utilities;
using Game.Companies;
using Game.Economy;
using Game.Prefabs;
using Unity.Collections;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    public partial class AssetInventorySystem
    {
        /// <summary>
        /// Builds catalog rows for every building prefab. Result is cached until the
        /// next game load because the prefab set does not change during a session.
        /// </summary>
        private List<UnifiedAssetVm> CollectCatalogPrefabs()
        {
            EnsureCatalogCached();
            return _catalogCache ?? new List<UnifiedAssetVm>();
        }

        private UnifiedAssetVm BuildCatalogPrefabVm(Entity prefab)
        {
            var em = EntityManager;
                    var info = GetPrefabInfo(prefab);
                    if (info == null) return null;
                    if (info.Category == AssetCategory.Other)
                    {
                        if (em.HasComponent<BuildingData>(prefab) || em.HasComponent<BuildingExtensionData>(prefab))
                        {
                            info.Category = AssetCategory.Service;
                            info.SubCategory = "Civic & Misc";
                        }
                        else
                        {
                            return null;
                        }
                    }

                    string displayName = !string.IsNullOrEmpty(info.LocalizedName) ? info.LocalizedName : FormatPrefabDisplayName(info.Name);

                    int capacity = info.Category == AssetCategory.Residential ? info.ResidentialCapacity : 0;
                    if (capacity == 0 && em.HasComponent<WorkplaceData>(prefab))
                    {
                        capacity = em.GetComponentData<WorkplaceData>(prefab).m_MaxWorkers;
                    }

                    int constructionCost = 0;
                    if (em.HasComponent<PlaceableObjectData>(prefab))
                    {
                        constructionCost = (int)em.GetComponentData<PlaceableObjectData>(prefab).m_ConstructionCost;
                    }
                    else if (em.HasComponent<ServiceUpgradeData>(prefab))
                    {
                        constructionCost = (int)em.GetComponentData<ServiceUpgradeData>(prefab).m_UpgradeCost;
                    }

                    var vm = new UnifiedAssetVm
                    {
                        Id = "prefab:" + info.Key,
                        EntityKey = string.Empty,
                        PrefabKey = info.Key,
                        PrefabName = info.Name,
                        IsPlaced = false,
                        Category = info.Category,
                        SubCategory = info.SubCategory,
                        Name = displayName,
                        SecondaryName = info.Name,
                        Theme = info.Theme,
                        ThemeIcon = info.ThemeIcon,
                        AssetPack = info.AssetPack,
                        AssetPackIcon = info.AssetPackIcon,
                        Density = info.Density,
                        ZoneType = info.ZoneType,
                        Thumbnail = info.Thumbnail,
                        Level = info.Level,
                        IsSignature = info.IsSignature,
                        CornerType = info.CornerType,
                        IsSubBuilding = info.IsSubBuilding,
                        Capacity = capacity,
                        ConstructionCost = constructionCost,
                        Efficiency = -1,
                    };

                    // Upkeep & Consumption metrics
                    int upkeep = 0;
                    bool hasServiceUpkeep = false;
                    if (em.HasBuffer<ServiceUpkeepData>(prefab))
                    {
                        var suBuf = em.GetBuffer<ServiceUpkeepData>(prefab, true);
                        for (int s = 0; s < suBuf.Length; s++)
                        {
                            if (suBuf[s].m_Upkeep.m_Resource == Resource.Money)
                            {
                                upkeep += suBuf[s].m_Upkeep.m_Amount;
                                hasServiceUpkeep = true;
                            }
                        }
                    }
                    if (em.HasComponent<ConsumptionData>(prefab))
                    {
                        var cons = em.GetComponentData<ConsumptionData>(prefab);
                        if (!hasServiceUpkeep) upkeep = cons.m_Upkeep;
                        vm.ElectricityConsumption = UnityEngine.Mathf.RoundToInt(cons.m_ElectricityConsumption);
                        vm.WaterConsumption = UnityEngine.Mathf.RoundToInt(cons.m_WaterConsumption);
                        vm.GarbageAccumulation = UnityEngine.Mathf.RoundToInt(cons.m_GarbageAccumulation);
                    }
                    vm.MaintenanceCost = upkeep;
                    vm.TotalUpkeep = upkeep;

                    // Service Capacities & Vehicles
                    FillCatalogServiceMetrics(em, prefab, vm);

                    // Parking Capacity
                    if (em.HasComponent<ParkingFacilityData>(prefab))
                    {
                        var pfd = em.GetComponentData<ParkingFacilityData>(prefab);
                        vm.ParkingCapacity = pfd.m_GarageMarkerCapacity;
                        vm.ParkingComfort = UnityEngine.Mathf.RoundToInt(pfd.m_ComfortFactor * 100f);
                        if (vm.ServiceCapacity == 0 && pfd.m_GarageMarkerCapacity > 0)
                        {
                            vm.ServiceCapacity = pfd.m_GarageMarkerCapacity;
                            vm.ServiceUnit = "cars";
                        }
                    }

                    // Attractiveness, Park Maintenance, Recreation & Leisure
                    if (em.HasComponent<AttractionData>(prefab))
                    {
                        vm.Attractiveness = em.GetComponentData<AttractionData>(prefab).m_Attractiveness;
                    }
                    if (em.HasComponent<ParkData>(prefab))
                    {
                        vm.ParkMaintenance = em.GetComponentData<ParkData>(prefab).m_MaintenancePool > 0 ? 100 : -1;
                    }
                    if (em.HasComponent<LeisureProviderData>(prefab))
                    {
                        var lpd = em.GetComponentData<LeisureProviderData>(prefab);
                        vm.Recreation = lpd.m_Efficiency;
                        vm.LeisureType = BamEcsUtils.FormatLeisureType(lpd.m_LeisureType);
                    }

                    // Storage Capacity (in tonnes)
                    if (em.HasComponent<StorageLimitData>(prefab) && vm.Category != AssetCategory.Office)
                    {
                        var sLimit = em.GetComponentData<StorageLimitData>(prefab);
                        if (vm.Category == AssetCategory.Storage && em.HasComponent<SpawnableBuildingData>(prefab) && em.HasComponent<BuildingData>(prefab))
                        {
                            int adj = sLimit.GetAdjustedLimitForWarehouse(
                                em.GetComponentData<SpawnableBuildingData>(prefab),
                                em.GetComponentData<BuildingData>(prefab));
                            vm.StorageCapacity = (float)System.Math.Round(adj / 1000.0, 2);
                        }
                        else
                        {
                            vm.StorageCapacity = (float)System.Math.Round(sLimit.m_Limit / 1000.0, 2);
                        }
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
                                vm.Resource = outRes;
                            }
                        }
                    }

                    if (em.HasComponent<StorageCompanyData>(prefab))
                    {
                        var scd = em.GetComponentData<StorageCompanyData>(prefab);
                        AppendMaskResourcesToOutput(scd.m_StoredResources, vm);
                    }

                    if (em.HasComponent<BuildingPropertyData>(prefab))
                    {
                        var bpd = em.GetComponentData<BuildingPropertyData>(prefab);
                        AppendMaskResourcesToOutput(bpd.m_AllowedStored, vm);
                    }

                    FillEffects(prefab, vm);
                    FillPrefabWorkplaceEducationTiers(em, prefab, vm);

                    if (em.HasComponent<BuildingData>(prefab))
                    {
                        var bData = em.GetComponentData<BuildingData>(prefab);
                        vm.LotDimensions = $"{bData.m_LotSize.x}x{bData.m_LotSize.y}";
                        vm.LotSize = bData.m_LotSize.x * bData.m_LotSize.y;
                    }

            return vm;
        }

        private static void FillCatalogServiceMetrics(EntityManager em, Entity prefab, UnifiedAssetVm vm)
        {
            if (em.HasComponent<HospitalData>(prefab))
            {
                var hd = em.GetComponentData<HospitalData>(prefab);
                vm.ServiceCapacity = hd.m_PatientCapacity;
                vm.ServiceUnit = "Patients";
                vm.VehiclesMax = hd.m_AmbulanceCapacity + hd.m_MedicalHelicopterCapacity;
            }
            else if (em.HasComponent<SchoolData>(prefab))
            {
                var sd = em.GetComponentData<SchoolData>(prefab);
                vm.ServiceCapacity = sd.m_StudentCapacity;
                vm.ServiceUnit = "Students";
            }
            else if (em.HasComponent<PrisonData>(prefab))
            {
                var prd = em.GetComponentData<PrisonData>(prefab);
                vm.ServiceCapacity = prd.m_PrisonerCapacity;
                vm.ServiceUnit = "Prisoners";
                vm.VehiclesMax = prd.m_PrisonVanCapacity;
            }
            else if (em.HasComponent<PoliceStationData>(prefab))
            {
                var pd = em.GetComponentData<PoliceStationData>(prefab);
                vm.ServiceCapacity = pd.m_JailCapacity;
                vm.ServiceUnit = "Inmates";
                vm.VehiclesMax = pd.m_PatrolCarCapacity + pd.m_PoliceHelicopterCapacity;
            }
            else if (em.HasComponent<FireStationData>(prefab))
            {
                var fd = em.GetComponentData<FireStationData>(prefab);
                vm.VehiclesMax = fd.m_FireEngineCapacity + fd.m_FireHelicopterCapacity + fd.m_DisasterResponseCapacity;
            }
            else if (em.HasComponent<GarbageFacilityData>(prefab))
            {
                var gd = em.GetComponentData<GarbageFacilityData>(prefab);
                vm.ServiceCapacity = UnityEngine.Mathf.RoundToInt(gd.m_GarbageCapacity / 1000f);
                vm.ServiceUnit = "t Garbage";
                vm.VehiclesMax = gd.m_VehicleCapacity;
            }
            else if (em.HasComponent<DeathcareFacilityData>(prefab))
            {
                var dd = em.GetComponentData<DeathcareFacilityData>(prefab);
                vm.ServiceCapacity = dd.m_StorageCapacity;
                vm.ServiceUnit = "Deceased";
                vm.VehiclesMax = dd.m_HearseCapacity;
            }
            else if (em.HasComponent<EmergencyShelterData>(prefab))
            {
                var esd = em.GetComponentData<EmergencyShelterData>(prefab);
                vm.ServiceCapacity = esd.m_ShelterCapacity;
                vm.ServiceUnit = "Sheltered";
                vm.VehiclesMax = esd.m_VehicleCapacity;
            }
            else if (em.HasComponent<PostFacilityData>(prefab))
            {
                var pfd = em.GetComponentData<PostFacilityData>(prefab);
                vm.ServiceCapacity = pfd.m_MailCapacity;
                vm.ServiceUnit = "Letters";
                vm.VehiclesMax = pfd.m_PostVanCapacity + pfd.m_PostTruckCapacity;
            }
            else if (em.HasComponent<MaintenanceDepotData>(prefab))
            {
                var mdd = em.GetComponentData<MaintenanceDepotData>(prefab);
                vm.ServiceCapacity = mdd.m_VehicleCapacity;
                vm.ServiceUnit = "Vehicles";
                vm.VehiclesMax = mdd.m_VehicleCapacity;
            }
            else if (em.HasComponent<TransportDepotData>(prefab))
            {
                var tdd = em.GetComponentData<TransportDepotData>(prefab);
                vm.ServiceCapacity = tdd.m_VehicleCapacity;
                vm.ServiceUnit = "Vehicles";
                vm.VehiclesMax = tdd.m_VehicleCapacity;
            }
            else if (em.HasComponent<PowerPlantData>(prefab))
            {
                var ppd = em.GetComponentData<PowerPlantData>(prefab);
                vm.ServiceCapacity = ppd.m_ElectricityProduction;
                vm.ServiceUnit = "kW";
            }
            else if (em.HasComponent<WaterPumpingStationData>(prefab))
            {
                var wpd = em.GetComponentData<WaterPumpingStationData>(prefab);
                vm.ServiceCapacity = wpd.m_Capacity;
                vm.ServiceUnit = "m³/mo.";
            }
            else if (em.HasComponent<SewageOutletData>(prefab))
            {
                var sod = em.GetComponentData<SewageOutletData>(prefab);
                vm.ServiceCapacity = sod.m_Capacity;
                vm.ServiceUnit = "m³/mo.";
            }
            else if (em.HasComponent<TelecomFacilityData>(prefab))
            {
                var tfd = em.GetComponentData<TelecomFacilityData>(prefab);
                vm.ServiceCapacity = (int)tfd.m_NetworkCapacity;
                vm.ServiceUnit = "GB/s";
            }
        }
    }
}
