using System;
using System.Reflection;
using AdvancedBAM.Utilities;
using Colossal.UI.Binding;
using Unity.Entities;

namespace AdvancedBAM.Systems
{
    public partial class AssetToolSystem
    {
        // SceneExplorer soft dependency (reflection-based, zero hard reference).
        // Works seamlessly whether SceneExplorer is installed or not, including when
        // AdvancedBAM loads earlier in mod initialization order than SceneExplorer.
        private ValueBinding<bool> _isSceneExplorerInstalled;
        private bool _sceneExplorerBound = false;
        private bool _hasPostStartupProbedSceneExplorer = false;

        private Assembly _sceneExplorerAssembly;
        private object _sceneExplorerSystemInstance;
        private object _sceneExplorerUiManager;
        private Type _sceneExplorerInspectedObjectType;
        private FieldInfo _sceneExplorerInspectedObjectEntityField;
        private object _sceneExplorerInspectToolSystemInstance;
        private MethodInfo _sceneExplorerInspectToolSystemInspectEntityMethod;
        private object _sceneExplorerToolPanelSystemInstance;
        private MethodInfo _sceneExplorerSelectEntityMethod;
        private MethodInfo _sceneExplorerInspectEntityMethod;
        private MethodInfo _sceneExplorerGetInspectorMethod;
        private MethodInfo _sceneExplorerSetSelectedEntityMethod;
        private MethodInfo _sceneExplorerShowUiMethod;

        private void InitSceneExplorerBindings()
        {
            EnsureSceneExplorerMethodsBound();
            AddBinding(_isSceneExplorerInstalled = new ValueBinding<bool>(
                BamChannels.Group, BamChannels.IsSceneExplorerInstalled, _sceneExplorerBound));
            AddBinding(new TriggerBinding<string>(
                BamChannels.Group, BamChannels.OpenInSceneExplorer, OpenInSceneExplorer));
        }

        private void OnWindowOpenedProbeSceneExplorer()
        {
            ProbeSceneExplorerIfNeeded();
        }

        private void ProbeSceneExplorerIfNeeded()
        {
            if (!_sceneExplorerBound)
            {
                EnsureSceneExplorerMethodsBound();
            }
        }

