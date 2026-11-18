using System;
using System.Collections.Generic;
using AdvancedBAM.Systems.Dtos;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.Prefabs;
using Game.Simulation;
using Game.UI;
using Unity.Collections;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    /// <summary>
    /// Reads placed buildings and unplaced catalog prefabs, normalizes them into
    /// <see cref="UnifiedAssetVm"/> rows and pushes them to the UI as JSON.
    /// Only runs while the explorer window is open, respects pause state,
    /// time-slices placed scans across frames, and preserves cached rows across minimize/restore.
    ///
    /// Partial files:
    ///   AssetInventorySystem.Prefabs.cs  - per-prefab classification cache
    ///   AssetInventorySystem.Placed.cs   - placed building scan
    ///   AssetInventorySystem.Catalog.cs  - catalog prefab scan
    ///   AssetInventorySystem.Services.cs - service status cards
    /// </summary>
    public partial class AssetInventorySystem : UISystemBase
    {
        private PrefabSystem _prefabSystem;
        private NameSystem _nameSystem;
        private TaxSystem _taxSystem;
        private Game.Simulation.CitySystem _citySystem;
        private BamWindowSystem _windowSystem;
        private Game.UI.InGame.AverageHappinessSection _avgHappinessSection;
        private Game.Prefabs.ResourceSystem _resourceSystem;
        private Game.UI.InGame.PrefabUISystem _prefabUISystem;
        private BamRepairSystem _repairSystem;
        private SimulationSystem _simulationSystem;

        private EntityQuery _placedQuery;
        private EntityQuery _catalogQuery;
        private EntityQuery _economyParameterQuery;
        private EntityQuery _happinessParameterQuery;

        public static AssetInventorySystem Instance { get; private set; }

        private ValueBinding<string> _assetsBinding;
        private ValueBinding<string> _catalogBinding;
        private ValueBinding<string> _serviceBinding;
        private ValueBinding<string> _statusBinding;

        private readonly List<UnifiedAssetVm> _rows = new List<UnifiedAssetVm>(4096);
        private readonly List<UnifiedAssetVm> _scanRows = new List<UnifiedAssetVm>(4096);
        private NativeList<Entity> _pendingPlacedEntities;
        private int _placedScanIndex;
        private bool _scanInProgress;
        private DateTime _scanStartedUtc;

        private List<UnifiedAssetVm> _catalogCache;
        private Entity[] _pendingCatalogPrefabs;
        private int _catalogProgress;
        private int _lastCatalogPrefabCount = -1;
        private GameMode _catalogBuiltMode = GameMode.Other;
        private bool _inGameLoaded;
        private float _catalogWarmDelaySeconds;
        private List<UnifiedAssetVm> _buildingCatalogList;

        private float _secondsSinceRefresh;
        private float _secondsSinceLastCompletedScan = 100f;
        private bool _dirty = true;
        private bool _catalogDirty = true;
        private bool _lastIncludeCatalog = true;
        private string _lastAssetsJson;
        private string _lastServiceJson;
        private string _lastStatusJson;
        private string _lastCatalogJson;

        private const int kPlacedSliceSize = 400;

        protected override void OnCreate()
        {
            base.OnCreate();
            Instance = this;

            _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
            _nameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            _taxSystem = World.GetOrCreateSystemManaged<TaxSystem>();
            _citySystem = World.GetOrCreateSystemManaged<Game.Simulation.CitySystem>();
            _windowSystem = World.GetOrCreateSystemManaged<BamWindowSystem>();
            _avgHappinessSection = World.GetOrCreateSystemManaged<Game.UI.InGame.AverageHappinessSection>();
            _resourceSystem = World.GetOrCreateSystemManaged<Game.Prefabs.ResourceSystem>();
            _prefabUISystem = World.GetOrCreateSystemManaged<Game.UI.InGame.PrefabUISystem>();
            _repairSystem = World.GetOrCreateSystemManaged<BamRepairSystem>();
            try { _simulationSystem = World.GetOrCreateSystemManaged<SimulationSystem>(); } catch (Exception ex) { Mod.Log.Debug($"AssetInventorySystem: optional SimulationSystem: {ex.Message}"); }

            _pendingPlacedEntities = new NativeList<Entity>(4096, Allocator.Persistent);
            _windowSystem.WindowOpened += OnWindowOpened;

            _placedQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<Game.Buildings.Building>(),
                    ComponentType.ReadOnly<PrefabRef>(),
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Game.Tools.Temp>(),
                    ComponentType.ReadOnly<Game.Common.Deleted>(),
                    ComponentType.ReadOnly<Game.Buildings.ServiceUpgrade>(),
                    ComponentType.ReadOnly<Game.Buildings.Extension>(),
                    ComponentType.ReadOnly<Game.Common.Owner>(),
                },
            });

            _catalogQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<PrefabData>(),
                    ComponentType.ReadOnly<BuildingData>(),
                },
                None = new[]
                {
                    ComponentType.ReadOnly<BuildingExtensionData>(),
                    ComponentType.ReadOnly<ServiceUpgradeBuilding>(),
                    ComponentType.ReadOnly<ServiceUpgradeData>(),
                },
            });

            _economyParameterQuery = GetEntityQuery(ComponentType.ReadOnly<EconomyParameterData>());
            _happinessParameterQuery = GetEntityQuery(ComponentType.ReadOnly<CitizenHappinessParameterData>());

            AddBinding(_assetsBinding = new ValueBinding<string>(BamChannels.Group, BamChannels.UnifiedAssets, "[]"));
            AddBinding(_catalogBinding = new ValueBinding<string>(BamChannels.Group, BamChannels.CatalogAssets, "[]"));
            AddBinding(_serviceBinding = new ValueBinding<string>(BamChannels.Group, BamChannels.ServiceStatus, "{\"cards\":[]}"));
            AddBinding(_statusBinding = new ValueBinding<string>(BamChannels.Group, BamChannels.InventoryStatus, "{}"));

            AddBinding(new TriggerBinding(BamChannels.Group, BamChannels.RequestRefresh, OnManualRefresh));
        }

        protected override void OnDestroy()
        {
            if (Instance == this) Instance = null;
            if (_windowSystem != null)
            {
                _windowSystem.WindowOpened -= OnWindowOpened;
            }
            if (_pendingPlacedEntities.IsCreated)
            {
                _pendingPlacedEntities.Dispose();
            }
            ClearStaticDescriptorCache();
            base.OnDestroy();
        }

        protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode)
        {
            base.OnGameLoadingComplete(purpose, mode);
            PackHelper.ClearCache();
            ClearStaticDescriptorCache();
            _districtNameCache.Clear();
            _roadNameCache.Clear();
            _rows.Clear();
            _scanRows.Clear();
            if (_pendingPlacedEntities.IsCreated) _pendingPlacedEntities.Clear();
            _placedScanIndex = 0;
            _scanInProgress = false;
            _secondsSinceLastCompletedScan = 100f;
            _lastAssetsJson = null;
            _lastServiceJson = null;
            _lastStatusJson = null;
            _dirty = true;

            _inGameLoaded = mode == GameMode.Game || mode == GameMode.Editor;
            if (!_inGameLoaded)
            {
                _catalogWarmDelaySeconds = 0f;
                return;
            }

            int catalogEntityCount = _catalogQuery.CalculateEntityCount();
            bool catalogCountChanged = catalogEntityCount != _lastCatalogPrefabCount;
            bool sameModeAndCount = _catalogBuiltMode == mode && !catalogCountChanged;
            if (!sameModeAndCount || (_catalogCache == null && _pendingCatalogPrefabs == null))
            {
                _prefabInfoCache.Clear();
                ClearDisplayNameCache();
                _catalogCache = null;
                _pendingCatalogPrefabs = null;
                _buildingCatalogList = null;
                _catalogProgress = 0;
                _lastCatalogPrefabCount = -1;
                _catalogBuiltMode = mode;
                _catalogWarmDelaySeconds = 0.25f;
                _catalogDirty = true;
                _lastCatalogJson = null;
                _catalogBinding?.Update("[]");
            }
            else if (_catalogCache != null)
            {
                _catalogDirty = true;
            }
        }

        private bool IsGamePaused()
        {
            return (_simulationSystem != null && _simulationSystem.selectedSpeed <= 0f)
                || UnityEngine.Time.timeScale <= 0f;
        }

        private void OnWindowOpened()
        {
            // Keep existing cached rows on rapid reopen or while paused unless empty or stale (>= 5s).
            if (_rows.Count == 0 || (!IsGamePaused() && _secondsSinceLastCompletedScan >= 5f))
            {
                MarkDirty();
            }
        }

        /// <summary>Forces a rebuild on the next frame the window is open (including while paused).</summary>
        public void MarkDirty()
        {
            _dirty = true;
        }

        private void OnManualRefresh()
        {
            MarkDirty();
            DistrictSystem.Instance?.RequestManualRefresh();
        }

        protected override void OnUpdate()
        {
            _secondsSinceLastCompletedScan = Math.Min(999f, _secondsSinceLastCompletedScan + UnityEngine.Time.unscaledDeltaTime);
            if (_catalogWarmDelaySeconds > 0f)
            {
                _catalogWarmDelaySeconds = Math.Max(0f, _catalogWarmDelaySeconds - UnityEngine.Time.unscaledDeltaTime);
            }

            bool windowActive = _windowSystem != null && _windowSystem.IsWindowActive;
            if (_inGameLoaded && _catalogCache == null && (_catalogWarmDelaySeconds <= 0f || windowActive) && (windowActive || !IsGamePaused()))
            {
                WarmCatalogCache(400);
            }

            if (!windowActive) return;

            bool paused = IsGamePaused();
            if (!paused && !_scanInProgress)
            {
                _secondsSinceRefresh += UnityEngine.Time.unscaledDeltaTime;
            }

            int interval = Math.Max(5, Mod.Settings?.RefreshIntervalSeconds ?? 20);
            if (_dirty || (!paused && !_scanInProgress && _secondsSinceRefresh >= interval))
            {
                _dirty = false;
                _secondsSinceRefresh = 0f;
                Mod.Log.Guard("AssetInventorySystem.BeginPlacedScan", BeginPlacedScan);
            }

            if (_scanInProgress)
            {
                Mod.Log.Guard("AssetInventorySystem.StepPlacedScan", () => StepPlacedScan(kPlacedSliceSize));
            }

            PushCatalogIfNeeded();
        }

        private void Rebuild()
        {
            BeginPlacedScan();
            StepPlacedScan(int.MaxValue);
        }

        private void BeginPlacedScan()
        {
            _scanStartedUtc = DateTime.UtcNow;
            _scanRows.Clear();
            _districtNameCache.Clear();
            if (_roadNameCache.Count > 8192)
            {
                _roadNameCache.Clear();
            }

            if (!_pendingPlacedEntities.IsCreated)
            {
                _pendingPlacedEntities = new NativeList<Entity>(4096, Allocator.Persistent);
            }
            _pendingPlacedEntities.Clear();

            using (var entities = _placedQuery.ToEntityArray(Allocator.TempJob))
            {
                if (_staticDescriptorCache.Count > entities.Length + 4096)
                {
                    _staticDescriptorCache.Clear();
                }
                _pendingPlacedEntities.ResizeUninitialized(entities.Length);
                if (entities.Length > 0)
                {
                    _pendingPlacedEntities.AsArray().CopyFrom(entities);
                }
            }

            _placedScanIndex = 0;
            _scanInProgress = true;
        }

        private void StepPlacedScan(int sliceSize)
        {
            if (!_scanInProgress) return;

            var em = EntityManager;
            int total = _pendingPlacedEntities.IsCreated ? _pendingPlacedEntities.Length : 0;
            int end = sliceSize == int.MaxValue
                ? total
                : Math.Min(total, _placedScanIndex + sliceSize);

            for (int i = _placedScanIndex; i < end; i++)
            {
                var entity = _pendingPlacedEntities[i];
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
                    if (vm != null && !string.IsNullOrEmpty(vm.EntityKey))
                    {
                        _scanRows.Add(vm);
                    }
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"AssetInventorySystem.StepPlacedScan: Failed building placed VM for entity {entity.Index}:{entity.Version} - {ex.Message}");
                }
            }

            _placedScanIndex = end;
            if (_placedScanIndex < total) return;

            _scanInProgress = false;
            _pendingPlacedEntities.Clear();

            _rows.Clear();
            _rows.AddRange(_scanRows);
            _scanRows.Clear();
            _secondsSinceLastCompletedScan = 0f;

            PushJsonIfChanged(_assetsBinding, ref _lastAssetsJson, _rows, "[]");
            PushJsonIfChanged(_serviceBinding, ref _lastServiceJson, BuildServiceStatus(_rows), "{\"cards\":[]}");

            int elapsedMs = (int)(DateTime.UtcNow - _scanStartedUtc).TotalMilliseconds;
            PushStatusBinding(elapsedMs);
        }

        private void PushStatusBinding(int elapsedMs)
        {
            int placedCount = _rows.Count;
            bool includeCatalog = Mod.Settings == null || Mod.Settings.IncludeCatalogPrefabs;
            int catalogCount = includeCatalog ? (_catalogCache?.Count ?? _buildingCatalogList?.Count ?? 0) : 0;

            var packsMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            void CollectPacks(List<UnifiedAssetVm> list)
            {
                if (list == null) return;
                for (int i = 0; i < list.Count; i++)
                {
                    var item = list[i];
                    if (item == null) continue;
                    string p = string.IsNullOrWhiteSpace(item.AssetPack) ? "Base Game" : item.AssetPack.Trim();
                    string icon = item.AssetPackIcon ?? string.Empty;
                    if (!packsMap.TryGetValue(p, out var existing) || (string.IsNullOrEmpty(existing) && !string.IsNullOrEmpty(icon)))
                    {
                        packsMap[p] = icon;
                    }
                }
            }
            CollectPacks(_rows);
            CollectPacks(_catalogCache);

            var statusVm = new InventoryStatusVm
            {
                Placed = placedCount,
                Catalog = catalogCount,
                ElapsedMs = elapsedMs,
            };
            foreach (var kv in packsMap)
            {
                statusVm.Packs.Add(new InventoryPackMetaVm { Name = kv.Key, Icon = kv.Value });
            }

            PushJsonIfChanged(_statusBinding, ref _lastStatusJson, statusVm, "{}");
        }

        public void RefreshNow()
        {
            Rebuild();
            PushCatalogIfNeeded();
        }

        private void PushCatalogIfNeeded()
        {
            bool includeCatalog = Mod.Settings == null || Mod.Settings.IncludeCatalogPrefabs;
            if (includeCatalog != _lastIncludeCatalog)
            {
                _lastIncludeCatalog = includeCatalog;
                _catalogDirty = true;
            }

            if (!_catalogDirty) return;
            if (includeCatalog && _catalogCache == null) return;

            _catalogDirty = false;
            if (!includeCatalog)
            {
                if (!string.Equals("[]", _lastCatalogJson, StringComparison.Ordinal))
                {
                    _lastCatalogJson = "[]";
                    _catalogBinding.Update("[]");
                }
            }
            else
            {
                PushJsonIfChanged(_catalogBinding, ref _lastCatalogJson, _catalogCache, "[]");
            }
        }

        public void WarmCatalogCache(int sliceSize)
        {
            if (_catalogCache != null) return;

            if (_pendingCatalogPrefabs == null)
            {
                using (var prefabs = _catalogQuery.ToEntityArray(Allocator.TempJob))
                {
                    _pendingCatalogPrefabs = prefabs.ToArray();
                }
                _lastCatalogPrefabCount = _pendingCatalogPrefabs.Length;
                _catalogProgress = 0;
                _buildingCatalogList = new List<UnifiedAssetVm>(_pendingCatalogPrefabs.Length);
            }

            int end = Math.Min(_pendingCatalogPrefabs.Length, _catalogProgress + sliceSize);
            for (int i = _catalogProgress; i < end; i++)
            {
                var prefabEnt = _pendingCatalogPrefabs[i];
                try
                {
                    var vm = BuildCatalogPrefabVm(prefabEnt);
                    if (vm != null) _buildingCatalogList.Add(vm);
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"AssetInventorySystem.WarmCatalogCache: Failed building catalog VM for prefab entity {prefabEnt.Index}:{prefabEnt.Version} - {ex.Message}");
                }
            }
            _catalogProgress = end;

            if (_catalogProgress >= _pendingCatalogPrefabs.Length)
            {
                _catalogCache = _buildingCatalogList;
                _pendingCatalogPrefabs = null;
                _buildingCatalogList = null;
                Mod.Log.Info($"AssetInventorySystem: catalog cached in background ({_catalogCache.Count} prefabs)");
                _catalogDirty = true;
                PushStatusBinding(0);
                if (_windowSystem != null && _windowSystem.IsWindowActive && !IsGamePaused())
                {
                    MarkDirty();
                }
            }
        }

        public void EnsureCatalogCached()
        {
            if (_catalogCache != null) return;
            WarmCatalogCache(int.MaxValue);
        }

        public IReadOnlyList<UnifiedAssetVm> GetPlacedRows() => _rows;
        public IReadOnlyList<UnifiedAssetVm> GetCatalogCache() => _catalogCache;

        private static void PushJsonIfChanged(ValueBinding<string> binding, ref string lastJson, object payload, string fallback)
        {
            try
            {
                string json = Mod.SerializeJson(payload);
                if (string.IsNullOrEmpty(json)) json = fallback;
                if (string.Equals(json, lastJson, StringComparison.Ordinal)) return;
                lastJson = json;
                binding.Update(json);
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"AssetInventorySystem: serialize failed for {binding.name}: {ex.Message}");
                if (!string.Equals(fallback, lastJson, StringComparison.Ordinal))
                {
                    lastJson = fallback;
                    binding.Update(fallback);
                }
            }
        }
    }
}
