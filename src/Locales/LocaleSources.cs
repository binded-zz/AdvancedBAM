using Colossal;
using AdvancedBAM.Settings;

namespace AdvancedBAM.Locales
{
    public static class LocaleSources
    {
        public static readonly string[] SupportedLocales = new[]
        {
            "en-US", "en-GB", "de-DE", "es-ES", "fr-FR", "it-IT", "pl-PL", "pt-BR", "ru-RU", "zh-HANS", "ja-JP", "ko-KR"
        };

        public static IDictionarySource GetSource(string code, BamSettings settings)
        {
            switch (code)
            {
                case "en-US":
                case "en-GB":
                    return new LocaleEN(settings);
                case "de-DE":
                    return new LocaleDE(settings);
                case "es-ES":
                    return new LocaleES(settings);
                case "fr-FR":
                    return new LocaleFR(settings);
                case "it-IT":
                    return new LocaleIT(settings);
                case "pl-PL":
                    return new LocalePL(settings);
                case "pt-BR":
                    return new LocalePTBR(settings);
                case "ru-RU":
                    return new LocaleRU(settings);
                case "zh-HANS":
                    return new LocaleZHHANS(settings);
                case "ja-JP":
                    return new LocaleJA(settings);
                case "ko-KR":
                    return new LocaleKO(settings);
                default:
                    return new LocaleEN(settings);
            }
        }
    }
}
