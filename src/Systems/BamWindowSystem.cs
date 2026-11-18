using System;
using Colossal.UI.Binding;
using Game;
using Game.UI;

namespace AdvancedBAM.Systems
{
    /// <summary>
    /// Owns the explorer window state: visibility, persisted rect, launcher button
    /// visibility, and the UI console relay (uiLog / uiError).
    /// </summary>
    public partial class BamWindowSystem : UISystemBase
    {
        private ValueBinding<bool> _windowVisible;
        private ValueBinding<bool> _launcherVisible;
        private ValueBinding<string> _windowRect;
        private ValueBinding<int> _rowsPerPage;
        private ValueBinding<string> _focusedEntityKey;
        private ValueBinding<int> _happinessFactorCount;
        private ValueBinding<int> _happinessFactorFilter;

        private DateTime _lastUiLogUtc = DateTime.MinValue;
        private int _uiLogBurst;

        public bool IsWindowOpen => _windowVisible != null && _windowVisible.value;
        public bool IsWindowCollapsed { get; private set; }
        public bool IsWindowActive => IsWindowOpen && !IsWindowCollapsed;

        /// <summary>Raised whenever the window transitions from closed to open.</summary>
        public event Action WindowOpened;

        /// <summary>Raised whenever a collapsed window is expanded back to full view.</summary>
        public event Action WindowExpanded;

        private bool _resolveOwnerBuilding = true;

