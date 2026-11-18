using System;
using System.Text.RegularExpressions;
using Unity.Entities;
using Game.Agents;
using Game.Buildings;
using Game.City;
using Game.Economy;
using Game.Prefabs;
using Game.Simulation;
using Game.Companies;
using Game.Citizens;
using Game.UI.InGame;

namespace AdvancedBAM.Utilities
{
    /// <summary>
    /// Centralized ECS utility and helper methods shared between DistrictSystem and AssetInventorySystem.
    /// Eliminates code duplication for factor labels, metrics, and workforce calculations.
    /// </summary>
    public static class BamEcsUtils
    {
        /// <summary>
        /// Splits a PascalCase or acronym+PascalCase identifier into clean human-readable words.
        /// </summary>
        public static string SplitPascalCase(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return string.Empty;
            string s = raw.Replace('_', ' ');
            s = Regex.Replace(s, @"([A-Z]{2,})([A-Z][a-z])", "$1 $2");
            s = Regex.Replace(s, @"([a-z0-9])([A-Z])", "$1 $2");
            s = Regex.Replace(s, @"\s+", " ").Trim();
            return s;
        }

        /// <summary>
        /// Converts a native Cities: Skylines II simulation happiness factor name into its
        /// authentic, vanilla in-game display label (matching AverageHappinessSection & CitizenHappinessSystem).
        /// </summary>
        public static string FormatFactorLabel(string factorName, int weight)
        {
            if (string.IsNullOrEmpty(factorName)) return string.Empty;
            bool pos = weight > 0;

            switch (factorName)
            {
                case "LocalBonuses": return pos ? "Proximity effects" : "Negative local effects";
                case "Education": return pos ? "Walking distance to Elementary School" : "School crowding";
                case "Healthcare": return pos ? "Reliable healthcare coverage" : "Healthcare shortage";
                case "Apartment": return pos ? "Spacious homes" : "Small homes";
                case "Wealth": return pos ? "High wealth" : "Low wealth";
                case "Mail": return pos ? "Reliable mail service" : "Poor mail service";
                case "Entertainment": return pos ? "Abundance of entertainment" : "Lack of entertainment";
                case "Tax": return pos ? "Fair taxes" : "High taxes";
                case "NoisePollution": return pos ? "Quiet neighborhood" : "High noise pollution";
                case "Leisure": return pos ? "Abundance of leisure time" : "Lack of leisure time";
                case "Telecom": return pos ? "Reliable internet service" : "Poor internet service";
                case "Garbage": return pos ? "Clean surroundings" : "Poor garbage services";
                case "Water": return pos ? "Reliable water supply" : "Unreliable water supply";
                case "WaterPollution": return pos ? "Pure drinking water" : "Polluted water";
                case "Sewage": return pos ? "Reliable sewage system" : "Bad sewer system";
                case "Electricity": return pos ? "Reliable electricity supply" : "Unreliable electricity supply";
                case "Crime": return pos ? "Safe neighborhood" : "High crime risk";
                case "AirPollution": return pos ? "Clean air" : "Polluted air";
                case "GroundPollution": return pos ? "Clean ground" : "High ground pollution";
                case "Welfare": return pos ? "Reliable social security" : "Poor social security";
                case "Customers": return pos ? "Abundant customers" : "Few customers";
                case "Materials": return pos ? "Abundant raw materials" : "Material shortage";
                case "MissingWorkers": return pos ? "Fully staffed" : "Missing workers";
                case "UneducatedWorkers": return pos ? "Abundant labor" : "Missing uneducated workers";
                case "EducatedWorkers": return pos ? "Educated workforce" : "Missing educated workers";
                case "Efficiency": return pos ? "High efficiency" : "Low efficiency";
                case "InputCosts": return pos ? "Low operating expenses" : "High input costs";
                case "OutputCosts": return pos ? "High sales profits" : "Low sales prices";
                case "ElectricityFee": return pos ? "Low electricity fees" : "High electricity fees";
                case "WaterFee": return pos ? "Low water fees" : "High water fees";
                case "Homelessness": return pos ? "Low homelessness" : "Homelessness";
                case "Unemployment": return pos ? "Abundant jobs" : "Unemployment";
                case "TrafficPenalty": return pos ? "Smooth traffic flow" : "Traffic";
                case "DeathPenalty": return pos ? "Dignified deathcare" : "Vicinity of the deceased penalty";
                case "Buildings": return pos ? "Service upgrades" : "Lack of building upgrades";
                case "Consumption": return pos ? "Abundant commercial goods" : "Commercial goods deficit";
                default: return SplitPascalCase(factorName);
            }
        }

