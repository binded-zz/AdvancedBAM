using System.Collections.Generic;
using System.Text.RegularExpressions;
using Game.Economy;
using Game.Prefabs;
using Game.UI;
using Game.Zones;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    public partial class AssetInventorySystem
    {
        /// <summary>Static facts about a prefab, computed once and reused for every placed copy.</summary>
        private sealed class PrefabInfo
        {
            public string Key = string.Empty;
            public string Name = string.Empty;
            public string LocalizedName = string.Empty;
            public string Category = AssetCategory.Other;
            public string SubCategory = string.Empty;
            public string Theme = string.Empty;
            public string ThemeIcon = string.Empty;
            public string AssetPack = "Base Game";
            public string AssetPackIcon = string.Empty;
            public string Density = string.Empty;
            public string ZoneType = string.Empty;
            public string Thumbnail = string.Empty;
            public int Level;
            public int ResidentialCapacity;
            public bool IsSignature;
            public string CornerType = "straight";
            public bool IsSubBuilding;
        }

        /// <summary>Category strings shared with the UI (see assetModels.ts -> AssetCategory).</summary>
        public static class AssetCategory
        {
            public const string Residential = "Residential";
            public const string Commercial = "Commercial";
            public const string Industrial = "Industrial";
            public const string Office = "Office";
            public const string Storage = "Storage";
            public const string Service = "Service";
            public const string Other = "Other";
        }

        private readonly Dictionary<Entity, PrefabInfo> _prefabInfoCache = new Dictionary<Entity, PrefabInfo>(2048);

        private PrefabInfo GetPrefabInfo(Entity prefab)
        {
            if (_prefabInfoCache.TryGetValue(prefab, out var cached)) return cached;

            var info = new PrefabInfo { Key = Utilities.EntityKey.From(prefab) };
            var em = EntityManager;

            info.Name = Mod.Log.Guard("GetPrefabName", () => _prefabSystem.GetPrefabName(prefab), string.Empty);
            if (string.IsNullOrEmpty(info.Name)) info.Name = $"Prefab {prefab.Index}";

            info.IsSignature = em.HasComponent<SignatureBuildingData>(prefab);

            bool hasProps = em.HasComponent<BuildingPropertyData>(prefab);
            BuildingPropertyData props = hasProps ? em.GetComponentData<BuildingPropertyData>(prefab) : default;
            info.ResidentialCapacity = hasProps ? props.m_ResidentialProperties : 0;

            if (em.HasComponent<SpawnableBuildingData>(prefab))
            {
                var spawn = em.GetComponentData<SpawnableBuildingData>(prefab);
                info.Level = spawn.m_Level;
                ClassifyZoned(spawn.m_ZonePrefab, hasProps, props, info);
            }
            else if (em.HasComponent<PlaceholderBuildingData>(prefab))
            {
                var placeholder = em.GetComponentData<PlaceholderBuildingData>(prefab);
                info.Level = 1;
                ClassifyZoned(placeholder.m_ZonePrefab, hasProps, props, info);
            }
            else if (em.HasComponent<ServiceObjectData>(prefab))
            {
                var svc = em.GetComponentData<ServiceObjectData>(prefab);
                info.Category = AssetCategory.Service;
                if (svc.m_Service != Entity.Null)
                {
                    string rawSvc = Mod.Log.Guard("GetServiceName", () => _prefabSystem.GetPrefabName(svc.m_Service), string.Empty);
                    info.SubCategory = rawSvc;
                }
            }
            else if (em.HasComponent<ExtractorFacilityData>(prefab))
            {
                info.Category = AssetCategory.Industrial;
                info.SubCategory = "Specialized Industry";
                info.ZoneType = "Specialized Industry";
                info.Density = "Specialized";
            }
            else if (em.HasComponent<SignatureBuildingData>(prefab))
            {
                if (hasProps && props.m_ResidentialProperties > 0)
                    info.Category = AssetCategory.Residential;
                else if (em.HasComponent<Game.Buildings.OfficeProperty>(prefab))
                    info.Category = AssetCategory.Office;
                else if (hasProps && props.m_AllowedSold != Resource.NoResource)
                    info.Category = AssetCategory.Commercial;
                else if (em.HasComponent<Game.Buildings.IndustrialProperty>(prefab) ||
                         (hasProps && props.m_AllowedManufactured != Resource.NoResource))
                    info.Category = AssetCategory.Industrial;
                else if (hasProps && props.m_AllowedStored != Resource.NoResource)
                    info.Category = AssetCategory.Storage;
                else
                    info.Category = AssetCategory.Commercial;
                info.SubCategory = "Signature Building";
                info.ZoneType = "Signature Building";
                info.Density = "Signature";
                info.IsSignature = true;
            }
            else if (hasProps && props.m_ResidentialProperties > 0)
            {
                info.Category = AssetCategory.Residential;
            }
            else if (em.HasComponent<ServiceUpgradeData>(prefab) ||
                     em.HasComponent<ServiceUpgradeBuilding>(prefab) ||
                     em.HasComponent<BuildingExtensionData>(prefab))
            {
                info.Category = AssetCategory.Service;
                info.SubCategory = "Service Upgrades";
                info.IsSubBuilding = true;
            }
            else if (em.HasComponent<BuildingData>(prefab))
            {
                if (hasProps && props.m_ResidentialProperties > 0)
                {
                    info.Category = AssetCategory.Residential;
                    info.SubCategory = "Residential Building";
                }
                else if (hasProps && props.m_AllowedSold != Resource.NoResource)
                {
                    info.Category = AssetCategory.Commercial;
                    info.SubCategory = "Commercial Building";
                }
                else if (em.HasComponent<Game.Buildings.OfficeProperty>(prefab))
                {
                    info.Category = AssetCategory.Office;
                    info.SubCategory = "Office Building";
                }
                else if (hasProps && props.m_AllowedManufactured != Resource.NoResource)
                {
                    info.Category = AssetCategory.Industrial;
                    info.SubCategory = "Industrial Building";
                }
                else if (hasProps && props.m_AllowedStored != Resource.NoResource)
                {
                    info.Category = AssetCategory.Storage;
                    info.SubCategory = "Storage Facility";
                }
                else
                {
                    info.Category = AssetCategory.Service;
                    info.SubCategory = "Civic & Misc";
                }
            }

            // Explicit Transport & Municipal Service classification fallbacks
            if (em.HasComponent<TransportDepotData>(prefab) ||
                em.HasComponent<TransportStationData>(prefab) ||
                em.HasComponent<PublicTransportStationData>(prefab) ||
                em.HasComponent<CargoTransportStationData>(prefab) ||
                em.HasComponent<ParkingFacilityData>(prefab))
            {
                info.Category = AssetCategory.Service;
                if (string.IsNullOrEmpty(info.SubCategory) || info.SubCategory == "Other" || info.SubCategory.ToLowerInvariant().Contains("road"))
                {
                    info.SubCategory = "Transportation";
                }
            }
            else if (em.HasComponent<PostFacilityData>(prefab))
            {
                info.Category = AssetCategory.Service;
                if (string.IsNullOrEmpty(info.SubCategory) || info.SubCategory == "Other")
                {
                    info.SubCategory = "Communications";
                }
            }
            else if (em.HasComponent<MaintenanceDepotData>(prefab))
            {
                info.Category = AssetCategory.Service;
                if (string.IsNullOrEmpty(info.SubCategory) || info.SubCategory == "Other")
                {
                    info.SubCategory = "Roads";
                }
            }

            // Standardize service subcategory strings for clean grouping
            if (info.Category == AssetCategory.Service && !string.IsNullOrEmpty(info.SubCategory))
            {
                string sLower = info.SubCategory.ToLowerInvariant();
                if (sLower.Contains("transport") || sLower.Contains("transit"))
                    info.SubCategory = "Transportation";
                else if (sLower.Contains("post") || sLower.Contains("mail") || sLower.Contains("telecom") || sLower.Contains("communicat"))
                    info.SubCategory = "Communications";
                else if (sLower.Contains("garbage") || sLower.Contains("waste"))
                    info.SubCategory = "Garbage Management";
                else if (sLower.Contains("health") || sLower.Contains("death") || sLower.Contains("hospital") || sLower.Contains("cemetery"))
                    info.SubCategory = "Health & Deathcare";
                else if (sLower.Contains("fire") || sLower.Contains("rescue") || sLower.Contains("disaster"))
                    info.SubCategory = "Fire & Rescue";
                else if (sLower.Contains("police") || sLower.Contains("admin") || sLower.Contains("prison"))
                    info.SubCategory = "Police & Administration";
                else if (sLower.Contains("park") || sLower.Contains("recreat") || sLower.Contains("tourism"))
                    info.SubCategory = "Parks & Recreation";
                else if (sLower.Contains("educat") || sLower.Contains("research") || sLower.Contains("school"))
                    info.SubCategory = "Education & Research";
                else if (sLower.Contains("electric") || sLower.Contains("power"))
                    info.SubCategory = "Electricity";
                else if (sLower.Contains("water") || sLower.Contains("sewage"))
                    info.SubCategory = "Water & Sewage";
                else if (sLower.Contains("road") && !sLower.Contains("transport"))
                    info.SubCategory = "Roads";
                else if (em.HasComponent<ServiceObjectData>(prefab))
                {
                    var svc = em.GetComponentData<ServiceObjectData>(prefab);
                    string locSvc = TryGetLocalizedPrefabTitle(svc.m_Service);
                    info.SubCategory = !string.IsNullOrEmpty(locSvc) ? locSvc : FormatPrefabDisplayName(info.SubCategory);
                }
                else
                {
                    info.SubCategory = FormatPrefabDisplayName(info.SubCategory);
                }
            }

            ReadManagedPrefabFacts(prefab, info);

            _prefabInfoCache[prefab] = info;
            return info;
        }

        private void ClassifyZoned(Entity zonePrefab, bool hasProps, BuildingPropertyData props, PrefabInfo info)
        {
            var em = EntityManager;
            if (zonePrefab == Entity.Null || !em.HasComponent<ZoneData>(zonePrefab)) return;

            var zone = em.GetComponentData<ZoneData>(zonePrefab);
            string rawZoneName = Mod.Log.Guard("GetZoneName", () => _prefabSystem.GetPrefabName(zonePrefab), string.Empty);
            string locZoneTitle = TryGetLocalizedPrefabTitle(zonePrefab);
            string displayZone = !string.IsNullOrEmpty(locZoneTitle) ? locZoneTitle : FormatPrefabDisplayName(rawZoneName);
            info.SubCategory = displayZone;
            info.ZoneType = NormalizeZoneTitle(displayZone);

            string subLower = (rawZoneName ?? "").ToLowerInvariant();
            string titleLower = (displayZone ?? "").ToLowerInvariant();

            switch (zone.m_AreaType)
            {
                case AreaType.Residential:
                    info.Category = AssetCategory.Residential;
                    if (subLower.Contains("rent") || subLower.Contains("income") || titleLower.Contains("low rent"))
                        info.Density = "Low Rent";
                    else if (subLower.Contains("row") || subLower.Contains("terrac") || titleLower.Contains("terraced"))
                        info.Density = "Row Housing";
                    else if (subLower.Contains("mixed") || titleLower.Contains("mixed"))
                        info.Density = "Mixed";
                    else if (subLower.Contains("low"))
                        info.Density = "Low";
                    else if (subLower.Contains("medium") || subLower.Contains("mid"))
                        info.Density = "Medium";
                    else if (subLower.Contains("high"))
                        info.Density = "High";
                    else if (props.m_ResidentialProperties <= 4)
                        info.Density = "Low";
                    else if (props.m_ResidentialProperties <= 20)
                        info.Density = "Medium";
                    else
                        info.Density = "High";
                    break;
                case AreaType.Commercial:
                    info.Category = AssetCategory.Commercial;
                    if (subLower.Contains("mixed") || titleLower.Contains("mixed"))
                        info.Density = "Mixed";
                    else if (subLower.Contains("row") || titleLower.Contains("row") || subLower.Contains("strip"))
                        info.Density = "Row";
                    else if (subLower.Contains("high") || titleLower.Contains("high"))
                        info.Density = "High";
                    else if (subLower.Contains("medium") || subLower.Contains("mid") || titleLower.Contains("medium"))
                        info.Density = "Medium";
                    else if (subLower.Contains("low") || titleLower.Contains("low"))
                        info.Density = "Low";
                    else if (info.IsSignature)
                        info.Density = "Signature";
                    else if (!string.IsNullOrEmpty(info.ZoneType))
                        info.Density = info.ZoneType;
                    break;
                case AreaType.Industrial:
                    if ((zone.m_ZoneFlags & ZoneFlags.Office) != 0)
                    {
                        info.Category = AssetCategory.Office;
                        if (subLower.Contains("mixed") || titleLower.Contains("mixed"))
                            info.Density = "Mixed";
                        else if (subLower.Contains("high") || titleLower.Contains("high"))
                            info.Density = "High";
                        else if (subLower.Contains("medium") || subLower.Contains("mid") || titleLower.Contains("medium"))
                            info.Density = "Medium";
                        else if (subLower.Contains("low") || titleLower.Contains("low"))
                            info.Density = "Low";
                        else if (info.IsSignature)
                            info.Density = "Signature";
                        else if (!string.IsNullOrEmpty(info.ZoneType))
                            info.Density = info.ZoneType;
                    }
                    else if (hasProps && props.m_AllowedStored != Resource.NoResource)
                    {
                        info.Category = AssetCategory.Storage;
                        info.Density = "Storage";
                        if (string.IsNullOrEmpty(info.ZoneType))
                            info.ZoneType = "Warehouses & Storage";
                    }
                    else
                    {
                        info.Category = AssetCategory.Industrial;
                        if (subLower.Contains("warehouse") || subLower.Contains("storage") || subLower.Contains("logistic") || titleLower.Contains("warehouse") || titleLower.Contains("storage"))
                            info.Density = "Storage";
                        else if (subLower.Contains("manufactur") || titleLower.Contains("manufactur"))
                            info.Density = "Manufacturing";
                        else if (subLower.Contains("special") || subLower.Contains("extract") || titleLower.Contains("special") || titleLower.Contains("extract"))
                            info.Density = "Specialized";
                        else if (!string.IsNullOrEmpty(info.ZoneType))
                            info.Density = info.ZoneType;
                        else
                            info.Density = "Manufacturing";
                    }
                    break;
            }
        }

        /// <summary>Reads data that only exists on the managed PrefabBase (theme, thumbnail, DLC/pack).</summary>
        private void ReadManagedPrefabFacts(Entity prefab, PrefabInfo info)
        {
            if (!_prefabSystem.TryGetPrefab(prefab, out PrefabBase prefabBase) || prefabBase == null) return;

            Mod.Log.Guard("ReadThumbnail", () =>
            {
                info.Thumbnail = ImageSystem.GetThumbnail(prefabBase) ?? string.Empty;
            });

            Mod.Log.Guard("ResolvePackAndTheme", () =>
            {
                var packInfo = PackHelper.GetPrefabAssetInfo(prefabBase);
                info.Theme = packInfo.Theme;
                info.ThemeIcon = packInfo.ThemeIcon;
                info.AssetPack = packInfo.AssetPack;
                info.AssetPackIcon = (packInfo.PackThumbnails != null && packInfo.PackThumbnails.Length > 0)
                    ? string.Join(",", packInfo.PackThumbnails)
                    : (packInfo.AssetPackIcon ?? string.Empty);
            });

            if (prefabBase is BuildingPrefab buildingPrefab)
            {
                info.CornerType = buildingPrefab.m_AccessType switch
                {
                    BuildingAccessType.LeftCorner or BuildingAccessType.LeftAndBackCorner => "left",
                    BuildingAccessType.RightCorner or BuildingAccessType.RightAndBackCorner => "right",
                    BuildingAccessType.LeftAndRightCorner => "both",
                    BuildingAccessType.All => "all",
                    _ => "straight"
                };
            }

            Mod.Log.Guard("ResolveLocalizedName", () =>
            {
                string locName = TryGetLocalizedPrefabTitle(prefab);
                if (!string.IsNullOrEmpty(locName))
                {
                    info.LocalizedName = locName;
                }
                else
                {
                    info.LocalizedName = FormatPrefabDisplayName(info.Name);
                }
            });
        }

        private string TryGetLocalizedPrefabTitle(Entity prefabEntity)
        {
            if (prefabEntity == Entity.Null || _prefabUISystem == null) return string.Empty;
            try
            {
                _prefabUISystem.GetTitleAndDescription(prefabEntity, out var titleId, out var _);
                var dict = Game.SceneFlow.GameManager.instance?.localizationManager?.activeDictionary;
                if (!string.IsNullOrEmpty(titleId) && dict != null && dict.TryGetValue(titleId, out var locName) &&
                    !string.IsNullOrEmpty(locName) &&
                    !locName.StartsWith("Assets.NAME[", System.StringComparison.Ordinal))
                {
                    return locName;
                }
            }
            catch (System.Exception ex)
            {
                Mod.Log.Debug($"TryGetPrefabLocalizedName for prefab {prefabEntity.Index}: {ex.Message}");
            }
            return string.Empty;
        }

        private static readonly Regex _zonePrefixRegex = new Regex(
            @"^(?:Mediterranean\s+Heritage|Eastern\s+European|North\s+American|Modern\s+Architecture|Urban\s+Promenades|San\s+Francisco|Beach\s+Properties|Mountain\s+Village|USA\s+SW|USA\s+NE|European|Japanese|Chinese|German|French|British|Dutch|USA|US|NA|EU|UK|FR|DE|NL|CN|JP|EE|SW|NE|MH|SK)(?:[\s:\-]+)+",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>
        /// Strips leading region, theme, or pack prefixes from zone display titles while preserving
        /// distinctive zone descriptors (e.g. "Low Density Gable Roof Housing", "Modded Eco Commercial").
        /// </summary>
        public static string NormalizeZoneTitle(string zoneTitle)
        {
            if (string.IsNullOrWhiteSpace(zoneTitle)) return string.Empty;
            string trimmed = zoneTitle.Trim();
            string stripped = _zonePrefixRegex.Replace(trimmed, string.Empty).Trim();
            return stripped.Length >= 3 ? stripped : trimmed;
        }

        private static readonly Dictionary<string, string> _displayNameCache = new Dictionary<string, string>(4096);

        public static void ClearDisplayNameCache()
        {
            _displayNameCache.Clear();
        }

        /// <summary>
        /// Cleans raw internal asset codes (like ccp4, ccp5, EU_Residential_Low_L1_2x2_01)
        /// into authentic, clean display titles matching FindIt format.
        /// </summary>
        public static string FormatPrefabDisplayName(string rawName)
        {
            if (string.IsNullOrEmpty(rawName)) return string.Empty;
            if (_displayNameCache.TryGetValue(rawName, out var cached)) return cached;

            string s = rawName;
            if (s.StartsWith("Assets.NAME[", System.StringComparison.Ordinal) && s.EndsWith("]", System.StringComparison.Ordinal))
            {
                s = s.Substring("Assets.NAME[".Length, s.Length - "Assets.NAME[".Length - 1);
            }

            // DLC & Creator pack codes
            s = Regex.Replace(s, @"\b(ccp0?4|ccp_0?4)\b", "Mediterranean", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"\b(ccp0?5|ccp_0?5)\b", "Modern Architecture", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"\b(ccp0?1|ccp_0?1)\b", "San Francisco", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"\b(ccp0?2|ccp_0?2)\b", "Beach Properties", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"\b(ccp0?3|ccp_0?3)\b", "Urban Promenades", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"\b(ccp0?6|ccp_0?6)\b", "Mountain Village", RegexOptions.IgnoreCase);

            // Zoned and building abbreviations
            s = Regex.Replace(s, @"(_res_|_res\b|\bres_)", " Residential ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_com_|_com\b|\bcom_)", " Commercial ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_ind_|_ind\b|\bind_)", " Industrial ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_off_|_off\b|\boff_)", " Office ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_low_|_low\b|\blow_)", " Low ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_med_|_med\b|\bmed_)", " Med ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_high_|_high\b|\bhigh_)", " High ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_mixed_|_mixed\b|\bmixed_)", " Mixed ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_row_|_row\b|\brow_)", " Row ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"(_lvl|_l)([1-5])\b", " L$2", RegexOptions.IgnoreCase);

            // Acronym+Word, CamelCase separation, and underscores
            s = s.Replace('_', ' ');
            s = Regex.Replace(s, @"([A-Z]{2,})([A-Z][a-z])", "$1 $2");
            s = Regex.Replace(s, @"([a-z])([A-Z])", "$1 $2");
            // Title-case word starts without uppercasing letters after apostrophes (e.g. Baker's) or 'x' in 4x6
            s = Regex.Replace(s, @"(?<=^|[\s\-/(])([a-z])", m => m.Value.ToUpperInvariant());
            s = Regex.Replace(s, @"\b(\d+)[xX](\d+)\b", "$1x$2");
            s = Regex.Replace(s, @"\s+", " ").Trim();

            _displayNameCache[rawName] = s;
            return s;
        }
    }
}
