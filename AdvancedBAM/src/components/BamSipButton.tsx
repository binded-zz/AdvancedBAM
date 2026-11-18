import { logCatch } from '../utils/devWarn';
import React, { useCallback, useMemo } from 'react';
import { bindValue } from 'cs2/api';
import { selectedInfo } from 'cs2/bindings';
import { Tooltip } from 'cs2/ui';
import apiSafe, { safeUseValue } from '../core/apiSafe';
import { BAM_GROUP, CHANNELS } from '../core/channels';
import './BamSipButton.css';

const fallbackSelectedEntity$ = bindValue<any>('selectedInfo', 'selectedEntity');
const fallbackTopSections$ = bindValue<any[]>('selectedInfo', 'topSections');
const fallbackMiddleSections$ = bindValue<any[]>('selectedInfo', 'middleSections');
const fallbackBottomSections$ = bindValue<any[]>('selectedInfo', 'bottomSections');

const BUILDING_OR_ASSET_SECTION_TYPES = new Set<string>([
  'Game.UI.InGame.LevelSection',
  'Game.UI.InGame.EfficiencySection',
  'Game.UI.InGame.EmployeesSection',
  'Game.UI.InGame.UpkeepSection',
  'Game.UI.InGame.CompanySection',
  'Game.UI.InGame.StorageSection',
  'Game.UI.InGame.TradedResourcesSection',
  'Game.UI.InGame.ProfitabilitySection',
  'Game.UI.InGame.AttractivenessSection',
  'Game.UI.InGame.ParkSection',
  'Game.UI.InGame.UpgradesSection',
  'Game.UI.InGame.UpgradePropertiesSection',
  'Game.UI.InGame.DestroyedBuildingSection',
  'Game.UI.InGame.EducationSection',
  'Game.UI.InGame.HealthcareSection',
  'Game.UI.InGame.DeathcareSection',
  'Game.UI.InGame.GarbageSection',
  'Game.UI.InGame.PoliceSection',
  'Game.UI.InGame.ElectricitySection',
  'Game.UI.InGame.TransformerSection',
  'Game.UI.InGame.BatterySection',
  'Game.UI.InGame.WaterSection',
  'Game.UI.InGame.SewageSection',
  'Game.UI.InGame.FireSection',
  'Game.UI.InGame.PrisonSection',
  'Game.UI.InGame.ShelterSection',
  'Game.UI.InGame.ParkingSection',
  'Game.UI.InGame.MailSection',
  'Game.UI.InGame.LocalServicesSection',
]);

const NON_BAM_ONLY_SECTION_TYPES = new Set<string>([
  'Game.UI.InGame.RoadSection',
  'Game.UI.InGame.DestroyedTreeSection',
  'Game.UI.InGame.AnimalSection',
  'Game.UI.InGame.DummyHumanSection',
  'Game.UI.InGame.LineSection',
  'Game.UI.InGame.LineVisualizerSection',
  'Game.UI.InGame.ScheduleSection',
  'Game.UI.InGame.TicketPriceSection',
  'Game.UI.InGame.VehicleCountSection',
  'Game.UI.InGame.SelectVehiclesSection',
  'Game.UI.InGame.PrivateVehicleSection',
  'Game.UI.InGame.PublicTransportVehicleSection',
  'Game.UI.InGame.CargoTransportVehicleSection',
  'Game.UI.InGame.DeliveryVehicleSection',
  'Game.UI.InGame.HealthcareVehicleSection',
  'Game.UI.InGame.FireVehicleSection',
  'Game.UI.InGame.PoliceVehicleSection',
  'Game.UI.InGame.MaintenanceVehicleSection',
  'Game.UI.InGame.DeathcareVehicleSection',
  'Game.UI.InGame.PostVehicleSection',
  'Game.UI.InGame.GarbageVehicleSection',
  'Game.UI.InGame.ExtractorVehicleSection',
]);

const isValidEntity = (ent: any): ent is { index: number; version: number } =>
  Boolean(ent && typeof ent.index === 'number' && ent.index > 0 && typeof ent.version === 'number');

interface BamSipButtonProps {
  entity?: { index: number; version: number };
}