        public static string FormatFactorLabel(BuildingHappinessFactor factor, int weight)
        {
            return FormatFactorLabel(factor.ToString(), weight);
        }

        public static string FormatFactorLabel(CitizenHappinessSystem.HappinessFactor factor, int weight)
        {
            return FormatFactorLabel(factor.ToString(), weight);
        }

        /// <summary>
        /// Formats a CS2 Resource enum flag into a clean human-readable display name.
        /// Returns empty string for NoResource, Last, All, or composite bitmasks.
        /// </summary>
        public static string FormatResourceName(Resource r)
        {
            if (r == Resource.NoResource || r == Resource.Last || r == Resource.All)
                return string.Empty;

            switch (r)
            {
                case Resource.ConvenienceFood: return "Convenience Food";
                case Resource.UnsortedMail: return "Unsorted Mail";
                case Resource.LocalMail: return "Local Mail";
                case Resource.OutgoingMail: return "Outgoing Mail";
                default:
                    string raw = r.ToString();
                    if (string.IsNullOrEmpty(raw) || char.IsDigit(raw[0]) || raw.Contains(","))
                        return string.Empty;
                    return SplitPascalCase(raw);
            }
        }

        /// <summary>
        /// Converts a native EfficiencyFactor enum value into its human-readable label matching EfficiencySection.
        /// </summary>
        public static string FormatEfficiencyFactor(EfficiencyFactor factor)
        {
            switch (factor)
            {
                case EfficiencyFactor.Destroyed: return "Destroyed";
                case EfficiencyFactor.Abandoned: return "Abandoned";
                case EfficiencyFactor.Disabled: return "Disabled";
                case EfficiencyFactor.Fire: return "Fire";
                case EfficiencyFactor.ServiceBudget: return "Service Budget";
                case EfficiencyFactor.NotEnoughEmployees: return "Not Enough Employees";
                case EfficiencyFactor.SickEmployees: return "Sick Employees";
                case EfficiencyFactor.EmployeeHappiness: return "Employee Happiness";
                case EfficiencyFactor.ElectricitySupply: return "Electricity Supply";
                case EfficiencyFactor.ElectricityFee: return "Electricity Fee";
                case EfficiencyFactor.WaterSupply: return "Water Supply";
                case EfficiencyFactor.DirtyWater: return "Polluted Water";
                case EfficiencyFactor.SewageHandling: return "Sewage Handling";
                case EfficiencyFactor.WaterFee: return "Water Fee";
                case EfficiencyFactor.Garbage: return "Garbage";
                case EfficiencyFactor.Telecom: return "Telecom";
                case EfficiencyFactor.Mail: return "Mail Handling";
                case EfficiencyFactor.MaterialSupply: return "Material Supply";
                case EfficiencyFactor.WindSpeed: return "Wind Speed";
                case EfficiencyFactor.WaterDepth: return "Water Depth";
                case EfficiencyFactor.SunIntensity: return "Sun Intensity";
                case EfficiencyFactor.NaturalResources: return "Natural Resources";
                case EfficiencyFactor.CityModifierSoftware: return "Software Efficiency";
                case EfficiencyFactor.CityModifierElectronics: return "Electronics Efficiency";
                case EfficiencyFactor.CityModifierIndustrialEfficiency: return "Industrial Efficiency";
                case EfficiencyFactor.CityModifierOfficeEfficiency: return "Office Efficiency";
                case EfficiencyFactor.CityModifierHospitalEfficiency: return "Hospital Efficiency";
                case EfficiencyFactor.SpecializationBonus: return "Specialization Bonus";
                case EfficiencyFactor.CityModifierFishInput: return "Fish Input Efficiency";
                case EfficiencyFactor.CityModifierFishHub: return "Fish Hub Efficiency";
                case EfficiencyFactor.LackResources: return "Lack of Resources";
                case EfficiencyFactor.GateBypass: return "Gate Bypass";
                default: return SplitPascalCase(factor.ToString());
            }
        }

