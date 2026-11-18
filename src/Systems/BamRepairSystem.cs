using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Reflection;
using Game;
using Game.Buildings;
using Game.Common;
using Game.Notifications;
using Game.Objects;
using Game.Prefabs;
using Game.Simulation;
using Game.Tools;
using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

namespace AdvancedBAM.Systems
{
    /// <summary>
    /// Executes building and disaster repairs safely inside SystemUpdatePhase.Modification1,
    /// before Modification2..End (InitializeSystem, SubAreaReferencesSystem, SubObjectReferencesSystem,
    /// SearchSystem, IconCommandSystem), PreCullingSystem, RenderingSystem, and CleanUpSystem run.
    /// </summary>
    public partial class BamRepairSystem : GameSystemBase
    {
        private delegate Unity.Jobs.JobHandle CreateDefinitionsDelegate(
            ObjectToolBaseSystem instance,
            Entity objectPrefab,
            Entity transformPrefab,
            Entity brushPrefab,
            Entity owner,
            Entity original,
            Entity laneEditor,
            Entity theme,
            NativeList<ControlPoint> controlPoints,
            NativeReference<ObjectToolBaseSystem.AttachmentData> attachmentPrefab,
            bool editorMode,
            bool lefthandTraffic,
            bool removing,
            bool stamping,
            float brushSize,
            float brushAngle,
            float brushStrength,
            float distance,
            float deltaTime,
            RandomSeed randomSeed,
            Snap snap,
            Game.Tools.AgeMask ageMask,
            bool decorationMode,
            PlacementOverrides overrides,
            Unity.Jobs.JobHandle inputDeps);

        private delegate Unity.Jobs.JobHandle DestroyDefinitionsDelegate(
            ToolBaseSystem instance,
            EntityQuery group,
            ToolOutputBarrier barrier,
            Unity.Jobs.JobHandle inputDeps);

        private UpdateSystem _updateSystem;
        private ToolSystem _toolSystem;
        private ObjectToolSystem _objectToolSystem;
        private ToolOutputBarrier _toolOutputBarrier;
        private Game.City.CityConfigurationSystem _cityConfigSystem;
        private AssetInventorySystem _inventorySystem;
        private IconCommandSystem _iconCommandSystem;
        private TerrainSystem _terrainSystem;
        private WaterSystem _waterSystem;
        private EntityQuery _definitionQuery;
        private EntityQuery _tempQuery;
        private EntityQuery _placedBuildingQuery;
        private EntityQuery _damagedRebuildQuery;
        private EntityQuery _damagedExtensionQuery;
        private EntityQuery _damagedEfficiencyQuery;
        private EntityQuery _damagedExtensionEfficiencyQuery;
        private EntityQuery _collapsedSurfaceQuery;
        private EntityQuery _collapsedObjectQuery;
        private EntityQuery _onFireQuery;
        private EntityQuery _accidentSiteQuery;
        private EntityQuery _involvedInAccidentQuery;
        private EntityQuery _notificationIconQuery;
        private EntityQuery _staticInterpolatedBuildingQuery;
        private EntityQuery _buildingConfigQuery;
        private EntityQuery _fireConfigQuery;
        private EntityQuery _disasterConfigQuery;
        private EntityQuery _policeConfigQuery;
        private EntityQuery _trafficConfigQuery;
        private EntityQuery _routeConfigQuery;
        private CreateDefinitionsDelegate _createDefinitionsDelegate;
        private DestroyDefinitionsDelegate _destroyDefinitionsDelegate;
        private Action<ToolBaseSystem, ApplyMode> _setApplyModeDelegate;
        private NativeList<ControlPoint> _relocateControlPoints;
        private readonly List<Entity> _relocateQueue = new List<Entity>();
        private readonly HashSet<Entity> _relocateQueuedSet = new HashSet<Entity>();
        private readonly List<Entity> _postRelocateCleanup = new List<Entity>();
        private Entity _activeRelocateEntity = Entity.Null;
        private int _activeRelocateStage;
        private readonly Dictionary<string, Type> _cachedComponentTypes = new Dictionary<string, Type>(StringComparer.Ordinal);
        private readonly RepairArtifactSet _artifactCache = new RepairArtifactSet();
        private int _postRepairRefreshFrames;

        private static readonly string[] OptionalDamageComponents =
        {
            "Game.Events.Fire",
            "Game.Events.Burning",
            "Game.Events.FireDamage",
            "Game.Common.Burning",
            "Game.Buildings.Burning",
            "Game.Buildings.BurnedDown"
        };

        private sealed class RepairArtifactSet
        {
            public Entity BuildingConfigEntity;
            public Entity FireConfigEntity;
            public Entity DisasterConfigEntity;
            public Entity PoliceConfigEntity;
            public Entity TrafficConfigEntity;
            public Entity RouteConfigEntity;
            public Entity TurnedOffNotification;

            public readonly HashSet<Entity> TriggerNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> RepairNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> FireNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> FloodNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> WeatherNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> AccidentNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> CollapseNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> AbandonedNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> PathNotificationPrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> CollapsedSurfacePrefabs = new HashSet<Entity>();
            public readonly HashSet<Entity> CollapsedObjectPrefabs = new HashSet<Entity>();

            public void Clear()
            {
                BuildingConfigEntity = Entity.Null;
                FireConfigEntity = Entity.Null;
                DisasterConfigEntity = Entity.Null;
                PoliceConfigEntity = Entity.Null;
                TrafficConfigEntity = Entity.Null;
                RouteConfigEntity = Entity.Null;
                TurnedOffNotification = Entity.Null;
                TriggerNotificationPrefabs.Clear();
                RepairNotificationPrefabs.Clear();
                FireNotificationPrefabs.Clear();
                FloodNotificationPrefabs.Clear();
                WeatherNotificationPrefabs.Clear();
                AccidentNotificationPrefabs.Clear();
                CollapseNotificationPrefabs.Clear();
                AbandonedNotificationPrefabs.Clear();
                PathNotificationPrefabs.Clear();
                CollapsedSurfacePrefabs.Clear();
                CollapsedObjectPrefabs.Clear();
            }

            public bool MatchesNotificationScope(Entity notifPrefab, string scope)
            {
                if (notifPrefab == Entity.Null || !TriggerNotificationPrefabs.Contains(notifPrefab))
                    return false;
                if (string.IsNullOrEmpty(scope) || scope.Equals("all", StringComparison.OrdinalIgnoreCase))
                    return true;

                switch (scope.ToLowerInvariant())
                {
                    case "fire": return FireNotificationPrefabs.Contains(notifPrefab);
                    case "flood": return FloodNotificationPrefabs.Contains(notifPrefab);
                    case "weather": return WeatherNotificationPrefabs.Contains(notifPrefab);
                    case "accident": return AccidentNotificationPrefabs.Contains(notifPrefab);
                    case "collapse": return CollapseNotificationPrefabs.Contains(notifPrefab);
                    case "abandoned": return AbandonedNotificationPrefabs.Contains(notifPrefab);
                    case "path": return PathNotificationPrefabs.Contains(notifPrefab);
                    default: return true;
                }
            }
        }

        private sealed class RepairContext
        {
            public readonly RepairArtifactSet Artifacts;
            public bool HasTerrainData;
            public TerrainHeightData TerrainData;
            public bool HasWaterData;
            public WaterSurfaceData<SurfaceWater> WaterData;

            public RepairContext(RepairArtifactSet artifacts)
            {
                Artifacts = artifacts;
            }

            public HashSet<Entity> RepairNotificationPrefabs => Artifacts.RepairNotificationPrefabs;
            public HashSet<Entity> CollapsedSurfacePrefabs => Artifacts.CollapsedSurfacePrefabs;
            public HashSet<Entity> CollapsedObjectPrefabs => Artifacts.CollapsedObjectPrefabs;
            public Entity TurnedOffNotification => Artifacts.TurnedOffNotification;
        }

        private readonly ConcurrentQueue<RebuildRequest> _rebuildQueue = new ConcurrentQueue<RebuildRequest>();

        private struct RebuildRequest
        {
            public Entity TargetEntity;
            public bool RebuildAll;
            public bool ForceRelocate;
            public string Category;
        }

        protected override void OnCreate()
        {
            base.OnCreate();

            _updateSystem = World.GetOrCreateSystemManaged<UpdateSystem>();
            _toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
            _objectToolSystem = World.GetOrCreateSystemManaged<ObjectToolSystem>();
            _toolOutputBarrier = World.GetOrCreateSystemManaged<ToolOutputBarrier>();
            _cityConfigSystem = World.GetOrCreateSystemManaged<Game.City.CityConfigurationSystem>();
            _inventorySystem = World.GetOrCreateSystemManaged<AssetInventorySystem>();
            _iconCommandSystem = World.GetOrCreateSystemManaged<IconCommandSystem>();

            _relocateControlPoints = new NativeList<ControlPoint>(1, Allocator.Persistent);

            try
            {
                var createMethod = typeof(ObjectToolBaseSystem).GetMethod("CreateDefinitions", BindingFlags.Instance | BindingFlags.NonPublic);
                if (createMethod != null)
                {
                    _createDefinitionsDelegate = (CreateDefinitionsDelegate)Delegate.CreateDelegate(typeof(CreateDefinitionsDelegate), createMethod);
                }

                var destroyMethod = typeof(ToolBaseSystem).GetMethod("DestroyDefinitions", BindingFlags.Instance | BindingFlags.NonPublic);
                if (destroyMethod != null)
                {
                    _destroyDefinitionsDelegate = (DestroyDefinitionsDelegate)Delegate.CreateDelegate(typeof(DestroyDefinitionsDelegate), destroyMethod);
                }

                var applyModeSetter = typeof(ToolBaseSystem).GetProperty("applyMode", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)?.GetSetMethod(true);
                if (applyModeSetter != null)
                {
                    _setApplyModeDelegate = (Action<ToolBaseSystem, ApplyMode>)Delegate.CreateDelegate(typeof(Action<ToolBaseSystem, ApplyMode>), applyModeSetter);
                }
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"BamRepairSystem.OnCreate delegate init warning: {ex.Message}");
            }

