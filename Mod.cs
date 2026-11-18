using System.Globalization;
using System.IO;
using System.Text;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Game;
using Game.Modding;
using Game.SceneFlow;
using AdvancedBAM.Locales;
using AdvancedBAM.Settings;
using AdvancedBAM.Systems;
using AdvancedBAM.Utilities;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace AdvancedBAM
{
    public class Mod : IMod
    {
        public const string ModId = "AdvancedBAM";
        public const string ModName = "Advanced Building & Asset Manager";
        public const string ModVersion = "1.0.2";

        public static BamLog Log { get; private set; }
        public static BamSettings Settings { get; private set; }

        public static readonly JsonSerializerSettings JsonSettings = new JsonSerializerSettings
        {
            ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
            PreserveReferencesHandling = PreserveReferencesHandling.None,
            NullValueHandling = NullValueHandling.Ignore,
            MaxDepth = 16,
            ContractResolver = new DefaultContractResolver
            {
                NamingStrategy = new CamelCaseNamingStrategy
                {
                    ProcessDictionaryKeys = false,
                    OverrideSpecifiedNames = true
                }
            }
        };

        private static readonly JsonSerializer s_jsonSerializer = JsonSerializer.CreateDefault(JsonSettings);
        private static readonly StringBuilder s_jsonBuffer = new StringBuilder(512 * 1024);

        internal static string SerializeJson(object payload)
        {
            s_jsonBuffer.Clear();
            using (var sw = new StringWriter(s_jsonBuffer, CultureInfo.InvariantCulture))
            using (var jw = new JsonTextWriter(sw) { Formatting = Formatting.None })
            {
                s_jsonSerializer.Serialize(jw, payload);
                jw.Flush();
            }
            string result = s_jsonBuffer.ToString();
            s_jsonBuffer.Clear();
            if (s_jsonBuffer.Capacity > 8 * 1024 * 1024)
            {
                s_jsonBuffer.Capacity = 512 * 1024;
            }
            return result;
        }

        public void OnLoad(UpdateSystem updateSystem)
        {
            Log = new BamLog(LogManager.GetLogger($"{ModId}.{nameof(Mod)}").SetShowsErrorsInUI(false));
            Log.Info($"Loading {ModName} v{ModVersion}");

            Settings = new BamSettings(this);

            // Load persisted Settings.coc before registering Options UI so registered controls read saved values
            AssetDatabase.global.LoadSettings(ModId, Settings, new BamSettings(this));
            Settings.RegisterInOptionsUI();

            // Register all multi-lingual locale sources with CS2 localization manager
            foreach (var localeCode in LocaleSources.SupportedLocales)
            {
                var source = LocaleSources.GetSource(localeCode, Settings);
                if (source != null)
                {
                    GameManager.instance.localizationManager.AddSource(localeCode, source);
                }
            }

            // Register ECS Systems
            updateSystem.UpdateAt<BamWindowSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AssetInventorySystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<DistrictSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<AssetToolSystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<BamRepairSystem>(SystemUpdatePhase.ToolUpdate);
            updateSystem.UpdateAt<BamRepairSystem>(SystemUpdatePhase.Modification1);

            Log.Info($"{ModName} loaded successfully with full multi-lingual support.");
        }

        public void OnDispose()
        {
            Log?.Info($"Disposing {ModName}");
            if (Settings != null)
            {
                Settings.UnregisterInOptionsUI();
                Settings = null;
            }
        }
    }
}
