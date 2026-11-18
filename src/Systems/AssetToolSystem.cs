using AdvancedBAM.Utilities;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.Prefabs;
using Game.Tools;
using Game.UI;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    /// <summary>
    /// Handles C# tool interactions from the UI:
    /// 1. Plop/Clone -> activates CS2's native ObjectToolSystem to place buildings.
    /// 2. Rebuild/Repair -> validates settings/entity keys and queues repairs on BamRepairSystem (Modification1).
    /// 3. SceneExplorer -> deferred soft-link probing and entity inspection dispatch.
    /// </summary>
    public partial class AssetToolSystem : UISystemBase
    {
        private ToolSystem _toolSystem;
        private ObjectToolSystem _objectToolSystem;
        private PrefabSystem _prefabSystem;
        private NameSystem _nameSystem;
        private BamWindowSystem _windowSystem;
        private BamRepairSystem _repairSystem;

        protected override void OnCreate()
        {
            base.OnCreate();

            _toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
            _objectToolSystem = World.GetOrCreateSystemManaged<ObjectToolSystem>();
            _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
            _nameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            _windowSystem = World.GetOrCreateSystemManaged<BamWindowSystem>();
            _repairSystem = World.GetOrCreateSystemManaged<BamRepairSystem>();

            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.PlopPrefab, TriggerPlopPrefab));
            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.CloneBuilding, TriggerCloneBuilding));
            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.RebuildBuilding, TriggerRebuildBuilding));
            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.RebuildAllBuildings, TriggerRebuildAllBuildings));
            AddBinding(new TriggerBinding<string, string>(BamChannels.Group, BamChannels.RenameAsset, TriggerRenameAsset));

            if (_windowSystem != null)
            {
                _windowSystem.WindowOpened += OnWindowOpenedProbeSceneExplorer;
            }

            InitSceneExplorerBindings();
        }

        protected override void OnDestroy()
        {
            if (_windowSystem != null)
            {
                _windowSystem.WindowOpened -= OnWindowOpenedProbeSceneExplorer;
            }
            base.OnDestroy();
        }

        protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode)
        {
            base.OnGameLoadingComplete(purpose, mode);
            ProbeSceneExplorerIfNeeded();
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();
            if (!_hasPostStartupProbedSceneExplorer)
            {
                _hasPostStartupProbedSceneExplorer = true;
                ProbeSceneExplorerIfNeeded();
            }
        }

        // ---- Rename Asset ---------------------------------------------------

        private void TriggerRenameAsset(string entityKey, string newName)
        {
            Mod.Log.Guard("TriggerRenameAsset", () =>
            {
                if (string.IsNullOrWhiteSpace(entityKey) || _nameSystem == null) return;
                if (!EntityKey.TryResolve(EntityManager, entityKey, out var target) || !EntityManager.Exists(target))
                {
                    Mod.Log.Warn($"TriggerRenameAsset: invalid entity key '{entityKey}'");
                    return;
                }

                string trimmed = (newName ?? string.Empty).Trim();
                _nameSystem.SetCustomName(target, trimmed);
                AssetInventorySystem.Instance?.MarkDirty();
            });
        }

        // ---- Placement Tool Activation --------------------------------------

        private void TriggerPlopPrefab(string prefabKey)
        {
            Mod.Log.Guard("TriggerPlopPrefab", () =>
            {
                if (!EntityKey.TryParse(prefabKey, out var prefabEntity) || !EntityManager.Exists(prefabEntity))
                {
                    Mod.Log.Warn($"TriggerPlopPrefab: invalid prefab entity key '{prefabKey}'");
                    return;
                }

                if (!_prefabSystem.TryGetPrefab(prefabEntity, out PrefabBase prefabBase) || prefabBase == null)
                {
                    Mod.Log.Warn($"TriggerPlopPrefab: cannot resolve PrefabBase for entity {prefabKey}");
                    return;
                }

                ActivatePlacementTool(prefabBase, prefabEntity);
            });
        }

        private void TriggerCloneBuilding(string entityKey)
        {
            Mod.Log.Guard("TriggerCloneBuilding", () =>
            {
                if (!EntityKey.TryResolve(EntityManager, entityKey, out var buildingEntity))
                {
                    Mod.Log.Warn($"TriggerCloneBuilding: invalid building entity key '{entityKey}'");
                    return;
                }

                if (!EntityManager.HasComponent<PrefabRef>(buildingEntity))
                {
                    Mod.Log.Warn($"TriggerCloneBuilding: entity {entityKey} has no PrefabRef");
                    return;
                }

                var prefabEntity = EntityManager.GetComponentData<PrefabRef>(buildingEntity).m_Prefab;
                if (prefabEntity == Entity.Null || !EntityManager.Exists(prefabEntity) ||
                    !_prefabSystem.TryGetPrefab(prefabEntity, out PrefabBase prefabBase) || prefabBase == null)
                {
                    Mod.Log.Warn($"TriggerCloneBuilding: cannot resolve prefab for building {entityKey}");
                    return;
                }

                ActivatePlacementTool(prefabBase, prefabEntity);
            });
        }

        private bool IsSubBuildingUpgradePrefab(Entity prefabEntity)
        {
            if (prefabEntity == Entity.Null || !EntityManager.Exists(prefabEntity)) return false;
            return EntityManager.HasComponent<Game.Prefabs.ServiceUpgradeData>(prefabEntity) ||
                   EntityManager.HasComponent<Game.Prefabs.ServiceUpgradeBuilding>(prefabEntity) ||
                   EntityManager.HasComponent<Game.Prefabs.BuildingExtensionData>(prefabEntity);
        }

        private void ActivatePlacementTool(PrefabBase prefabBase, Entity prefabEntity = default)
        {
            if (_toolSystem == null || _objectToolSystem == null || prefabBase == null) return;
            if (prefabEntity != Entity.Null && IsSubBuildingUpgradePrefab(prefabEntity))
            {
                Mod.Log.Info($"ActivatePlacementTool: skipped sub-building upgrade '{prefabBase.name}' (cannot be plopped standalone)");
                return;
            }

            if (prefabBase is ObjectPrefab objectPrefab)
            {
                _objectToolSystem.prefab = objectPrefab;
                _toolSystem.activeTool = _objectToolSystem;
                Mod.Log.Info($"Activated ObjectToolSystem for prefab '{prefabBase.name}'");

                if (Mod.Settings != null && Mod.Settings.CloseWindowOnPlace)
                {
                    _windowSystem?.SetVisible(false);
                }
            }
            else
            {
                Mod.Log.Warn($"ActivatePlacementTool: prefab '{prefabBase.name}' is not an ObjectPrefab");
            }
        }

        // ---- Building Rebuild & Repair --------------------------------------

        private void TriggerRebuildBuilding(string entityKey)
        {
            if (Mod.Settings != null && !Mod.Settings.EnableBuildingRepairs)
            {
                Mod.Log.Info($"TriggerRebuildBuilding('{entityKey}') ignored: EnableBuildingRepairs is disabled in settings.");
                return;
            }
            bool forceRelocate = true;
            string rawKey = entityKey ?? string.Empty;
            if (rawKey.StartsWith("path:", System.StringComparison.OrdinalIgnoreCase))
            {
                rawKey = rawKey.Substring(5).Trim();
                forceRelocate = true;
            }
            if (!EntityKey.TryResolve(EntityManager, rawKey, out var ent))
            {
                Mod.Log.Warn($"TriggerRebuildBuilding: invalid or missing entity '{entityKey}'");
                return;
            }
            Mod.Log.Info($"TriggerRebuildBuilding('{entityKey}') -> queued entity {ent.Index}:{ent.Version} (forceRelocate={forceRelocate})");
            _repairSystem?.EnqueueRebuildBuilding(ent, forceRelocate);
        }

        private void TriggerRebuildAllBuildings(string category)
        {
            if (Mod.Settings != null && !Mod.Settings.EnableBuildingRepairs)
            {
                Mod.Log.Info($"TriggerRebuildAllBuildings('{category}') ignored: EnableBuildingRepairs is disabled in settings.");
                return;
            }
            Mod.Log.Info($"TriggerRebuildAllBuildings(scope='{category}') -> queued for Modification1");
            _repairSystem?.EnqueueRebuildAll(category);
        }
    }
}
