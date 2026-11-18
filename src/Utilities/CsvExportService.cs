using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using AdvancedBAM.Systems;
using AdvancedBAM.Systems.Dtos;

namespace AdvancedBAM.Utilities
{
    public static class CsvExportService
    {
        internal static string GetUserDataDirectory()
        {
            try
            {
                return Colossal.PSI.Environment.EnvPath.kUserDataPath;
            }
            catch
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "..", "LocalLow", "Colossal Order", "Cities Skylines II");
            }
        }

        public static string GetExportDirectory()
        {
            string exportDir = Path.Combine(GetUserDataDirectory(), "ModsData", "AdvancedBAM", "Exports");
            if (!Directory.Exists(exportDir))
            {
                Directory.CreateDirectory(exportDir);
            }
            return exportDir;
        }

        public static string ExportPlacedAssets()
        {
            try
            {
                var inv = AssetInventorySystem.Instance ?? Unity.Entities.World.DefaultGameObjectInjectionWorld?.GetExistingSystemManaged<AssetInventorySystem>();
                if (inv == null)
                {
                    Mod.Log.Warn("CsvExportService: AssetInventorySystem unavailable.");
                    return null;
                }

                inv.RefreshNow();
                var rows = inv.GetPlacedRows();

                var sb = new StringBuilder();
                sb.AppendLine("EntityKey,Name,Category,SubCategory,District,Level,Condition,MaxCondition,Occupied,Capacity,Efficiency,MaintenanceCost,Theme,AssetPack,IsSignature,IsDamaged,IsTurnedOff,RoadName");

                if (rows != null)
                {
                    foreach (var item in rows)
                    {
                        if (!item.IsPlaced) continue;
                        sb.Append(EscapeCsv(item.EntityKey)).Append(',')
                          .Append(EscapeCsv(item.Name)).Append(',')
                          .Append(EscapeCsv(item.Category.ToString())).Append(',')
                          .Append(EscapeCsv(item.SubCategory)).Append(',')
                          .Append(EscapeCsv(item.District)).Append(',')
                          .Append(item.Level).Append(',')
                          .Append(item.BuildingCondition).Append(',')
                          .Append(item.MaxCondition).Append(',')
                          .Append(item.Occupied).Append(',')
                          .Append(item.Capacity).Append(',')
                          .Append(item.Efficiency).Append(',')
                          .Append(item.MaintenanceCost).Append(',')
                          .Append(EscapeCsv(item.Theme)).Append(',')
                          .Append(EscapeCsv(item.AssetPack)).Append(',')
                          .Append(item.IsSignature).Append(',')
                          .Append(item.IsDamaged).Append(',')
                          .Append(item.IsTurnedOff).Append(',')
                          .Append(EscapeCsv(item.RoadName))
                          .AppendLine();
                    }
                }

                string filePath = Path.Combine(GetExportDirectory(), $"BAM_PlacedAssets_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
                File.WriteAllText(filePath, sb.ToString(), Encoding.UTF8);
                Mod.Log.Info($"Exported {rows?.Count ?? 0} placed assets to {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                Mod.Log.Error($"Failed to export placed assets CSV: {ex.Message}");
                return null;
            }
        }

        public static string ExportDistricts()
        {
            try
            {
                var ds = DistrictSystem.Instance ?? Unity.Entities.World.DefaultGameObjectInjectionWorld?.GetExistingSystemManaged<DistrictSystem>();
                if (ds == null)
                {
                    Mod.Log.Warn("CsvExportService: DistrictSystem unavailable.");
                    return null;
                }

                ds.RefreshNow();
                var rows = ds.GetDistrictRows();

                var sb = new StringBuilder();
                sb.AppendLine("EntityKey,DistrictName,Population,Households,ResidentialCount,CommercialCount,IndustrialCount,OfficeCount,AverageHappiness,AverageBuildingLevel,PoliciesActive");

                if (rows != null)
                {
                    foreach (var d in rows)
                    {
                        int polCount = d.Policies != null ? d.Policies.Count : 0;
                        sb.Append(EscapeCsv(d.EntityKey)).Append(',')
                          .Append(EscapeCsv(d.Name)).Append(',')
                          .Append(d.Population).Append(',')
                          .Append(d.Households).Append(',')
                          .Append(d.ResidentialCount).Append(',')
                          .Append(d.CommercialCount).Append(',')
                          .Append(d.IndustrialCount).Append(',')
                          .Append(d.OfficeCount).Append(',')
                          .Append(d.AvgHappiness).Append(',')
                          .Append(d.AvgBuildingLevel).Append(',')
                          .Append(polCount)
                          .AppendLine();
                    }
                }

                string filePath = Path.Combine(GetExportDirectory(), $"BAM_Districts_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
                File.WriteAllText(filePath, sb.ToString(), Encoding.UTF8);
                Mod.Log.Info($"Exported {rows?.Count ?? 0} districts to {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                Mod.Log.Error($"Failed to export districts CSV: {ex.Message}");
                return null;
            }
        }

        public static string ExportCatalogPrefabs()
        {
            try
            {
                var inv = AssetInventorySystem.Instance ?? Unity.Entities.World.DefaultGameObjectInjectionWorld?.GetExistingSystemManaged<AssetInventorySystem>();
                if (inv == null)
                {
                    Mod.Log.Warn("CsvExportService: AssetInventorySystem unavailable.");
                    return null;
                }

                inv.EnsureCatalogCached();
                var catalog = inv.GetCatalogCache();

                var sb = new StringBuilder();
                sb.AppendLine("PrefabKey,Name,Category,SubCategory,Theme,AssetPack,Level,ConstructionCost,MaintenanceCost");

                if (catalog != null)
                {
                    foreach (var item in catalog)
                    {
                        sb.Append(EscapeCsv(item.PrefabKey)).Append(',')
                          .Append(EscapeCsv(item.Name)).Append(',')
                          .Append(EscapeCsv(item.Category.ToString())).Append(',')
                          .Append(EscapeCsv(item.SubCategory)).Append(',')
                          .Append(EscapeCsv(item.Theme)).Append(',')
                          .Append(EscapeCsv(item.AssetPack)).Append(',')
                          .Append(item.Level).Append(',')
                          .Append(item.ConstructionCost).Append(',')
                          .Append(item.MaintenanceCost)
                          .AppendLine();
                    }
                }

                string filePath = Path.Combine(GetExportDirectory(), $"BAM_CatalogPrefabs_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
                File.WriteAllText(filePath, sb.ToString(), Encoding.UTF8);
                Mod.Log.Info($"Exported {catalog?.Count ?? 0} catalog prefabs to {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                Mod.Log.Error($"Failed to export catalog prefabs CSV: {ex.Message}");
                return null;
            }
        }

        public static string SaveCustomCsv(string csvContent, string prefix = "BAM_FilteredAssets")
        {
            try
            {
                if (string.IsNullOrEmpty(csvContent)) return null;
                if (csvContent.Length > 20 * 1024 * 1024)
                {
                    Mod.Log.Warn($"SaveCustomCsv aborted: payload size {csvContent.Length} exceeds limit");
                    return null;
                }

                string rawPrefix = string.IsNullOrWhiteSpace(prefix) ? "BAM_FilteredAssets" : prefix.Trim();
                var sbPrefix = new StringBuilder(rawPrefix.Length);
                for (int i = 0; i < rawPrefix.Length; i++)
                {
                    char c = rawPrefix[i];
                    sbPrefix.Append(char.IsLetterOrDigit(c) || c == '_' || c == '-' ? c : '_');
                }
                string safePrefix = sbPrefix.Length > 0 ? sbPrefix.ToString() : "BAM_FilteredAssets";

                string filePath = Path.Combine(GetExportDirectory(), $"{safePrefix}_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
                File.WriteAllText(filePath, csvContent, Encoding.UTF8);
                Mod.Log.Info($"Exported custom CSV to {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                Mod.Log.Error($"Failed to save custom CSV: {ex.Message}");
                return null;
            }
        }

        public static void OpenExportFolder()
        {
            try
            {
                string dir = GetExportDirectory();
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = dir,
                    UseShellExecute = true,
                    Verb = "open"
                });
            }
            catch (Exception ex)
            {
                Mod.Log.Error($"Failed to open export folder: {ex.Message}");
            }
        }

        private static string EscapeCsv(string value)
        {
            if (string.IsNullOrEmpty(value)) return "\"\"";
            if (value.Contains(",") || value.Contains("\"") || value.Contains("\n") || value.Contains("\r"))
            {
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            }
            return value;
        }
    }
}