        /// <summary>
        /// Formats a LeisureType enum into its clean human-readable display string.
        /// </summary>
        public static string FormatLeisureType(LeisureType type)
        {
            switch (type)
            {
                case LeisureType.Meals: return "Meals";
                case LeisureType.Entertainment: return "Entertainment";
                case LeisureType.Commercial: return "Commercial";
                case LeisureType.CityIndoors: return "Indoor Recreation";
                case LeisureType.Travel: return "Sightseeing & Travel";
                case LeisureType.CityPark: return "Outdoor Recreation";
                case LeisureType.CityBeach: return "Beach Recreation";
                case LeisureType.Attractions: return "Attractions";
                case LeisureType.Relaxation: return "Relaxation";
                case LeisureType.Sightseeing: return "Sightseeing";
                default: return SplitPascalCase(type.ToString());
            }
        }

        /// <summary>
        /// Formats a LocalModifierType enum without double-negatives (e.g. "-25% Crime Accumulation").
        /// </summary>
        public static string FormatLocalModifierType(LocalModifierType type)
        {
            switch (type)
            {
                case LocalModifierType.Wellbeing: return "Well-Being";
                case LocalModifierType.Health: return "Health";
                case LocalModifierType.CrimeAccumulation: return "Crime Accumulation";
                case LocalModifierType.ForestFireHazard: return "Forest Fire Hazard";
                case LocalModifierType.ForestFireResponseTime: return "Forest Fire Response Time";
                default: return SplitPascalCase(type.ToString());
            }
        }

        /// <summary>
        /// Formats a CityModifierType enum into clean human-readable display text.
        /// </summary>
        public static string FormatCityModifierType(CityModifierType type)
        {
            switch (type)
            {
                case CityModifierType.Attractiveness: return "Attractiveness";
                case CityModifierType.CrimeAccumulation: return "Crime Accumulation";
                case CityModifierType.DisasterWarningTime: return "Disaster Warning Time";
                case CityModifierType.DisasterDamageRate: return "Disaster Damage Rate";
                case CityModifierType.DiseaseProbability: return "Disease Probability";
                case CityModifierType.ParkEntertainment: return "Park Entertainment";
                case CityModifierType.CriminalMonitorProbability: return "Criminal Monitoring";
                case CityModifierType.IndustrialAirPollution: return "Industrial Air Pollution";
                case CityModifierType.IndustrialGroundPollution: return "Industrial Ground Pollution";
                case CityModifierType.IndustrialGarbage: return "Industrial Garbage";
                case CityModifierType.RecoveryFailChange: return "Disaster Recovery Fail Chance";
                case CityModifierType.OreResourceAmount: return "Ore Resource Amount";
                case CityModifierType.OilResourceAmount: return "Oil Resource Amount";
                case CityModifierType.UniversityInterest: return "University Interest";
                case CityModifierType.OfficeSoftwareDemand: return "Office Software Demand";
                case CityModifierType.IndustrialElectronicsDemand: return "Industrial Electronics Demand";
                case CityModifierType.OfficeSoftwareEfficiency: return "Office Software Efficiency";
                case CityModifierType.IndustrialElectronicsEfficiency: return "Industrial Electronics Efficiency";
                case CityModifierType.TelecomCapacity: return "Telecom Capacity";
                case CityModifierType.Entertainment: return "Entertainment";
                case CityModifierType.HighwayTrafficSafety: return "Highway Traffic Safety";
                case CityModifierType.PrisonTime: return "Prison Time";
                case CityModifierType.CrimeProbability: return "Crime Probability";
                case CityModifierType.CollegeGraduation: return "College Graduation";
                case CityModifierType.UniversityGraduation: return "University Graduation";
                case CityModifierType.ImportCost: return "Import Cost";
                case CityModifierType.LoanInterest: return "Loan Interest";
                case CityModifierType.BuildingLevelingCost: return "Building Leveling Cost";
                case CityModifierType.ExportCost: return "Export Cost";
                case CityModifierType.TaxiStartingFee: return "Taxi Starting Fee";
                case CityModifierType.IndustrialEfficiency: return "Industrial Efficiency";
                case CityModifierType.OfficeEfficiency: return "Office Efficiency";
                case CityModifierType.PollutionHealthAffect: return "Pollution Health Effect";
                case CityModifierType.HospitalEfficiency: return "Hospital Efficiency";
                case CityModifierType.IndustrialFishInputEfficiency: return "Fish Input Efficiency";
                case CityModifierType.IndustrialFishHubEfficiency: return "Fish Hub Efficiency";
                case CityModifierType.CityServiceImportCost: return "City Service Import Cost";
                case CityModifierType.CityServiceBuildingBaseUpkeepCost: return "Service Building Base Upkeep";
                case CityModifierType.CrimeResponseTime: return "Crime Response Time";
                case CityModifierType.TaxHappiness: return "Tax Happiness";
                default: return SplitPascalCase(type.ToString());
            }
        }

