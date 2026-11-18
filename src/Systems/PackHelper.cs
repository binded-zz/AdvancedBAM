using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using Colossal.Logging;
using Game.Prefabs;
using Game.UI;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    public struct PrefabAssetInfo
    {
        public string Theme;
        public string ThemeIcon;
        public string AssetPack;
        public string AssetPackIcon;
        public string NativePackIcon;
        public string[] PackThumbnails;
    }

    /// <summary>
    /// Resolves theme, DLC pack, and content prerequisites for prefabs and placed buildings.
    /// Aliased as DlcHelper for compatibility.
    /// </summary>
    public static class PackHelper
    {
        private static readonly ConcurrentDictionary<string, PrefabAssetInfo> s_Cache =
            new ConcurrentDictionary<string, PrefabAssetInfo>(StringComparer.OrdinalIgnoreCase);

        public static void ClearCache()
        {
            s_Cache.Clear();
        }

        private static string TryGetUIObjectIcon(PrefabBase prefab)
        {
            if (prefab == null) return "";
            try
            {
                if (prefab.TryGet<UIObject>(out var uiObj) && !string.IsNullOrEmpty(uiObj.m_Icon))
                {
                    return uiObj.m_Icon;
                }

                var world = World.DefaultGameObjectInjectionWorld;
                if (world != null)
                {
                    var prefabSystem = world.GetExistingSystemManaged<PrefabSystem>();
                    if (prefabSystem != null && prefabSystem.TryGetEntity(prefab, out var entity))
                    {
                        var em = world.EntityManager;
                        if (em.HasComponent<UIObjectData>(entity))
                        {
                            var uiData = em.GetComponentData<UIObjectData>(entity);
                            var field = uiData.GetType().GetField("m_Icon", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
                            if (field != null)
                            {
                                var val = field.GetValue(uiData) as string;
                                if (!string.IsNullOrEmpty(val)) return val;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"TryGetUIObjectIcon error: {ex.Message}");
            }
            return "";
        }

        private static string TryGetPackIcon(AssetPackPrefab pack)
        {
            if (pack == null) return "";
            try
            {
                if (!string.IsNullOrEmpty(pack.thumbnailUrl)) return pack.thumbnailUrl;
                string thumb = ImageSystem.GetThumbnail(pack);
                if (!string.IsNullOrEmpty(thumb)) return thumb;
                string icon = ImageSystem.GetIcon(pack);
                if (!string.IsNullOrEmpty(icon)) return icon;
                string uiIcon = TryGetUIObjectIcon(pack);
                if (!string.IsNullOrEmpty(uiIcon)) return uiIcon;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"TryGetPackIcon error: {ex.Message}");
            }
            return "";
        }

        public static PrefabAssetInfo GetPrefabAssetInfo(PrefabBase prefabBase)
        {
            if (prefabBase == null)
                return new PrefabAssetInfo { Theme = "Unknown", AssetPack = "Base Game", AssetPackIcon = "", NativePackIcon = "", PackThumbnails = new string[0] };

            string name = prefabBase.name ?? "";
            if (s_Cache.TryGetValue(name, out var cachedInfo))
                return cachedInfo;

            var info = ResolvePrefabAssetInfo(prefabBase);
            s_Cache[name] = info;
            return info;
        }

        private static PrefabAssetInfo ResolvePrefabAssetInfo(PrefabBase prefabBase)
        {
            string theme = "Unknown";
            string themeIcon = "";
            string assetPack = "Base Game";
            string assetPackIcon = "";
            var packThumbnailsList = new List<string>();

            if (prefabBase == null)
                return new PrefabAssetInfo { Theme = theme, ThemeIcon = themeIcon, AssetPack = assetPack, AssetPackIcon = assetPackIcon, NativePackIcon = assetPackIcon, PackThumbnails = new string[0] };

            // 1. Resolve Theme
            if (prefabBase.TryGet<ThemeObject>(out var themeObject) && themeObject.m_Theme != null)
            {
                theme = themeObject.m_Theme.name ?? "Unknown";
                themeIcon = TryGetUIObjectIcon(themeObject.m_Theme);
            }

            if (theme == "Unknown" && prefabBase.TryGet<SpawnableBuilding>(out var spawnable) && spawnable.m_ZoneType != null)
            {
                var zoneTheme = spawnable.m_ZoneType.GetComponent<ThemeObject>();
                if (zoneTheme != null && zoneTheme.m_Theme != null)
                {
                    theme = zoneTheme.m_Theme.name ?? "Unknown";
                    themeIcon = TryGetUIObjectIcon(zoneTheme.m_Theme);
                }
            }

            // Always provide standard vanilla theme SVG paths if theme is known but icon string was empty
            if (string.IsNullOrEmpty(themeIcon))
            {
                if (theme.Equals("European", StringComparison.OrdinalIgnoreCase) || theme.Equals("EU", StringComparison.OrdinalIgnoreCase))
                {
                    themeIcon = "Media/Game/Themes/European.svg";
                }
                else if (theme.Equals("NorthAmerican", StringComparison.OrdinalIgnoreCase) || theme.Equals("North American", StringComparison.OrdinalIgnoreCase) || theme.Equals("USA", StringComparison.OrdinalIgnoreCase))
                {
                    themeIcon = "Media/Game/Themes/North American.svg";
                }
            }

            // 2. Resolve Asset Pack / DLC
            var assetPackItem = prefabBase.GetComponent<AssetPackItem>();
            if (assetPackItem?.m_Packs?.Length > 0)
            {
                var pack = assetPackItem.m_Packs[0];
                if (pack != null)
                {
                    assetPack = pack.name ?? "Custom";
                    assetPackIcon = TryGetPackIcon(pack);
                }

                // Collect all thumbnails from all packs
                foreach (var p in assetPackItem.m_Packs)
                {
                    if (p != null)
                    {
                        try
                        {
                            string thumb = ImageSystem.GetThumbnail(p);
                            if (!string.IsNullOrEmpty(thumb))
                            {
                                packThumbnailsList.Add(thumb);
                            }
                            else
                            {
                                string uiIcon = TryGetPackIcon(p);
                                if (!string.IsNullOrEmpty(uiIcon))
                                    packThumbnailsList.Add(uiIcon);
                            }
                        }
                        catch (Exception ex)
                        {
                            Mod.Log.Warn($"Thumbnail resolution error: {ex.Message}");
                        }
                    }
                }
            }
            else if (prefabBase.TryGet<SpawnableBuilding>(out var spawnableForPack) && spawnableForPack.m_ZoneType != null)
            {
                var zonePackItem = spawnableForPack.m_ZoneType.GetComponent<AssetPackItem>();
                if (zonePackItem?.m_Packs?.Length > 0)
                {
                    var pack = zonePackItem.m_Packs[0];
                    if (pack != null)
                    {
                        assetPack = pack.name ?? "Custom";
                        assetPackIcon = TryGetPackIcon(pack);

                        foreach (var p in zonePackItem.m_Packs)
                        {
                            if (p != null)
                            {
                                try
                                {
                                    string thumb = ImageSystem.GetThumbnail(p);
                                    if (!string.IsNullOrEmpty(thumb)) packThumbnailsList.Add(thumb);
                                    else
                                    {
                                        string uiIcon = TryGetPackIcon(p);
                                        if (!string.IsNullOrEmpty(uiIcon)) packThumbnailsList.Add(uiIcon);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Mod.Log.Warn($"Zone pack thumbnail error: {ex.Message}");
                                }
                            }
                        }
                    }
                }
            }

            // Check ContentPrerequisite for official DLC
            if (assetPack == "Base Game" && prefabBase.TryGet<ContentPrerequisite>(out var cp) && cp.m_ContentPrerequisite.TryGet<DlcRequirement>(out var dlc))
            {
                try
                {
                    assetPack = Colossal.PSI.Common.PlatformManager.instance.GetDlcName(dlc.m_Dlc) ?? "DLC";
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"GetDlcName error: {ex.Message}");
                    assetPack = "DLC";
                }
            }

            // Fallback for custom user created assets (Paradox Mods) that lack an AssetPackItem
            if (assetPack == "Base Game" && prefabBase.asset != null && !prefabBase.asset.isBuiltin)
            {
                try
                {
                    var meta = prefabBase.asset.GetMeta();
                    if (!string.IsNullOrEmpty(meta.displayName))
                    {
                        assetPack = meta.displayName;
                    }
                    else if (!string.IsNullOrEmpty(meta.packageName))
                    {
                        assetPack = meta.packageName;
                    }
                    else
                    {
                        assetPack = "Custom Content";
                    }
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"Custom asset meta error: {ex.Message}");
                }
            }

            // Normalize pack names for UI grouping and presentation
            if (!string.IsNullOrEmpty(assetPack) && assetPack != "Base Game" && assetPack != "Custom" && assetPack != "DLC")
            {
                if (!assetPack.Contains(" "))
                {
                    assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, "([a-z])([A-Z])", "$1 $2");
                    assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, "([A-Z]+)([A-Z][a-z])", "$1 $2");
                }

                assetPack = assetPack.Replace("_", " ");
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\bAsset\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\bPack\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\bFilter\b", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                assetPack = System.Text.RegularExpressions.Regex.Replace(assetPack, @"\s+", " ").Trim();
            }

            // Fallback for official DLCs when no assetPackIcon was found yet
            if (string.IsNullOrEmpty(assetPackIcon))
            {
                if (assetPack == "Base Game")
                {
                    assetPackIcon = "";
                }
                else
                {
                    string cleanPack = (assetPack ?? "").Replace(" ", "").Replace("&", "And").Replace("-", "");
                    if (cleanPack.Equals("SanFrancisco", StringComparison.OrdinalIgnoreCase)) cleanPack = "SanFranciscoSet";
                    else if (cleanPack.Equals("BridgesPorts", StringComparison.OrdinalIgnoreCase)) cleanPack = "BridgesAndPorts";
                    else if (cleanPack.Equals("Deluxe", StringComparison.OrdinalIgnoreCase) || cleanPack.Equals("PreOrder", StringComparison.OrdinalIgnoreCase)) cleanPack = "LandmarkBuildings";

                    string[] officialDlcs = {
                        "BeachProperties", "BridgesAndPorts", "CityStations", "CS1TreasureHunt", "DowntownMarketSet",
                        "DragonGate", "FirstResponse", "LandmarkBuildings", "LeisureVenues", "MediterraneanHeritage",
                        "ModernArchitecture", "ModernSuburbs", "Newsletter", "OfficeEvolution", "ParkAdventures",
                        "PDXAccount", "SanFranciscoSet", "Skyscrapers", "SupplyChains", "UrbanPromenades"
                    };

                    if (System.Array.Exists(officialDlcs, p => p.Equals(cleanPack, System.StringComparison.OrdinalIgnoreCase)))
                    {
                        assetPackIcon = $"Media/DLC/{cleanPack}.svg";
                    }
                    else if (assetPack.IndexOf("DLC", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        assetPackIcon = "Media/DLC/DLCFallback.svg";
                    }
                }
            }

            if (packThumbnailsList.Count == 0 && !string.IsNullOrEmpty(assetPackIcon))
            {
                packThumbnailsList.Add(assetPackIcon);
            }

            return new PrefabAssetInfo
            {
                Theme = theme,
                ThemeIcon = themeIcon,
                AssetPack = assetPack,
                AssetPackIcon = assetPackIcon,
                NativePackIcon = assetPackIcon,
                PackThumbnails = packThumbnailsList.ToArray()
            };
        }
    }

    /// <summary>Alias for PackHelper for consistency with requests.</summary>
    public static class DlcHelper
    {
        public static PrefabAssetInfo GetPrefabAssetInfo(PrefabBase prefab) => PackHelper.GetPrefabAssetInfo(prefab);
    }
}
