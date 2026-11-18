using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using AdvancedBAM.Utilities;
using Colossal.UI.Binding;
using Newtonsoft.Json;

namespace AdvancedBAM.Systems
{
    public partial class BamWindowSystem
    {
        private const int UiPrefsSaveDebounceMs = 250;

        private sealed class UiPrefsPayload
        {
            [JsonProperty("loaded")]
            public bool Loaded { get; set; }

            [JsonProperty("prefs")]
            public Dictionary<string, string> Prefs { get; set; }
        }

        private readonly Dictionary<string, string> _uiPrefs =
            new Dictionary<string, string>(StringComparer.Ordinal);

        private ValueBinding<string> _uiPrefsBinding;
        private bool _uiPrefsDirty;
        private DateTime _uiPrefsNextFlushUtc = DateTime.MinValue;

        private static string GetUiPrefsFilePath()
        {
            return Path.Combine(
                CsvExportService.GetUserDataDirectory(),
                "ModsSettings",
                nameof(AdvancedBAM),
                "ui-settings.json");
        }

        private void InitUiPrefsBindings()
        {
            LoadUiPrefsFromDisk();

            AddBinding(_uiPrefsBinding = new ValueBinding<string>(
                BamChannels.Group,
                BamChannels.UiPrefs,
                BuildUiPrefsPayloadJson()));

            AddBinding(new TriggerBinding<string, string>(
                BamChannels.Group,
                BamChannels.SetUiPref,
                OnSetUiPref));
            AddBinding(new TriggerBinding<string>(
                BamChannels.Group,
                BamChannels.RemoveUiPref,
                OnRemoveUiPref));
            AddBinding(new TriggerBinding<string>(
                BamChannels.Group,
                BamChannels.ClearUiPrefs,
                OnClearUiPrefs));
        }

        private string BuildUiPrefsPayloadJson()
        {
            return JsonConvert.SerializeObject(new UiPrefsPayload
            {
                Loaded = true,
                Prefs = _uiPrefs
            }, Formatting.None);
        }

        private void LoadUiPrefsFromDisk()
        {
            _uiPrefs.Clear();
            string path = GetUiPrefsFilePath();
            try
            {
                if (!File.Exists(path)) return;

                string json = File.ReadAllText(path, Encoding.UTF8);
                if (string.IsNullOrWhiteSpace(json)) return;

                var parsed = JsonConvert.DeserializeObject<Dictionary<string, string>>(json);
                if (parsed == null) return;

                foreach (var kvp in parsed)
                {
                    if (!string.IsNullOrEmpty(kvp.Key) && kvp.Value != null)
                    {
                        _uiPrefs[kvp.Key] = kvp.Value;
                    }
                }
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"[UiPrefs] Failed to load '{path}': {ex.Message}");
            }
            finally
            {
                SyncResolvedSettingKey("bam_setting_sub_target");
            }
        }

        private void OnSetUiPref(string key, string value)
        {
            if (string.IsNullOrEmpty(key)) return;
            if (value == null)
            {
                OnRemoveUiPref(key);
                return;
            }

            if (_uiPrefs.TryGetValue(key, out string existing) &&
                string.Equals(existing, value, StringComparison.Ordinal))
            {
                return;
            }

            _uiPrefs[key] = value;
            SyncResolvedSettingKey(key);
            MarkUiPrefsDirty();
        }

        private void OnRemoveUiPref(string key)
        {
            if (string.IsNullOrEmpty(key)) return;
            if (!_uiPrefs.Remove(key)) return;

            SyncResolvedSettingKey(key);
            MarkUiPrefsDirty();
        }

        private void OnClearUiPrefs(string prefix)
        {
            bool changed = false;
            if (string.IsNullOrEmpty(prefix))
            {
                if (_uiPrefs.Count > 0)
                {
                    _uiPrefs.Clear();
                    changed = true;
                }
            }
            else
            {
                var keysToRemove = new List<string>();
                foreach (string key in _uiPrefs.Keys)
                {
                    if (key.StartsWith(prefix, StringComparison.Ordinal))
                    {
                        keysToRemove.Add(key);
                    }
                }

                for (int i = 0; i < keysToRemove.Count; i++)
                {
                    _uiPrefs.Remove(keysToRemove[i]);
                    changed = true;
                }
            }

            if (!changed) return;

            SyncResolvedSettingKey("bam_setting_sub_target");
            MarkUiPrefsDirty();
        }

        private void SyncResolvedSettingKey(string key)
        {
            if (!string.Equals(key, "bam_setting_sub_target", StringComparison.Ordinal)) return;

            _resolveOwnerBuilding =
                !_uiPrefs.TryGetValue("bam_setting_sub_target", out string subTarget) ||
                !string.Equals(subTarget, "sub", StringComparison.OrdinalIgnoreCase);
        }

        private void MarkUiPrefsDirty()
        {
            _uiPrefsDirty = true;
            _uiPrefsNextFlushUtc = DateTime.UtcNow.AddMilliseconds(UiPrefsSaveDebounceMs);
            _uiPrefsBinding?.Update(BuildUiPrefsPayloadJson());
        }

        private void FlushUiPrefsIfDue(bool force)
        {
            if (!_uiPrefsDirty) return;
            if (!force && DateTime.UtcNow < _uiPrefsNextFlushUtc) return;

            string path = GetUiPrefsFilePath();
            string tmpPath = path + ".tmp";
            try
            {
                string dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrEmpty(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                string json = JsonConvert.SerializeObject(_uiPrefs, Formatting.Indented);
                File.WriteAllText(tmpPath, json, new UTF8Encoding(false));
                File.Copy(tmpPath, path, overwrite: true);
                File.Delete(tmpPath);
                _uiPrefsDirty = false;
            }
            catch (Exception ex)
            {
                Mod.Log.Warn($"[UiPrefs] Failed to save '{path}': {ex.Message}");
            }
        }
    }
}