            _definitionQuery = GetEntityQuery(ComponentType.ReadOnly<CreationDefinition>(), ComponentType.Exclude<Updated>());
            _tempQuery = GetEntityQuery(ComponentType.ReadOnly<Temp>(), ComponentType.Exclude<Deleted>());
            _placedBuildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Building>(), ComponentType.ReadOnly<PrefabRef>() },
                None = new[] { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Temp>() }
            });

            ComponentType[] damageAny =
            {
                ComponentType.ReadOnly<Destroyed>(),
                ComponentType.ReadOnly<Abandoned>(),
                ComponentType.ReadOnly<Condemned>(),
                ComponentType.ReadOnly<Damaged>(),
                ComponentType.ReadOnly<Game.Buildings.RescueTarget>(),
                ComponentType.ReadOnly<Game.Events.OnFire>(),
                ComponentType.ReadOnly<Game.Events.Flooded>(),
                ComponentType.ReadOnly<Game.Events.FacingWeather>(),
                ComponentType.ReadOnly<Game.Events.AccidentSite>()
            };
            ComponentType[] damageNone = { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Temp>() };

            _damagedRebuildQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Building>() },
                Any = damageAny,
                None = damageNone
            });

            _damagedExtensionQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Extension>() },
                Any = damageAny,
                None = damageNone
            });

            _damagedEfficiencyQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Building>(), ComponentType.ReadOnly<Efficiency>() },
                None = damageNone
            });

            _damagedExtensionEfficiencyQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Extension>(), ComponentType.ReadOnly<Efficiency>() },
                None = damageNone
            });

            _terrainSystem = World.GetOrCreateSystemManaged<TerrainSystem>();
            _waterSystem = World.GetOrCreateSystemManaged<WaterSystem>();

            _collapsedSurfaceQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<Game.Areas.Area>(),
                    ComponentType.ReadOnly<PrefabRef>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>(),
                    ComponentType.ReadOnly<Game.Areas.Lot>()
                }
            });

            _collapsedObjectQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<Game.Objects.Object>(),
                    ComponentType.ReadOnly<PrefabRef>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>()
                }
            });

            _onFireQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Game.Events.OnFire>() },
                None = damageNone
            });

            _accidentSiteQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Game.Events.AccidentSite>() },
                None = damageNone
            });

            _involvedInAccidentQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Game.Events.InvolvedInAccident>() },
                None = damageNone
            });

            _notificationIconQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<Game.Notifications.Icon>(),
                    ComponentType.ReadOnly<PrefabRef>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>()
                }
            });

            _staticInterpolatedBuildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<Game.Rendering.InterpolatedTransform>(),
                    ComponentType.ReadOnly<Game.Objects.Static>()
                },
                Any = new[]
                {
                    ComponentType.ReadOnly<Building>(),
                    ComponentType.ReadOnly<Extension>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>(),
                    ComponentType.ReadOnly<Game.Rendering.Swaying>()
                }
            });

            _buildingConfigQuery = GetEntityQuery(ComponentType.ReadOnly<BuildingConfigurationData>());
            _fireConfigQuery = GetEntityQuery(ComponentType.ReadOnly<FireConfigurationData>());
            _disasterConfigQuery = GetEntityQuery(ComponentType.ReadOnly<DisasterConfigurationData>());
            _policeConfigQuery = GetEntityQuery(ComponentType.ReadOnly<PoliceConfigurationData>());
            _trafficConfigQuery = GetEntityQuery(ComponentType.ReadOnly<TrafficConfigurationData>());
            _routeConfigQuery = GetEntityQuery(ComponentType.ReadOnly<RouteConfigurationData>());
        }

        protected override void OnDestroy()
        {
            if (_relocateControlPoints.IsCreated)
            {
                _relocateControlPoints.Dispose();
            }
            base.OnDestroy();
        }

        public void EnqueueRebuildBuilding(Entity entity, bool forceRelocate = false)
        {
            if (entity == Entity.Null) return;
            _rebuildQueue.Enqueue(new RebuildRequest { TargetEntity = entity, RebuildAll = false, ForceRelocate = forceRelocate });
        }

        public void EnqueueRebuildAll(string category)
        {
            _rebuildQueue.Enqueue(new RebuildRequest { TargetEntity = Entity.Null, RebuildAll = true, Category = category });
        }

        protected override void OnStopRunning()
        {
            while (_rebuildQueue.TryDequeue(out _)) { }
            if (_activeRelocateEntity != Entity.Null && EntityManager.Exists(_activeRelocateEntity))
            {
                RemoveHiddenIfPresent(EntityManager, _activeRelocateEntity);
            }
            _activeRelocateEntity = Entity.Null;
            _activeRelocateStage = 0;
            _relocateQueue.Clear();
            _relocateQueuedSet.Clear();
            _postRelocateCleanup.Clear();
            _postRepairRefreshFrames = 0;
            _artifactCache.Clear();
            base.OnStopRunning();
        }

        protected override void OnUpdate()
        {
            if (_updateSystem != null && _updateSystem.currentPhase == SystemUpdatePhase.ToolUpdate)
            {
                if (_activeRelocateEntity != Entity.Null || _relocateQueue.Count > 0)
                {
                    Mod.Log.Guard("BamRepairSystem.ProcessToolRelocateStep", ProcessToolRelocateStep);
                }
                return;
            }

            if (_postRepairRefreshFrames > 0)
            {
                _postRepairRefreshFrames--;
                if (_postRepairRefreshFrames == 0)
                {
                    _inventorySystem?.MarkDirty();
                    World.GetExistingSystemManaged<DistrictSystem>()?.MarkDirty();
                }
            }

            if (_rebuildQueue.IsEmpty && _postRelocateCleanup.Count == 0) return;

            Mod.Log.Guard("BamRepairSystem.OnUpdate", ProcessPendingRebuilds);
        }

        private static bool IsUnrelocatableCustomLotParent(EntityManager em, Entity entity)
        {
            if (entity == Entity.Null || !em.Exists(entity) || !em.HasComponent<PrefabRef>(entity))
                return false;

            var prefab = em.GetComponentData<PrefabRef>(entity).m_Prefab;
            if (prefab != Entity.Null && em.Exists(prefab) && em.HasComponent<PlaceholderBuildingData>(prefab))
            {
                return true;
            }
            return false;
        }

        private static void ResetBuildingRoadConnectionForReconnect(EntityManager em, Entity entity)
        {
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity) || !em.HasComponent<Building>(entity))
                return;

            var bldg = em.GetComponentData<Building>(entity);
            Entity oldRoad = bldg.m_RoadEdge;
            if (oldRoad != Entity.Null)
            {
                if (em.Exists(oldRoad) && !em.HasComponent<Deleted>(oldRoad) && em.HasBuffer<ConnectedBuilding>(oldRoad))
                {
                    var connected = em.GetBuffer<ConnectedBuilding>(oldRoad);
                    for (int i = connected.Length - 1; i >= 0; i--)
                    {
                        if (connected[i].m_Building == entity)
                        {
                            connected.RemoveAt(i);
                        }
                    }
                    if (!em.HasComponent<Game.Common.PathfindUpdated>(oldRoad))
                    {
                        em.AddComponent<Game.Common.PathfindUpdated>(oldRoad);
                    }
                }
                bldg.m_RoadEdge = Entity.Null;
                bldg.m_CurvePosition = 0f;
                em.SetComponentData(entity, bldg);
            }
        }

        private static void PrepareSingleBuildingForRelocateApply(EntityManager em, Entity entity)
        {
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity))
                return;

            ResetBuildingRoadConnectionForReconnect(em, entity);

            if (em.HasComponent<Game.Objects.Transform>(entity))
            {
                var tf = em.GetComponentData<Game.Objects.Transform>(entity);
                tf.m_Position.y += 0.0001f;
                em.SetComponentData(entity, tf);
            }

            if (em.HasBuffer<Game.Objects.SubObject>(entity))
            {
                var subObjects = em.GetBuffer<Game.Objects.SubObject>(entity, true);
                for (int i = 0; i < subObjects.Length; i++)
                {
                    var subObj = subObjects[i].m_SubObject;
                    if (subObj == Entity.Null || !em.Exists(subObj) || em.HasComponent<Deleted>(subObj))
                        continue;

                    if (em.HasComponent<Game.Objects.SpawnLocation>(subObj))
                    {
                        var sp = em.GetComponentData<Game.Objects.SpawnLocation>(subObj);
                        sp.m_ConnectedLane1 = Entity.Null;
                        sp.m_ConnectedLane2 = Entity.Null;
                        sp.m_CurvePosition1 = 0f;
                        sp.m_CurvePosition2 = 0f;
                        em.SetComponentData(subObj, sp);
                    }

                    if (!em.HasComponent<Building>(subObj) &&
                        !em.HasComponent<Game.Buildings.ServiceUpgrade>(subObj) &&
                        em.HasComponent<Game.Objects.Transform>(subObj))
                    {
                        var stf = em.GetComponentData<Game.Objects.Transform>(subObj);
                        stf.m_Position.y += 0.0001f;
                        em.SetComponentData(subObj, stf);
                    }
                }
            }

            if (em.HasBuffer<Game.Net.SubLane>(entity))
            {
                var subLanes = em.GetBuffer<Game.Net.SubLane>(entity, true);
                for (int i = 0; i < subLanes.Length; i++)
                {
                    var subLane = subLanes[i].m_SubLane;
                    if (subLane != Entity.Null && em.Exists(subLane) && !em.HasComponent<Deleted>(subLane) &&
                        em.HasComponent<Game.Net.LaneConnection>(subLane))
                    {
                        em.RemoveComponent<Game.Net.LaneConnection>(subLane);
                    }
                }
            }
        }

        private static void PrepareEntityForRelocateApply(EntityManager em, Entity root)
        {
            if (root == Entity.Null || !em.Exists(root) || em.HasComponent<Deleted>(root))
                return;

            PrepareSingleBuildingForRelocateApply(em, root);

            if (em.HasBuffer<InstalledUpgrade>(root))
            {
                var upgrades = em.GetBuffer<InstalledUpgrade>(root, true);
                for (int i = 0; i < upgrades.Length; i++)
                {
                    var upg = upgrades[i].m_Upgrade;
                    if (upg != Entity.Null && em.Exists(upg) && !em.HasComponent<Deleted>(upg))
                    {
                        PrepareSingleBuildingForRelocateApply(em, upg);
                    }
                }
            }
        }

        private void EnqueueRelocateBuilding(Entity entity)
        {
            var em = EntityManager;
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity) || em.HasComponent<Temp>(entity))
                return;

            Entity root = ResolveRepairTarget(entity);
            if (root != Entity.Null && em.Exists(root) && !em.HasComponent<Deleted>(root) && !em.HasComponent<Temp>(root) &&
                em.HasComponent<PrefabRef>(root) && em.HasComponent<Game.Objects.Transform>(root))
            {
                if (!IsUnrelocatableCustomLotParent(em, root))
                {
                    if (_relocateQueuedSet.Add(root))
                    {
                        _relocateQueue.Add(root);
                    }
                }

                if (em.HasComponent<Game.Objects.Attachment>(root))
                {
                    var attachedChild = em.GetComponentData<Game.Objects.Attachment>(root).m_Attached;
                    if (attachedChild != Entity.Null && em.Exists(attachedChild) &&
                        !em.HasComponent<Deleted>(attachedChild) && !em.HasComponent<Temp>(attachedChild) &&
                        em.HasComponent<Building>(attachedChild) && em.HasComponent<PrefabRef>(attachedChild) &&
                        em.HasComponent<Game.Objects.Transform>(attachedChild) &&
                        _relocateQueuedSet.Add(attachedChild))
                    {
                        _relocateQueue.Add(attachedChild);
                    }
                }
            }
        }

        private void ProcessToolRelocateStep()
        {
            if (_createDefinitionsDelegate == null || _destroyDefinitionsDelegate == null || _objectToolSystem == null || _toolOutputBarrier == null || _toolSystem == null)
            {
                _relocateQueue.Clear();
                _relocateQueuedSet.Clear();
                _activeRelocateEntity = Entity.Null;
                _activeRelocateStage = 0;
                return;
            }

            CompleteDependency();
            var em = EntityManager;

            if (_activeRelocateStage == 1)
            {
                _destroyDefinitionsDelegate(_objectToolSystem, _definitionQuery, _toolOutputBarrier, default).Complete();

                bool hasTemp = !_tempQuery.IsEmptyIgnoreFilter;
                if (hasTemp)
                {
                    using (var tempEntities = _tempQuery.ToEntityArray(Allocator.TempJob))
                    {
                        for (int i = 0; i < tempEntities.Length; i++)
                        {
                            var tEnt = tempEntities[i];
                            if (!em.Exists(tEnt) || !em.HasComponent<Temp>(tEnt)) continue;
                            var temp = em.GetComponentData<Temp>(tEnt);
                            if (temp.m_Cost != 0 || (temp.m_Flags & TempFlags.Cancel) != 0)
                            {
                                temp.m_Cost = 0;
                                temp.m_Flags &= ~TempFlags.Cancel;
                                em.SetComponentData(tEnt, temp);
                            }
                        }
                    }
                }

                if (hasTemp &&
                    _activeRelocateEntity != Entity.Null &&
                    em.Exists(_activeRelocateEntity) &&
                    !em.HasComponent<Deleted>(_activeRelocateEntity))
                {
                    PrepareEntityForRelocateApply(em, _activeRelocateEntity);
                    _terrainSystem?.OnBuildingMoved(_activeRelocateEntity);
                    if (_toolSystem.activeTool != null)
                    {
                        _setApplyModeDelegate?.Invoke(_toolSystem.activeTool, ApplyMode.Apply);
                    }
                    _postRelocateCleanup.Add(_activeRelocateEntity);
                    Mod.Log.Info($"Applied automated in-place Move/Relocate for building {_activeRelocateEntity.Index}:{_activeRelocateEntity.Version} (remaining={_relocateQueue.Count})");
                }
                else
                {
                    if (_activeRelocateEntity != Entity.Null && em.Exists(_activeRelocateEntity))
                    {
                        RemoveHiddenIfPresent(em, _activeRelocateEntity);
                    }
                    if (_toolSystem.activeTool != null)
                    {
                        _setApplyModeDelegate?.Invoke(_toolSystem.activeTool, ApplyMode.Clear);
                    }
                }

                _activeRelocateEntity = Entity.Null;
                _activeRelocateStage = 0;
                return;
            }

            Entity nextTarget = Entity.Null;
            while (_relocateQueue.Count > 0)
            {
                var candidate = _relocateQueue[0];
                _relocateQueue.RemoveAt(0);
                _relocateQueuedSet.Remove(candidate);
                if (candidate != Entity.Null &&
                    em.Exists(candidate) &&
                    !em.HasComponent<Deleted>(candidate) &&
                    !em.HasComponent<Temp>(candidate) &&
                    em.HasComponent<PrefabRef>(candidate) &&
                    em.HasComponent<Game.Objects.Transform>(candidate))
                {
                    nextTarget = candidate;
                    break;
                }
            }

            if (nextTarget == Entity.Null)
            {
                return;
            }

            _destroyDefinitionsDelegate(_objectToolSystem, _definitionQuery, _toolOutputBarrier, default).Complete();
            if (_toolSystem.activeTool != null)
            {
                _setApplyModeDelegate?.Invoke(_toolSystem.activeTool, ApplyMode.Clear);
            }

            var prefab = em.GetComponentData<PrefabRef>(nextTarget).m_Prefab;
            var transform = em.GetComponentData<Game.Objects.Transform>(nextTarget);
            float elevation = em.HasComponent<Game.Objects.Elevation>(nextTarget)
                ? em.GetComponentData<Game.Objects.Elevation>(nextTarget).m_Elevation
                : 0f;

            Entity originalParent = Entity.Null;
            if (em.HasComponent<Game.Objects.Attached>(nextTarget))
            {
                originalParent = em.GetComponentData<Game.Objects.Attached>(nextTarget).m_Parent;
            }

            _relocateControlPoints.Clear();
            _relocateControlPoints.Add(new ControlPoint
            {
                m_Position = transform.m_Position,
                m_HitPosition = transform.m_Position,
                m_Rotation = transform.m_Rotation,
                m_OriginalEntity = originalParent,
                m_Elevation = elevation
            });

            Entity theme = _cityConfigSystem != null ? _cityConfigSystem.defaultTheme : Entity.Null;
            bool leftHand = _cityConfigSystem != null && _cityConfigSystem.leftHandTraffic;

            var jobHandle = _createDefinitionsDelegate(
                _objectToolSystem,
                prefab,
                Entity.Null,
                Entity.Null,
                Entity.Null,
                nextTarget,
                Entity.Null,
                theme,
                _relocateControlPoints,
                default,
                false,
                leftHand,
                false,
                false,
                0f,
                0f,
                0f,
                0f,
                0f,
                RandomSeed.Next(),
                Snap.None,
                Game.Tools.AgeMask.Sapling,
                false,
                default,
                default);
            jobHandle.Complete();

            _activeRelocateEntity = nextTarget;
            _activeRelocateStage = 1;
        }

        private void ProcessPendingRebuilds()
        {
            // Finish pending simulation/reader jobs before structural ECS mutation in Modification1.
            CompleteDependency();

            if (Mod.Settings != null && !Mod.Settings.EnableBuildingRepairs)
            {
                while (_rebuildQueue.TryDequeue(out _)) { }
                _relocateQueue.Clear();
                _relocateQueuedSet.Clear();
                _postRelocateCleanup.Clear();
                Mod.Log.Info("Repair queue cleared: EnableBuildingRepairs is disabled in settings.");
                return;
            }

            var ctx = CreateRepairContext();
            bool changedAny = false;
            int requestCount = 0;

            if (_postRelocateCleanup.Count > 0)
            {
                for (int i = 0; i < _postRelocateCleanup.Count; i++)
                {
                    var relocated = _postRelocateCleanup[i];
                    if (relocated != Entity.Null &&
                        EntityManager.Exists(relocated) &&
                        !EntityManager.HasComponent<Deleted>(relocated) &&
                        !EntityManager.HasComponent<Temp>(relocated))
                    {
                        RebuildEntity(relocated, ctx);
                        MarkEntityUpdated(EntityManager, relocated);
                        changedAny = true;
                    }
                }
                _postRelocateCleanup.Clear();
            }

            while (_rebuildQueue.TryDequeue(out var req))
            {
                requestCount++;
                if (req.RebuildAll)
                {
                    changedAny |= RebuildAllDamaged(req.Category, ctx);
                }
                else if (req.TargetEntity != Entity.Null &&
                         EntityManager.Exists(req.TargetEntity) &&
                         !EntityManager.HasComponent<Deleted>(req.TargetEntity) &&
                         !EntityManager.HasComponent<Temp>(req.TargetEntity))
                {
                    bool needsPathRelocate = req.ForceRelocate || HasRepairNeedOrLeftovers(req.TargetEntity, "path", includeHierarchy: true);
                    changedAny |= RebuildEntity(req.TargetEntity, ctx);
                    if (needsPathRelocate)
                    {
                        EnqueueRelocateBuilding(req.TargetEntity);
                        changedAny = true;
                    }
                }
            }

            if (changedAny)
            {
                _inventorySystem?.MarkDirty();
                World.GetExistingSystemManaged<DistrictSystem>()?.MarkDirty();
                // Schedule a follow-up UI refresh after Modification2..End + simulation ticks update efficiency.
                _postRepairRefreshFrames = 3;
            }

            if (requestCount > 0)
            {
                Mod.Log.Info($"Repair queue processed in Modification1: requests={requestCount}, changed={changedAny}, relocatePending={_relocateQueue.Count}");
            }
        }

        private RepairArtifactSet GetArtifactSet()
        {
            var em = EntityManager;
            Entity bEnt = _buildingConfigQuery.IsEmptyIgnoreFilter ? Entity.Null : _buildingConfigQuery.GetSingletonEntity();
            Entity fEnt = _fireConfigQuery.IsEmptyIgnoreFilter ? Entity.Null : _fireConfigQuery.GetSingletonEntity();
            Entity dEnt = _disasterConfigQuery.IsEmptyIgnoreFilter ? Entity.Null : _disasterConfigQuery.GetSingletonEntity();
            Entity pEnt = _policeConfigQuery.IsEmptyIgnoreFilter ? Entity.Null : _policeConfigQuery.GetSingletonEntity();
            Entity tEnt = _trafficConfigQuery.IsEmptyIgnoreFilter ? Entity.Null : _trafficConfigQuery.GetSingletonEntity();
            Entity rEnt = _routeConfigQuery.IsEmptyIgnoreFilter ? Entity.Null : _routeConfigQuery.GetSingletonEntity();

            bool matchesCache =
                _artifactCache.BuildingConfigEntity == bEnt &&
                _artifactCache.FireConfigEntity == fEnt &&
                _artifactCache.DisasterConfigEntity == dEnt &&
                _artifactCache.PoliceConfigEntity == pEnt &&
                _artifactCache.TrafficConfigEntity == tEnt &&
                _artifactCache.RouteConfigEntity == rEnt &&
                (bEnt == Entity.Null || em.Exists(bEnt));

            if (matchesCache && _artifactCache.TriggerNotificationPrefabs.Count > 0)
            {
                return _artifactCache;
            }

            _artifactCache.Clear();
            _artifactCache.BuildingConfigEntity = bEnt;
            _artifactCache.FireConfigEntity = fEnt;
            _artifactCache.DisasterConfigEntity = dEnt;
            _artifactCache.PoliceConfigEntity = pEnt;
            _artifactCache.TrafficConfigEntity = tEnt;
            _artifactCache.RouteConfigEntity = rEnt;

            if (bEnt != Entity.Null)
            {
                var bCfg = em.GetComponentData<BuildingConfigurationData>(bEnt);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, bCfg.m_AbandonedCollapsedNotification, _artifactCache.CollapseNotificationPrefabs, _artifactCache.AbandonedNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, bCfg.m_AbandonedNotification, _artifactCache.AbandonedNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, bCfg.m_CondemnedNotification, _artifactCache.AbandonedNotificationPrefabs);
                AddValidEntity(_artifactCache.RepairNotificationPrefabs, bCfg.m_TurnedOffNotification);
                _artifactCache.TurnedOffNotification = bCfg.m_TurnedOffNotification;
                AddPrefabWithPlaceholders(em, _artifactCache.CollapsedSurfacePrefabs, bCfg.m_CollapsedSurface);
                AddPrefabWithPlaceholders(em, _artifactCache.CollapsedObjectPrefabs, bCfg.m_CollapsedObject);
            }
            if (fEnt != Entity.Null)
            {
                var fCfg = em.GetComponentData<FireConfigurationData>(fEnt);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, fCfg.m_FireNotificationPrefab, _artifactCache.FireNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, fCfg.m_BurnedDownNotificationPrefab, _artifactCache.FireNotificationPrefabs, _artifactCache.CollapseNotificationPrefabs);
            }
            if (dEnt != Entity.Null)
            {
                var dCfg = em.GetComponentData<DisasterConfigurationData>(dEnt);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, dCfg.m_WeatherDamageNotificationPrefab, _artifactCache.WeatherNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, dCfg.m_WeatherDestroyedNotificationPrefab, _artifactCache.WeatherNotificationPrefabs, _artifactCache.CollapseNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, dCfg.m_WaterDamageNotificationPrefab, _artifactCache.FloodNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, dCfg.m_WaterDestroyedNotificationPrefab, _artifactCache.FloodNotificationPrefabs, _artifactCache.CollapseNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, dCfg.m_DestroyedNotificationPrefab, _artifactCache.CollapseNotificationPrefabs);
            }
            if (pEnt != Entity.Null)
            {
                var pCfg = em.GetComponentData<PoliceConfigurationData>(pEnt);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, pCfg.m_TrafficAccidentNotificationPrefab, _artifactCache.AccidentNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, pCfg.m_CrimeSceneNotificationPrefab, _artifactCache.AccidentNotificationPrefabs);
            }
            if (tEnt != Entity.Null)
            {
                var tCfg = em.GetComponentData<TrafficConfigurationData>(tEnt);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_RoadConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_TrackConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_CarConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_ShipConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_TrainConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_PedestrianConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_BicycleConnectionNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_DeadEndNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, tCfg.m_BottleneckNotification, _artifactCache.PathNotificationPrefabs);
            }
            if (rEnt != Entity.Null)
            {
                var rCfg = em.GetComponentData<RouteConfigurationData>(rEnt);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, rCfg.m_PathfindNotification, _artifactCache.PathNotificationPrefabs);
                AddTriggerNotif(_artifactCache.TriggerNotificationPrefabs, _artifactCache.RepairNotificationPrefabs, rCfg.m_GateBypassNotification, _artifactCache.PathNotificationPrefabs);
            }

            return _artifactCache;
        }

        private RepairContext CreateRepairContext()
        {
            return new RepairContext(GetArtifactSet());
        }

        private static void AddTriggerNotif(
            HashSet<Entity> triggerSet,
            HashSet<Entity> repairSet,
            Entity prefab,
            HashSet<Entity> scopeSetA = null,
            HashSet<Entity> scopeSetB = null)
        {
            if (prefab == Entity.Null) return;
            triggerSet.Add(prefab);
            repairSet.Add(prefab);
            scopeSetA?.Add(prefab);
            scopeSetB?.Add(prefab);
        }

        private static void AddValidEntity(HashSet<Entity> set, Entity entity)
        {
            if (entity != Entity.Null) set.Add(entity);
        }

        private static void AddPrefabWithPlaceholders(EntityManager em, HashSet<Entity> set, Entity prefab)
        {
            if (prefab == Entity.Null || !em.Exists(prefab)) return;
            set.Add(prefab);
            if (em.HasBuffer<PlaceholderObjectElement>(prefab))
            {
                var buf = em.GetBuffer<PlaceholderObjectElement>(prefab, true);
                for (int i = 0; i < buf.Length; i++)
                {
                    if (buf[i].m_Object != Entity.Null)
                    {
                        set.Add(buf[i].m_Object);
                    }
                }
            }
        }

        private static void MarkEntityDeleted(EntityManager em, Entity entity)
        {
            if (entity != Entity.Null && em.Exists(entity) && !em.HasComponent<Deleted>(entity))
            {
                em.AddComponent<Deleted>(entity);
            }
        }

        private static void MarkEntityUpdated(EntityManager em, Entity entity)
        {
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity)) return;
            if (!em.HasComponent<Updated>(entity))
                em.AddComponent<Updated>(entity);
            if (!em.HasComponent<BatchesUpdated>(entity))
                em.AddComponent<BatchesUpdated>(entity);
            if (!em.HasComponent<Game.Common.PathfindUpdated>(entity))
                em.AddComponent<Game.Common.PathfindUpdated>(entity);
        }

        internal bool HasRepairNeedOrLeftovers(Entity entity, string scope = "all", bool includeHierarchy = true)
        {
            var em = EntityManager;
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity) || em.HasComponent<Temp>(entity))
                return false;

            var artifacts = GetArtifactSet();
            return includeHierarchy
                ? HasHierarchyRepairNeed(em, entity, scope, artifacts, 0)
                : HasDirectRepairNeedOrLeftovers(em, entity, scope, artifacts);
        }

        private bool HasHierarchyRepairNeed(EntityManager em, Entity entity, string scope, RepairArtifactSet artifacts, int depth)
        {
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity))
                return false;

            if (HasDirectRepairNeedOrLeftovers(em, entity, scope, artifacts))
                return true;

            if (depth >= 5) return false;

            if (em.HasComponent<Game.Objects.Attachment>(entity))
            {
                var attached = em.GetComponentData<Game.Objects.Attachment>(entity).m_Attached;
                if (attached != Entity.Null && attached != entity &&
                    HasHierarchyRepairNeed(em, attached, scope, artifacts, depth + 1))
                {
                    return true;
                }
            }

            if (em.HasBuffer<InstalledUpgrade>(entity))
            {
                var upgrades = em.GetBuffer<InstalledUpgrade>(entity, true);
                for (int i = 0; i < upgrades.Length; i++)
                {
                    var upg = upgrades[i].m_Upgrade;
                    if (upg != Entity.Null && upg != entity &&
                        HasHierarchyRepairNeed(em, upg, scope, artifacts, depth + 1))
                    {
                        return true;
                    }
                }
            }

            if (em.HasBuffer<Game.Objects.SubObject>(entity))
            {
                var subObjects = em.GetBuffer<Game.Objects.SubObject>(entity, true);
                for (int i = 0; i < subObjects.Length; i++)
                {
                    var subObj = subObjects[i].m_SubObject;
                    if (subObj != Entity.Null && subObj != entity &&
                        HasHierarchyRepairNeed(em, subObj, scope, artifacts, depth + 1))
                    {
                        return true;
                    }
                }
            }

            if (em.HasBuffer<Game.Net.SubNet>(entity))
            {
                var subNets = em.GetBuffer<Game.Net.SubNet>(entity, true);
                for (int i = 0; i < subNets.Length; i++)
                {
                    var subNet = subNets[i].m_SubNet;
                    if (subNet != Entity.Null && subNet != entity &&
                        HasHierarchyRepairNeed(em, subNet, scope, artifacts, depth + 1))
                    {
                        return true;
                    }
                }
            }

            if (em.HasBuffer<Game.Areas.SubArea>(entity))
            {
                var subAreas = em.GetBuffer<Game.Areas.SubArea>(entity, true);
                for (int i = 0; i < subAreas.Length; i++)
                {
                    var subArea = subAreas[i].m_Area;
                    if (subArea != Entity.Null && subArea != entity &&
                        HasHierarchyRepairNeed(em, subArea, scope, artifacts, depth + 1))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private bool HasDirectRepairNeedOrLeftovers(EntityManager em, Entity ent, string scope, RepairArtifactSet artifacts)
        {
            if (ent == Entity.Null || !em.Exists(ent) || em.HasComponent<Deleted>(ent))
                return false;

            bool matchAll = string.IsNullOrEmpty(scope) || scope.Equals("all", StringComparison.OrdinalIgnoreCase);
            bool checkCollapse = matchAll || scope.Equals("collapse", StringComparison.OrdinalIgnoreCase);

            if (matchAll)
            {
                if (em.HasComponent<Destroyed>(ent) ||
                    em.HasComponent<Game.Buildings.RescueTarget>(ent) ||
                    em.HasComponent<Abandoned>(ent) ||
                    em.HasComponent<Condemned>(ent) ||
                    em.HasComponent<Game.Events.OnFire>(ent) ||
                    em.HasComponent<Game.Events.Flooded>(ent) ||
                    em.HasComponent<Game.Events.FacingWeather>(ent) ||
                    em.HasComponent<Game.Events.AccidentSite>(ent) ||
                    HasNonZeroDamage(em, ent))
                {
                    return true;
                }
            }
            else if (MatchesDisasterScope(ent, scope))
            {
                return true;
            }

            if (HasMatchingDamagedEfficiency(ent, scope))
                return true;

            if (em.HasBuffer<IconElement>(ent))
            {
                var icons = em.GetBuffer<IconElement>(ent, true);
                for (int i = 0; i < icons.Length; i++)
                {
                    var iconEnt = icons[i].m_Icon;
                    if (iconEnt == Entity.Null || !em.Exists(iconEnt) || em.HasComponent<Deleted>(iconEnt) || !em.HasComponent<PrefabRef>(iconEnt))
                        continue;
                    if (artifacts.MatchesNotificationScope(em.GetComponentData<PrefabRef>(iconEnt).m_Prefab, scope))
                        return true;
                }
            }

            if (checkCollapse)
            {
                if (artifacts.CollapsedObjectPrefabs.Count > 0 && em.HasBuffer<Game.Objects.SubObject>(ent))
                {
                    var subObjects = em.GetBuffer<Game.Objects.SubObject>(ent, true);
                    for (int i = 0; i < subObjects.Length; i++)
                    {
                        var subObj = subObjects[i].m_SubObject;
                        if (subObj != Entity.Null && em.Exists(subObj) && !em.HasComponent<Deleted>(subObj) &&
                            em.HasComponent<PrefabRef>(subObj) &&
                            artifacts.CollapsedObjectPrefabs.Contains(em.GetComponentData<PrefabRef>(subObj).m_Prefab))
                        {
                            return true;
                        }
                    }
                }

                if (artifacts.CollapsedSurfacePrefabs.Count > 0 && em.HasBuffer<Game.Areas.SubArea>(ent))
                {
                    var subAreas = em.GetBuffer<Game.Areas.SubArea>(ent, true);
                    for (int i = 0; i < subAreas.Length; i++)
                    {
                        var areaEnt = subAreas[i].m_Area;
                        if (areaEnt != Entity.Null && em.Exists(areaEnt) && !em.HasComponent<Deleted>(areaEnt) &&
                            !em.HasComponent<Game.Areas.Lot>(areaEnt) &&
                            em.HasComponent<PrefabRef>(areaEnt) &&
                            artifacts.CollapsedSurfacePrefabs.Contains(em.GetComponentData<PrefabRef>(areaEnt).m_Prefab))
                        {
                            return true;
                        }
                    }
                }

                if (IsOrphanedCollapsedInterpolatedBuilding(em, ent))
                    return true;
            }

            return false;
        }

        private static bool HasNonZeroDamage(EntityManager em, Entity ent)
        {
            if (!em.HasComponent<Damaged>(ent)) return false;
            var d = em.GetComponentData<Damaged>(ent).m_Damage;
            return d.x > 0.0001f || d.y > 0.0001f || d.z > 0.0001f;
        }

        private static bool IsOrphanedCollapsedInterpolatedBuilding(EntityManager em, Entity ent)
        {
            if (!em.HasComponent<Game.Rendering.InterpolatedTransform>(ent) ||
                !em.HasComponent<Game.Objects.Static>(ent) ||
                !em.HasComponent<Game.Objects.Transform>(ent) ||
                em.HasComponent<Game.Rendering.Swaying>(ent) ||
                em.HasComponent<Game.Objects.Relative>(ent) ||
                em.HasBuffer<TransformFrame>(ent))
            {
                return false;
            }

            if (!em.HasComponent<Building>(ent) && !em.HasComponent<Extension>(ent))
                return false;

            var tf = em.GetComponentData<Game.Objects.Transform>(ent);
            var interp = em.GetComponentData<Game.Rendering.InterpolatedTransform>(ent);
            return math.distancesq(interp.m_Position, tf.m_Position) > 0.0025f;
        }

        private static bool IsBuildingIntentionallyDisabled(EntityManager em, Entity entity)
        {
            if (em.HasComponent<Building>(entity) &&
                BuildingUtils.CheckOption(em.GetComponentData<Building>(entity), BuildingOption.Inactive))
            {
                return true;
            }
            if (em.HasComponent<Extension>(entity) &&
                (em.GetComponentData<Extension>(entity).m_Flags & ExtensionFlags.Disabled) != 0)
            {
                return true;
            }
            return false;
        }

        private static bool RemoveHiddenIfPresent(EntityManager em, Entity entity)
        {
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity) || !em.HasComponent<Game.Tools.Hidden>(entity))
                return false;
            em.RemoveComponent<Game.Tools.Hidden>(entity);
            if (!em.HasComponent<BatchesUpdated>(entity))
                em.AddComponent<BatchesUpdated>(entity);
            return true;
        }

        private void EnsureTerrainData(RepairContext ctx)
        {
            if (!ctx.HasTerrainData && _terrainSystem != null)
            {
                ctx.TerrainData = _terrainSystem.GetHeightData(waitForPending: true);
                ctx.HasTerrainData = true;
            }
        }

        private void EnsureWaterData(RepairContext ctx)
        {
            if (!ctx.HasWaterData && _waterSystem != null)
            {
                ctx.WaterData = _waterSystem.GetSurfaceData(out var deps);
                deps.Complete();
                _waterSystem.AddSurfaceReader(default);
                ctx.HasWaterData = true;
            }
        }

        private static int GetFirstNodeIndex(DynamicBuffer<SubAreaNode> nodes, int2 range)
        {
            int result = range.x;
            float minDist = float.MaxValue;
            for (int i = range.x; i < range.y; i++)
            {
                int nextIdx = math.select(i + 1, range.x, i + 1 == range.y);
                float dist = Colossal.Mathematics.MathUtils.Distance(
                    new Colossal.Mathematics.Line2.Segment(nodes[i].m_Position.xz, nodes[nextIdx].m_Position.xz),
                    default(float2),
                    out float _);
                if (dist < minDist)
                {
                    result = i;
                    minDist = dist;
                }
            }
            return result;
        }

        private static void RemoveUpgradeClearedSpaceSubAreas(EntityManager em, Entity entity, ref bool modified)
        {
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity) ||
                !em.HasBuffer<InstalledUpgrade>(entity) || !em.HasBuffer<Game.Areas.SubArea>(entity))
            {
                return;
            }

            var clearTriangles = new List<Colossal.Mathematics.Triangle2>();
            var upgrades = em.GetBuffer<InstalledUpgrade>(entity, true);
            for (int u = 0; u < upgrades.Length; u++)
            {
                var upg = upgrades[u].m_Upgrade;
                if (upg == Entity.Null || !em.Exists(upg) || em.HasComponent<Deleted>(upg) || !em.HasBuffer<Game.Areas.SubArea>(upg))
                    continue;

                var upgSubAreas = em.GetBuffer<Game.Areas.SubArea>(upg, true);
                for (int i = 0; i < upgSubAreas.Length; i++)
                {
                    var clearArea = upgSubAreas[i].m_Area;
                    if (clearArea == Entity.Null || !em.Exists(clearArea) || em.HasComponent<Deleted>(clearArea) ||
                        !em.HasComponent<Game.Areas.Clear>(clearArea) ||
                        !em.HasBuffer<Game.Areas.Node>(clearArea) ||
                        !em.HasBuffer<Game.Areas.Triangle>(clearArea))
                    {
                        continue;
                    }

                    var cNodes = em.GetBuffer<Game.Areas.Node>(clearArea, true);
                    var cTris = em.GetBuffer<Game.Areas.Triangle>(clearArea, true);
                    for (int t = 0; t < cTris.Length; t++)
                    {
                        clearTriangles.Add(Game.Areas.AreaUtils.GetTriangle2(cNodes, cTris[t]));
                    }
                }
            }

            if (clearTriangles.Count == 0)
                return;

            var toDeleteAreas = new List<Entity>();
            var subAreas = em.GetBuffer<Game.Areas.SubArea>(entity);
            for (int i = subAreas.Length - 1; i >= 0; i--)
            {
                var areaEnt = subAreas[i].m_Area;
                if (areaEnt == Entity.Null || !em.Exists(areaEnt) || em.HasComponent<Deleted>(areaEnt) ||
                    em.HasComponent<Game.Areas.Lot>(areaEnt) || !em.HasComponent<Game.Areas.Space>(areaEnt) ||
                    !em.HasBuffer<Game.Areas.Node>(areaEnt))
                {
                    continue;
                }

                bool overlapsClear = false;
                var sNodes = em.GetBuffer<Game.Areas.Node>(areaEnt, true);
                if (em.HasBuffer<Game.Areas.Triangle>(areaEnt))
                {
                    var sTris = em.GetBuffer<Game.Areas.Triangle>(areaEnt, true);
                    for (int st = 0; st < sTris.Length && !overlapsClear; st++)
                    {
                        var spaceTri = Game.Areas.AreaUtils.GetTriangle2(sNodes, sTris[st]);
                        for (int ct = 0; ct < clearTriangles.Count; ct++)
                        {
                            if (Colossal.Mathematics.MathUtils.Intersect(spaceTri, clearTriangles[ct]))
                            {
                                overlapsClear = true;
                                break;
                            }
                        }
                    }
                }

                if (!overlapsClear)
                {
                    for (int sn = 0; sn < sNodes.Length && !overlapsClear; sn++)
                    {
                        float2 pt = sNodes[sn].m_Position.xz;
                        for (int ct = 0; ct < clearTriangles.Count; ct++)
                        {
                            if (Colossal.Mathematics.MathUtils.Intersect(clearTriangles[ct], pt, out _))
                            {
                                overlapsClear = true;
                                break;
                            }
                        }
                    }
                }

                if (overlapsClear)
                {
                    toDeleteAreas.Add(areaEnt);
                    subAreas.RemoveAt(i);
                    modified = true;
                }
            }

            for (int i = 0; i < toDeleteAreas.Count; i++)
            {
                var areaEnt = toDeleteAreas[i];
                if (em.HasBuffer<Game.Net.SubLane>(areaEnt))
                {
                    var lanes = em.GetBuffer<Game.Net.SubLane>(areaEnt, true);
                    var laneList = new List<Entity>(lanes.Length);
                    for (int l = 0; l < lanes.Length; l++)
                    {
                        if (lanes[l].m_SubLane != Entity.Null)
                            laneList.Add(lanes[l].m_SubLane);
                    }
                    for (int l = 0; l < laneList.Count; l++)
                    {
                        MarkEntityDeleted(em, laneList[l]);
                    }
                }
                MarkEntityDeleted(em, areaEnt);
            }
        }

        private void RestoreMissingClipAndSpaceSubAreas(EntityManager em, Entity entity, RepairContext ctx, ref bool modified)
        {
            if (!em.HasComponent<Building>(entity) && !em.HasComponent<Extension>(entity))
                return;
            if (!em.HasComponent<PrefabRef>(entity) || !em.HasComponent<Game.Objects.Transform>(entity))
                return;

            var prefab = em.GetComponentData<PrefabRef>(entity).m_Prefab;
            if (prefab == Entity.Null || !em.Exists(prefab) ||
                !em.HasBuffer<Game.Prefabs.SubArea>(prefab) ||
                !em.HasBuffer<SubAreaNode>(prefab))
            {
                return;
            }

            var prefabSubAreas = em.GetBuffer<Game.Prefabs.SubArea>(prefab, true);
            var prefabSubAreaNodes = em.GetBuffer<SubAreaNode>(prefab, true);
            if (prefabSubAreas.Length == 0 || prefabSubAreaNodes.Length == 0)
                return;

            var existingCounts = new Dictionary<Entity, int>();
            if (em.HasBuffer<Game.Areas.SubArea>(entity))
            {
                var curSubAreas = em.GetBuffer<Game.Areas.SubArea>(entity, true);
                for (int i = 0; i < curSubAreas.Length; i++)
                {
                    var areaEnt = curSubAreas[i].m_Area;
                    if (areaEnt == Entity.Null || !em.Exists(areaEnt) || em.HasComponent<Deleted>(areaEnt) || !em.HasComponent<PrefabRef>(areaEnt))
                        continue;
                    var existingPrefab = em.GetComponentData<PrefabRef>(areaEnt).m_Prefab;
                    if (existingPrefab == Entity.Null) continue;
                    existingCounts.TryGetValue(existingPrefab, out int count);
                    existingCounts[existingPrefab] = count + 1;
                }
            }

            // Copy definitions out before any structural EntityManager.CreateEntity call invalidates DynamicBuffers.
            var toCreate = new List<(Entity areaPrefab, AreaGeometryData geom, List<SubAreaNode> nodes)>();
            for (int i = 0; i < prefabSubAreas.Length; i++)
            {
                var sa = prefabSubAreas[i];
                if (sa.m_Prefab == Entity.Null || !em.Exists(sa.m_Prefab)) continue;
                int nodeCount = sa.m_NodeRange.y - sa.m_NodeRange.x;
                if (nodeCount < 3 || sa.m_NodeRange.x < 0 || sa.m_NodeRange.y > prefabSubAreaNodes.Length) continue;

                // Resolve placeholder container if any, matching existing counts against candidates first.
                Entity matchedExistingPrefab = Entity.Null;
                Entity resolvedPrefab = sa.m_Prefab;
                if (em.HasBuffer<PlaceholderObjectElement>(sa.m_Prefab))
                {
                    var placeholders = em.GetBuffer<PlaceholderObjectElement>(sa.m_Prefab, true);
                    Entity firstValid = Entity.Null;
                    for (int p = 0; p < placeholders.Length; p++)
                    {
                        var cand = placeholders[p].m_Object;
                        if (cand == Entity.Null || !em.Exists(cand)) continue;
                        if (firstValid == Entity.Null) firstValid = cand;
                        if (existingCounts.TryGetValue(cand, out int cnt) && cnt > 0)
                        {
                            matchedExistingPrefab = cand;
                            break;
                        }
                    }
                    if (firstValid != Entity.Null) resolvedPrefab = firstValid;
                }
                else if (existingCounts.TryGetValue(sa.m_Prefab, out int cnt) && cnt > 0)
                {
                    matchedExistingPrefab = sa.m_Prefab;
                }

                if (matchedExistingPrefab != Entity.Null)
                {
                    existingCounts[matchedExistingPrefab] = existingCounts[matchedExistingPrefab] - 1;
                    continue;
                }

                if (!em.HasComponent<AreaGeometryData>(resolvedPrefab) || !em.HasComponent<AreaData>(resolvedPrefab))
                    continue;

                var geom = em.GetComponentData<AreaGeometryData>(resolvedPrefab);
                bool isClip = (geom.m_Flags & Game.Areas.GeometryFlags.ClipTerrain) != 0;
                bool isSpace = geom.m_Type == Game.Areas.AreaType.Space;
                if (geom.m_Type == Game.Areas.AreaType.Lot || (!isClip && !isSpace))
                    continue;

                var copiedNodes = new List<SubAreaNode>(nodeCount);
                int idx = GetFirstNodeIndex(prefabSubAreaNodes, sa.m_NodeRange);
                bool hasAnyGroundNode = false;
                for (int n = 0; n < nodeCount; n++)
                {
                    var sNode = prefabSubAreaNodes[idx];
                    if (sNode.m_ParentMesh < 0)
                    {
                        hasAnyGroundNode = true;
                    }
                    copiedNodes.Add(sNode);
                    if (++idx == sa.m_NodeRange.y) idx = sa.m_NodeRange.x;
                }

                // DestroySystem only deletes Clip areas and elevated Space areas (!IsAnyOnGround).
                // Never restore ground-level Space areas, as those are intentionally cleared by InstalledUpgrades.
                if (isSpace && hasAnyGroundNode)
                    continue;

                toCreate.Add((resolvedPrefab, geom, copiedNodes));
            }

            if (toCreate.Count == 0) return;

            var ownerTransform = em.GetComponentData<Game.Objects.Transform>(entity);
            bool isNative = em.HasComponent<Native>(entity);
            if (!em.HasBuffer<Game.Areas.SubArea>(entity))
            {
                em.AddBuffer<Game.Areas.SubArea>(entity);
            }

            for (int c = 0; c < toCreate.Count; c++)
            {
                var (areaPrefab, geom, nodes) = toCreate[c];
                var areaData = em.GetComponentData<AreaData>(areaPrefab);
                var areaEnt = em.CreateEntity(areaData.m_Archetype);
                em.SetComponentData(areaEnt, new PrefabRef(areaPrefab));

                if (em.HasComponent<Owner>(areaEnt))
                    em.SetComponentData(areaEnt, new Owner(entity));
                else
                    em.AddComponentData(areaEnt, new Owner(entity));

                if (isNative && !em.HasComponent<Native>(areaEnt))
                    em.AddComponent<Native>(areaEnt);

                if (em.HasComponent<Game.Areas.Area>(areaEnt))
                    em.SetComponentData(areaEnt, new Game.Areas.Area(Game.Areas.AreaFlags.Complete));
                else
                    em.AddComponentData(areaEnt, new Game.Areas.Area(Game.Areas.AreaFlags.Complete));

                if (!em.HasComponent<Created>(areaEnt))
                    em.AddComponent<Created>(areaEnt);
                if (!em.HasComponent<Updated>(areaEnt))
                    em.AddComponent<Updated>(areaEnt);

                var areaNodes = em.HasBuffer<Game.Areas.Node>(areaEnt)
                    ? em.GetBuffer<Game.Areas.Node>(areaEnt)
                    : em.AddBuffer<Game.Areas.Node>(areaEnt);
                areaNodes.Clear();

                bool onWater = (geom.m_Flags & Game.Areas.GeometryFlags.OnWaterSurface) != 0;
                for (int n = 0; n < nodes.Count; n++)
                {
                    var src = nodes[n];
                    float3 worldPos = ObjectUtils.LocalToWorld(ownerTransform, src.m_Position);
                    float elevation = src.m_ParentMesh >= 0 ? src.m_Position.y : float.MinValue;
                    var node = new Game.Areas.Node(worldPos, elevation);
                    if (elevation == float.MinValue)
                    {
                        if (onWater)
                        {
                            EnsureTerrainData(ctx);
                            EnsureWaterData(ctx);
                            if (ctx.HasTerrainData && ctx.HasWaterData)
                                node = Game.Areas.AreaUtils.AdjustPosition(node, ref ctx.TerrainData, ref ctx.WaterData);
                        }
                        else
                        {
                            EnsureTerrainData(ctx);
                            if (ctx.HasTerrainData)
                                node = Game.Areas.AreaUtils.AdjustPosition(node, ref ctx.TerrainData);
                        }
                    }
                    areaNodes.Add(node);
                }

                em.GetBuffer<Game.Areas.SubArea>(entity).Add(new Game.Areas.SubArea(areaEnt));
                modified = true;
            }
        }

        private static void DetachOrDeleteEvent(EntityManager em, Entity eventEntity, Entity targetEntity)
        {
            if (eventEntity == Entity.Null || !em.Exists(eventEntity) || em.HasComponent<Deleted>(eventEntity)) return;

            bool remainingTargets = false;
            if (em.HasBuffer<Game.Events.TargetElement>(eventEntity))
            {
                var targets = em.GetBuffer<Game.Events.TargetElement>(eventEntity);
                for (int i = targets.Length - 1; i >= 0; i--)
                {
                    if (targets[i].m_Entity == targetEntity || !em.Exists(targets[i].m_Entity))
                    {
                        targets.RemoveAt(i);
                    }
                }
                remainingTargets = targets.Length > 0;
            }

            // Never delete active map-wide disaster generators (WeatherPhenomenon / WaterLevelChange / Flood),
            // and never delete shared events (e.g. spreading Fire) while other targets still reference them.
            bool isGlobalDisaster =
                em.HasComponent<Game.Events.WeatherPhenomenon>(eventEntity) ||
                em.HasComponent<Game.Events.WaterLevelChange>(eventEntity) ||
                em.HasComponent<Game.Events.Flood>(eventEntity);

            if (!isGlobalDisaster && !remainingTargets)
            {
                MarkEntityDeleted(em, eventEntity);
            }
        }

        private bool RebuildEntity(Entity root, RepairContext ctx)
        {
            if (Mod.Settings != null && !Mod.Settings.EnableBuildingRepairs) return false;

            var em = EntityManager;
            var processed = new HashSet<Entity>();
            var pending = new List<Entity>(8);
            var enqueued = new HashSet<Entity>();

            // If renter, extension, attached child, or owned member, normalize to the root building/property.
            Entity target = ResolveRepairTarget(root);
            if (target == Entity.Null || !em.Exists(target) || em.HasComponent<Deleted>(target) || em.HasComponent<Temp>(target))
                return false;

            bool modified = false;
            pending.Add(target);
            enqueued.Add(target);

            for (int cursor = 0; cursor < pending.Count; cursor++)
            {
                var current = pending[cursor];
                if (current == Entity.Null || !em.Exists(current) || em.HasComponent<Deleted>(current)) continue;

                // Enqueue attached children (modular lots/extractors) and non-collapsed sub-objects BEFORE cleanup.
                if (em.HasComponent<Game.Objects.Attachment>(current))
                {
                    var attached = em.GetComponentData<Game.Objects.Attachment>(current).m_Attached;
                    if (attached != Entity.Null && em.Exists(attached) && !em.HasComponent<Deleted>(attached) && enqueued.Add(attached))
                    {
                        pending.Add(attached);
                    }
                }

                if (em.HasBuffer<Game.Objects.SubObject>(current))
                {
                    var subBuffer = em.GetBuffer<Game.Objects.SubObject>(current, true);
                    for (int i = 0; i < subBuffer.Length; i++)
                    {
                        var sub = subBuffer[i].m_SubObject;
                        if (sub == Entity.Null || !em.Exists(sub) || em.HasComponent<Deleted>(sub)) continue;
                        if (ctx.CollapsedObjectPrefabs != null &&
                            ctx.CollapsedObjectPrefabs.Count > 0 &&
                            em.HasComponent<PrefabRef>(sub) &&
                            ctx.CollapsedObjectPrefabs.Contains(em.GetComponentData<PrefabRef>(sub).m_Prefab))
                        {
                            continue;
                        }
                        if (enqueued.Add(sub))
                        {
                            pending.Add(sub);
                        }
                    }
                }

                if (em.HasBuffer<InstalledUpgrade>(current))
                {
                    var upgBuffer = em.GetBuffer<InstalledUpgrade>(current, true);
                    for (int i = 0; i < upgBuffer.Length; i++)
                    {
                        var upg = upgBuffer[i].m_Upgrade;
                        if (upg != Entity.Null && em.Exists(upg) && !em.HasComponent<Deleted>(upg) && enqueued.Add(upg))
                        {
                            pending.Add(upg);
                        }
                    }
                }

                // Traverse non-lot, non-collapsed SubAreas (e.g. Extractor fields/trees) so fires/damage inside them clear cleanly.
                if (em.HasBuffer<Game.Areas.SubArea>(current))
                {
                    var subAreaBuf = em.GetBuffer<Game.Areas.SubArea>(current, true);
                    for (int i = 0; i < subAreaBuf.Length; i++)
                    {
                        var areaEnt = subAreaBuf[i].m_Area;
                        if (areaEnt == Entity.Null || !em.Exists(areaEnt) || em.HasComponent<Deleted>(areaEnt)) continue;
                        if (em.HasComponent<Game.Areas.Lot>(areaEnt)) continue;
                        if (ctx.CollapsedSurfacePrefabs != null &&
                            ctx.CollapsedSurfacePrefabs.Count > 0 &&
                            em.HasComponent<PrefabRef>(areaEnt) &&
                            ctx.CollapsedSurfacePrefabs.Contains(em.GetComponentData<PrefabRef>(areaEnt).m_Prefab))
                        {
                            continue;
                        }
                        if (enqueued.Add(areaEnt))
                        {
                            pending.Add(areaEnt);
                        }
                    }
                }

                // Traverse building/area SubNets and SubLanes so internal paths, driveways, and pathfinding connections restore cleanly.
                if (em.HasBuffer<Game.Net.SubNet>(current))
                {
                    var subNetBuf = em.GetBuffer<Game.Net.SubNet>(current, true);
                    for (int i = 0; i < subNetBuf.Length; i++)
                    {
                        var subNet = subNetBuf[i].m_SubNet;
                        if (subNet != Entity.Null && em.Exists(subNet) && !em.HasComponent<Deleted>(subNet) && enqueued.Add(subNet))
                        {
                            pending.Add(subNet);
                        }
                    }
                }

                if (em.HasBuffer<Game.Net.SubLane>(current))
                {
                    var subLaneBuf = em.GetBuffer<Game.Net.SubLane>(current, true);
                    for (int i = 0; i < subLaneBuf.Length; i++)
                    {
                        var subLane = subLaneBuf[i].m_SubLane;
                        if (subLane != Entity.Null && em.Exists(subLane) && !em.HasComponent<Deleted>(subLane) && enqueued.Add(subLane))
                        {
                            pending.Add(subLane);
                        }
                    }
                }

                bool itemModified = RebuildSingleEntity(current, processed, ctx);
                modified |= itemModified;
            }

            if (modified)
            {
                // Marking target Updated in Modification1 causes Game.Buildings.InitializeSystem (Modification2)
                // to restore ElectricityConsumer, WaterConsumer, GarbageProducer, MailProducer, and notify
                // power/water road edges without needing to force Updated onto the road segment itself.
                MarkEntityUpdated(em, target);

                for (int i = 1; i < pending.Count; i++)
                {
                    var child = pending[i];
                    if (child != Entity.Null && em.Exists(child) && !em.HasComponent<Deleted>(child))
                    {
                        MarkEntityUpdated(em, child);
                    }
                }

                if (em.HasComponent<Building>(target))
                {
                    var roadEdge = em.GetComponentData<Building>(target).m_RoadEdge;
                    if (roadEdge != Entity.Null && em.Exists(roadEdge) && !em.HasComponent<Deleted>(roadEdge) &&
                        !em.HasComponent<Game.Common.PathfindUpdated>(roadEdge))
                    {
                        em.AddComponent<Game.Common.PathfindUpdated>(roadEdge);
                    }
                }
            }

            return modified;
        }

        private bool RebuildSingleEntity(Entity entity, HashSet<Entity> processed, RepairContext ctx)
        {
            var em = EntityManager;
            if (entity == Entity.Null || !em.Exists(entity) || em.HasComponent<Deleted>(entity) || !processed.Add(entity))
                return false;

            bool modified = false;
            bool wasDestroyed = em.HasComponent<Destroyed>(entity);

            // 1. Destroyed component & safe event detachment
            if (wasDestroyed)
            {
                var destroyed = em.GetComponentData<Destroyed>(entity);
                DetachOrDeleteEvent(em, destroyed.m_Event, entity);
                em.RemoveComponent<Destroyed>(entity);
                modified = true;
            }

            // 2. RescueTarget cleanup: FireRescueDispatchSystem.ValidateTarget cancels orphaned requests safely
            if (em.HasComponent<Game.Buildings.RescueTarget>(entity))
            {
                em.RemoveComponent<Game.Buildings.RescueTarget>(entity);
                modified = true;
            }

            // 3. Clear and remove structural damage vector
            if (em.HasComponent<Damaged>(entity))
            {
                em.SetComponentData(entity, new Damaged { m_Damage = Unity.Mathematics.float3.zero });
                em.RemoveComponent<Damaged>(entity);
                modified = true;
            }

            // 4. Remove abandoned and condemned states
            if (em.HasComponent<Abandoned>(entity))
            {
                em.RemoveComponent<Abandoned>(entity);
                modified = true;
            }
            if (em.HasComponent<Condemned>(entity))
            {
                em.RemoveComponent<Condemned>(entity);
                modified = true;
            }

            // 5. Extinguish fire, flood, storm weather, or accident directly on entity;
            //    vanilla dispatch systems destroy orphaned FireRescueRequest / PoliceEmergencyRequest cleanly.
            if (em.HasComponent<Game.Events.OnFire>(entity))
            {
                var onFire = em.GetComponentData<Game.Events.OnFire>(entity);
                DetachOrDeleteEvent(em, onFire.m_Event, entity);
                em.RemoveComponent<Game.Events.OnFire>(entity);
                modified = true;
            }
            for (int i = 0; i < OptionalDamageComponents.Length; i++)
            {
                modified |= RemoveOptionalComponentByName(em, entity, OptionalDamageComponents[i]);
            }
            if (em.HasComponent<Game.Events.Flooded>(entity))
            {
                var flooded = em.GetComponentData<Game.Events.Flooded>(entity);
                DetachOrDeleteEvent(em, flooded.m_Event, entity);
                em.RemoveComponent<Game.Events.Flooded>(entity);
                modified = true;
            }
            if (em.HasComponent<Game.Events.FacingWeather>(entity))
            {
                var weather = em.GetComponentData<Game.Events.FacingWeather>(entity);
                DetachOrDeleteEvent(em, weather.m_Event, entity);
                em.RemoveComponent<Game.Events.FacingWeather>(entity);
                modified = true;
            }
            if (em.HasComponent<Game.Events.AccidentSite>(entity))
            {
                var accident = em.GetComponentData<Game.Events.AccidentSite>(entity);
                DetachOrDeleteEvent(em, accident.m_Event, entity);
                em.RemoveComponent<Game.Events.AccidentSite>(entity);
                modified = true;
            }
            if (em.HasComponent<Game.Events.InvolvedInAccident>(entity))
            {
                var involved = em.GetComponentData<Game.Events.InvolvedInAccident>(entity);
                DetachOrDeleteEvent(em, involved.m_Event, entity);
                em.RemoveComponent<Game.Events.InvolvedInAccident>(entity);
                modified = true;
            }

            // 6. Restore healthy positive BuildingCondition so building does not relapse into abandonment
            if (em.HasComponent<BuildingCondition>(entity))
            {
                var cond = em.GetComponentData<BuildingCondition>(entity);
                const int healthyMinCondition = 10000;
                if (cond.m_Condition < healthyMinCondition)
                {
                    cond.m_Condition = healthyMinCondition;
                    em.SetComponentData(entity, cond);
                    modified = true;
                }
            }

            // 7. Return empty un-abandoned zone/signature properties to market so tenants/companies can move back in
            if (!em.HasComponent<Destroyed>(entity) &&
                !em.HasComponent<Abandoned>(entity) &&
                !em.HasComponent<Condemned>(entity) &&
                !em.HasComponent<PropertyOnMarket>(entity) &&
                !em.HasComponent<PropertyToBeOnMarket>(entity) &&
                em.HasBuffer<Renter>(entity) &&
                em.HasComponent<PrefabRef>(entity))
            {
                Entity pRef = em.GetComponentData<PrefabRef>(entity).m_Prefab;
                if (pRef != Entity.Null && em.Exists(pRef) && em.HasComponent<BuildingPropertyData>(pRef))
                {
                    int cap = em.GetComponentData<BuildingPropertyData>(pRef).CountProperties();
                    if (em.GetBuffer<Renter>(entity, true).Length < cap)
                    {
                        em.AddComponent<PropertyToBeOnMarket>(entity);
                        modified = true;
                    }
                }
            }

            // 8. Clear stale disaster/abandoned EfficiencyFactor penalties without touching player BuildingOption.Inactive
            if (em.HasBuffer<Efficiency>(entity))
            {
                var effBuf = em.GetBuffer<Efficiency>(entity);
                bool hasPenalty = false;
                for (int i = 0; i < effBuf.Length; i++)
                {
                    var factor = effBuf[i].m_Factor;
                    if ((factor == EfficiencyFactor.Destroyed ||
                         factor == EfficiencyFactor.Abandoned ||
                         factor == EfficiencyFactor.Fire) &&
                        effBuf[i].m_Efficiency < 0.999f)
                    {
                        hasPenalty = true;
                        break;
                    }
                }
                if (hasPenalty)
                {
                    BuildingUtils.SetEfficiencyFactor(effBuf, EfficiencyFactor.Destroyed, 1f);
                    BuildingUtils.SetEfficiencyFactor(effBuf, EfficiencyFactor.Abandoned, 1f);
                    BuildingUtils.SetEfficiencyFactor(effBuf, EfficiencyFactor.Fire, 1f);
                    modified = true;
                }
            }

            // 9. Immediately delete floating disaster/abandoned/condemned/accident notification icons (mirrors ApplyNotificationsSystem)
            //    so broken icons clear cleanly even while paused or partially repaired.
            if (em.HasBuffer<IconElement>(entity))
            {
                var iconElems = em.GetBuffer<IconElement>(entity);
                bool preserveTurnedOff = IsBuildingIntentionallyDisabled(em, entity);
                bool removedAnyIcon = false;

                for (int i = iconElems.Length - 1; i >= 0; i--)
                {
                    var iconEnt = iconElems[i].m_Icon;
                    if (iconEnt == Entity.Null || !em.Exists(iconEnt) || em.HasComponent<Deleted>(iconEnt))
                    {
                        iconElems.RemoveAt(i);
                        removedAnyIcon = true;
                        continue;
                    }

                    if (!em.HasComponent<PrefabRef>(iconEnt)) continue;
                    var notifPrefab = em.GetComponentData<PrefabRef>(iconEnt).m_Prefab;
                    if (notifPrefab == ctx.TurnedOffNotification && preserveTurnedOff) continue;
                    if (ctx.RepairNotificationPrefabs == null || !ctx.RepairNotificationPrefabs.Contains(notifPrefab)) continue;

                    MarkEntityDeleted(em, iconEnt);
                    iconElems.RemoveAt(i);
                    removedAnyIcon = true;
                    modified = true;
                }

                if (removedAnyIcon && iconElems.Length == 0)
                {
                    em.RemoveComponent<IconElement>(entity);
                }
            }

            // 9b. Clear Hidden flag, abandoned facade dirtiness (Surface.m_Dirtyness), and revive dead/stump sub-trees.
            if (RemoveHiddenIfPresent(em, entity))
            {
                modified = true;
            }

            if (em.HasComponent<Game.Objects.Surface>(entity))
            {
                var surface = em.GetComponentData<Game.Objects.Surface>(entity);
                if (surface.m_Dirtyness != 0)
                {
                    surface.m_Dirtyness = 0;
                    em.SetComponentData(entity, surface);
                    modified = true;
                }
            }

            if (em.HasComponent<Game.Objects.Tree>(entity))
            {
                var tree = em.GetComponentData<Game.Objects.Tree>(entity);
                if ((tree.m_State & (Game.Objects.TreeState.Dead | Game.Objects.TreeState.Stump | Game.Objects.TreeState.Collected)) != 0)
                {
                    tree.m_State &= ~(Game.Objects.TreeState.Dead | Game.Objects.TreeState.Stump | Game.Objects.TreeState.Collected);
                    if ((tree.m_State & (Game.Objects.TreeState.Teen | Game.Objects.TreeState.Adult | Game.Objects.TreeState.Elderly)) == 0)
                    {
                        tree.m_State |= Game.Objects.TreeState.Adult;
                    }
                    tree.m_Growth = 0;
                    em.SetComponentData(entity, tree);
                    modified = true;
                }
            }

            // 10. Remove collapse animation transform from static/stopped entities
            //     before PreCullingSystem builds frame culling flags (mirrors ApplyObjectsSystem).
            if (em.HasComponent<Game.Rendering.InterpolatedTransform>(entity) &&
                ((em.HasComponent<Game.Objects.Static>(entity) &&
                  !em.HasComponent<Game.Rendering.Swaying>(entity) &&
                  !em.HasComponent<Game.Objects.Relative>(entity) &&
                  !em.HasBuffer<TransformFrame>(entity)) ||
                 em.HasComponent<Stopped>(entity)))
            {
                em.RemoveComponent<Game.Rendering.InterpolatedTransform>(entity);
                modified = true;
            }

            // 11. Remove collapsed rubble objects/surfaces spawned by DestroySystem,
            //     restore deleted Clip/Space sub-areas, ensure SubObject respawning, and refresh valid sub-areas.
            //     Never touch Game.Areas.Lot entities; never add Updated to Deleted entities.
            if (em.HasBuffer<Game.Objects.SubObject>(entity))
            {
                var subObjects = em.GetBuffer<Game.Objects.SubObject>(entity);
                for (int i = subObjects.Length - 1; i >= 0; i--)
                {
                    var subObj = subObjects[i].m_SubObject;
                    if (subObj == Entity.Null || !em.Exists(subObj))
                    {
                        subObjects.RemoveAt(i);
                        modified = true;
                    }
                    else if (ctx.CollapsedObjectPrefabs != null &&
                             ctx.CollapsedObjectPrefabs.Count > 0 &&
                             em.HasComponent<PrefabRef>(subObj) &&
                             ctx.CollapsedObjectPrefabs.Contains(em.GetComponentData<PrefabRef>(subObj).m_Prefab))
                    {
                        MarkEntityDeleted(em, subObj);
                        subObjects.RemoveAt(i);
                        modified = true;
                    }
                    else if (RemoveHiddenIfPresent(em, subObj))
                    {
                        MarkEntityUpdated(em, subObj);
                        modified = true;
                    }
                }
            }
            else if (em.HasComponent<PrefabRef>(entity) &&
                     (em.HasComponent<Building>(entity) || em.HasComponent<Extension>(entity)))
            {
                var prefab = em.GetComponentData<PrefabRef>(entity).m_Prefab;
                if (prefab != Entity.Null && em.Exists(prefab) &&
                    em.HasBuffer<Game.Prefabs.SubObject>(prefab) &&
                    em.GetBuffer<Game.Prefabs.SubObject>(prefab, true).Length > 0)
                {
                    em.AddBuffer<Game.Objects.SubObject>(entity);
                    modified = true;
                }
            }

            if (em.HasBuffer<Game.Areas.SubArea>(entity))
            {
                var subAreas = em.GetBuffer<Game.Areas.SubArea>(entity);
                for (int i = subAreas.Length - 1; i >= 0; i--)
                {
                    var areaEnt = subAreas[i].m_Area;
                    if (areaEnt == Entity.Null || !em.Exists(areaEnt))
                    {
                        subAreas.RemoveAt(i);
                        modified = true;
                    }
                    else if (!em.HasComponent<Game.Areas.Lot>(areaEnt) &&
                             ctx.CollapsedSurfacePrefabs != null &&
                             ctx.CollapsedSurfacePrefabs.Count > 0 &&
                             em.HasComponent<PrefabRef>(areaEnt) &&
                             ctx.CollapsedSurfacePrefabs.Contains(em.GetComponentData<PrefabRef>(areaEnt).m_Prefab))
                    {
                        MarkEntityDeleted(em, areaEnt);
                        subAreas.RemoveAt(i);
                        modified = true;
                    }
                    else
                    {
                        if (RemoveHiddenIfPresent(em, areaEnt))
                        {
                            modified = true;
                        }
                        if (modified && !em.HasComponent<Deleted>(areaEnt) && !em.HasComponent<Updated>(areaEnt))
                        {
                            em.AddComponent<Updated>(areaEnt);
                        }
                    }
                }
            }

            RemoveUpgradeClearedSpaceSubAreas(em, entity, ref modified);

            if (wasDestroyed)
            {
                RestoreMissingClipAndSpaceSubAreas(em, entity, ctx, ref modified);
            }

            if (modified)
            {
                MarkEntityUpdated(em, entity);
            }

            return modified;
        }

        private Entity ResolveRepairTarget(Entity entity)
        {
            var em = EntityManager;
            if (entity == Entity.Null || !em.Exists(entity)) return entity;

            Entity current = entity;
            bool advanced;
            int depth = 0;

            do
            {
                advanced = false;
                if (++depth > 16) break;

                if (em.HasComponent<PropertyRenter>(current))
                {
                    var renter = em.GetComponentData<PropertyRenter>(current);
                    if (renter.m_Property != Entity.Null && em.Exists(renter.m_Property) && renter.m_Property != current)
                    {
                        current = renter.m_Property;
                        advanced = true;
                        continue;
                    }
                }

                if (em.HasComponent<Owner>(current))
                {
                    var owner = em.GetComponentData<Owner>(current).m_Owner;
                    if (owner != Entity.Null && em.Exists(owner) && owner != current)
                    {
                        current = owner;
                        advanced = true;
                        continue;
                    }
                }

                if (em.HasComponent<Game.Objects.Attached>(current))
                {
                    var parent = em.GetComponentData<Game.Objects.Attached>(current).m_Parent;
                    if (parent != Entity.Null &&
                        em.Exists(parent) &&
                        parent != current &&
                        !em.HasComponent<Game.Net.Edge>(parent) &&
                        !em.HasComponent<Game.Net.Node>(parent) &&
                        (em.HasComponent<Building>(parent) ||
                         em.HasComponent<Extension>(parent) ||
                         em.HasComponent<Game.Objects.Attachment>(parent)))
                    {
                        current = parent;
                        advanced = true;
                    }
                }
            }
            while (advanced);

            return current;
        }

        private bool RemoveOptionalComponentByName(EntityManager em, Entity entity, string fullTypeName)
        {
            if (entity == Entity.Null || !em.Exists(entity) || string.IsNullOrEmpty(fullTypeName)) return false;

            if (!_cachedComponentTypes.TryGetValue(fullTypeName, out var type))
            {
                type = ResolveTypeByName(fullTypeName);
                _cachedComponentTypes[fullTypeName] = type;
            }

            if (type == null) return false;

            var componentType = ComponentType.ReadWrite(type);
            if (!em.HasComponent(entity, componentType)) return false;

            em.RemoveComponent(entity, componentType);
            return true;
        }

        private static Type ResolveTypeByName(string fullTypeName)
        {
            var type = Type.GetType(fullTypeName, false);
            if (type != null) return type;

            var assemblies = AppDomain.CurrentDomain.GetAssemblies();
            for (int i = 0; i < assemblies.Length; i++)
            {
                Assembly asm = assemblies[i];
                if (asm == null) continue;
                type = asm.GetType(fullTypeName, false, false);
                if (type != null) return type;
            }

            return null;
        }

        private bool RebuildAllDamaged(string category, RepairContext ctx)
        {
            if (Mod.Settings != null && !Mod.Settings.EnableBuildingRepairs) return false;

            var em = EntityManager;
            var targets = new HashSet<Entity>();
            var pendingOwnedCollapsed = new List<(Entity entity, Entity root)>();
            int orphanCleanupCount = 0;
            bool any = false;

            CollectMatchingTargets(_damagedRebuildQuery, category, targets);
            CollectMatchingTargets(_damagedExtensionQuery, category, targets);
            CollectMatchingEfficiencyTargets(_damagedEfficiencyQuery, category, targets);
            CollectMatchingEfficiencyTargets(_damagedExtensionEfficiencyQuery, category, targets);

            CollectOrphanOrNotificationTargets(category, ctx, targets, pendingOwnedCollapsed, ref orphanCleanupCount, ref any);

            int repairedCount = 0;
            bool isAllScope = string.IsNullOrEmpty(category) || category.Equals("all", StringComparison.OrdinalIgnoreCase);
            bool isPathScope = category != null && category.Equals("path", StringComparison.OrdinalIgnoreCase);
            bool isFireScope = isAllScope || category.Equals("fire", StringComparison.OrdinalIgnoreCase);
            bool isAccidentScope = isAllScope || category.Equals("accident", StringComparison.OrdinalIgnoreCase);
            var directNonBuildingProcessed = new HashSet<Entity>();

            if (isFireScope)
            {
                CollectOrRepairNonBuildingEntities(_onFireQuery, targets, directNonBuildingProcessed, ctx, ref repairedCount, ref any);
            }
            if (isAccidentScope)
            {
                CollectOrRepairNonBuildingEntities(_accidentSiteQuery, targets, directNonBuildingProcessed, ctx, ref repairedCount, ref any);
                CollectOrRepairNonBuildingEntities(_involvedInAccidentQuery, targets, directNonBuildingProcessed, ctx, ref repairedCount, ref any);
            }

            foreach (var target in targets)
            {
                bool needsPathRelocate = isPathScope || (isAllScope && HasRepairNeedOrLeftovers(target, "path", includeHierarchy: true));
                if (RebuildEntity(target, ctx))
                {
                    any = true;
                    repairedCount++;
                }
                if (needsPathRelocate)
                {
                    EnqueueRelocateBuilding(target);
                    any = true;
                }
            }

            // Catch any collapsed rubble/surface owned by a targeted building whose SubObject/SubArea buffer link was missing.
            for (int i = 0; i < pendingOwnedCollapsed.Count; i++)
            {
                var (collapsedEnt, root) = pendingOwnedCollapsed[i];
                if (collapsedEnt != Entity.Null && em.Exists(collapsedEnt) && !em.HasComponent<Deleted>(collapsedEnt))
                {
                    MarkEntityDeleted(em, collapsedEnt);
                    MarkEntityUpdated(em, root);
                    orphanCleanupCount++;
                    any = true;
                }
            }

            Mod.Log.Info($"RebuildAllDamaged(scope='{category}'): candidates={targets.Count}, repaired={repairedCount}, orphansCleaned={orphanCleanupCount}, relocateQueued={_relocateQueue.Count}");
            return any;
        }

        private void CollectOrphanOrNotificationTargets(
            string category,
            RepairContext ctx,
            HashSet<Entity> targets,
            List<(Entity entity, Entity root)> pendingOwnedCollapsed,
            ref int orphanCleanupCount,
            ref bool any)
        {
            var em = EntityManager;
            bool matchAll = string.IsNullOrEmpty(category) || category.Equals("all", StringComparison.OrdinalIgnoreCase);
            bool checkCollapse = matchAll || category.Equals("collapse", StringComparison.OrdinalIgnoreCase);

            using (var iconEntities = _notificationIconQuery.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < iconEntities.Length; i++)
                {
                    var iconEnt = iconEntities[i];
                    if (!em.HasComponent<PrefabRef>(iconEnt)) continue;
                    var notifPrefab = em.GetComponentData<PrefabRef>(iconEnt).m_Prefab;
                    if (!ctx.Artifacts.MatchesNotificationScope(notifPrefab, category)) continue;

                    if (!em.HasComponent<Owner>(iconEnt))
                    {
                        MarkEntityDeleted(em, iconEnt);
                        orphanCleanupCount++;
                        any = true;
                        continue;
                    }

                    var owner = em.GetComponentData<Owner>(iconEnt).m_Owner;
                    if (owner == Entity.Null || !em.Exists(owner) || em.HasComponent<Deleted>(owner))
                    {
                        MarkEntityDeleted(em, iconEnt);
                        orphanCleanupCount++;
                        any = true;
                        continue;
                    }

                    var root = ResolveRepairTarget(owner);
                    if (root != Entity.Null && em.Exists(root) && !em.HasComponent<Deleted>(root) && !em.HasComponent<Temp>(root) &&
                        (em.HasComponent<Building>(root) || em.HasComponent<Extension>(root)))
                    {
                        targets.Add(root);
                    }
                    else if (em.HasComponent<Game.Common.Target>(iconEnt))
                    {
                        var tgt = em.GetComponentData<Game.Common.Target>(iconEnt).m_Target;
                        var tgtRoot = ResolveRepairTarget(tgt);
                        if (tgtRoot != Entity.Null && em.Exists(tgtRoot) && !em.HasComponent<Deleted>(tgtRoot) && !em.HasComponent<Temp>(tgtRoot) &&
                            (em.HasComponent<Building>(tgtRoot) || em.HasComponent<Extension>(tgtRoot)))
                        {
                            targets.Add(tgtRoot);
                        }
                    }
                }
            }

            if (!checkCollapse) return;

            CollectCollapsedEntities(_collapsedSurfaceQuery, ctx.CollapsedSurfacePrefabs, targets, pendingOwnedCollapsed, ref orphanCleanupCount, ref any);
            CollectCollapsedEntities(_collapsedObjectQuery, ctx.CollapsedObjectPrefabs, targets, pendingOwnedCollapsed, ref orphanCleanupCount, ref any);

            using (var interpEntities = _staticInterpolatedBuildingQuery.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < interpEntities.Length; i++)
                {
                    var ent = interpEntities[i];
                    if (!IsOrphanedCollapsedInterpolatedBuilding(em, ent)) continue;
                    var root = ResolveRepairTarget(ent);
                    if (root != Entity.Null && em.Exists(root) && !em.HasComponent<Deleted>(root) && !em.HasComponent<Temp>(root) &&
                        (em.HasComponent<Building>(root) || em.HasComponent<Extension>(root)))
                    {
                        targets.Add(root);
                    }
                }
            }
        }

        private void CollectCollapsedEntities(
            EntityQuery query,
            HashSet<Entity> prefabSet,
            HashSet<Entity> targets,
            List<(Entity entity, Entity root)> pendingOwnedCollapsed,
            ref int orphanCleanupCount,
            ref bool any)
        {
            if (prefabSet == null || prefabSet.Count == 0) return;

            var em = EntityManager;
            using (var entities = query.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var collapsedEnt = entities[i];
                    if (!em.HasComponent<PrefabRef>(collapsedEnt)) continue;
                    var prefab = em.GetComponentData<PrefabRef>(collapsedEnt).m_Prefab;
                    if (!prefabSet.Contains(prefab)) continue;

                    if (!em.HasComponent<Owner>(collapsedEnt))
                    {
                        MarkEntityDeleted(em, collapsedEnt);
                        orphanCleanupCount++;
                        any = true;
                        continue;
                    }

                    var owner = em.GetComponentData<Owner>(collapsedEnt).m_Owner;
                    if (owner == Entity.Null || !em.Exists(owner) || em.HasComponent<Deleted>(owner))
                    {
                        MarkEntityDeleted(em, collapsedEnt);
                        orphanCleanupCount++;
                        any = true;
                        continue;
                    }

                    var root = ResolveRepairTarget(owner);
                    if (root != Entity.Null && em.Exists(root) && !em.HasComponent<Deleted>(root) && !em.HasComponent<Temp>(root) &&
                        (em.HasComponent<Building>(root) || em.HasComponent<Extension>(root)))
                    {
                        targets.Add(root);
                        pendingOwnedCollapsed.Add((collapsedEnt, root));
                    }
                }
            }
        }

        private void CollectOrRepairNonBuildingEntities(
            EntityQuery query,
            HashSet<Entity> buildingTargets,
            HashSet<Entity> directProcessed,
            RepairContext ctx,
            ref int repairedCount,
            ref bool any)
        {
            var em = EntityManager;
            using (var entities = query.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var ent = entities[i];
                    if (ent == Entity.Null || !em.Exists(ent) || em.HasComponent<Deleted>(ent) || em.HasComponent<Temp>(ent))
                        continue;

                    var root = ResolveRepairTarget(ent);
                    if (root != Entity.Null && em.Exists(root) && !em.HasComponent<Deleted>(root) && !em.HasComponent<Temp>(root) &&
                        (em.HasComponent<Building>(root) || em.HasComponent<Extension>(root)))
                    {
                        buildingTargets.Add(root);
                        if (ent != root && RebuildSingleEntity(ent, directProcessed, ctx))
                        {
                            MarkEntityUpdated(em, ent);
                            MarkEntityUpdated(em, root);
                            repairedCount++;
                            any = true;
                        }
                    }
                    else if (RebuildSingleEntity(ent, directProcessed, ctx))
                    {
                        MarkEntityUpdated(em, ent);
                        repairedCount++;
                        any = true;
                    }
                }
            }
        }

        private void CollectMatchingTargets(EntityQuery query, string category, HashSet<Entity> targets)
        {
            using (var entities = query.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var entity = entities[i];
                    if (MatchesDisasterScope(entity, category))
                    {
                        var root = ResolveRepairTarget(entity);
                        if (root != Entity.Null && EntityManager.Exists(root))
                        {
                            targets.Add(root);
                        }
                    }
                }
            }
        }

        private void CollectMatchingEfficiencyTargets(EntityQuery query, string category, HashSet<Entity> targets)
        {
            using (var entities = query.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var entity = entities[i];
                    if (HasMatchingDamagedEfficiency(entity, category))
                    {
                        var root = ResolveRepairTarget(entity);
                        if (root != Entity.Null && EntityManager.Exists(root))
                        {
                            targets.Add(root);
                        }
                    }
                }
            }
        }

        private bool HasMatchingDamagedEfficiency(Entity entity, string scope)
        {
            if (!EntityManager.HasBuffer<Efficiency>(entity)) return false;

            bool matchAll = string.IsNullOrEmpty(scope) || scope.Equals("all", StringComparison.OrdinalIgnoreCase);
            bool matchFire = matchAll || scope.Equals("fire", StringComparison.OrdinalIgnoreCase);
            bool matchDestroyed = matchAll || scope.Equals("collapse", StringComparison.OrdinalIgnoreCase);
            bool matchAbandoned = matchAll || scope.Equals("abandoned", StringComparison.OrdinalIgnoreCase);
            if (!matchFire && !matchDestroyed && !matchAbandoned) return false;

            var effBuf = EntityManager.GetBuffer<Efficiency>(entity, true);
            for (int i = 0; i < effBuf.Length; i++)
            {
                if (effBuf[i].m_Efficiency >= 0.999f) continue;
                var factor = effBuf[i].m_Factor;
                if ((matchDestroyed && factor == EfficiencyFactor.Destroyed) ||
                    (matchAbandoned && factor == EfficiencyFactor.Abandoned) ||
                    (matchFire && factor == EfficiencyFactor.Fire))
                {
                    return true;
                }
            }
            return false;
        }

        private bool MatchesDisasterScope(Entity entity, string scope)
        {
            if (string.IsNullOrEmpty(scope) || scope.Equals("all", StringComparison.OrdinalIgnoreCase))
                return true;

            var em = EntityManager;
            Entity evt = Entity.Null;
            if (em.HasComponent<Destroyed>(entity))
            {
                evt = em.GetComponentData<Destroyed>(entity).m_Event;
            }

            bool hasMatchingIcon = false;
            if (em.HasBuffer<IconElement>(entity))
            {
                var artifacts = GetArtifactSet();
                var icons = em.GetBuffer<IconElement>(entity, true);
                for (int i = 0; i < icons.Length; i++)
                {
                    var iconEnt = icons[i].m_Icon;
                    if (iconEnt == Entity.Null || !em.Exists(iconEnt) || em.HasComponent<Deleted>(iconEnt) || !em.HasComponent<PrefabRef>(iconEnt))
                        continue;
                    if (artifacts.MatchesNotificationScope(em.GetComponentData<PrefabRef>(iconEnt).m_Prefab, scope))
                    {
                        hasMatchingIcon = true;
                        break;
                    }
                }
            }

            switch (scope.ToLowerInvariant())
            {
                case "fire":
                    return hasMatchingIcon ||
                           em.HasComponent<Game.Events.OnFire>(entity) ||
                           (evt != Entity.Null && em.Exists(evt) && (em.HasComponent<Game.Events.OnFire>(evt) || em.HasComponent<Game.Events.Fire>(evt)));

                case "flood":
                    return hasMatchingIcon ||
                           em.HasComponent<Game.Events.Flooded>(entity) ||
                           (evt != Entity.Null && em.Exists(evt) &&
                            (em.HasComponent<Game.Events.Flooded>(evt) ||
                             em.HasComponent<Game.Events.Flood>(evt) ||
                             em.HasComponent<Game.Events.WaterLevelChange>(evt)));

                case "weather":
                    return hasMatchingIcon ||
                           em.HasComponent<Game.Events.FacingWeather>(entity) ||
                           (evt != Entity.Null && em.Exists(evt) &&
                            (em.HasComponent<Game.Events.FacingWeather>(evt) ||
                             em.HasComponent<Game.Events.WeatherPhenomenon>(evt)));

                case "accident":
                    return hasMatchingIcon ||
                           em.HasComponent<Game.Events.AccidentSite>(entity) ||
                           (evt != Entity.Null && em.Exists(evt) && em.HasComponent<Game.Events.AccidentSite>(evt));

                case "collapse":
                    return hasMatchingIcon ||
                           em.HasComponent<Destroyed>(entity) ||
                           HasNonZeroDamage(em, entity) ||
                           IsOrphanedCollapsedInterpolatedBuilding(em, entity);

                case "abandoned":
                    return hasMatchingIcon ||
                           em.HasComponent<Abandoned>(entity) ||
                           em.HasComponent<Condemned>(entity);

                case "path":
                    return hasMatchingIcon;

                default:
                    return true;
            }
        }
    }
}