        public static string FormatLocalModifier(LocalModifierData lmd)
        {
            float rawVal = lmd.m_Delta.max != 0f ? lmd.m_Delta.max : lmd.m_Delta.min;
            float delta = ModifierUIUtils.GetModifierDelta(lmd.m_Mode, rawVal);
            string sign = delta > 0f ? "+" : "";
            string valStr = lmd.m_Mode != ModifierValueMode.Absolute
                ? $"{sign}{Math.Round(delta):0}%"
                : $"{sign}{delta:0.#}";
            string typeName = FormatLocalModifierType(lmd.m_Type);
            string radius = lmd.m_Radius.max > 0f ? $" within {lmd.m_Radius.max:0} m" : "";
            return $"{valStr} {typeName}{radius}";
        }

        public static string FormatCityModifier(CityModifierData cmd)
        {
            float rawVal = cmd.m_Range.max != 0f ? cmd.m_Range.max : cmd.m_Range.min;
            float delta = ModifierUIUtils.GetModifierDelta(cmd.m_Mode, rawVal);
            string sign = delta > 0f ? "+" : "";
            string valStr = cmd.m_Mode != ModifierValueMode.Absolute
                ? $"{sign}{Math.Round(delta):0}%"
                : $"{sign}{delta:0.#}";
            string typeName = FormatCityModifierType(cmd.m_Type);
            return $"{valStr} {typeName} (city-wide)";
        }

        /// <summary>
        /// Aggregates current filled employees and maximum capacity for a workplace entity.
        /// </summary>
        public static void AddWorkforce(EntityManager em, Entity workplace, ref int employees, ref int maxWorkers)
        {
            if (workplace == Entity.Null || !em.Exists(workplace)) return;
            if (em.HasComponent<WorkProvider>(workplace))
                maxWorkers += em.GetComponentData<WorkProvider>(workplace).m_MaxWorkers;
            if (em.HasBuffer<Employee>(workplace))
                employees += em.GetBuffer<Employee>(workplace, true).Length;
        }

        /// <summary>
        /// Reads worker education levels (0 = uneducated, 1 = poorly, 2 = educated, 3 = well, 4 = highly)
        /// into an int[5] array.
        /// </summary>
        public static void ExtractWorkerEducation(EntityManager em, Entity workplace, int[] eduTiers)
        {
            if (workplace == Entity.Null || !em.Exists(workplace) || !em.HasBuffer<Employee>(workplace)) return;
            var employees = em.GetBuffer<Employee>(workplace, true);
            for (int e = 0; e < employees.Length; e++)
            {
                int edu = employees[e].m_Level;
                if (edu >= 0 && edu < eduTiers.Length)
                {
                    eduTiers[edu]++;
                }
            }
        }

        /// <summary>
        /// Computes the average happiness of up to maxSample employees across a building and its tenant companies.
        /// </summary>
        public static int CalculateAverageWorkerHappiness(EntityManager em, Entity building, DynamicBuffer<Renter> renters, int maxSample = 40)
        {
            int wSum = 0, wCount = 0;
            int rCount = renters.IsCreated ? renters.Length : 0;
            for (int r = -1; r < rCount && wCount < maxSample; r++)
            {
                Entity workplace = r < 0 ? building : renters[r].m_Renter;
                if (workplace == Entity.Null || !em.Exists(workplace) || !em.HasBuffer<Employee>(workplace)) continue;
                var emps = em.GetBuffer<Employee>(workplace, true);
                for (int w = 0; w < emps.Length && wCount < maxSample; w++)
                {
                    var wEnt = emps[w].m_Worker;
                    if (wEnt != Entity.Null && em.Exists(wEnt) && em.HasComponent<Citizen>(wEnt) && !CitizenUtils.IsDead(em, wEnt))
                    {
                        wSum += em.GetComponentData<Citizen>(wEnt).Happiness;
                        wCount++;
                    }
                }
            }
            return wCount > 0 ? (int)Math.Round((double)wSum / wCount) : 0;
        }

