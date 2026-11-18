using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Reflection;
using Colossal.UI.Binding;
using Game;
using Game.Areas;
using Game.Buildings;
using Game.Citizens;
using Game.City;
using Game.Common;
using Game.Companies;
using Game.Economy;
using Game.Net;
using Game.Policies;
using Game.Prefabs;
using Game.Simulation;
using Game.Tools;
using Game.UI;
using Game.UI.InGame;
using Unity.Collections;
using Unity.Entities;
using AdvancedBAM.Systems.Dtos;
using AdvancedBAM.Utilities;

namespace AdvancedBAM.Systems
{
    /// <summary>
    /// Scans districts, aggregates demographic and building metrics per district,
    /// and exposes policy toggles and slider adjustments via ECS Game.Policies.Modify events.
    /// </summary>
    public partial class DistrictSystem : UISystemBase
    {
        private EntityQuery _districtQuery;
        private EntityQuery _buildingQuery;
        private EntityQuery _subBuildingQuery;
        private EntityQuery _policyPrefabQuery;
        private EntityQuery _happinessFactorParamQuery;
        private EntityQuery _happinessParamQuery;
        private EntityQuery _touristHouseholdQuery;
        private EntityQuery _homelessHouseholdQuery;

        private EntityArchetype _policyEventArchetype;
        private EndFrameBarrier _endFrameBarrier;
        private CitySystem _citySystem;
        private CityConfigurationSystem _cityConfigurationSystem;
        private NameSystem _nameSystem;
        private PrefabSystem _prefabSystem;
        private BamWindowSystem _windowSystem;
        private CountHouseholdDataSystem _countHouseholdDataSystem;
        private AverageHappinessSection _avgHappinessSection;
        private EducationInfoviewUISystem _educationInfoview;
        private WorkplacesInfoviewUISystem _workplacesInfoview;
        private PopulationInfoviewUISystem _populationInfoview;
        private CitizenHappinessSystem _citizenHappinessSystem;
        private ResourceSystem _resourceSystem;
        private SimulationSystem _simulationSystem;

        public static DistrictSystem Instance { get; private set; }

        private ValueBinding<string> _districtsBinding;
        private ValueBinding<string> _policiesBinding;

        private static readonly PropertyInfo s_avgHappinessSelectedEntityProp =
            typeof(AverageHappinessSection).GetProperty("selectedEntity", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
        private static readonly FieldInfo s_avgHappinessFactorsField =
            typeof(AverageHappinessSection).GetField("<happinessFactors>k__BackingField", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);

        private bool _dirty = true;
        private bool _logPopVerifyOnRebuild;
        private bool _policiesPushed;
        private float _secondsSinceRefresh;
        private float _secondsSinceLastCompletedScan = 100f;
        private float _initialOpenDelay;
        private string _lastDistrictsJson;
        private string _lastPolicyMetaJson;
        private string _lastPopVerifySummary = string.Empty;

        private struct PolicyRequest
        {
            public Entity DistrictEntity;
            public Entity PolicyEntity;
            public bool Active;
            public float Adjustment;
            public bool IsCity;
        }

        private readonly ConcurrentQueue<PolicyRequest> _pendingPolicyRequests = new ConcurrentQueue<PolicyRequest>();

        private readonly List<DistrictVm> _districtRows = new List<DistrictVm>(64);
        private readonly List<DistrictPolicyMetaVm> _policyMetaRows = new List<DistrictPolicyMetaVm>(64);
        private readonly Dictionary<Entity, DistrictVm> _districtMapScratch = new Dictionary<Entity, DistrictVm>(64);
        private readonly List<DistrictVm> _districtListScratch = new List<DistrictVm>(64);
        private readonly HashSet<Entity> _seenSubWorkplacesScratch = new HashSet<Entity>();
        private readonly HashSet<Entity> _seenHouseholdsScratch = new HashSet<Entity>();

        protected override void OnCreate()
        {
            base.OnCreate();
            Instance = this;

            _citySystem = World.GetOrCreateSystemManaged<CitySystem>();
            _cityConfigurationSystem = World.GetOrCreateSystemManaged<CityConfigurationSystem>();
            _nameSystem = World.GetOrCreateSystemManaged<NameSystem>();
            _prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
            _endFrameBarrier = World.GetOrCreateSystemManaged<EndFrameBarrier>();
            _windowSystem = World.GetOrCreateSystemManaged<BamWindowSystem>();
            try { _countHouseholdDataSystem = World.GetOrCreateSystemManaged<CountHouseholdDataSystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional CountHouseholdDataSystem: {ex.Message}"); }
            try { _avgHappinessSection = World.GetOrCreateSystemManaged<AverageHappinessSection>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional AverageHappinessSection: {ex.Message}"); }
            try { _educationInfoview = World.GetOrCreateSystemManaged<EducationInfoviewUISystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional EducationInfoviewUISystem: {ex.Message}"); }
            try { _workplacesInfoview = World.GetOrCreateSystemManaged<WorkplacesInfoviewUISystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional WorkplacesInfoviewUISystem: {ex.Message}"); }
            try { _populationInfoview = World.GetOrCreateSystemManaged<PopulationInfoviewUISystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional PopulationInfoviewUISystem: {ex.Message}"); }
            try { _citizenHappinessSystem = World.GetOrCreateSystemManaged<CitizenHappinessSystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional CitizenHappinessSystem: {ex.Message}"); }
            try { _resourceSystem = World.GetOrCreateSystemManaged<ResourceSystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional ResourceSystem: {ex.Message}"); }
            try { _simulationSystem = World.GetOrCreateSystemManaged<SimulationSystem>(); } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: optional SimulationSystem: {ex.Message}"); }

            _districtQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<District>() },
                None = new[] { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Temp>() }
            });

            _buildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Building>(), ComponentType.ReadOnly<PrefabRef>() },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>(),
                    ComponentType.ReadOnly<Game.Common.Owner>(),
                    ComponentType.ReadOnly<Game.Buildings.ServiceUpgrade>(),
                    ComponentType.ReadOnly<Game.Buildings.Extension>()
                }
            });

            _policyPrefabQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new ComponentType[]
                {
                    ComponentType.ReadOnly<PolicyData>(),
                    ComponentType.ReadOnly<PrefabData>()
                },
                Any = new ComponentType[]
                {
                    ComponentType.ReadOnly<DistrictOptionData>(),
                    ComponentType.ReadOnly<DistrictModifierData>(),
                    ComponentType.ReadOnly<CityOptionData>(),
                    ComponentType.ReadOnly<CityModifierData>()
                }
            });

            _policyEventArchetype = EntityManager.CreateArchetype(
                ComponentType.ReadWrite<Event>(),
                ComponentType.ReadWrite<Modify>()
            );

