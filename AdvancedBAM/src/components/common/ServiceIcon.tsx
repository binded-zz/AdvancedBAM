import React from 'react';

interface ServiceIconProps {
  service?: string;
  sizeRem?: number;
  showLabel?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const SERVICE_ICONS: Record<string, string> = {
  electricity: 'Media/Game/Icons/Electricity.svg',
  power: 'Media/Game/Icons/Electricity.svg',
  water: 'Media/Game/Icons/Water.svg',
  sewage: 'Media/Game/Icons/Water.svg',
  healthcare: 'Media/Game/Icons/Healthcare.svg',
  health: 'Media/Game/Icons/Healthcare.svg',
  hospital: 'Media/Game/Icons/Healthcare.svg',
  deathcare: 'Media/Game/Icons/Deathcare.svg',
  cemetery: 'Media/Game/Icons/Deathcare.svg',
  crematorium: 'Media/Game/Icons/Deathcare.svg',
  firesafety: 'Media/Game/Icons/FireSafety.svg',
  fire: 'Media/Game/Icons/FireSafety.svg',
  disaster: 'Media/Game/Icons/DisasterControl.svg',
  disastercontrol: 'Media/Game/Icons/DisasterControl.svg',
  police: 'Media/Game/Icons/Police.svg',
  administration: 'Media/Game/Icons/Police.svg',
  policeadministration: 'Media/Game/Icons/Police.svg',
  education: 'Media/Game/Icons/Education.svg',
  educationresearch: 'Media/Game/Icons/Education.svg',
  research: 'Media/Game/Icons/Education.svg',
  school: 'Media/Game/Icons/Education.svg',
  college: 'Media/Game/Icons/Education.svg',
  university: 'Media/Game/Icons/Education.svg',
  parksrecreation: 'Media/Game/Icons/ParksAndRecreation.svg',
  parks: 'Media/Game/Icons/ParksAndRecreation.svg',
  park: 'Media/Game/Icons/ParksAndRecreation.svg',
  recreation: 'Media/Game/Icons/ParksAndRecreation.svg',
  tourism: 'Media/Game/Icons/ParksAndRecreation.svg',
  transportation: 'Media/Game/Icons/Transportation.svg',
  transport: 'Media/Game/Icons/Transportation.svg',
  publictransport: 'Media/Game/Icons/Transportation.svg',
  transit: 'Media/Game/Icons/Transportation.svg',
  bus: 'Media/Game/Icons/Transportation.svg',
  train: 'Media/Game/Icons/Train.svg',
  tram: 'Media/Game/Icons/Tram.svg',
  subway: 'Media/Game/Icons/Subway.svg',
  ship: 'Media/Game/Icons/Ship.svg',
  airplane: 'Media/Game/Icons/PassengerAirplaneLine.svg',
  garbage: 'Media/Game/Icons/Garbage.svg',
  waste: 'Media/Game/Icons/Garbage.svg',
  recycling: 'Media/Game/Icons/WasteRecycling.svg',
  postservice: 'Media/Game/Icons/PostService.svg',
  post: 'Media/Game/Icons/PostService.svg',
  mail: 'Media/Game/Icons/PostService.svg',
  telecom: 'Media/Game/Icons/Telecom.svg',
  communications: 'Media/Game/Icons/Telecom.svg',
  network: 'Media/Game/Icons/Telecom.svg',
  roads: 'Media/Game/Icons/Roads.svg',
  road: 'Media/Game/Icons/Roads.svg',
  roadservices: 'Media/Game/Icons/RoadsServices.svg',
  parking: 'Media/Game/Icons/Parking.svg',
  services: 'Media/Game/Icons/Services.svg',
};

export const getServiceIconPath = (service?: string): string => {
  if (!service) return 'Media/Game/Icons/Services.svg';
  const clean = service.toLowerCase().replace(/[\s\-_&/]+/g, '');
  if (SERVICE_ICONS[clean]) return SERVICE_ICONS[clean];

  // Partial match checks
  if (clean.includes('electric') || clean.includes('power')) return SERVICE_ICONS.electricity;
  if (clean.includes('water') || clean.includes('sewage')) return SERVICE_ICONS.water;
  if (clean.includes('health') || clean.includes('hospital')) return SERVICE_ICONS.healthcare;
  if (clean.includes('death') || clean.includes('cemetery')) return SERVICE_ICONS.deathcare;
  if (clean.includes('fire')) return SERVICE_ICONS.firesafety;
  if (clean.includes('disaster')) return SERVICE_ICONS.disaster;
  if (clean.includes('police') || clean.includes('admin') || clean.includes('prison')) return SERVICE_ICONS.police;
  if (clean.includes('educat') || clean.includes('school') || clean.includes('college') || clean.includes('research')) return SERVICE_ICONS.education;
  if (clean.includes('parking') || clean.includes('garage')) return SERVICE_ICONS.parking;
  if (clean.includes('park') || clean.includes('recreat') || clean.includes('leisure') || clean.includes('touris')) return SERVICE_ICONS.parksrecreation;
  if (clean.includes('transport') || clean.includes('transit') || clean.includes('bus') || clean.includes('train')) return SERVICE_ICONS.transportation;
  if (clean.includes('garbag') || clean.includes('waste') || clean.includes('recycle')) return SERVICE_ICONS.garbage;
  if (clean.includes('post') || clean.includes('mail')) return SERVICE_ICONS.postservice;
  if (clean.includes('telecom') || clean.includes('communicat')) return SERVICE_ICONS.telecom;
  if (clean.includes('road')) return SERVICE_ICONS.roads;

  return 'Media/Game/Icons/Services.svg';
};

export const ServiceIcon: React.FC<ServiceIconProps> = ({
  service,
  sizeRem = 20,
  showLabel = false,
  style,
  className = '',
}) => {
  const iconPath = getServiceIconPath(service);
  const displayName = service || 'Service';

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...style,
      }}
      title={`Service: ${displayName}`}
    >
      <img
        src={iconPath}
        alt={displayName}
        style={{
          width: `${sizeRem}rem`,
          height: `${sizeRem}rem`,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          pointerEvents: 'none',
        }}
      />
      {showLabel && (
        <span
          style={{
            marginLeft: '5rem',
            fontSize: '11rem',
            color: '#eceff1',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </span>
      )}
    </div>
  );
};

export default ServiceIcon;
