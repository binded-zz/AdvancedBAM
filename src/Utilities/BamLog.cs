using System;
using Colossal.Logging;

namespace AdvancedBAM.Utilities
{
    /// <summary>
    /// Crash-proof wrapper around the Colossal logger. Falls back to UnityEngine.Debug
    /// when the Colossal logger is not yet available (early boot / late dispose).
    /// Messages must stay plain ASCII - no emojis (Cohtml + log readers choke on them).
    /// </summary>
    public sealed class BamLog
    {
        private const string Prefix = "[AdvancedBAM]";
        private readonly ILog _inner;

        public BamLog(ILog inner)
        {
            _inner = inner;
        }

        public void Info(string message)
        {
            try { _inner.Info(message); }
            catch { UnityEngine.Debug.Log($"{Prefix} {message}"); }
        }

        public void Warn(string message)
        {
            try { _inner.Warn(message); }
            catch { UnityEngine.Debug.LogWarning($"{Prefix} {message}"); }
        }

        public void Error(string message)
        {
            try { _inner.Error(message); }
            catch { UnityEngine.Debug.LogError($"{Prefix} {message}"); }
        }

        public void Debug(string message)
        {
            try { _inner.Debug(message); }
            catch { UnityEngine.Debug.Log($"{Prefix} [DEBUG] {message}"); }
        }

        /// <summary>Runs <paramref name="body"/> and logs (instead of throwing) any exception.</summary>
        public void Guard(string context, Action body)
        {
            try { body(); }
            catch (Exception ex) { Warn($"{context}: {ex.GetType().Name}: {ex.Message}"); }
        }

        /// <summary>Value-returning variant of <see cref="Guard(string, Action)"/>.</summary>
        public T Guard<T>(string context, Func<T> body, T fallback)
        {
            try { return body(); }
            catch (Exception ex)
            {
                Warn($"{context}: {ex.GetType().Name}: {ex.Message}");
                return fallback;
            }
        }
    }
}