export const BamSipButton: React.FC<BamSipButtonProps> = ({ entity }) => {
  const currentEntity = safeUseValue<any>(
    selectedInfo?.selectedEntity$ ?? fallbackSelectedEntity$,
    null
  );
  const topSections = safeUseValue<any[]>(
    (selectedInfo as any)?.topSections$ ?? fallbackTopSections$,
    []
  );
  const middleSections = safeUseValue<any[]>(
    selectedInfo?.middleSections$ ?? fallbackMiddleSections$,
    []
  );
  const bottomSections = safeUseValue<any[]>(
    (selectedInfo as any)?.bottomSections$ ?? fallbackBottomSections$,
    []
  );

  const rawTargetEntity = entity || currentEntity;

  const inspectionMeta = useMemo(() => {
    if (!isValidEntity(rawTargetEntity)) {
      return { canInspect: false, isDistrict: false, resolvedEntity: null as { index: number; version: number } | null };
    }

    const sections = [
      ...(Array.isArray(topSections) ? topSections : []),
      ...(Array.isArray(middleSections) ? middleSections : []),
      ...(Array.isArray(bottomSections) ? bottomSections : []),
    ];

    // If an explicit entity prop was passed directly, allow inspecting it
    if (entity && isValidEntity(entity) && sections.length === 0) {
      return { canInspect: true, isDistrict: false, resolvedEntity: entity };
    }

    if (sections.length === 0) {
      return { canInspect: false, isDistrict: false, resolvedEntity: null };
    }

    let hasBuildingOrAsset = false;
    let hasNonBamOnly = false;
    let hasPolicies = false;
    let hasDistrictResidents = false;
    let linkedBuildingEntity: { index: number; version: number } | null = null;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      if (!sec) continue;
      const type = String(sec.__Type || '');
      if (!type) continue;

      if (NON_BAM_ONLY_SECTION_TYPES.has(type)) {
        hasNonBamOnly = true;
      }

      if (BUILDING_OR_ASSET_SECTION_TYPES.has(type)) {
        hasBuildingOrAsset = true;
      }

      if (type === 'Game.UI.InGame.PoliciesSection') {
        hasPolicies = true;
      }

      if (type === 'Game.UI.InGame.ResidentsSection') {
        if (sec.isDistrict) {
          hasDistrictResidents = true;
        } else if (sec.isHousehold) {
          if (isValidEntity(sec.residenceEntity)) {
            linkedBuildingEntity = sec.residenceEntity;
          }
        } else {
          // Residential building
          hasBuildingOrAsset = true;
        }
      }

      if (type === 'Game.UI.InGame.CitizenSection') {
        if (isValidEntity(sec.residenceEntity)) {
          linkedBuildingEntity = sec.residenceEntity;
        } else if (isValidEntity(sec.workplaceEntity)) {
          linkedBuildingEntity = sec.workplaceEntity;
        } else if (isValidEntity(sec.schoolEntity)) {
          linkedBuildingEntity = sec.schoolEntity;
        }
      }
    }

    // Hide on roads/nets, trees, routes, vehicles, animals, dummy humans
    if (hasNonBamOnly && !hasBuildingOrAsset) {
      return { canInspect: false, isDistrict: false, resolvedEntity: null };
    }

    // Buildings, Service Upgrades/Extensions, Companies, Parks
    if (hasBuildingOrAsset) {
      return { canInspect: true, isDistrict: false, resolvedEntity: rawTargetEntity };
    }

    // District area selected in Native SIP (has PoliciesSection or District ResidentsSection, without Building sections)
    if (hasPolicies || hasDistrictResidents) {
      return { canInspect: true, isDistrict: true, resolvedEntity: rawTargetEntity };
    }

    // Household or Citizen with an associated home / workplace / school building
    if (linkedBuildingEntity) {
      return { canInspect: true, isDistrict: false, resolvedEntity: linkedBuildingEntity };
    }

    return { canInspect: false, isDistrict: false, resolvedEntity: null };
  }, [rawTargetEntity, entity, topSections, middleSections, bottomSections]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const target = inspectionMeta.resolvedEntity;
      if (target && isValidEntity(target)) {
        try {
          apiSafe.trigger('audio', 'playSound', 'select-item', 1);
        } catch (err) { logCatch('BamSipButton', err); }
        apiSafe.trigger(BAM_GROUP, CHANNELS.FOCUS_BUILDING_IN_BAM, target.index, target.version);
        apiSafe.trigger(BAM_GROUP, CHANNELS.SET_WINDOW_VISIBLE, true);
      }
    },
    [inspectionMeta.resolvedEntity]
  );

  if (!inspectionMeta.canInspect || !inspectionMeta.resolvedEntity) {
    return null;
  }

  const tooltipLabel = inspectionMeta.isDistrict
    ? 'Inspect District in BAM'
    : 'Inspect in Building & Asset Manager';

  return (
    <div className="bamSipButtonWrapper">
      <Tooltip tooltip={tooltipLabel}>
        <button
          id="bam-sip-action-btn"
          className="bamSipButton"
          onClick={handleClick}
          type="button"
        >
          <div className="bamSipIconBadge">
            <span className="bamSipText">BAM</span>
          </div>
        </button>
      </Tooltip>
    </div>
  );
};

export default BamSipButton;
