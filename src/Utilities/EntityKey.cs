using System;
using Unity.Entities;

namespace AdvancedBAM.Utilities
{
    /// <summary>
    /// Converts between Unity <see cref="Entity"/> handles and the "index:version"
    /// string keys that travel across the C# / UI boundary.
    /// </summary>
    public static class EntityKey
    {
        private static readonly char[] Separators = { ':', ',' };

        public static string From(Entity entity)
        {
            return entity == Entity.Null ? string.Empty : $"{entity.Index}:{entity.Version}";
        }

        public static bool TryParse(string key, out Entity entity)
        {
            entity = Entity.Null;
            if (string.IsNullOrWhiteSpace(key)) return false;
            var parts = key.Split(Separators, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2) return false;
            if (!int.TryParse(parts[0], out int index) || !int.TryParse(parts[1], out int version)) return false;
            if (index < 0 || (index == 0 && version == 0)) return false;

            entity = new Entity { Index = index, Version = version };
            return true;
        }

        /// <summary>Parses and verifies the entity still exists in the given world.</summary>
        public static bool TryResolve(EntityManager em, string key, out Entity entity)
        {
            return TryParse(key, out entity) && em.Exists(entity);
        }
    }
}