        protected override void OnCreate()
        {
            base.OnCreate();

            var s = Mod.Settings;

            AddBinding(_windowVisible = new ValueBinding<bool>(BamChannels.Group, BamChannels.WindowVisible, false));
            AddBinding(_launcherVisible = new ValueBinding<bool>(BamChannels.Group, BamChannels.LauncherVisible, s?.ShowLauncherButton ?? true));
            AddBinding(_windowRect = new ValueBinding<string>(BamChannels.Group, BamChannels.WindowRect, BuildRectJson()));
            AddBinding(_rowsPerPage = new ValueBinding<int>(BamChannels.Group, BamChannels.RowsPerPage, s?.RowsPerPage ?? 50));
            AddBinding(_focusedEntityKey = new ValueBinding<string>(BamChannels.Group, BamChannels.FocusedEntityKey, string.Empty));
            AddBinding(_happinessFactorCount = new ValueBinding<int>(BamChannels.Group, BamChannels.HappinessFactorCount, (int)(s?.HappinessFactorCount ?? Settings.HappinessDisplayCount.ShowAll)));
            AddBinding(_happinessFactorFilter = new ValueBinding<int>(BamChannels.Group, BamChannels.HappinessFactorFilter, (int)(s?.HappinessFactorFilter ?? Settings.HappinessDisplayFilter.AllFactors)));

            AddBinding(new TriggerBinding(BamChannels.Group, BamChannels.ToggleWindow, () => SetVisible(!IsWindowOpen)));
            AddBinding(new TriggerBinding<bool>(BamChannels.Group, BamChannels.SetWindowVisible, SetVisible));
            AddBinding(new TriggerBinding<bool>(BamChannels.Group, BamChannels.SetWindowCollapsed, SetCollapsed));
            AddBinding(new TriggerBinding<int, int, int, int>(BamChannels.Group, BamChannels.SaveWindowRect, SaveRect));
            AddBinding(new TriggerBinding<int, int>(BamChannels.Group, BamChannels.FocusBuildingInBam, FocusBuilding));
            AddBinding(new TriggerBinding(BamChannels.Group, BamChannels.ClearFocusedEntity, () => _focusedEntityKey?.Update(string.Empty)));
            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.OpenExternalUrl, Settings.BamSettings.OpenAllowedExternalUrl));
            AddBinding(new TriggerBinding<string, string>(BamChannels.Group, BamChannels.ExportCsv, (csvContent, prefix) => Utilities.CsvExportService.SaveCustomCsv(csvContent, prefix)));
            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.UiLog, msg => RelayUiMessage(msg, false)));
            AddBinding(new TriggerBinding<string>(BamChannels.Group, BamChannels.UiError, msg => RelayUiMessage(msg, true)));

            InitUiPrefsBindings();
        }

        protected override void OnGameLoadingComplete(Colossal.Serialization.Entities.Purpose purpose, GameMode mode)
        {
            base.OnGameLoadingComplete(purpose, mode);
            // Never restore an open window across loads - avoids the window covering the main menu.
            if (_windowVisible != null && _windowVisible.value) _windowVisible.Update(false);
        }

        protected override void OnUpdate()
        {
            FlushUiPrefsIfDue(force: false);

            var s = Mod.Settings;
            if (s == null) return;

            // Cheap per-frame sync of options that can change from the Options menu.
            if (_launcherVisible.value != s.ShowLauncherButton) _launcherVisible.Update(s.ShowLauncherButton);
            if (_rowsPerPage.value != s.RowsPerPage) _rowsPerPage.Update(s.RowsPerPage);
            int happyCount = (int)s.HappinessFactorCount;
            if (_happinessFactorCount.value != happyCount) _happinessFactorCount.Update(happyCount);
            int happyFilter = (int)s.HappinessFactorFilter;
            if (_happinessFactorFilter.value != happyFilter) _happinessFactorFilter.Update(happyFilter);
        }

        public void SetVisible(bool visible)
        {
            if (_windowVisible.value == visible) return;
            _windowVisible.Update(visible);
            if (visible)
            {
                IsWindowCollapsed = false;
                _windowRect.Update(BuildRectJson());
                WindowOpened?.Invoke();
            }
        }

        public void SetCollapsed(bool collapsed)
        {
            if (IsWindowCollapsed == collapsed) return;
            IsWindowCollapsed = collapsed;
            if (!collapsed && IsWindowOpen)
            {
                WindowExpanded?.Invoke();
            }
        }

        public void FocusBuilding(int index, int version)
        {
            var entity = new Unity.Entities.Entity { Index = index, Version = version };
            if (entity == Unity.Entities.Entity.Null || !EntityManager.Exists(entity)) return;

            if (EntityManager.HasComponent<Game.Areas.District>(entity))
            {
                SetVisible(true);
                _focusedEntityKey?.Update($"{entity.Index}:{entity.Version}");
                return;
            }

            if (EntityManager.HasComponent<Game.Citizens.HouseholdMember>(entity))
            {
                var hm = EntityManager.GetComponentData<Game.Citizens.HouseholdMember>(entity);
                if (hm.m_Household != Unity.Entities.Entity.Null && EntityManager.Exists(hm.m_Household))
                {
                    entity = hm.m_Household;
                }
            }

            if (EntityManager.HasComponent<Game.Buildings.PropertyRenter>(entity))
            {
                var pr = EntityManager.GetComponentData<Game.Buildings.PropertyRenter>(entity);
                if (pr.m_Property != Unity.Entities.Entity.Null && EntityManager.Exists(pr.m_Property))
                {
                    entity = pr.m_Property;
                }
            }

            if (_resolveOwnerBuilding && EntityManager.Exists(entity))
            {
                int safety = 0;
                while (EntityManager.Exists(entity) && EntityManager.HasComponent<Game.Common.Owner>(entity) && safety++ < 6)
                {
                    bool isSub = EntityManager.HasComponent<Game.Buildings.ServiceUpgrade>(entity)
                              || EntityManager.HasComponent<Game.Buildings.Extension>(entity)
                              || (!EntityManager.HasComponent<Game.Buildings.Building>(entity) &&
                                  !EntityManager.HasComponent<Game.Areas.District>(entity));
                    if (!isSub) break;

                    var owner = EntityManager.GetComponentData<Game.Common.Owner>(entity).m_Owner;
                    if (owner == Unity.Entities.Entity.Null || !EntityManager.Exists(owner)) break;
                    entity = owner;

                    if (EntityManager.HasComponent<Game.Buildings.PropertyRenter>(entity))
                    {
                        var prOwner = EntityManager.GetComponentData<Game.Buildings.PropertyRenter>(entity);
                        if (prOwner.m_Property != Unity.Entities.Entity.Null && EntityManager.Exists(prOwner.m_Property))
                        {
                            entity = prOwner.m_Property;
                        }
                    }
                }
            }

            if (EntityManager.Exists(entity) &&
                (EntityManager.HasComponent<Game.Buildings.Building>(entity) ||
                 EntityManager.HasComponent<Game.Areas.District>(entity)))
            {
                SetVisible(true);
                _focusedEntityKey?.Update($"{entity.Index}:{entity.Version}");
            }
        }

        private void SaveRect(int x, int y, int width, int height)
        {
            var s = Mod.Settings;
            if (s == null) return;

            s.WindowX = x;
            s.WindowY = y;
            s.WindowWidth = Math.Max(480, width);
            s.WindowHeight = Math.Max(320, height);
            s.ApplyAndSave();
        }

        private static string BuildRectJson()
        {
            var s = Mod.Settings;
            int x = s?.WindowX ?? Settings.BamSettings.DefaultWindowX;
            int y = s?.WindowY ?? Settings.BamSettings.DefaultWindowY;
            int w = s?.WindowWidth ?? Settings.BamSettings.DefaultWindowWidth;
            int h = s?.WindowHeight ?? Settings.BamSettings.DefaultWindowHeight;
            return $"{{\"x\":{x},\"y\":{y},\"width\":{w},\"height\":{h}}}";
        }

        /// <summary>
        /// Writes UI console output into the mod log. Throttled to 20 lines/second so a
        /// render loop error cannot flood the log file.
        /// </summary>
        private void RelayUiMessage(string message, bool isError)
        {
            var now = DateTime.UtcNow;
            if ((now - _lastUiLogUtc).TotalSeconds >= 1) { _lastUiLogUtc = now; _uiLogBurst = 0; }
            if (++_uiLogBurst > 20) return;

            if (string.IsNullOrEmpty(message)) return;
            if (message.Length > 2000) message = message.Substring(0, 2000) + "...";

            if (isError) Mod.Log.Error($"[UI] {message}");
            else Mod.Log.Info($"[UI] {message}");
        }

        protected override void OnDestroy()
        {
            FlushUiPrefsIfDue(force: true);
            base.OnDestroy();
        }
    }
}
