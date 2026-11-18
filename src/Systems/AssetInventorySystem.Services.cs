using System.Collections.Generic;
using AdvancedBAM.Systems.Dtos;
using Game.Simulation;

namespace AdvancedBAM.Systems
{
    public partial class AssetInventorySystem
    {
        private WaterStatisticsSystem _waterStats;
        private ElectricityStatisticsSystem _electricityStats;
        private readonly Dictionary<string, ServiceStatusVm> _serviceByKey = new Dictionary<string, ServiceStatusVm>(16);
        private readonly Dictionary<string, int> _serviceEffSum = new Dictionary<string, int>(16);
        private readonly Dictionary<string, int> _serviceEffCount = new Dictionary<string, int>(16);
        private readonly ServiceStatusPayload _servicePayload = new ServiceStatusPayload();

        /// <summary>
        /// Groups placed service buildings by service (prefab name of the service
        /// group) into status cards. Water and Electricity cards are upgraded with
        /// city-wide consumption / capacity from the game's statistics systems;
        /// other services report employees vs. workplaces.
        /// </summary>
        private ServiceStatusPayload BuildServiceStatus(List<UnifiedAssetVm> rows)
        {
            _serviceByKey.Clear();
            _serviceEffSum.Clear();
            _serviceEffCount.Clear();
            _servicePayload.Cards.Clear();

            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                if (row == null || !row.IsPlaced || row.Category != AssetCategory.Service || string.IsNullOrEmpty(row.EntityKey)) continue;

                string label = string.IsNullOrEmpty(row.SubCategory) ? "Other" : row.SubCategory;
                string key = label.ToLowerInvariant();

                if (!_serviceByKey.TryGetValue(key, out var card))
                {
                    card = new ServiceStatusVm { Key = key, Label = label, Unit = "Workers" };
                    _serviceByKey[key] = card;
                    _serviceEffSum[key] = 0;
                    _serviceEffCount[key] = 0;
                }

                card.BuildingCount++;
                card.Usage += row.Occupied;
                card.Capacity += row.Capacity;
                if (row.Efficiency >= 0)
                {
                    _serviceEffSum[key] += row.Efficiency;
                    _serviceEffCount[key]++;
                }
            }

            foreach (var pair in _serviceByKey)
            {
                int n = _serviceEffCount[pair.Key];
                pair.Value.AvgEfficiency = n > 0 ? _serviceEffSum[pair.Key] / n : 0;
            }

            ApplyUtilityStatistics(_serviceByKey);

            _servicePayload.Cards.AddRange(_serviceByKey.Values);
            _servicePayload.Cards.Sort((a, b) => string.CompareOrdinal(a.Label, b.Label));
            return _servicePayload;
        }

        private void ApplyUtilityStatistics(Dictionary<string, ServiceStatusVm> cards)
        {
            Mod.Log.Guard("ApplyUtilityStatistics", () =>
            {
                if (_waterStats == null) _waterStats = World.GetExistingSystemManaged<WaterStatisticsSystem>();
                if (_electricityStats == null) _electricityStats = World.GetExistingSystemManaged<ElectricityStatisticsSystem>();

                foreach (var card in cards.Values)
                {
                    if (card.Key.Contains("water") && _waterStats != null)
                    {
                        card.Usage = _waterStats.freshConsumption;
                        card.Capacity = _waterStats.freshCapacity;
                        card.Unit = "Water";
                    }
                    else if (card.Key.Contains("electric") && _electricityStats != null)
                    {
                        card.Usage = _electricityStats.consumption;
                        card.Capacity = _electricityStats.production;
                        card.Unit = "Power";
                    }
                }
            });
        }
    }
}