        private void EnsureSceneExplorerMethodsBound()
        {
            if (_sceneExplorerBound)
                return;

            try
            {
                Assembly sceneExplorerAsm = _sceneExplorerAssembly;
                if (sceneExplorerAsm == null)
                {
                    foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        if (asm.GetName().Name == "SceneExplorer")
                        {
                            sceneExplorerAsm = asm;
                            _sceneExplorerAssembly = asm;
                            break;
                        }
                    }
                }

                if (sceneExplorerAsm == null)
                    return;

                var inspectObjectType = sceneExplorerAsm.GetType("SceneExplorer.System.InspectedObject");
                var inspectToolType = sceneExplorerAsm.GetType("SceneExplorer.System.InspectObjectToolSystem");
                var toolPanelType = sceneExplorerAsm.GetType("SceneExplorer.System.InspectorToolPanelSystem");
                var uiManagerType = sceneExplorerAsm.GetType("SceneExplorer.ToBeReplaced.UIManager");
                var entityInspectorType = sceneExplorerAsm.GetType("SceneExplorer.ToBeReplaced.Windows.EntityInspector");

                if (inspectObjectType != null && _sceneExplorerInspectedObjectType == null)
                {
                    _sceneExplorerInspectedObjectType = inspectObjectType;
                    _sceneExplorerInspectedObjectEntityField = inspectObjectType.GetField(
                        "entity",
                        BindingFlags.Public | BindingFlags.Instance);
                }

                if (inspectToolType != null &&
                    _sceneExplorerInspectedObjectType != null &&
                    _sceneExplorerInspectToolSystemInspectEntityMethod == null)
                {
                    _sceneExplorerInspectToolSystemInspectEntityMethod = inspectToolType.GetMethod(
                        "InspectEntity",
                        BindingFlags.Public | BindingFlags.Instance,
                        null,
                        new[] { _sceneExplorerInspectedObjectType },
                        null);
                }

                if (toolPanelType != null && _sceneExplorerSelectEntityMethod == null)
                {
                    _sceneExplorerSelectEntityMethod = toolPanelType.GetMethod(
                        "SelectEntity",
                        BindingFlags.Public | BindingFlags.Instance,
                        null,
                        new[] { typeof(Entity) },
                        null);
                }

                if (uiManagerType != null)
                {
                    if (_sceneExplorerInspectEntityMethod == null)
                    {
                        _sceneExplorerInspectEntityMethod = uiManagerType.GetMethod(
                            "InspectEntity",
                            BindingFlags.Public | BindingFlags.Instance,
                            null,
                            new[] { typeof(Entity) },
                            null);
                    }

                    if (_sceneExplorerGetInspectorMethod == null)
                    {
                        _sceneExplorerGetInspectorMethod = uiManagerType.GetMethod(
                            "GetInspectorInstance",
                            BindingFlags.Public | BindingFlags.Instance);
                    }

                    if (_sceneExplorerShowUiMethod == null)
                    {
                        _sceneExplorerShowUiMethod = uiManagerType.GetMethod(
                            "ShowUI",
                            BindingFlags.Public | BindingFlags.Instance,
                            null,
                            Type.EmptyTypes,
                            null);
                    }
                }

                if (entityInspectorType != null && _sceneExplorerSetSelectedEntityMethod == null)
                {
                    var prop = entityInspectorType.GetProperty("SelectedEntity", BindingFlags.Public | BindingFlags.Instance);
                    _sceneExplorerSetSelectedEntityMethod = prop?.GetSetMethod();
                }

                if (_sceneExplorerInspectEntityMethod != null ||
                    _sceneExplorerInspectToolSystemInspectEntityMethod != null ||
                    _sceneExplorerSelectEntityMethod != null)
                {
                    _sceneExplorerBound = true;
                    if (_isSceneExplorerInstalled != null && !_isSceneExplorerInstalled.value)
                    {
                        _isSceneExplorerInstalled.Update(true);
                    }
                    Mod.Log.Info("[SceneExplorer] Soft-link established. InspectObjectToolSystem, UIManager, and InspectorToolPanelSystem ready.");
                }
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"[SceneExplorer] Soft-dependency probe warning (non-fatal): {ex.Message}");
            }
        }

        private object ResolveSceneExplorerUiManager()
        {
            if (_sceneExplorerUiManager != null)
            {
                // Guard against destroyed UnityEngine.Object instances across reloads
                if (_sceneExplorerUiManager is UnityEngine.Object unityObj && unityObj == null)
                {
                    _sceneExplorerUiManager = null;
                }
                else
                {
                    return _sceneExplorerUiManager;
                }
            }

            if (_sceneExplorerSystemInstance == null && _sceneExplorerAssembly != null)
            {
                var seType = _sceneExplorerAssembly.GetType("SceneExplorer.SceneExplorerUISystem");
                if (seType != null)
                {
                    _sceneExplorerSystemInstance = World.GetExistingSystemManaged(seType);
                }
            }

            if (_sceneExplorerSystemInstance != null)
            {
                var uiManagerField = _sceneExplorerSystemInstance.GetType().GetField("UiManager", BindingFlags.Public | BindingFlags.Instance);
                if (uiManagerField != null)
                {
                    _sceneExplorerUiManager = uiManagerField.GetValue(_sceneExplorerSystemInstance);
                }
            }

            if (_sceneExplorerUiManager == null && _sceneExplorerInspectEntityMethod != null)
            {
                var uiManagerType = _sceneExplorerInspectEntityMethod.DeclaringType;
                if (uiManagerType != null)
                {
                    var found = UnityEngine.Object.FindObjectsOfType(uiManagerType, includeInactive: true);
                    if (found != null && found.Length > 0)
                    {
                        _sceneExplorerUiManager = found[0];
                    }
                }
            }

            return _sceneExplorerUiManager;
        }

        private bool SyncInspectObjectToolEntity(Entity entity)
        {
            if (_sceneExplorerInspectToolSystemInspectEntityMethod == null ||
                _sceneExplorerInspectedObjectType == null ||
                _sceneExplorerInspectedObjectEntityField == null)
            {
                return false;
            }

            try
            {
                var toolType = _sceneExplorerInspectToolSystemInspectEntityMethod.DeclaringType;
                if (toolType != null)
                {
                    _sceneExplorerInspectToolSystemInstance = World.GetExistingSystemManaged(toolType);
                }

                if (_sceneExplorerInspectToolSystemInstance == null)
                {
                    return false;
                }

                // Update InspectedObject without enabling/switching ToolSystem.activeTool so closing or
                // keeping DefaultToolSystem does not invoke InspectObjectToolSystem.OnStopRunning() -> HideUI().
                object inspectedObjInstance = Activator.CreateInstance(_sceneExplorerInspectedObjectType);
                _sceneExplorerInspectedObjectEntityField.SetValue(inspectedObjInstance, entity);
                _sceneExplorerInspectToolSystemInspectEntityMethod.Invoke(
                    _sceneExplorerInspectToolSystemInstance,
                    new[] { inspectedObjInstance });
                return true;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"[SceneExplorer] InspectObjectToolSystem.InspectEntity warning: {ex.Message}");
                return false;
            }
        }

        private void OpenInSceneExplorer(string entityKeyStr)
        {
            Mod.Log.Info($"[SceneExplorer] OpenInSceneExplorer trigger received for '{entityKeyStr}'");
            ProbeSceneExplorerIfNeeded();

            if (!_sceneExplorerBound)
            {
                Mod.Log.Warn($"[SceneExplorer] OpenInSceneExplorer called for '{entityKeyStr}' but SceneExplorer is not loaded.");
                return;
            }

            try
            {
                if (!EntityKey.TryResolve(EntityManager, entityKeyStr, out Entity entity))
                {
                    Mod.Log.Warn($"[SceneExplorer] Entity '{entityKeyStr}' not found or invalid in EntityManager.");
                    return;
                }

                // 1. Update InspectObjectToolSystem's InspectedObject component first.
                //    Root EntityInspector.Update() syncs SelectedEntity from InspectedObject every frame,
                //    so leaving InspectedObject as Entity.Null immediately wipes any direct SelectedEntity write.
                bool syncedInspectedObject = SyncInspectObjectToolEntity(entity);
                bool openedUi = false;

                // 2. Open/update UIManager's root EntityInspector without hijacking the active ToolSystem tool.
                object uiManager = ResolveSceneExplorerUiManager();
                if (uiManager != null && _sceneExplorerInspectEntityMethod != null)
                {
                    _sceneExplorerInspectEntityMethod.Invoke(uiManager, new object[] { entity });

                    try
                    {
                        var inspectorInstance = _sceneExplorerGetInspectorMethod?.Invoke(uiManager, null);
                        if (inspectorInstance != null && _sceneExplorerSetSelectedEntityMethod != null)
                        {
                            _sceneExplorerSetSelectedEntityMethod.Invoke(inspectorInstance, new object[] { entity });
                        }
                    }
                    catch (Exception inspectorEx)
                    {
                        Mod.Log.Warn($"[SceneExplorer] Direct EntityInspector.SelectedEntity assignment warning: {inspectorEx.Message}");
                    }

                    _sceneExplorerShowUiMethod?.Invoke(uiManager, null);
                    openedUi = true;
                }

                // 3. If SceneExplorer's InspectorToolPanelSystem is already enabled by the user, keep it synced too.
                if (_sceneExplorerSelectEntityMethod != null)
                {
                    var toolPanelType = _sceneExplorerSelectEntityMethod.DeclaringType;
                    if (toolPanelType != null)
                    {
                        _sceneExplorerToolPanelSystemInstance = World.GetExistingSystemManaged(toolPanelType);
                    }

                    if (_sceneExplorerToolPanelSystemInstance is Unity.Entities.SystemBase panelSys && panelSys.Enabled)
                    {
                        try
                        {
                            _sceneExplorerSelectEntityMethod.Invoke(_sceneExplorerToolPanelSystemInstance, new object[] { entity });
                        }
                        catch (Exception selEx)
                        {
                            Mod.Log.Debug($"[SceneExplorer] Optional InspectorToolPanelSystem.SelectEntity warning: {selEx.Message}");
                        }
                    }
                }

                Mod.Log.Info($"[SceneExplorer] Dispatched entity {entity.Index}:{entity.Version} to SceneExplorer (syncedTool={syncedInspectedObject}, openedUi={openedUi}).");
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"[SceneExplorer] OpenInSceneExplorer failed for '{entityKeyStr}': {ex.Message}");
            }
        }
    }
}