        /// <summary>
        /// Returns true when <paramref name="householdEntity"/> is an active, moved-in resident household
        /// (excluding un-moved-in migrating, moving-away, tourist, commuter, deleted, or temp entities).
        /// </summary>
        public static bool IsValidMovedInHousehold(EntityManager em, Entity householdEntity, out Household hh)
        {
            hh = default;
            if (householdEntity == Entity.Null ||
                !em.Exists(householdEntity) ||
                em.HasComponent<Game.Common.Deleted>(householdEntity) ||
                em.HasComponent<Game.Tools.Temp>(householdEntity) ||
                em.HasComponent<CompanyData>(householdEntity) ||
                !em.HasComponent<Household>(householdEntity))
            {
                return false;
            }

            hh = em.GetComponentData<Household>(householdEntity);
            if ((hh.m_Flags & HouseholdFlags.MovedIn) == 0) return false;
            if ((hh.m_Flags & (HouseholdFlags.Tourist | HouseholdFlags.Commuter)) != 0) return false;
            if (em.HasComponent<MovingAway>(householdEntity) ||
                em.HasComponent<TouristHousehold>(householdEntity) ||
                em.HasComponent<CommuterHousehold>(householdEntity))
            {
                return false;
            }

            return true;
        }

        /// <summary>
        /// Returns true when <paramref name="citizenEntity"/> exists, is not deleted/temp, and is alive.
        /// </summary>
        public static bool IsLivingCitizen(EntityManager em, Entity citizenEntity)
        {
            if (citizenEntity == Entity.Null ||
                !em.Exists(citizenEntity) ||
                em.HasComponent<Game.Common.Deleted>(citizenEntity) ||
                em.HasComponent<Game.Tools.Temp>(citizenEntity) ||
                !em.HasComponent<Citizen>(citizenEntity) ||
                CitizenUtils.IsDead(em, citizenEntity))
            {
                return false;
            }

            if (em.HasComponent<HealthProblem>(citizenEntity))
            {
                var hp = em.GetComponentData<HealthProblem>(citizenEntity);
                if ((hp.m_Flags & HealthProblemFlags.Dead) != 0)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Reads standard utility consumption and production figures for a building entity.
        /// </summary>
        public static void ExtractUtilities(
            EntityManager em,
            Entity entity,
            out int electricityWanted,
            out int waterWanted,
            out int garbageProduced,
            out float crimeProduced,
            out int mailSending,
            out int mailReceiving)
        {
            electricityWanted = 0;
            waterWanted = 0;
            garbageProduced = 0;
            crimeProduced = 0f;
            mailSending = 0;
            mailReceiving = 0;

            if (entity == Entity.Null || !em.Exists(entity)) return;

            if (em.HasComponent<ElectricityConsumer>(entity))
            {
                try { electricityWanted = em.GetComponentData<ElectricityConsumer>(entity).m_WantedConsumption; }
                catch (System.Exception ex) { Mod.Log.Debug($"ElectricityConsumer read {entity.Index}: {ex.Message}"); }
            }
            if (em.HasComponent<WaterConsumer>(entity))
            {
                try { waterWanted = em.GetComponentData<WaterConsumer>(entity).m_WantedConsumption; }
                catch (System.Exception ex) { Mod.Log.Debug($"WaterConsumer read {entity.Index}: {ex.Message}"); }
            }
            if (em.HasComponent<GarbageProducer>(entity))
            {
                try { garbageProduced = em.GetComponentData<GarbageProducer>(entity).m_Garbage; }
                catch (System.Exception ex) { Mod.Log.Debug($"GarbageProducer read {entity.Index}: {ex.Message}"); }
            }
            if (em.HasComponent<CrimeProducer>(entity))
            {
                try { crimeProduced = em.GetComponentData<CrimeProducer>(entity).m_Crime; }
                catch (System.Exception ex) { Mod.Log.Debug($"CrimeProducer read {entity.Index}: {ex.Message}"); }
            }
            if (em.HasComponent<MailProducer>(entity))
            {
                try
                {
                    var mail = em.GetComponentData<MailProducer>(entity);
                    mailSending = mail.m_SendingMail;
                    mailReceiving = mail.receivingMail;
                }
                catch (System.Exception ex) { Mod.Log.Debug($"MailProducer read {entity.Index}: {ex.Message}"); }
            }
        }
    }
}