            _happinessFactorParamQuery = GetEntityQuery(ComponentType.ReadOnly<Game.Prefabs.HappinessFactorParameterData>());
            _happinessParamQuery = GetEntityQuery(ComponentType.ReadOnly<Game.Prefabs.CitizenHappinessParameterData>());
            _touristHouseholdQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<TouristHousehold>(),
                    ComponentType.ReadOnly<HouseholdCitizen>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>(),
                    ComponentType.ReadOnly<Game.Agents.MovingAway>()
                }
            });

            _subBuildingQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[] { ComponentType.ReadOnly<Game.Common.Owner>() },
                Any = new[]
                {
                    ComponentType.ReadOnly<Employee>(),
                    ComponentType.ReadOnly<Game.Companies.WorkProvider>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>()
                }
            });

            _homelessHouseholdQuery = GetEntityQuery(new EntityQueryDesc
            {
                All = new[]
                {
                    ComponentType.ReadOnly<HomelessHousehold>(),
                    ComponentType.ReadOnly<Household>(),
                    ComponentType.ReadOnly<HouseholdCitizen>()
                },
                None = new[]
                {
                    ComponentType.ReadOnly<Deleted>(),
                    ComponentType.ReadOnly<Temp>(),
                    ComponentType.ReadOnly<Game.Agents.MovingAway>()
                }
            });

            AddBinding(_districtsBinding = new ValueBinding<string>(BamChannels.Group, BamChannels.DistrictsData, "[]"));
            AddBinding(_policiesBinding = new ValueBinding<string>(BamChannels.Group, BamChannels.DistrictPolicies, "[]"));

            AddBinding(new TriggerBinding<string, string, bool>(
                BamChannels.Group,
                BamChannels.ToggleDistrictPolicy,
                (dKey, pKey, active) => QueuePolicyChange(dKey, pKey, active, 0f, preserveExistingIfZero: true)
            ));

            AddBinding(new TriggerBinding<string, string, bool, float>(
                BamChannels.Group,
                BamChannels.ToggleDistrictPolicyWithAdjustment,
                (dKey, pKey, active, adj) => QueuePolicyChange(dKey, pKey, active, adj, preserveExistingIfZero: false)
            ));

            AddBinding(new TriggerBinding<string, string, float>(
                BamChannels.Group,
                BamChannels.SetDistrictPolicyAdjustment,
                (dKey, pKey, adj) => QueuePolicyChange(dKey, pKey, true, adj, preserveExistingIfZero: false)
            ));

            AddBinding(new TriggerBinding<string, bool, float>(
                BamChannels.Group,
                BamChannels.ApplyPolicyToAllDistricts,
                ApplyPolicyToAllDistricts
            ));

            AddBinding(new TriggerBinding<string, string>(
                BamChannels.Group,
                BamChannels.CopyDistrictPolicies,
                CopyDistrictPolicies
            ));

            AddBinding(new TriggerBinding<string>(
                BamChannels.Group,
                BamChannels.ResetDistrictPolicies,
                ResetDistrictPolicies
            ));

            AddBinding(new TriggerBinding<string, string>(
                BamChannels.Group,
                BamChannels.RenameDistrict,
                RenameDistrict
            ));

            if (_windowSystem != null)
            {
                _windowSystem.WindowOpened += OnWindowOpened;
            }
        }

        protected override void OnDestroy()
        {
            if (Instance == this) Instance = null;
            if (_windowSystem != null)
            {
                _windowSystem.WindowOpened -= OnWindowOpened;
            }
            base.OnDestroy();
        }

        protected override void OnGameLoadingComplete(Colossal.Serialization.Entities.Purpose purpose, GameMode mode)
        {
            base.OnGameLoadingComplete(purpose, mode);
            _policyMetaRows.Clear();
            _policiesPushed = false;
            _sliderPoliciesHealed = false;
            _districtRows.Clear();
            _districtMapScratch.Clear();
            _districtListScratch.Clear();
            _lastDistrictsJson = null;
            _lastPolicyMetaJson = null;
            _secondsSinceLastCompletedScan = 100f;
            _dirty = true;
        }

        private bool _sliderPoliciesHealed;

        private void HealZeroSliderPolicies()
        {
            void ScanTarget(Entity target, bool isCity)
            {
                if (target == Entity.Null || !EntityManager.Exists(target) || !EntityManager.HasBuffer<Policy>(target)) return;
                var buf = EntityManager.GetBuffer<Policy>(target, true);
                for (int i = 0; i < buf.Length; i++)
                {
                    var p = buf[i];
                    if (p.m_Policy == Entity.Null || !EntityManager.Exists(p.m_Policy) || !EntityManager.HasComponent<PolicySliderData>(p.m_Policy)) continue;
                    var sd = EntityManager.GetComponentData<PolicySliderData>(p.m_Policy);
                    if (Math.Abs(p.m_Adjustment) < 0.001f && (sd.m_Range.min > 0f || sd.m_Default != 0f))
                    {
                        float fallback = sd.m_Default != 0f ? sd.m_Default : sd.m_Range.min;
                        fallback = UnityEngine.Mathf.Clamp(fallback, sd.m_Range.min, sd.m_Range.max);
                        if (Math.Abs(fallback) >= 0.001f)
                        {
                            bool isActive = (p.m_Flags & PolicyFlags.Active) != 0;
                            _pendingPolicyRequests.Enqueue(new PolicyRequest
                            {
                                DistrictEntity = target,
                                PolicyEntity = p.m_Policy,
                                Active = isActive,
                                Adjustment = fallback,
                                IsCity = isCity
                            });
                        }
                    }
                }
            }

            if (_citySystem != null)
            {
                ScanTarget(_citySystem.City, isCity: true);
            }
            using (var districts = _districtQuery.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < districts.Length; i++)
                {
                    ScanTarget(districts[i], isCity: false);
                }
            }
        }

        private bool IsGamePaused()
        {
            return (_simulationSystem != null && _simulationSystem.selectedSpeed <= 0f)
                || UnityEngine.Time.timeScale <= 0f;
        }

        public void MarkDirty()
        {
            _dirty = true;
        }

        public void RequestManualRefresh()
        {
            _logPopVerifyOnRebuild = true;
            _dirty = true;
        }

        private void OnWindowOpened()
        {
            if (_districtRows.Count == 0 || (!IsGamePaused() && _secondsSinceLastCompletedScan >= 5f))
            {
                _dirty = true;
                _initialOpenDelay = 0.25f; // Stagger district scan so it never collides with AssetInventorySystem on window open frame
            }
        }

        private float _policyRefreshCooldown = -1f;

        protected override void OnUpdate()
        {
            _secondsSinceLastCompletedScan = Math.Min(999f, _secondsSinceLastCompletedScan + UnityEngine.Time.unscaledDeltaTime);

            bool windowActive = _windowSystem != null && _windowSystem.IsWindowActive;
            bool paused = IsGamePaused();

            if (!_sliderPoliciesHealed && _citySystem != null && _citySystem.City != Entity.Null && EntityManager.Exists(_citySystem.City) && (windowActive || !paused))
            {
                _sliderPoliciesHealed = true;
                HealZeroSliderPolicies();
            }

            ProcessPendingPolicyRequests();

            if (!windowActive) return;

            if (_policyRefreshCooldown > 0f)
            {
                _policyRefreshCooldown -= UnityEngine.Time.unscaledDeltaTime;
                if (_policyRefreshCooldown <= 0f)
                {
                    _policyRefreshCooldown = -1f;
                    RefreshPoliciesOnly();
                }
            }

            if (_initialOpenDelay > 0f)
            {
                _initialOpenDelay -= UnityEngine.Time.unscaledDeltaTime;
                if (_initialOpenDelay > 0f) return;
            }

            if (!paused)
            {
                _secondsSinceRefresh += UnityEngine.Time.unscaledDeltaTime;
            }

            int interval = Math.Max(5, Mod.Settings?.RefreshIntervalSeconds ?? 20);
            if (!_dirty && (paused || _secondsSinceRefresh < interval)) return;

            _dirty = false;
            _secondsSinceRefresh = 0f;
            Mod.Log.Guard("DistrictSystem.Rebuild", Rebuild);
        }

        private float SanitizePolicyAdjustment(Entity policyEntity, Entity districtEntity, bool active, float adjustment, bool preserveExistingIfZero)
        {
            if (float.IsNaN(adjustment) || float.IsInfinity(adjustment))
            {
                adjustment = 0f;
            }

            if (preserveExistingIfZero && Math.Abs(adjustment) < 0.001f && districtEntity != Entity.Null && EntityManager.Exists(districtEntity) && EntityManager.HasBuffer<Policy>(districtEntity))
            {
                var policies = EntityManager.GetBuffer<Policy>(districtEntity, true);
                for (int i = 0; i < policies.Length; i++)
                {
                    if (policies[i].m_Policy == policyEntity)
                    {
                        adjustment = policies[i].m_Adjustment;
                        break;
                    }
                }
            }

            if (policyEntity != Entity.Null && EntityManager.Exists(policyEntity) && EntityManager.HasComponent<PolicySliderData>(policyEntity))
            {
                var sd = EntityManager.GetComponentData<PolicySliderData>(policyEntity);
                // Vanilla CS2 UI hides slider controls whenever Policy.m_Adjustment == 0 (JS truthiness check),
                // so never reset a slider policy's adjustment to 0 on toggle-off / reset when a non-zero default or min exists.
                if (Math.Abs(adjustment) < 0.001f && (preserveExistingIfZero || !active))
                {
                    adjustment = sd.m_Default != 0f ? sd.m_Default : sd.m_Range.min;
                }
                adjustment = UnityEngine.Mathf.Clamp(adjustment, sd.m_Range.min, sd.m_Range.max);
            }

            return adjustment;
        }

        private void QueuePolicyChange(string districtKey, string policyKey, bool active, float adjustment, bool preserveExistingIfZero = false)
        {
            try
            {
                bool isCity = string.Equals(districtKey, "city", StringComparison.OrdinalIgnoreCase);
                Entity districtEntity = isCity
                    ? _citySystem.City
                    : (EntityKey.TryParse(districtKey, out var de) ? de : Entity.Null);

                Entity policyEntity = EntityKey.TryParse(policyKey, out Entity pe) ? pe : Entity.Null;

                if (districtEntity == Entity.Null || !EntityManager.Exists(districtEntity) ||
                    policyEntity == Entity.Null || !EntityManager.Exists(policyEntity))
                {
                    Mod.Log.Warn($"DistrictSystem.QueuePolicyChange: Unresolved or non-existent entity (districtKey='{districtKey}' -> {districtEntity}, policyKey='{policyKey}' -> {policyEntity})");
                    return;
                }

                adjustment = SanitizePolicyAdjustment(policyEntity, districtEntity, active, adjustment, preserveExistingIfZero);
                Mod.Log.Info($"DistrictSystem.QueuePolicyChange: districtKey={districtKey}, policyKey={policyKey}, active={active}, adjustment={adjustment}");

                _pendingPolicyRequests.Enqueue(new PolicyRequest
                {
                    DistrictEntity = districtEntity,
                    PolicyEntity = policyEntity,
                    Active = active,
                    Adjustment = adjustment,
                    IsCity = isCity
                });
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"DistrictSystem.QueuePolicyChange error: {ex.Message}");
            }
        }

        private void ProcessPendingPolicyRequests()
        {
            if (_endFrameBarrier == null || _policyEventArchetype == default) return;
            bool applied = false;

            while (_pendingPolicyRequests.TryDequeue(out var req))
            {
                try
                {
                    if (req.DistrictEntity == Entity.Null || !EntityManager.Exists(req.DistrictEntity) ||
                        req.PolicyEntity == Entity.Null || !EntityManager.Exists(req.PolicyEntity))
                    {
                        continue;
                    }

                    Mod.Log.Info($"DistrictSystem.ProcessPendingPolicyRequests: dispatching Modify event for policy {req.PolicyEntity.Index}:{req.PolicyEntity.Version} to district {req.DistrictEntity.Index}:{req.DistrictEntity.Version} (isCity: {req.IsCity}, active: {req.Active}, adj: {req.Adjustment})");

                    var ecb = _endFrameBarrier.CreateCommandBuffer();
                    var evt = ecb.CreateEntity(_policyEventArchetype);
                    ecb.SetComponent(evt, new Modify(req.DistrictEntity, req.PolicyEntity, req.Active, req.Adjustment));

                    // When simulation is paused, Game.Policies.ModifiedSystem (in GameSimulation) won't run until unpaused.
                    // Mirror the policy change into the Policy buffer immediately so UI/ReadActivePolicies stay pause-aware,
                    // while the queued Modify event still runs ModifiedSystem.RefreshEffects cleanly upon unpause.
                    if (IsGamePaused())
                    {
                        ApplyPolicyBufferImmediate(req);
                    }

                    applied = true;
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"DistrictSystem.ProcessPendingPolicyRequests error: {ex.Message}");
                }
            }

            if (applied)
            {
                _policyRefreshCooldown = 0.35f;
            }
        }

        private void ApplyPolicyBufferImmediate(PolicyRequest req)
        {
            var em = EntityManager;
            if (req.DistrictEntity == Entity.Null || !em.Exists(req.DistrictEntity) || !em.HasBuffer<Policy>(req.DistrictEntity) ||
                req.PolicyEntity == Entity.Null || !em.Exists(req.PolicyEntity))
                return;

            var buf = em.GetBuffer<Policy>(req.DistrictEntity, false);
            int idx = -1;
            for (int i = 0; i < buf.Length; i++)
            {
                if (buf[i].m_Policy == req.PolicyEntity)
                {
                    idx = i;
                    break;
                }
            }

            if (!req.Active)
            {
                if (idx >= 0)
                {
                    if (!em.HasComponent<PolicySliderData>(req.PolicyEntity))
                    {
                        buf.RemoveAt(idx);
                    }
                    else
                    {
                        var sd = em.GetComponentData<PolicySliderData>(req.PolicyEntity);
                        var pol = buf[idx];
                        if (Math.Abs(sd.m_Default - pol.m_Adjustment) < 0.001f)
                        {
                            buf.RemoveAt(idx);
                        }
                        else
                        {
                            pol.m_Flags &= ~PolicyFlags.Active;
                            pol.m_Adjustment = req.Adjustment;
                            buf[idx] = pol;
                        }
                    }
                }
            }
            else
            {
                if (idx >= 0)
                {
                    var pol = buf[idx];
                    pol.m_Flags |= PolicyFlags.Active;
                    pol.m_Adjustment = req.Adjustment;
                    buf[idx] = pol;
                }
                else
                {
                    buf.Add(new Policy(req.PolicyEntity, PolicyFlags.Active, req.Adjustment));
                }
            }
        }


        private void RenameDistrict(string districtKey, string newName)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(districtKey)) return;
                var trimmed = (newName ?? string.Empty).Trim();

                if (string.Equals(districtKey, "city", StringComparison.OrdinalIgnoreCase))
                {
                    Entity cityEntity = _citySystem != null ? _citySystem.City : Entity.Null;
                    if (cityEntity != Entity.Null && EntityManager.Exists(cityEntity) && _nameSystem != null)
                    {
                        _nameSystem.SetCustomName(cityEntity, trimmed);
                    }
                    if (_cityConfigurationSystem != null)
                    {
                        _cityConfigurationSystem.cityName = trimmed;
                    }
                    _dirty = true;
                    return;
                }

                if (!EntityKey.TryParse(districtKey, out Entity districtEntity) || !EntityManager.Exists(districtEntity)) return;
                if (_nameSystem == null) return;

                _nameSystem.SetCustomName(districtEntity, trimmed);
                _dirty = true;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"DistrictSystem.RenameDistrict error: {ex.Message}");
            }
        }

        public void RefreshNow()
        {
            Rebuild();
        }

        public IReadOnlyList<DistrictVm> GetDistrictRows() => _districtRows;

        private void Rebuild()
        {
            RebuildPolicyMeta();
            RebuildDistricts();

            if (_logPopVerifyOnRebuild)
            {
                _logPopVerifyOnRebuild = false;
                if (!string.IsNullOrEmpty(_lastPopVerifySummary))
                {
                    Mod.Log.Info(_lastPopVerifySummary);
                }
            }

            if (!_policiesPushed && _policyMetaRows.Count > 0)
            {
                PushJsonIfChanged(_policiesBinding, ref _lastPolicyMetaJson, _policyMetaRows, "[]");
                _policiesPushed = true;
            }
            PushJsonIfChanged(_districtsBinding, ref _lastDistrictsJson, _districtRows, "[]");
            _secondsSinceLastCompletedScan = 0f;
        }

        private void RebuildPolicyMeta()
        {
            if (_policyMetaRows.Count > 0) return;
            if (_policyPrefabQuery.IsEmptyIgnoreFilter) return;

            using (var entities = _policyPrefabQuery.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < entities.Length; i++)
                {
                    var entity = entities[i];
                    if (!_prefabSystem.TryGetPrefab(entity, out PolicyPrefab prefab) || prefab == null) continue;

                    string name = prefab.name ?? string.Empty;
                    string icon = string.Empty;

                    try
                    {
                        icon = ImageSystem.GetThumbnail(prefab) ?? ImageSystem.GetIcon(prefab) ?? string.Empty;
                    }
                    catch (System.Exception ex)
                    {
                        Mod.Log.Debug($"District policy icon lookup {entity.Index}: {ex.Message}");
                    }

                    bool hasSlider = EntityManager.HasComponent<PolicySliderData>(entity);
                    float? sDef = null; float? sMin = null; float? sMax = null;
                    if (hasSlider)
                    {
                        var sd = EntityManager.GetComponentData<PolicySliderData>(entity);
                        sDef = sd.m_Default;
                        sMin = sd.m_Range.min;
                        sMax = sd.m_Range.max;
                    }

                    bool isCity = !name.StartsWith("DP_") &&
                                  (EntityManager.HasComponent<CityOptionData>(entity) ||
                                   EntityManager.HasComponent<CityModifierData>(entity) ||
                                   name.StartsWith("PP_"));

                    bool isDistrict = !name.StartsWith("PP_") &&
                                      (EntityManager.HasComponent<DistrictOptionData>(entity) ||
                                       EntityManager.HasComponent<DistrictModifierData>(entity) ||
                                       name.StartsWith("DP_"));

                    _policyMetaRows.Add(new DistrictPolicyMetaVm
                    {
                        EntityKey = EntityKey.From(entity),
                        Name = name,
                        Icon = icon,
                        IsCity = isCity,
                        IsDistrict = isDistrict,
                        HasSlider = hasSlider,
                        SliderDefault = sDef,
                        SliderMin = sMin,
                        SliderMax = sMax
                    });
                }
            }

            // Native game policies first, then modded/Policy Plus policies alphabetically
            _policyMetaRows.Sort((a, b) =>
            {
                bool aMod = !string.IsNullOrEmpty(a.Name) && (a.Name.StartsWith("PP_") || a.Name.StartsWith("DP_"));
                bool bMod = !string.IsNullOrEmpty(b.Name) && (b.Name.StartsWith("PP_") || b.Name.StartsWith("DP_"));
                if (aMod != bMod) return aMod ? 1 : -1;
                return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
            });
        }

        private void RebuildDistricts()
        {
            _districtRows.Clear();
            var em = EntityManager;

            // 1. Pre-index districts for aggregation (reusing persistent scratch containers)
            _districtMapScratch.Clear();
            _districtListScratch.Clear();
            var districtMap = _districtMapScratch;
            var districtList = _districtListScratch;

            using (var distEntities = _districtQuery.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < distEntities.Length; i++)
                {
                    var dEnt = distEntities[i];
                    string name = Mod.Log.Guard("DistrictName", () => _nameSystem.GetRenderedLabelName(dEnt), string.Empty);
                    if (string.IsNullOrEmpty(name)) name = $"District {dEnt.Index}";

                    var dVm = new DistrictVm
                    {
                        Entity = dEnt,
                        EntityKey = EntityKey.From(dEnt),
                        Name = name
                    };

                    if (em.HasComponent<Geometry>(dEnt))
                    {
                        try
                        {
                            var geom = em.GetComponentData<Geometry>(dEnt);
                            dVm.Area = Math.Round((double)geom.m_SurfaceArea / 1_000_000.0, 2);
                        }
                        catch (System.Exception ex)
                        {
                            Mod.Log.Debug($"Geometry read for district {dEnt.Index}: {ex.Message}");
                        }
                    }

                    ReadActivePolicies(dEnt, dVm.Policies);
                    districtMap[dEnt] = dVm;
                    districtList.Add(dVm);
                }
            }

            var undistricted = new DistrictVm
            {
                EntityKey = "undistricted",
                Name = "Undistricted"
            };

            ResourcePrefabs rPrefabs = default;
            bool hasRPrefabs = false;
            if (_resourceSystem != null)
            {
                try { rPrefabs = _resourceSystem.GetPrefabs(); hasRPrefabs = true; } catch (System.Exception ex) { Mod.Log.Debug($"DistrictSystem: GetPrefabs: {ex.Message}"); }
            }

            Entity cityEntity = _citySystem != null ? _citySystem.City : Entity.Null;
            DynamicBuffer<ServiceFee> cityServiceFees = default;
            bool hasCityServiceFees = cityEntity != Entity.Null && em.Exists(cityEntity) && em.HasBuffer<ServiceFee>(cityEntity);
            if (hasCityServiceFees)
            {
                cityServiceFees = em.GetBuffer<ServiceFee>(cityEntity, true);
            }

            CitizenHappinessParameterData happinessParams = default;
            bool hasHappinessParams = false;
            if (!_happinessParamQuery.IsEmptyIgnoreFilter)
            {
                try
                {
                    happinessParams = _happinessParamQuery.GetSingleton<CitizenHappinessParameterData>();
                    hasHappinessParams = true;
                }
                catch (System.Exception ex)
                {
                    Mod.Log.Debug($"DistrictSystem: CitizenHappinessParameterData: {ex.Message}");
                }
            }

            int diagMovedInResidents = 0;
            int diagNotMovedInYet = 0;
            int diagDeadCitizens = 0;
            int diagMovingAwayCitizens = 0;
            int diagRenterTourists = 0;
            int diagCommuters = 0;
            int diagHomeless = 0;
            int diagSubBuildingWorkers = 0;
            int diagTouristQueryCitizens = 0;

            _seenSubWorkplacesScratch.Clear();
            _seenHouseholdsScratch.Clear();

            // 2. Scan buildings and aggregate metrics into their assigned district (or undistricted bucket for City rollup)
            using (var buildings = _buildingQuery.ToEntityArray(Allocator.TempJob))
            {
                for (int i = 0; i < buildings.Length; i++)
                {
                    var bEnt = buildings[i];
                    if (bEnt == Entity.Null || !em.Exists(bEnt) || em.HasComponent<Game.Common.Deleted>(bEnt) || em.HasComponent<Game.Tools.Temp>(bEnt)) continue;
                    // Skip sub-objects / installed upgrade wings so primary building counts match native district properties count
                    if (em.HasComponent<Game.Common.Owner>(bEnt) || em.HasComponent<Game.Buildings.ServiceUpgrade>(bEnt)) continue;

                    Entity dist = em.HasComponent<CurrentDistrict>(bEnt)
                        ? em.GetComponentData<CurrentDistrict>(bEnt).m_District
                        : Entity.Null;
                    DistrictVm dVm = (dist != Entity.Null && districtMap.TryGetValue(dist, out var mappedVm))
                        ? mappedVm
                        : undistricted;

                    dVm.TotalBuildings++;

                    Entity prEnt = em.HasComponent<PrefabRef>(bEnt) ? em.GetComponentData<PrefabRef>(bEnt).m_Prefab : Entity.Null;

                    bool isRes = em.HasComponent<ResidentialProperty>(bEnt) || (prEnt != Entity.Null && em.HasComponent<ResidentialProperty>(prEnt));
                    bool isCom = em.HasComponent<CommercialProperty>(bEnt) || (prEnt != Entity.Null && em.HasComponent<CommercialProperty>(prEnt));
                    bool isOff = em.HasComponent<OfficeProperty>(bEnt) || (prEnt != Entity.Null && em.HasComponent<OfficeProperty>(prEnt));
                    bool isInd = em.HasComponent<IndustrialProperty>(bEnt) || (prEnt != Entity.Null && em.HasComponent<IndustrialProperty>(prEnt));

                    // Storage properties (warehouses) share IndustrialProperty in CS2 but have AllowedStored != NoResource or StorageCompany tenant
                    bool isStor = false;
                    if (prEnt != Entity.Null && em.HasComponent<BuildingPropertyData>(prEnt))
                    {
                        var bpd = em.GetComponentData<BuildingPropertyData>(prEnt);
                        if (bpd.m_AllowedStored != Resource.NoResource)
                        {
                            isStor = true;
                        }
                    }
                    if (!isStor && em.HasBuffer<Renter>(bEnt))
                    {
                        var renters = em.GetBuffer<Renter>(bEnt, true);
                        for (int r = 0; r < renters.Length; r++)
                        {
                            var rEnt = renters[r].m_Renter;
                            if (rEnt != Entity.Null && em.Exists(rEnt) && em.HasComponent<Game.Companies.StorageCompany>(rEnt))
                            {
                                isStor = true;
                                break;
                            }
                        }
                    }

                    bool isService = em.HasComponent<Game.Buildings.Hospital>(bEnt)
                        || em.HasComponent<Game.Buildings.School>(bEnt)
                        || em.HasComponent<Game.Buildings.PoliceStation>(bEnt)
                        || em.HasComponent<Game.Buildings.Prison>(bEnt)
                        || em.HasComponent<Game.Buildings.FireStation>(bEnt)
                        || em.HasComponent<Game.Buildings.GarbageFacility>(bEnt)
                        || em.HasComponent<Game.Buildings.DeathcareFacility>(bEnt)
                        || em.HasComponent<Game.Buildings.TransportDepot>(bEnt)
                        || em.HasComponent<Game.Buildings.TransportStation>(bEnt)
                        || em.HasComponent<Game.Buildings.PublicTransportStation>(bEnt)
                        || em.HasComponent<Game.Buildings.CargoTransportStation>(bEnt)
                        || em.HasComponent<Game.Buildings.ParkingFacility>(bEnt)
                        || em.HasComponent<Game.Buildings.PostFacility>(bEnt)
                        || em.HasComponent<Game.Buildings.MaintenanceDepot>(bEnt)
                        || em.HasComponent<Game.Buildings.TelecomFacility>(bEnt)
                        || em.HasComponent<Game.Buildings.EmergencyShelter>(bEnt)
                        || em.HasComponent<Game.Buildings.WaterPumpingStation>(bEnt)
                        || em.HasComponent<Game.Buildings.SewageOutlet>(bEnt)
                        || em.HasComponent<Game.Buildings.ElectricityProducer>(bEnt)
                        || em.HasComponent<Game.Buildings.Park>(bEnt);

                    if (isRes && (isCom || isOff || isInd)) dVm.MixedCount++;
                    else if (isRes) dVm.ResidentialCount++;
                    else if (isCom) dVm.CommercialCount++;
                    else if (isOff) dVm.OfficeCount++;
                    else if (isStor) dVm.StorageCount++;
                    else if (isInd) dVm.IndustrialCount++;
                    else if (isService) dVm.ServiceCount++;

                    bool isUnusable = em.HasComponent<Abandoned>(bEnt)
                                   || em.HasComponent<Condemned>(bEnt)
                                   || em.HasComponent<Destroyed>(bEnt);

                    // Household capacity (exclude abandoned, condemned, or destroyed buildings)
                    if (!isUnusable && prEnt != Entity.Null && em.HasComponent<BuildingPropertyData>(prEnt))
                    {
                        var bpd = em.GetComponentData<BuildingPropertyData>(prEnt);
                        dVm.HouseholdCapacity += bpd.m_ResidentialProperties;
                    }

                    // Building Level (spawnable zoned buildings only)
                    if (prEnt != Entity.Null && em.HasComponent<SpawnableBuildingData>(prEnt))
                    {
                        var sbd = em.GetComponentData<SpawnableBuildingData>(prEnt);
                        dVm.BuildingLevelSum += sbd.m_Level;
                        dVm.SpawnableBuildingCount++;
                    }

                    // Crime
                    if (em.HasComponent<CrimeProducer>(bEnt))
                    {
                        var cp = em.GetComponentData<CrimeProducer>(bEnt);
                        dVm.TotalCrime += cp.m_Crime;
                    }

                    // Land Value
                    bool isInactiveBldg = false;
                    if (em.HasComponent<Building>(bEnt))
                    {
                        var bldg = em.GetComponentData<Building>(bEnt);
                        isInactiveBldg = BuildingUtils.CheckOption(bldg, BuildingOption.Inactive);
                        if (bldg.m_RoadEdge != Entity.Null && em.HasComponent<LandValue>(bldg.m_RoadEdge))
                        {
                            dVm.TotalLandValue += em.GetComponentData<LandValue>(bldg.m_RoadEdge).m_LandValue;
                            dVm.LandValueSamples++;
                        }
                    }

                    // Attractiveness & Recreation
                    if (em.HasComponent<Game.Buildings.AttractivenessProvider>(bEnt))
                    {
                        dVm.Attractiveness += em.GetComponentData<Game.Buildings.AttractivenessProvider>(bEnt).m_Attractiveness;
                    }
                    else if (prEnt != Entity.Null && em.HasComponent<Game.Prefabs.AttractionData>(prEnt))
                    {
                        dVm.Attractiveness += em.GetComponentData<Game.Prefabs.AttractionData>(prEnt).m_Attractiveness;
                    }

                    // Schools (UpgradeUtils.TryGetCombinedComponent already includes active InstalledUpgrades; match EducationInfoviewUISystem efficiency > 0 check)
                    if (!isInactiveBldg && !isUnusable && em.HasComponent<Game.Buildings.School>(bEnt) && prEnt != Entity.Null)
                    {
                        float bldgEfficiency = 1f;
                        if (em.HasBuffer<Efficiency>(bEnt))
                        {
                            bldgEfficiency = BuildingUtils.GetEfficiency(em.GetBuffer<Efficiency>(bEnt, true));
                        }

                        if (bldgEfficiency != 0f)
                        {
                            SchoolData sd;
                            if (!UpgradeUtils.TryGetCombinedComponent(em, bEnt, prEnt, out sd) && em.HasComponent<SchoolData>(prEnt))
                            {
                                sd = em.GetComponentData<SchoolData>(prEnt);
                            }

                            if (sd.m_StudentCapacity > 0 || sd.m_EducationLevel > 0)
                            {
                                int enrolled = em.HasBuffer<Game.Buildings.Student>(bEnt) ? em.GetBuffer<Game.Buildings.Student>(bEnt, true).Length : 0;
                                int cap = sd.m_StudentCapacity;

                                switch ((int)sd.m_EducationLevel)
                                {
                                    case 1: dVm.ElemCapacity += cap; dVm.ElemEnrolled += enrolled; break;
                                    case 2: dVm.HsCapacity += cap; dVm.HsEnrolled += enrolled; break;
                                    case 3: dVm.CollegeCapacity += cap; dVm.CollegeEnrolled += enrolled; break;
                                    case 4: dVm.UniCapacity += cap; dVm.UniEnrolled += enrolled; break;
                                }
                            }
                        }
                    }

                    // Utilities Consumption & Service Maintenance Upkeep (scaled by 0.1f when inactive)
                    BamEcsUtils.ExtractUtilities(
                        em,
                        bEnt,
                        out int bElec,
                        out int bWater,
                        out int bGarbage,
                        out _,
                        out _,
                        out _);
                    dVm.ElectricityConsumption += bElec;
                    dVm.WaterConsumption += bWater;
                    dVm.GarbageAccumulation += bGarbage;

                    if (isService && prEnt != Entity.Null)
                    {
                        int svcUpkeep = GetDistrictPrefabMoneyUpkeep(em, prEnt);
                        if (em.HasBuffer<InstalledUpgrade>(bEnt))
                        {
                            var upBuf = em.GetBuffer<InstalledUpgrade>(bEnt, true);
                            for (int u = 0; u < upBuf.Length; u++)
                            {
                                if (BuildingUtils.CheckOption(upBuf[u], BuildingOption.Inactive)) continue;
                                var uEnt = upBuf[u].m_Upgrade;
                                if (uEnt != Entity.Null && em.Exists(uEnt) && em.HasComponent<PrefabRef>(uEnt))
                                {
                                    svcUpkeep += GetDistrictPrefabMoneyUpkeep(em, em.GetComponentData<PrefabRef>(uEnt).m_Prefab);
                                }
                            }
                        }
                        if (isInactiveBldg) svcUpkeep = UnityEngine.Mathf.RoundToInt(svcUpkeep * 0.1f);
                        dVm.MaintenanceCost += svcUpkeep;
                    }

                    // Workplaces on building itself
                    AddWorkforce(bEnt, dVm);

                    if (em.HasBuffer<InstalledUpgrade>(bEnt))
                    {
                        var upBuf = em.GetBuffer<InstalledUpgrade>(bEnt, true);
                        for (int u = 0; u < upBuf.Length; u++)
                        {
                            var uEnt = upBuf[u].m_Upgrade;
                            if (uEnt == Entity.Null || !em.Exists(uEnt) || em.HasComponent<Deleted>(uEnt) || em.HasComponent<Temp>(uEnt)) continue;
                            bool isInactiveUpgrade = BuildingUtils.CheckOption(upBuf[u], BuildingOption.Inactive);
                            _seenSubWorkplacesScratch.Add(uEnt);
                            if (isInactiveUpgrade) continue;

                            if (em.HasBuffer<Employee>(uEnt) || em.HasComponent<Game.Companies.WorkProvider>(uEnt))
                            {
                                AddWorkforce(uEnt, dVm);
                                if (em.HasBuffer<Employee>(uEnt))
                                {
                                    diagSubBuildingWorkers += em.GetBuffer<Employee>(uEnt, true).Length;
                                }
                            }
                        }
                    }

                    // Direct company on building (Signature / extractors)
                    Entity companyStorageTarget = Entity.Null;
                    if (em.HasComponent<CompanyData>(bEnt) && !em.HasComponent<Household>(bEnt))
                    {
                        companyStorageTarget = bEnt;
                        AccumulateDistrictCompanyStats(em, bEnt, isCom, dVm);
                    }

                    // Renters / Households / Citizens / Tenant Companies
                    if (em.HasBuffer<Renter>(bEnt))
                    {
                        var renters = em.GetBuffer<Renter>(bEnt, true);
                        int resHhRenters = 0;
                        for (int r = 0; r < renters.Length; r++)
                        {
                            if (BamEcsUtils.IsValidMovedInHousehold(em, renters[r].m_Renter, out _))
                            {
                                resHhRenters++;
                            }
                        }
                        float buildingFeePerRenter = 0f;
                        if (hasCityServiceFees && resHhRenters > 0)
                        {
                            float bldgFees = 0f;
                            if (em.HasComponent<ElectricityConsumer>(bEnt))
                            {
                                var elecCons = em.GetComponentData<ElectricityConsumer>(bEnt);
                                bldgFees += elecCons.m_FulfilledConsumption * ServiceFeeSystem.GetFee(PlayerResource.Electricity, cityServiceFees);
                            }
                            if (em.HasComponent<WaterConsumer>(bEnt))
                            {
                                var waterCons = em.GetComponentData<WaterConsumer>(bEnt);
                                bldgFees += (waterCons.m_FulfilledFresh + waterCons.m_FulfilledSewage) * ServiceFeeSystem.GetFee(PlayerResource.Water, cityServiceFees);
                            }
                            if (prEnt != Entity.Null && em.HasComponent<ConsumptionData>(prEnt))
                            {
                                var consData = em.GetComponentData<ConsumptionData>(prEnt);
                                bldgFees += consData.m_GarbageAccumulation * ServiceFeeSystem.GetFee(PlayerResource.Garbage, cityServiceFees);
                            }
                            buildingFeePerRenter = bldgFees / resHhRenters;
                        }

                        for (int r = 0; r < renters.Length; r++)
                        {
                            var rEnt = renters[r].m_Renter;
                            if (rEnt == Entity.Null || !em.Exists(rEnt)) continue;

                            if (em.HasComponent<Household>(rEnt))
                            {
                                if (!em.HasComponent<Deleted>(rEnt) && !em.HasComponent<Temp>(rEnt) && !em.HasComponent<CompanyData>(rEnt))
                                {
                                    var rawHh = em.GetComponentData<Household>(rEnt);
                                    bool isMovingAwayHh = em.HasComponent<Game.Agents.MovingAway>(rEnt);
                                    bool isTouristHh = (rawHh.m_Flags & HouseholdFlags.Tourist) != 0 || em.HasComponent<TouristHousehold>(rEnt);
                                    bool isCommuterHh = (rawHh.m_Flags & HouseholdFlags.Commuter) != 0 || em.HasComponent<CommuterHousehold>(rEnt);
                                    bool isMovedInHh = (rawHh.m_Flags & HouseholdFlags.MovedIn) != 0;
                                    bool isHomelessDiag = em.HasComponent<HomelessHousehold>(rEnt);

                                    if (em.HasBuffer<HouseholdCitizen>(rEnt))
                                    {
                                        var diagCits = em.GetBuffer<HouseholdCitizen>(rEnt, true);
                                        for (int dc = 0; dc < diagCits.Length; dc++)
                                        {
                                            var dCit = diagCits[dc].m_Citizen;
                                            if (dCit == Entity.Null || !em.Exists(dCit) || em.HasComponent<Deleted>(dCit) || em.HasComponent<Temp>(dCit) || !em.HasComponent<Citizen>(dCit))
                                            {
                                                continue;
                                            }

                                            bool isDeadCit = CitizenUtils.IsDead(em, dCit) ||
                                                (em.HasComponent<HealthProblem>(dCit) && (em.GetComponentData<HealthProblem>(dCit).m_Flags & HealthProblemFlags.Dead) != 0);
                                            if (isDeadCit)
                                            {
                                                diagDeadCitizens++;
                                            }
                                            else if (isTouristHh)
                                            {
                                                diagRenterTourists++;
                                            }
                                            else if (isCommuterHh)
                                            {
                                                diagCommuters++;
                                            }
                                            else if (isMovingAwayHh)
                                            {
                                                diagMovingAwayCitizens++;
                                            }
                                            else if (!isMovedInHh)
                                            {
                                                diagNotMovedInYet++;
                                            }
                                            else
                                            {
                                                diagMovedInResidents++;
                                                if (isHomelessDiag) diagHomeless++;
                                            }
                                        }
                                    }
                                }

                                if (!BamEcsUtils.IsValidMovedInHousehold(em, rEnt, out var hh)) continue;
                                _seenHouseholdsScratch.Add(rEnt);

                                dVm.Households++;
                                long hhWealth = em.HasBuffer<Resources>(rEnt)
                                    ? EconomyUtils.GetHouseholdTotalWealth(hh, em.GetBuffer<Resources>(rEnt, true))
                                    : hh.m_Resources;
                                dVm.WealthSum += hhWealth;
                                dVm.IncomeSum += hh.m_Income;
                                dVm.UpkeepSum += Math.Abs(hh.m_MoneySpendOnBuildingLevelingLastDay);
                                dVm.ResourceCostSum += hh.m_ShoppedValuePerDay;
                                dVm.FeesSum += buildingFeePerRenter;

                                if (em.HasBuffer<HouseholdAnimal>(rEnt))
                                {
                                    dVm.Pets += em.GetBuffer<HouseholdAnimal>(rEnt, true).Length;
                                }

                                if (em.HasComponent<PropertyRenter>(rEnt))
                                {
                                    var pr = em.GetComponentData<PropertyRenter>(rEnt);
                                    dVm.RentSum += pr.m_Rent;
                                }

                                bool isHomelessHh = em.HasComponent<HomelessHousehold>(rEnt);
                                if (isHomelessHh && !em.HasBuffer<HouseholdCitizen>(rEnt))
                                {
                                    dVm.Homeless++;
                                }

                                if (em.HasBuffer<HouseholdCitizen>(rEnt))
                                {
                                    var citizens = em.GetBuffer<HouseholdCitizen>(rEnt, true);
                                    for (int c = 0; c < citizens.Length; c++)
                                    {
                                        var cEnt = citizens[c].m_Citizen;
                                        if (!BamEcsUtils.IsLivingCitizen(em, cEnt))
                                        {
                                            continue;
                                        }

                                        dVm.Population++;
                                        if (isHomelessHh) dVm.Homeless++;
                                        AccumulateLivingCitizenStats(em, cEnt, dVm);
                                    }
                                }
                            }
                            else
                            {
                                _seenSubWorkplacesScratch.Add(rEnt);
                                AddWorkforce(rEnt, dVm);
                                companyStorageTarget = rEnt;
                                AccumulateDistrictCompanyStats(em, rEnt, isCom, dVm);
                            }
                        }
                    }

                    // Physical storage amount & capacity (excluding weightless Office companies)
                    if (!isOff)
                    {
                        Entity sTarget = companyStorageTarget != Entity.Null ? companyStorageTarget : bEnt;
                        AccumulateDistrictStorage(em, bEnt, prEnt, sTarget, isStor, hasRPrefabs, rPrefabs, dVm);
                    }
                }
            }

            // 2a. Roll up sub-building / extension / installed upgrade workplaces (Owner) into parent district
            if (!_subBuildingQuery.IsEmptyIgnoreFilter)
            {
                using (var subBuildings = _subBuildingQuery.ToEntityArray(Allocator.TempJob))
                {
                    for (int s = 0; s < subBuildings.Length; s++)
                    {
                        var sbEnt = subBuildings[s];
                        if (sbEnt == Entity.Null || !em.Exists(sbEnt) || em.HasComponent<Deleted>(sbEnt) || em.HasComponent<Temp>(sbEnt)) continue;
                        if (!_seenSubWorkplacesScratch.Add(sbEnt)) continue;

                        Entity sbDistrict = ResolveDistrictFromTarget(em, sbEnt);
                        DistrictVm targetVm = (sbDistrict != Entity.Null && districtMap.TryGetValue(sbDistrict, out var mappedSbVm))
                            ? mappedSbVm
                            : undistricted;

                        AddWorkforce(sbEnt, targetVm);
                        if (em.HasBuffer<Employee>(sbEnt))
                        {
                            diagSubBuildingWorkers += em.GetBuffer<Employee>(sbEnt, true).Length;
                        }
                    }
                }
            }

            // 2a-2. Reconcile MovedIn HomelessHousehold entities not already visited inside primary building renters
            if (!_homelessHouseholdQuery.IsEmptyIgnoreFilter)
            {
                using (var homelessHhs = _homelessHouseholdQuery.ToEntityArray(Allocator.TempJob))
                {
                    for (int h = 0; h < homelessHhs.Length; h++)
                    {
                        var hEnt = homelessHhs[h];
                        if (!BamEcsUtils.IsValidMovedInHousehold(em, hEnt, out var hh)) continue;
                        if (!_seenHouseholdsScratch.Add(hEnt)) continue;

                        var hlComp = em.GetComponentData<HomelessHousehold>(hEnt);
                        Entity hhDistrict = ResolveDistrictFromTarget(em, hlComp.m_TempHome);
                        if (hhDistrict == Entity.Null)
                        {
                            hhDistrict = ResolveDistrictFromTarget(em, hEnt);
                        }

                        var citizens = em.GetBuffer<HouseholdCitizen>(hEnt, true);
                        DistrictVm householdDistrictVm = null;
                        int livingCount = 0;
                        for (int c = 0; c < citizens.Length; c++)
                        {
                            var cEnt = citizens[c].m_Citizen;
                            if (!BamEcsUtils.IsLivingCitizen(em, cEnt)) continue;

                            Entity citDistrict = hhDistrict;
                            if (citDistrict == Entity.Null && em.HasComponent<CurrentBuilding>(cEnt))
                            {
                                var curBldg = em.GetComponentData<CurrentBuilding>(cEnt);
                                if (curBldg.m_CurrentBuilding != Entity.Null)
                                {
                                    citDistrict = ResolveDistrictFromTarget(em, curBldg.m_CurrentBuilding);
                                }
                            }
                            if (citDistrict == Entity.Null && em.HasComponent<Target>(cEnt))
                            {
                                var citTarget = em.GetComponentData<Target>(cEnt);
                                if (citTarget.m_Target != Entity.Null)
                                {
                                    citDistrict = ResolveDistrictFromTarget(em, citTarget.m_Target);
                                }
                            }

                            DistrictVm targetVm = (citDistrict != Entity.Null && districtMap.TryGetValue(citDistrict, out var mappedHlVm))
                                ? mappedHlVm
                                : undistricted;

                            if (householdDistrictVm == null) householdDistrictVm = targetVm;
                            targetVm.Population++;
                            targetVm.Homeless++;
                            diagMovedInResidents++;
                            diagHomeless++;
                            livingCount++;
                            AccumulateLivingCitizenStats(em, cEnt, targetVm);
                        }

                        if (livingCount > 0 || hlComp.m_TempHome != Entity.Null || hhDistrict != Entity.Null)
                        {
                            DistrictVm hhVm = householdDistrictVm ?? ((hhDistrict != Entity.Null && districtMap.TryGetValue(hhDistrict, out var mappedFallback)) ? mappedFallback : undistricted);
                            hhVm.Households++;
                            long hhWealth = em.HasBuffer<Resources>(hEnt)
                                ? EconomyUtils.GetHouseholdTotalWealth(hh, em.GetBuffer<Resources>(hEnt, true))
                                : hh.m_Resources;
                            hhVm.WealthSum += hhWealth;
                            hhVm.IncomeSum += hh.m_Income;
                            if (em.HasBuffer<HouseholdAnimal>(hEnt))
                            {
                                hhVm.Pets += em.GetBuffer<HouseholdAnimal>(hEnt, true).Length;
                            }
                        }
                    }
                }
            }

            // 2b. Scan active tourist households and attribute tourists to their current/target/hotel district
            if (!_touristHouseholdQuery.IsEmptyIgnoreFilter)
            {
                using (var touristHhs = _touristHouseholdQuery.ToEntityArray(Allocator.TempJob))
                {
                    for (int t = 0; t < touristHhs.Length; t++)
                    {
                        var thEnt = touristHhs[t];
                        if (thEnt == Entity.Null || !em.Exists(thEnt) || em.HasComponent<Deleted>(thEnt) || em.HasComponent<Temp>(thEnt) || !em.HasComponent<Target>(thEnt)) continue;

                        var thComp = em.GetComponentData<TouristHousehold>(thEnt);
                        Entity hhDistrict = ResolveDistrictFromTarget(em, thComp.m_Hotel);
                        if (hhDistrict == Entity.Null)
                        {
                            var hhTarget = em.GetComponentData<Target>(thEnt).m_Target;
                            hhDistrict = ResolveDistrictFromTarget(em, hhTarget);
                        }

                        var tCitizens = em.GetBuffer<HouseholdCitizen>(thEnt, true);
                        for (int tc = 0; tc < tCitizens.Length; tc++)
                        {
                            var tcEnt = tCitizens[tc].m_Citizen;
                            if (!BamEcsUtils.IsLivingCitizen(em, tcEnt)) continue;

                            Entity citDistrict = Entity.Null;
                            if (em.HasComponent<CurrentBuilding>(tcEnt))
                            {
                                var curBldg = em.GetComponentData<CurrentBuilding>(tcEnt);
                                if (curBldg.m_CurrentBuilding != Entity.Null)
                                {
                                    citDistrict = ResolveDistrictFromTarget(em, curBldg.m_CurrentBuilding);
                                }
                            }
                            if (citDistrict == Entity.Null && em.HasComponent<Target>(tcEnt))
                            {
                                var citTarget = em.GetComponentData<Target>(tcEnt);
                                if (citTarget.m_Target != Entity.Null)
                                {
                                    citDistrict = ResolveDistrictFromTarget(em, citTarget.m_Target);
                                }
                            }
                            if (citDistrict == Entity.Null)
                            {
                                citDistrict = hhDistrict;
                            }

                            DistrictVm targetVm = (citDistrict != Entity.Null && districtMap.TryGetValue(citDistrict, out var mappedTourVm))
                                ? mappedTourVm
                                : undistricted;
                            targetVm.Tourists++;
                            diagTouristQueryCitizens++;
                        }
                    }
                }
            }

            // 3. Compute per-district averages and accumulate weighted City rollup (including undistricted buildings)
            string realCityName = _cityConfigurationSystem?.cityName;
            if (string.IsNullOrEmpty(realCityName) && _nameSystem != null && cityEntity != Entity.Null)
            {
                realCityName = _nameSystem.GetRenderedLabelName(cityEntity);
            }
            if (string.IsNullOrEmpty(realCityName)) realCityName = "City";

            var cityRow = new DistrictVm
            {
                Entity = cityEntity,
                EntityKey = "city",
                Name = realCityName,
                IsCity = true,
                CityName = realCityName
            };

            if (cityEntity != Entity.Null && em.Exists(cityEntity))
            {
                ReadActivePolicies(cityEntity, cityRow.Policies);
            }

            for (int i = 0; i < districtList.Count; i++)
            {
                var r = districtList[i];
                FinalizeDistrictMetrics(r, hasHappinessParams, happinessParams);
                r.HappinessFactors = ResolveDistrictHappiness(r.Entity, r);
                AccumulateDistrictIntoCity(cityRow, r);
            }

            if (undistricted.TotalBuildings > 0 || undistricted.Population > 0 || undistricted.Tourists > 0 || undistricted.Workers > 0 || undistricted.MaxWorkers > 0)
            {
                FinalizeDistrictMetrics(undistricted, hasHappinessParams, happinessParams);
                AccumulateDistrictIntoCity(cityRow, undistricted);
            }

            FinalizeDistrictMetrics(cityRow, hasHappinessParams, happinessParams);
            cityRow.Area = Math.Round(cityRow.Area, 2);

            int districtsSumPop = 0;
            for (int i = 0; i < districtList.Count; i++)
            {
                districtsSumPop += districtList[i].Population;
            }
            int unassignedDistrictPop = undistricted.Population;
            int bamCityPop = districtsSumPop + unassignedDistrictPop;
            int vanillaCityPop = 0;

            if (cityEntity != Entity.Null && em.Exists(cityEntity) && em.HasComponent<Game.City.Population>(cityEntity))
            {
                var cityPop = em.GetComponentData<Game.City.Population>(cityEntity);
                vanillaCityPop = cityPop.m_Population;
                if (cityPop.m_Population > 0)
                {
                    cityRow.Population = cityPop.m_Population;
                }
            }

            int diagTouristsFinal = Math.Max(diagRenterTourists, diagTouristQueryCitizens);
            int deltaPop = bamCityPop - vanillaCityPop;
            _lastPopVerifySummary =
                $"[BAM-PopVerify] VanillaCityPop={vanillaCityPop} BamCityPop={bamCityPop} Delta={deltaPop} | " +
                $"DistrictsSumPop={districtsSumPop} UnassignedDistrictPop={unassignedDistrictPop} | " +
                $"MovedInResidents={diagMovedInResidents} NotMovedInYet={diagNotMovedInYet} DeadCitizens={diagDeadCitizens} " +
                $"MovingAwayCitizens={diagMovingAwayCitizens} Tourists={diagTouristsFinal} Commuters={diagCommuters} " +
                $"Homeless={diagHomeless} SubBuildingWorkers={diagSubBuildingWorkers}";
            cityRow.PopVerify = _lastPopVerifySummary;

            // Authoritative game-wide counters via CountHouseholdDataSystem
            if (_countHouseholdDataSystem != null)
            {
                try
                {
                    if (!_countHouseholdDataSystem.IsCountDataNotReady())
                    {
                        var cd = _countHouseholdDataSystem.GetHouseholdCountData();
                        if (cd.m_MovedInCitizenCount > 0) cityRow.Population = cd.m_MovedInCitizenCount;
                        if (cd.m_MovedInHouseholdCount > 0) cityRow.Households = cd.m_MovedInHouseholdCount;
                        if (cd.m_ChildrenCount > 0 || cd.m_MovedInCitizenCount > 0)
                        {
                            cityRow.Children = cd.m_ChildrenCount;
                            cityRow.Teens = cd.m_TeenCount;
                            cityRow.Adults = cd.m_AdultCount;
                            cityRow.Seniors = cd.m_SeniorCount;
                            cityRow.EduUneducated = cd.m_UneducatedCount;
                            cityRow.EduPoorlyEducated = cd.m_PoorlyEducatedCount;
                            cityRow.EduEducated = cd.m_EducatedCount;
                            cityRow.EduWellEducated = cd.m_WellEducatedCount;
                            cityRow.EduHighlyEducated = cd.m_HighlyEducatedCount;
                        }
                        cityRow.Homeless = cd.m_HomelessCitizenCount;
                        if (cd.m_MovedInCitizenCount > 0 && cd.m_TotalMovedInCitizenHappiness > 0)
                        {
                            cityRow.AvgHappiness = (int)(cd.m_TotalMovedInCitizenHappiness / cd.m_MovedInCitizenCount);
                        }
                        if (cd.m_WorkableCitizenCount > 0)
                        {
                            cityRow.EmployableAdults = cd.m_WorkableCitizenCount;
                            cityRow.Unemployed = Math.Max(0, cd.m_WorkableCitizenCount - cd.m_CityWorkerCount);
                            cityRow.UnemploymentRate = (float)Math.Round(_countHouseholdDataSystem.UnemploymentRate, 1);
                        }

                        cityRow.GameTourists = Math.Max(cd.m_TouristCitizenCount, cityRow.Tourists);
                        cityRow.Tourists = cityRow.GameTourists;
                        cityRow.GameCommuters = cd.m_CommuterHouseholdCount;
                        cityRow.GameMovingAway = cd.m_MovingAwayHouseholdCount;
                        cityRow.GameEmployees = cityRow.Workers;
                        cityRow.GameAllCitizens = cityRow.Population + cityRow.GameTourists + cityRow.GameCommuters + cityRow.GameMovingAway;
                    }
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"DistrictSystem.CountHouseholdDataSystem error: {ex.Message}");
                }
            }

            // Synchronize city-wide totals with the game's authoritative infoview systems (100% exact match with native panels)
            AuthoritativeSync.SyncCitySnapshot(cityRow, _populationInfoview, _workplacesInfoview, _educationInfoview);
            ScaleDistrictEligibilityToCity(districtList, undistricted, cityRow);

            cityRow.HappinessFactors = ResolveCityHappinessNative() ?? ComputeDistrictHappinessDrivers(cityRow);

            _districtRows.Add(cityRow);
            _districtRows.AddRange(districtList);
        }

        private static void AccumulateLivingCitizenStats(EntityManager em, Entity cEnt, DistrictVm dVm)
        {
            dVm.DemographicSamples++;
            var citizen = em.GetComponentData<Citizen>(cEnt);
            dVm.HappinessSum += citizen.Happiness;

            var age = citizen.GetAge();
            switch (age)
            {
                case CitizenAge.Child: dVm.Children++; break;
                case CitizenAge.Teen: dVm.Teens++; break;
                case CitizenAge.Adult: dVm.Adults++; break;
                case CitizenAge.Elderly: dVm.Seniors++; break;
            }

            switch (citizen.GetEducationLevel())
            {
                case 0: dVm.EduUneducated++; break;
                case 1: dVm.EduPoorlyEducated++; break;
                case 2: dVm.EduEducated++; break;
                case 3: dVm.EduWellEducated++; break;
                case 4: dVm.EduHighlyEducated++; break;
            }

            bool isStudent = em.HasComponent<Game.Citizens.Student>(cEnt);
            if (isStudent) dVm.Students++;

            // Vanilla workable citizen & unemployment (matching CitizenUtils.IsWorkableCitizen & CountHouseholdDataSystem)
            if (CitizenUtils.IsWorkableCitizen(citizen, age, isStudent, false))
            {
                dVm.EmployableAdults++;
                bool isCityWorker = false;
                if (em.HasComponent<Worker>(cEnt))
                {
                    var workerComp = em.GetComponentData<Worker>(cEnt);
                    isCityWorker = workerComp.m_Workplace != Entity.Null && !em.HasComponent<Game.Objects.OutsideConnection>(workerComp.m_Workplace);
                }
                if (!isCityWorker)
                {
                    dVm.Unemployed++;
                }
            }

            if (em.HasComponent<HealthProblem>(cEnt))
            {
                var hp = em.GetComponentData<HealthProblem>(cEnt);
                if ((hp.m_Flags & HealthProblemFlags.Dead) == 0 && (hp.m_Flags & HealthProblemFlags.Sick) != 0)
                {
                    dVm.Sick++;
                }
            }
        }

        private static Entity ResolveDistrictFromTarget(EntityManager em, Entity target)
        {
            int depth = 0;
            Entity cur = target;
            while (cur != Entity.Null && depth < 8 && em.Exists(cur))
            {
                if (em.HasComponent<CurrentDistrict>(cur))
                {
                    var cd = em.GetComponentData<CurrentDistrict>(cur);
                    if (cd.m_District != Entity.Null)
                    {
                        return cd.m_District;
                    }
                }
                if (em.HasComponent<HomelessHousehold>(cur))
                {
                    var hl = em.GetComponentData<HomelessHousehold>(cur);
                    if (hl.m_TempHome != Entity.Null && hl.m_TempHome != cur)
                    {
                        cur = hl.m_TempHome;
                        depth++;
                        continue;
                    }
                }
                if (em.HasComponent<PropertyRenter>(cur))
                {
                    var pr = em.GetComponentData<PropertyRenter>(cur);
                    if (pr.m_Property != Entity.Null && pr.m_Property != cur)
                    {
                        cur = pr.m_Property;
                        depth++;
                        continue;
                    }
                }
                if (em.HasComponent<Game.Common.Owner>(cur))
                {
                    var owner = em.GetComponentData<Game.Common.Owner>(cur);
                    if (owner.m_Owner != Entity.Null && owner.m_Owner != cur)
                    {
                        cur = owner.m_Owner;
                        depth++;
                        continue;
                    }
                }
                break;
            }
            return Entity.Null;
        }

        private static void ScaleDistrictEligibilityToCity(List<DistrictVm> districts, DistrictVm undistricted, DistrictVm cityRow)
        {
            int sumChildren = undistricted.Children;
            int sumTeens = undistricted.Teens;
            int sumEdu2 = undistricted.EduEducated;
            int sumEdu3 = undistricted.EduWellEducated;

            for (int i = 0; i < districts.Count; i++)
            {
                sumChildren += districts[i].Children;
                sumTeens += districts[i].Teens;
                sumEdu2 += districts[i].EduEducated;
                sumEdu3 += districts[i].EduWellEducated;
            }

            for (int i = 0; i < districts.Count; i++)
            {
                var d = districts[i];
                if (sumChildren > 0 && cityRow.ElemEligible > 0)
                {
                    d.ElemEligible = Math.Max(d.ElemEnrolled, (int)Math.Round((double)cityRow.ElemEligible * d.Children / sumChildren));
                }
                if (sumTeens > 0 && cityRow.HsEligible > 0)
                {
                    d.HsEligible = Math.Max(d.HsEnrolled, (int)Math.Round((double)cityRow.HsEligible * d.Teens / sumTeens));
                }
                if (sumEdu2 > 0 && cityRow.CollegeEligible > 0)
                {
                    d.CollegeEligible = Math.Max(d.CollegeEnrolled, (int)Math.Round((double)cityRow.CollegeEligible * d.EduEducated / sumEdu2));
                }
                if (sumEdu3 > 0 && cityRow.UniEligible > 0)
                {
                    d.UniEligible = Math.Max(d.UniEnrolled, (int)Math.Round((double)cityRow.UniEligible * d.EduWellEducated / sumEdu3));
                }
            }
        }

        private static int GetDistrictPrefabMoneyUpkeep(EntityManager em, Entity targetPrefab)
        {
            if (targetPrefab == Entity.Null || !em.Exists(targetPrefab)) return 0;
            if (em.HasBuffer<ServiceUpkeepData>(targetPrefab))
            {
                var suBuf = em.GetBuffer<ServiceUpkeepData>(targetPrefab, true);
                int moneyUpkeep = 0;
                bool hasMoney = false;
                for (int s = 0; s < suBuf.Length; s++)
                {
                    if (suBuf[s].m_Upkeep.m_Resource == Resource.Money)
                    {
                        moneyUpkeep += suBuf[s].m_Upkeep.m_Amount;
                        hasMoney = true;
                    }
                }
                if (hasMoney || suBuf.Length > 0) return moneyUpkeep;
            }
            if (em.HasComponent<ConsumptionData>(targetPrefab))
            {
                return em.GetComponentData<ConsumptionData>(targetPrefab).m_Upkeep;
            }
            return 0;
        }

        private static void AccumulateDistrictCompanyStats(EntityManager em, Entity cEnt, bool isCom, DistrictVm dVm)
        {
            if (cEnt == Entity.Null || !em.Exists(cEnt)) return;
            if (em.HasComponent<CompanyStatisticData>(cEnt))
            {
                var stats = em.GetComponentData<CompanyStatisticData>(cEnt);
                if (isCom) dVm.CommercialActivity += stats.m_Income;
            }
            if (em.HasComponent<Profitability>(cEnt))
            {
                var prof = em.GetComponentData<Profitability>(cEnt);
                if (isCom && !em.HasComponent<CompanyStatisticData>(cEnt))
                {
                    dVm.CommercialActivity += prof.m_LastTotalWorth;
                }
                dVm.ProfitabilitySum += ((prof.m_Profitability - 127.5) / 127.5) * 100.0;
                dVm.ProfitabilitySamples++;
            }
        }

        private static bool IsPhysicalDistrictResource(Resource resource)
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

        private static void AccumulateDistrictStorage(
            EntityManager em,
            Entity bEnt,
            Entity bPrefab,
            Entity storageTarget,
            bool isWarehouse,
            bool hasRPrefabs,
            ResourcePrefabs rPrefabs,
            DistrictVm dVm)
        {
            // Skip weightless office companies
            if (storageTarget != Entity.Null && em.HasComponent<PrefabRef>(storageTarget))
            {
                var cPrefCheck = em.GetComponentData<PrefabRef>(storageTarget).m_Prefab;
                if (cPrefCheck != Entity.Null && em.HasComponent<IndustrialProcessData>(cPrefCheck))
                {
                    var proc = em.GetComponentData<IndustrialProcessData>(cPrefCheck);
                    var outR = proc.m_Output.m_Resource;
                    if (outR != Resource.NoResource && !IsPhysicalDistrictResource(outR) && proc.m_Input1.m_Resource == Resource.NoResource)
                    {
                        return;
                    }
                }
            }

            if (storageTarget != Entity.Null && em.HasBuffer<Resources>(storageTarget))
            {
                var resBuf = em.GetBuffer<Resources>(storageTarget, true);
                double kg = 0.0;
                for (int r = 0; r < resBuf.Length; r++)
                {
                    var res = resBuf[r].m_Resource;
                    int amt = resBuf[r].m_Amount;
                    if (amt <= 0 || res == Resource.NoResource || res == Resource.Money) continue;
                    string singleName = BamEcsUtils.FormatResourceName(res);
                    if (!string.IsNullOrEmpty(singleName))
                    {
                        if (!IsPhysicalDistrictResource(res)) continue;
                        float w = hasRPrefabs ? EconomyUtils.GetWeight(em, res, rPrefabs) : 1f;
                        if (w <= 0f) continue;
                        kg += amt;
                    }
                    else if ((ulong)res != 0)
                    {
                        ulong resVal = (ulong)res;
                        for (int bit = 0; bit < 64; bit++)
                        {
                            ulong mask = 1UL << bit;
                            if ((resVal & mask) == 0) continue;
                            Resource flag = (Resource)mask;
                            if (flag == Resource.Money || !IsPhysicalDistrictResource(flag)) continue;
                            string flagName = BamEcsUtils.FormatResourceName(flag);
                            if (!string.IsNullOrEmpty(flagName))
                            {
                                float fw = hasRPrefabs ? EconomyUtils.GetWeight(em, flag, rPrefabs) : 1f;
                                if (fw > 0f)
                                {
                                    kg += amt;
                                    break;
                                }
                            }
                        }
                    }
                }
                dVm.StorageAmount += (float)(kg / 1000.0);
            }

            double capTons = 0.0;
            if (bPrefab != Entity.Null && UpgradeUtils.TryGetCombinedComponent<StorageLimitData>(em, bEnt, bPrefab, out var bLimit) && bLimit.m_Limit > 0)
            {
                if ((isWarehouse || em.HasComponent<StorageCompanyData>(bPrefab)) &&
                    em.HasComponent<SpawnableBuildingData>(bPrefab) &&
                    em.HasComponent<BuildingData>(bPrefab))
                {
                    int adj = bLimit.GetAdjustedLimitForWarehouse(
                        em.GetComponentData<SpawnableBuildingData>(bPrefab),
                        em.GetComponentData<BuildingData>(bPrefab));
                    capTons = adj / 1000.0;
                }
                else
                {
                    capTons = bLimit.m_Limit / 1000.0;
                }
            }
            else if (storageTarget != Entity.Null && em.HasComponent<PrefabRef>(storageTarget))
            {
                var cPref = em.GetComponentData<PrefabRef>(storageTarget).m_Prefab;
                if (cPref != Entity.Null && em.HasComponent<StorageLimitData>(cPref))
                {
                    var cLimit = em.GetComponentData<StorageLimitData>(cPref);
                    if ((isWarehouse || em.HasComponent<Game.Companies.StorageCompany>(storageTarget) || em.HasComponent<StorageCompanyData>(cPref)) &&
                        bPrefab != Entity.Null &&
                        em.HasComponent<SpawnableBuildingData>(bPrefab) &&
                        em.HasComponent<BuildingData>(bPrefab))
                    {
                        int adj = cLimit.GetAdjustedLimitForWarehouse(
                            em.GetComponentData<SpawnableBuildingData>(bPrefab),
                            em.GetComponentData<BuildingData>(bPrefab));
                        capTons = adj / 1000.0;
                    }
                    else
                    {
                        capTons = cLimit.m_Limit / 1000.0;
                    }
                }
            }

            if (capTons > 0.0)
            {
                dVm.StorageCapacity += (float)capTons;
            }
        }

        private static void FinalizeDistrictMetrics(DistrictVm r, bool hasHappinessParams, CitizenHappinessParameterData happinessParams)
        {
            if (r.SpawnableBuildingCount > 0)
            {
                r.AvgBuildingLevel = (int)Math.Round((double)r.BuildingLevelSum / r.SpawnableBuildingCount);
            }
            if (r.DemographicSamples > 0)
            {
                r.AvgHappiness = (int)Math.Round((double)r.HappinessSum / r.DemographicSamples);
            }
            else if (r.Population > 0)
            {
                r.AvgHappiness = 50;
            }

            // Base district eligibility (scaled to city authoritative eligibility when available)
            r.ElemEligible = Math.Max(r.ElemEnrolled, (int)Math.Round(r.Children * 0.61));
            r.HsEligible = Math.Max(r.HsEnrolled, (int)Math.Round(r.Teens * 0.63));
            r.CollegeEligible = Math.Max(r.CollegeEnrolled, (int)Math.Round(r.EduEducated * 0.16));
            r.UniEligible = Math.Max(r.UniEnrolled, (int)Math.Round(r.EduWellEducated * 0.35));

            if (r.Households > 0)
            {
                r.AvgWealth = Math.Round(r.WealthSum / r.Households, 1);
                if (hasHappinessParams)
                {
                    r.AvgWealthKey = CitizenUIUtils.GetHouseholdWealthKey((int)Math.Round(r.AvgWealth), happinessParams).ToString();
                }
                r.AvgIncome = Math.Round(r.IncomeSum / r.Households, 1);
                r.AvgRent = Math.Round(r.RentSum / r.Households);
                r.AvgUpkeep = Math.Round(r.UpkeepSum / r.Households);
                r.AvgResourceCost = Math.Round(r.ResourceCostSum / r.Households);
                r.AvgFees = Math.Round(r.FeesSum / r.Households);
            }

            if (r.LandValueSamples > 0)
            {
                r.AvgLandValue = (float)Math.Round(r.TotalLandValue / r.LandValueSamples, 1);
            }

            if (r.ProfitabilitySamples > 0)
            {
                r.AvgProfitability = (int)Math.Round(r.ProfitabilitySum / r.ProfitabilitySamples);
            }

            int laborForce = r.EmployableAdults > 0 ? r.EmployableAdults : r.Adults;
            if (laborForce > 0)
            {
                r.UnemploymentRate = (float)Math.Round(Math.Min(100.0, (r.Unemployed * 100.0) / laborForce), 1);
            }

            r.StorageAmount = (float)Math.Round(r.StorageAmount, 1);
            r.StorageCapacity = (float)Math.Round(r.StorageCapacity, 1);
        }

        private static void AccumulateDistrictIntoCity(DistrictVm cityRow, DistrictVm r)
        {
            cityRow.TotalBuildings += r.TotalBuildings;
            cityRow.ResidentialCount += r.ResidentialCount;
            cityRow.MixedCount += r.MixedCount;
            cityRow.CommercialCount += r.CommercialCount;
            cityRow.IndustrialCount += r.IndustrialCount;
            cityRow.OfficeCount += r.OfficeCount;
            cityRow.StorageCount += r.StorageCount;
            cityRow.ServiceCount += r.ServiceCount;
            cityRow.HouseholdCapacity += r.HouseholdCapacity;
            cityRow.Population += r.Population;
            cityRow.Households += r.Households;
            cityRow.Children += r.Children;
            cityRow.Teens += r.Teens;
            cityRow.Adults += r.Adults;
            cityRow.Seniors += r.Seniors;
            cityRow.Students += r.Students;
            cityRow.Tourists += r.Tourists;
            cityRow.Homeless += r.Homeless;
            cityRow.EduUneducated += r.EduUneducated;
            cityRow.EduPoorlyEducated += r.EduPoorlyEducated;
            cityRow.EduEducated += r.EduEducated;
            cityRow.EduWellEducated += r.EduWellEducated;
            cityRow.EduHighlyEducated += r.EduHighlyEducated;
            cityRow.Workers += r.Workers;
            cityRow.MaxWorkers += r.MaxWorkers;
            cityRow.Unemployed += r.Unemployed;
            cityRow.EmployableAdults += r.EmployableAdults;
            cityRow.WorkerUneducated += r.WorkerUneducated;
            cityRow.WorkerPoorlyEducated += r.WorkerPoorlyEducated;
            cityRow.WorkerEducated += r.WorkerEducated;
            cityRow.WorkerWellEducated += r.WorkerWellEducated;
            cityRow.WorkerHighlyEducated += r.WorkerHighlyEducated;
            cityRow.WorkplaceUneducated += r.WorkplaceUneducated;
            cityRow.WorkplacePoorlyEducated += r.WorkplacePoorlyEducated;
            cityRow.WorkplaceEducated += r.WorkplaceEducated;
            cityRow.WorkplaceWellEducated += r.WorkplaceWellEducated;
            cityRow.WorkplaceHighlyEducated += r.WorkplaceHighlyEducated;
            cityRow.OpenPositions += r.OpenPositions;
            cityRow.ElemCapacity += r.ElemCapacity;
            cityRow.ElemEnrolled += r.ElemEnrolled;
            cityRow.ElemEligible += r.ElemEligible;
            cityRow.HsCapacity += r.HsCapacity;
            cityRow.HsEnrolled += r.HsEnrolled;
            cityRow.HsEligible += r.HsEligible;
            cityRow.CollegeCapacity += r.CollegeCapacity;
            cityRow.CollegeEnrolled += r.CollegeEnrolled;
            cityRow.CollegeEligible += r.CollegeEligible;
            cityRow.UniCapacity += r.UniCapacity;
            cityRow.UniEnrolled += r.UniEnrolled;
            cityRow.UniEligible += r.UniEligible;
            cityRow.TotalCrime += r.TotalCrime;
            cityRow.Sick += r.Sick;
            cityRow.Pets += r.Pets;
            cityRow.TotalLandValue += r.TotalLandValue;
            cityRow.LandValueSamples += r.LandValueSamples;
            cityRow.Area += r.Area;
            cityRow.Attractiveness += r.Attractiveness;
            cityRow.CommercialActivity += r.CommercialActivity;
            cityRow.ElectricityConsumption += r.ElectricityConsumption;
            cityRow.WaterConsumption += r.WaterConsumption;
            cityRow.GarbageAccumulation += r.GarbageAccumulation;
            cityRow.MaintenanceCost += r.MaintenanceCost;
            cityRow.StorageAmount += r.StorageAmount;
            cityRow.StorageCapacity += r.StorageCapacity;

            // Weighted accumulators for city averages
            cityRow.DemographicSamples += r.DemographicSamples;
            cityRow.HappinessSum += r.HappinessSum;
            cityRow.BuildingLevelSum += r.BuildingLevelSum;
            cityRow.SpawnableBuildingCount += r.SpawnableBuildingCount;
            cityRow.WealthSum += r.WealthSum;
            cityRow.IncomeSum += r.IncomeSum;
            cityRow.RentSum += r.RentSum;
            cityRow.UpkeepSum += r.UpkeepSum;
            cityRow.ResourceCostSum += r.ResourceCostSum;
            cityRow.FeesSum += r.FeesSum;
            cityRow.ProfitabilitySum += r.ProfitabilitySum;
            cityRow.ProfitabilitySamples += r.ProfitabilitySamples;
        }

        internal static string FormatFactorLabel(string factorName, int weight)
        {
            return BamEcsUtils.FormatFactorLabel(factorName, weight);
        }

        private List<EfficiencyFactorVm> ResolveCityHappinessNative()
        {
            if (_citizenHappinessSystem != null)
            {
                try
                {
                    if (!_happinessFactorParamQuery.IsEmptyIgnoreFilter)
                    {
                        Entity singletonEntity = _happinessFactorParamQuery.GetSingletonEntity();
                        DynamicBuffer<Game.Prefabs.HappinessFactorParameterData> buffer = EntityManager.GetBuffer<Game.Prefabs.HappinessFactorParameterData>(singletonEntity, isReadOnly: true);
                        ComponentLookup<Game.Prefabs.Locked> locked = GetComponentLookup<Game.Prefabs.Locked>(isReadOnly: true);

                        var list = new List<EfficiencyFactorVm>(26);
                        for (int i = 0; i < (int)CitizenHappinessSystem.HappinessFactor.Count; i++)
                        {
                            var factorEnum = (CitizenHappinessSystem.HappinessFactor)i;
                            var score = _citizenHappinessSystem.GetHappinessFactor(factorEnum, buffer, ref locked);
                            int netVal = UnityEngine.Mathf.RoundToInt(score.x);

                            string label = BamEcsUtils.FormatFactorLabel(factorEnum, netVal);
                            list.Add(new EfficiencyFactorVm
                            {
                                Factor = label,
                                Percentage = netVal
                            });
                        }

                        if (list.Count > 0)
                        {
                            list.Sort((a, b) =>
                            {
                                int cmp = Math.Abs(b.Percentage).CompareTo(Math.Abs(a.Percentage));
                                if (cmp != 0) return cmp;
                                return string.Compare(a.Factor, b.Factor, StringComparison.Ordinal);
                            });
                            return list;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Mod.Log.Warn($"ResolveCityHappinessNative error: {ex.Message}");
                }
            }
            return null;
        }

        private List<EfficiencyFactorVm> ResolveDistrictHappiness(Entity dEnt, DistrictVm dVm)
        {
            if (_avgHappinessSection != null)
            {
                try
                {
                    if (s_avgHappinessSelectedEntityProp != null && s_avgHappinessFactorsField != null)
                    {
                        var sel = (Entity)s_avgHappinessSelectedEntityProp.GetValue(_avgHappinessSection);
                        if (sel == dEnt)
                        {
                            var list = (Unity.Collections.NativeList<FactorInfo>)s_avgHappinessFactorsField.GetValue(_avgHappinessSection);
                            if (list.IsCreated && list.Length > 0)
                            {
                                var result = new List<EfficiencyFactorVm>();
                                for (int i = 0; i < list.Length; i++)
                                {
                                    var fi = list[i];
                                    string factorName = Enum.GetName(typeof(BuildingHappinessFactor), fi.factor) ?? $"Factor #{fi.factor}";
                                    string label = BamEcsUtils.FormatFactorLabel(factorName, fi.weight);
                                    result.Add(new EfficiencyFactorVm
                                    {
                                        Factor = label,
                                        Percentage = fi.weight
                                    });
                                }
                                if (result.Count > 0)
                                {
                                    result.Sort((a, b) => Math.Abs(b.Percentage).CompareTo(Math.Abs(a.Percentage)));
                                    return result;
                                }
                            }
                        }
                    }
                }
                catch (System.Exception ex)
                {
                    Mod.Log.Debug($"ExtractDistrictHappinessFromNative: {ex.Message}");
                }
            }
            return ComputeDistrictHappinessDrivers(dVm);
        }

        private static List<EfficiencyFactorVm> ComputeDistrictHappinessDrivers(DistrictVm dVm)
        {
            var list = new List<EfficiencyFactorVm>();
            if (dVm.Population == 0 && dVm.TotalBuildings == 0) return list;

            // 1. Proximity effects / LocalBonuses (parks, attractions, special buildings)
            int proximityScore = Math.Min(35, 10 + (dVm.ServiceCount * 3) + (int)(dVm.Area * 2));
            if (proximityScore > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("LocalBonuses", proximityScore), Percentage = proximityScore });
            }

            // 2. Education (Walking distance to Elementary School / school capacity)
            int totalCap = dVm.ElemCapacity + dVm.HsCapacity + dVm.CollegeCapacity + dVm.UniCapacity;
            int totalElig = dVm.ElemEligible + dVm.HsEligible + dVm.CollegeEligible + dVm.UniEligible;
            if (dVm.ElemCapacity >= dVm.ElemEligible && dVm.ElemEligible > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Education", +8), Percentage = +8 });
            }
            else if (totalElig > 0 && totalCap >= totalElig)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Education", +6), Percentage = +6 });
            }
            else if (totalElig > 0 && totalCap < (totalElig / 2))
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Education", -7), Percentage = -7 });
            }

            // 3. Healthcare
            int sickRatio = dVm.Population > 0 ? (dVm.Sick * 100) / dVm.Population : 0;
            if (sickRatio <= 2)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Healthcare", +8), Percentage = +8 });
            }
            else
            {
                int penalty = -Math.Min(15, sickRatio * 2);
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Healthcare", penalty), Percentage = penalty });
            }

            // 4. Housing & Spacious homes
            if (dVm.AvgBuildingLevel >= 4)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Apartment", +7), Percentage = +7 });
            }
            else if (dVm.AvgBuildingLevel >= 3)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Apartment", +4), Percentage = +4 });
            }
            else if (dVm.AvgBuildingLevel <= 1 && dVm.Population > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Apartment", -4), Percentage = -4 });
            }

            // 5. Mail Service
            if (dVm.TotalBuildings > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Mail", +6), Percentage = +6 });
            }

            // 6. Entertainment & Culture
            if (dVm.CommercialCount > 0 || dVm.ServiceCount > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Entertainment", +6), Percentage = +6 });
            }
            else
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Entertainment", -4), Percentage = -4 });
            }

            // 7. Taxes
            if (dVm.AvgIncome > 0 && dVm.AvgIncome < dVm.AvgRent)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Tax", -5), Percentage = -5 });
            }
            else if (dVm.AvgIncome > (dVm.AvgRent + dVm.AvgUpkeep) && dVm.AvgIncome > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Tax", +4), Percentage = +4 });
            }

            // 8. Noise Pollution
            if (dVm.IndustrialCount > 0 || dVm.CommercialCount > 20)
            {
                int noisePenalty = -Math.Min(6, 2 + (dVm.IndustrialCount / 20));
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("NoisePollution", noisePenalty), Percentage = noisePenalty });
            }
            else
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("NoisePollution", +2), Percentage = +2 });
            }

            // 9. Leisure & Free Time
            if (dVm.UnemploymentRate < 10f && dVm.Population > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Leisure", +1), Percentage = +1 });
            }

            // 10. Telecom & Internet
            if (dVm.TotalBuildings > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Telecom", +1), Percentage = +1 });
            }

            // 11. Garbage / Cleanliness
            if (dVm.GarbageAccumulation > 200)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Garbage", -10), Percentage = -10 });
            }
            else
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Garbage", +3), Percentage = +3 });
            }

            // 12. Utilities (Electricity, Water, Sewage)
            if (dVm.ElectricityConsumption > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Electricity", +5), Percentage = +5 });
            }
            if (dVm.WaterConsumption > 0)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Water", +5), Percentage = +5 });
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Sewage", +4), Percentage = +4 });
            }

            // 13. Public Safety & Crime (average accumulated crime per building, not raw sum)
            float avgCrime = dVm.TotalBuildings > 0 ? dVm.TotalCrime / dVm.TotalBuildings : 0f;
            if (avgCrime > 5000f)
            {
                int crimePenalty = -Math.Min(15, (int)((avgCrime - 5000f) / 1000f) + 1);
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Crime", crimePenalty), Percentage = crimePenalty });
            }
            else
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Crime", +4), Percentage = +4 });
            }

            // 14. Employment & Workforce
            if (dVm.Workers > 0 && dVm.UnemploymentRate < 6f)
            {
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Unemployment", +7), Percentage = +7 });
            }
            else if (dVm.UnemploymentRate > 12f)
            {
                int unempPenalty = -(int)Math.Min(20, dVm.UnemploymentRate);
                list.Add(new EfficiencyFactorVm { Factor = BamEcsUtils.FormatFactorLabel("Unemployment", unempPenalty), Percentage = unempPenalty });
            }

            // Sort by impact (magnitude descending)
            list.Sort((a, b) => Math.Abs(b.Percentage).CompareTo(Math.Abs(a.Percentage)));
            return list;
        }

        private void ApplyPolicyToAllDistricts(string policyKey, bool active, float adjustment)
        {
            try
            {
                if (string.IsNullOrEmpty(policyKey)) return;
                if (!EntityKey.TryParse(policyKey, out Entity policyEntity) || !EntityManager.Exists(policyEntity)) return;

                float sanitizedAdjustment = SanitizePolicyAdjustment(policyEntity, Entity.Null, active, adjustment, preserveExistingIfZero: active && Math.Abs(adjustment) < 0.001f);

                using (var districts = _districtQuery.ToEntityArray(Allocator.TempJob))
                {
                    for (int i = 0; i < districts.Length; i++)
                    {
                        var dEnt = districts[i];
                        _pendingPolicyRequests.Enqueue(new PolicyRequest
                        {
                            DistrictEntity = dEnt,
                            PolicyEntity = policyEntity,
                            Active = active,
                            Adjustment = sanitizedAdjustment,
                            IsCity = false
                        });
                    }
                }
                _dirty = true;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"DistrictSystem.ApplyPolicyToAllDistricts error: {ex.Message}");
            }
        }

        private void CopyDistrictPolicies(string sourceDistrictKey, string targetDistrictKey)
        {
            try
            {
                if (string.IsNullOrEmpty(sourceDistrictKey) || string.IsNullOrEmpty(targetDistrictKey)) return;
                if (!EntityKey.TryParse(sourceDistrictKey, out Entity sourceEntity) || !EntityManager.Exists(sourceEntity)) return;
                if (!EntityKey.TryParse(targetDistrictKey, out Entity targetEntity) || !EntityManager.Exists(targetEntity)) return;

                var sourcePolicies = new Dictionary<Entity, float>();
                if (EntityManager.HasBuffer<Policy>(sourceEntity))
                {
                    var sBuf = EntityManager.GetBuffer<Policy>(sourceEntity, true);
                    for (int i = 0; i < sBuf.Length; i++)
                    {
                        var p = sBuf[i];
                        if ((p.m_Flags & PolicyFlags.Active) != 0)
                        {
                            sourcePolicies[p.m_Policy] = p.m_Adjustment;
                        }
                    }
                }

                if (EntityManager.HasBuffer<Policy>(targetEntity))
                {
                    var tBuf = EntityManager.GetBuffer<Policy>(targetEntity, true);
                    for (int i = 0; i < tBuf.Length; i++)
                    {
                        var p = tBuf[i];
                        if (p.m_Policy == Entity.Null || !EntityManager.Exists(p.m_Policy)) continue;
                        if ((p.m_Flags & PolicyFlags.Active) != 0 && !sourcePolicies.ContainsKey(p.m_Policy))
                        {
                            _pendingPolicyRequests.Enqueue(new PolicyRequest
                            {
                                DistrictEntity = targetEntity,
                                PolicyEntity = p.m_Policy,
                                Active = false,
                                Adjustment = SanitizePolicyAdjustment(p.m_Policy, targetEntity, active: false, p.m_Adjustment, preserveExistingIfZero: true),
                                IsCity = false
                            });
                        }
                    }
                }

                foreach (var kvp in sourcePolicies)
                {
                    _pendingPolicyRequests.Enqueue(new PolicyRequest
                    {
                        DistrictEntity = targetEntity,
                        PolicyEntity = kvp.Key,
                        Active = true,
                        Adjustment = kvp.Value,
                        IsCity = false
                    });
                }
                _dirty = true;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"DistrictSystem.CopyDistrictPolicies error: {ex.Message}");
            }
        }

        private void ResetDistrictPolicies(string districtKey)
        {
            try
            {
                if (string.IsNullOrEmpty(districtKey)) return;
                bool isCity = string.Equals(districtKey, "city", StringComparison.OrdinalIgnoreCase);
                Entity target = isCity && _citySystem != null ? _citySystem.City : Entity.Null;
                if (!isCity)
                {
                    if (!EntityKey.TryParse(districtKey, out target) || !EntityManager.Exists(target)) return;
                }
                if (target == Entity.Null || !EntityManager.Exists(target) || !EntityManager.HasBuffer<Policy>(target)) return;

                var buf = EntityManager.GetBuffer<Policy>(target, true);
                for (int i = 0; i < buf.Length; i++)
                {
                    var p = buf[i];
                    if (p.m_Policy == Entity.Null || !EntityManager.Exists(p.m_Policy)) continue;
                    if ((p.m_Flags & PolicyFlags.Active) != 0)
                    {
                        _pendingPolicyRequests.Enqueue(new PolicyRequest
                        {
                            DistrictEntity = target,
                            PolicyEntity = p.m_Policy,
                            Active = false,
                            Adjustment = SanitizePolicyAdjustment(p.m_Policy, target, active: false, p.m_Adjustment, preserveExistingIfZero: true),
                            IsCity = isCity
                        });
                    }
                }
                _dirty = true;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"DistrictSystem.ResetDistrictPolicies error: {ex.Message}");
            }
        }

        private readonly int[] _eduTiersBuffer = new int[5];

        private void AddWorkforce(Entity ent, DistrictVm dVm)
        {
            var em = EntityManager;
            if (ent == Entity.Null || !em.Exists(ent)) return;

            if (em.HasBuffer<Employee>(ent))
            {
                dVm.Workers += em.GetBuffer<Employee>(ent, true).Length;
            }

            Array.Clear(_eduTiersBuffer, 0, _eduTiersBuffer.Length);
            BamEcsUtils.ExtractWorkerEducation(em, ent, _eduTiersBuffer);
            dVm.WorkerUneducated += _eduTiersBuffer[0];
            dVm.WorkerPoorlyEducated += _eduTiersBuffer[1];
            dVm.WorkerEducated += _eduTiersBuffer[2];
            dVm.WorkerWellEducated += _eduTiersBuffer[3];
            dVm.WorkerHighlyEducated += _eduTiersBuffer[4];

            if (em.HasComponent<Game.Companies.WorkProvider>(ent))
            {
                var wp = em.GetComponentData<Game.Companies.WorkProvider>(ent);
                bool addedByTier = false;
                if (em.HasComponent<Game.Prefabs.PrefabRef>(ent))
                {
                    var pRef = em.GetComponentData<Game.Prefabs.PrefabRef>(ent);
                    if (em.HasComponent<Game.Prefabs.WorkplaceData>(pRef.m_Prefab))
                    {
                        var wpd = em.GetComponentData<Game.Prefabs.WorkplaceData>(pRef.m_Prefab);
                        int bLevel = 1;
                        if (em.HasComponent<Game.Buildings.PropertyRenter>(ent))
                        {
                            var prop = em.GetComponentData<Game.Buildings.PropertyRenter>(ent).m_Property;
                            if (em.HasComponent<Game.Prefabs.PrefabRef>(prop))
                            {
                                var propPref = em.GetComponentData<Game.Prefabs.PrefabRef>(prop).m_Prefab;
                                if (em.HasComponent<Game.Prefabs.SpawnableBuildingData>(propPref))
                                {
                                    bLevel = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(propPref).m_Level;
                                }
                            }
                        }
                        else if (em.HasComponent<Game.Prefabs.SpawnableBuildingData>(pRef.m_Prefab))
                        {
                            bLevel = em.GetComponentData<Game.Prefabs.SpawnableBuildingData>(pRef.m_Prefab).m_Level;
                        }

                        var wpData = Game.UI.InGame.EmploymentData.GetWorkplacesData(wp.m_MaxWorkers, bLevel, wpd.m_Complexity);
                        dVm.MaxWorkers += wpData.total;
                        dVm.WorkplaceUneducated += wpData.uneducated;
                        dVm.WorkplacePoorlyEducated += wpData.poorlyEducated;
                        dVm.WorkplaceEducated += wpData.educated;
                        dVm.WorkplaceWellEducated += wpData.wellEducated;
                        dVm.WorkplaceHighlyEducated += wpData.highlyEducated;
                        addedByTier = true;
                    }
                }

                if (!addedByTier)
                {
                    dVm.MaxWorkers += wp.m_MaxWorkers;
                }
            }
            dVm.OpenPositions = Math.Max(0, dVm.MaxWorkers - dVm.Workers);
        }

        public void RefreshPoliciesOnly()
        {
            if (_districtRows.Count == 0)
            {
                Rebuild();
                return;
            }

            for (int i = 0; i < _districtRows.Count; i++)
            {
                var d = _districtRows[i];
                d.Policies.Clear();
                ReadActivePolicies(d.Entity, d.Policies);
            }

            PushJsonIfChanged(_districtsBinding, ref _lastDistrictsJson, _districtRows, "[]");
        }

        private void ReadActivePolicies(Entity entity, List<DistrictPolicyActiveVm> into)
        {
            var em = EntityManager;
            if (entity == Entity.Null || !em.Exists(entity) || !em.HasBuffer<Policy>(entity)) return;

            var buf = em.GetBuffer<Policy>(entity, true);
            for (int i = 0; i < buf.Length; i++)
            {
                var pol = buf[i];
                if (pol.m_Policy == Entity.Null) continue;
                if ((pol.m_Flags & PolicyFlags.Active) == 0) continue;

                into.Add(new DistrictPolicyActiveVm
                {
                    Key = EntityKey.From(pol.m_Policy),
                    Adjustment = pol.m_Adjustment
                });
            }
        }

        private static void PushJsonIfChanged<T>(ValueBinding<string> binding, ref string lastJson, T value, string fallback)
        {
            if (binding == null) return;
            try
            {
                string json = Mod.SerializeJson(value);
                string payload = string.IsNullOrEmpty(json) ? fallback : json;
                if (string.Equals(lastJson, payload, StringComparison.Ordinal)) return;
                lastJson = payload;
                binding.Update(payload);
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"DistrictSystem.PushJsonIfChanged failed: {ex.Message}");
                if (!string.Equals(lastJson, fallback, StringComparison.Ordinal))
                {
                    lastJson = fallback;
                    binding.Update(fallback);
                }
            }
        }

        private static class AuthoritativeSync
        {
            private static readonly FieldInfo s_fElemStudents = typeof(EducationInfoviewUISystem).GetField("m_ElementaryStudents", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fElemCapacity = typeof(EducationInfoviewUISystem).GetField("m_ElementaryCapacity", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fElemEligible = typeof(EducationInfoviewUISystem).GetField("m_ElementaryEligible", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fHsStudents = typeof(EducationInfoviewUISystem).GetField("m_HighSchoolStudents", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fHsCapacity = typeof(EducationInfoviewUISystem).GetField("m_HighSchoolCapacity", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fHsEligible = typeof(EducationInfoviewUISystem).GetField("m_HighSchoolEligible", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fCollegeStudents = typeof(EducationInfoviewUISystem).GetField("m_CollegeStudents", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fCollegeCapacity = typeof(EducationInfoviewUISystem).GetField("m_CollegeCapacity", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fCollegeEligible = typeof(EducationInfoviewUISystem).GetField("m_CollegeEligible", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fUniStudents = typeof(EducationInfoviewUISystem).GetField("m_UniversityStudents", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fUniCapacity = typeof(EducationInfoviewUISystem).GetField("m_UniversityCapacity", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fUniEligible = typeof(EducationInfoviewUISystem).GetField("m_UniversityEligible", BindingFlags.NonPublic | BindingFlags.Instance);

            private static readonly FieldInfo s_fPopulation = typeof(PopulationInfoviewUISystem).GetField("m_Population", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fEmployed = typeof(PopulationInfoviewUISystem).GetField("m_Employed", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fJobs = typeof(PopulationInfoviewUISystem).GetField("m_Jobs", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fUnemployment = typeof(PopulationInfoviewUISystem).GetField("m_Unemployment", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly FieldInfo s_fHomeless = typeof(PopulationInfoviewUISystem).GetField("m_Homeless", BindingFlags.NonPublic | BindingFlags.Instance);

            private static readonly MethodInfo s_mGetWorkplaces = typeof(WorkplacesInfoviewUISystem).GetMethod("GetWorkplaces", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly MethodInfo s_mGetWorkers = typeof(WorkplacesInfoviewUISystem).GetMethod("GetWorkers", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly MethodInfo s_mGetWorkplacesData = typeof(WorkplacesInfoviewUISystem).GetMethod("GetWorkplacesData", BindingFlags.NonPublic | BindingFlags.Instance);
            private static readonly MethodInfo s_mGetEmployeesData = typeof(WorkplacesInfoviewUISystem).GetMethod("GetEmployeesData", BindingFlags.NonPublic | BindingFlags.Instance);

            private static int ReadIntBinding(FieldInfo f, object target, int fallback)
            {
                if (f == null || target == null) return fallback;
                try
                {
                    var b = f.GetValue(target) as Colossal.UI.Binding.ValueBinding<int>;
                    return b != null ? b.value : fallback;
                }
                catch { return fallback; }
            }

            private static float ReadFloatBinding(FieldInfo f, object target, float fallback)
            {
                if (f == null || target == null) return fallback;
                try
                {
                    var b = f.GetValue(target) as Colossal.UI.Binding.ValueBinding<float>;
                    return b != null ? b.value : fallback;
                }
                catch { return fallback; }
            }

            public static void SyncCitySnapshot(
                DistrictVm cityRow,
                PopulationInfoviewUISystem popSys,
                WorkplacesInfoviewUISystem wpSys,
                EducationInfoviewUISystem eduSys)
            {
                if (popSys != null)
                {
                    try
                    {
                        int pop = ReadIntBinding(s_fPopulation, popSys, -1);
                        if (pop >= 0)
                        {
                            cityRow.Population = pop;
                        }

                        int employed = ReadIntBinding(s_fEmployed, popSys, -1);
                        if (employed >= 0)
                        {
                            cityRow.GameEmployees = employed;
                        }

                        int jobs = ReadIntBinding(s_fJobs, popSys, -1);
                        if (jobs >= 0)
                        {
                            cityRow.MaxWorkers = jobs;
                        }

                        float unemp = ReadFloatBinding(s_fUnemployment, popSys, -1f);
                        if (unemp >= 0)
                        {
                            cityRow.UnemploymentRate = (float)Math.Round(unemp, 1);
                        }

                        int homeless = ReadIntBinding(s_fHomeless, popSys, -1);
                        if (homeless >= 0)
                        {
                            cityRow.Homeless = homeless;
                        }
                    }
                    catch (Exception ex)
                    {
                        Mod.Log.Warn($"SyncCitySnapshot Population error: {ex.Message}");
                    }
                }

                if (wpSys != null)
                {
                    try
                    {
                        if (s_mGetWorkplaces != null)
                        {
                            int totalWp = (int)s_mGetWorkplaces.Invoke(wpSys, null);
                            if (totalWp >= 0) cityRow.MaxWorkers = totalWp;
                        }

                        if (s_mGetWorkers != null)
                        {
                            int totalWorkers = (int)s_mGetWorkers.Invoke(wpSys, null);
                            if (totalWorkers >= 0)
                            {
                                cityRow.Workers = totalWorkers;
                            }
                        }

                        if (s_mGetWorkplacesData != null)
                        {
                            var wpData = (Game.UI.InGame.EmploymentData)s_mGetWorkplacesData.Invoke(wpSys, null);
                            if (wpData.total > 0)
                            {
                                cityRow.WorkplaceUneducated = wpData.uneducated;
                                cityRow.WorkplacePoorlyEducated = wpData.poorlyEducated;
                                cityRow.WorkplaceEducated = wpData.educated;
                                cityRow.WorkplaceWellEducated = wpData.wellEducated;
                                cityRow.WorkplaceHighlyEducated = wpData.highlyEducated;
                            }
                        }

                        if (s_mGetEmployeesData != null)
                        {
                            var emp = (Game.UI.InGame.EmploymentData)s_mGetEmployeesData.Invoke(wpSys, null);
                            if (emp.total > 0)
                            {
                                cityRow.WorkerUneducated = emp.uneducated;
                                cityRow.WorkerPoorlyEducated = emp.poorlyEducated;
                                cityRow.WorkerEducated = emp.educated;
                                cityRow.WorkerWellEducated = emp.wellEducated;
                                cityRow.WorkerHighlyEducated = emp.highlyEducated;
                                cityRow.OpenPositions = emp.openPositions > 0 ? emp.openPositions : Math.Max(0, cityRow.MaxWorkers - cityRow.Workers);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Mod.Log.Warn($"SyncCitySnapshot Workplaces error: {ex.Message}");
                    }
                }

                if (eduSys != null)
                {
                    try
                    {
                        int eEnr = ReadIntBinding(s_fElemStudents, eduSys, 0);
                        int eCap = ReadIntBinding(s_fElemCapacity, eduSys, 0);
                        int eElig = ReadIntBinding(s_fElemEligible, eduSys, 0);
                        if (eEnr > 0 || eCap > 0) { cityRow.ElemEnrolled = eEnr; cityRow.ElemCapacity = eCap; }
                        if (eElig > 0) cityRow.ElemEligible = eElig;

                        int hEnr = ReadIntBinding(s_fHsStudents, eduSys, 0);
                        int hCap = ReadIntBinding(s_fHsCapacity, eduSys, 0);
                        int hElig = ReadIntBinding(s_fHsEligible, eduSys, 0);
                        if (hEnr > 0 || hCap > 0) { cityRow.HsEnrolled = hEnr; cityRow.HsCapacity = hCap; }
                        if (hElig > 0) cityRow.HsEligible = hElig;

                        int cEnr = ReadIntBinding(s_fCollegeStudents, eduSys, 0);
                        int cCap = ReadIntBinding(s_fCollegeCapacity, eduSys, 0);
                        int cElig = ReadIntBinding(s_fCollegeEligible, eduSys, 0);
                        if (cEnr > 0 || cCap > 0) { cityRow.CollegeEnrolled = cEnr; cityRow.CollegeCapacity = cCap; }
                        if (cElig > 0) cityRow.CollegeEligible = cElig;

                        int uEnr = ReadIntBinding(s_fUniStudents, eduSys, 0);
                        int uCap = ReadIntBinding(s_fUniCapacity, eduSys, 0);
                        int uElig = ReadIntBinding(s_fUniEligible, eduSys, 0);
                        if (uEnr > 0 || uCap > 0) { cityRow.UniEnrolled = uEnr; cityRow.UniCapacity = uCap; }
                        if (uElig > 0) cityRow.UniEligible = uElig;

                        int totalStudents = cityRow.ElemEnrolled + cityRow.HsEnrolled + cityRow.CollegeEnrolled + cityRow.UniEnrolled;
                        if (totalStudents > 0) cityRow.Students = totalStudents;
                    }
                    catch (Exception ex)
                    {
                        Mod.Log.Warn($"SyncCitySnapshot Education error: {ex.Message}");
                    }
                }

                cityRow.GameAllCitizens = cityRow.Population + cityRow.GameTourists + cityRow.GameCommuters + cityRow.GameMovingAway;
            }
        }
    }
}
