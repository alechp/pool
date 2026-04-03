export type HardwareVisualVariant =
  | 'gateway-zigbee-budget'
  | 'gateway-zigbee-premium'
  | 'gateway-lora-budget'
  | 'gateway-lora-premium'
  | 'sensor-standalone-budget'
  | 'sensor-standalone-premium'
  | 'sensor-zigbee-budget'
  | 'sensor-zigbee-premium'
  | 'sensor-lora-budget'
  | 'sensor-lora-premium'
  | 'part-board'
  | 'part-camera'
  | 'part-radar'
  | 'part-battery'
  | 'part-enclosure'
  | 'part-wiring'
  | 'part-power'
  | 'part-storage'
  | 'part-antenna'
  | 'part-audio'
  | 'part-accessory';

export function getHubVisualVariant(hubTierId?: string | null): HardwareVisualVariant {
  switch (hubTierId) {
    case 'zigbee-cheap':
      return 'gateway-zigbee-budget';
    case 'zigbee-premium':
      return 'gateway-zigbee-premium';
    case 'lora-cheap':
      return 'gateway-lora-budget';
    case 'lora-premium':
      return 'gateway-lora-premium';
    default:
      return 'gateway-zigbee-budget';
  }
}

export function getSensorVisualVariant(sensorTierId?: string | null): HardwareVisualVariant {
  switch (sensorTierId) {
    case 'sa-cheap':
      return 'sensor-standalone-budget';
    case 'sa-premium':
      return 'sensor-standalone-premium';
    case 'zb-cheap':
      return 'sensor-zigbee-budget';
    case 'zb-premium':
      return 'sensor-zigbee-premium';
    case 'lr-cheap':
      return 'sensor-lora-budget';
    case 'lr-premium':
      return 'sensor-lora-premium';
    default:
      return 'sensor-standalone-budget';
  }
}

export function getPartVisualVariant(partName: string): HardwareVisualVariant {
  const value = partName.toLowerCase();

  if (value.includes('camera')) return 'part-camera';
  if (value.includes('mmwave') || value.includes('radar')) return 'part-radar';
  if (value.includes('battery') || value.includes('lipo')) return 'part-battery';
  if (value.includes('box') || value.includes('enclosure') || value.includes('case')) return 'part-enclosure';
  if (value.includes('wiring') || value.includes('sealant') || value.includes('standoff') || value.includes('desiccant')) return 'part-wiring';
  if (value.includes('adapter') || value.includes('psu') || value.includes('wall') || value.includes('power')) return 'part-power';
  if (value.includes('microsd') || value.includes('sd')) return 'part-storage';
  if (value.includes('antenna') || value.includes('hat') || value.includes('slzb')) return 'part-antenna';
  if (value.includes('microphone')) return 'part-audio';
  if (
    value.includes('esp32') ||
    value.includes('raspberry pi') ||
    value.includes('heltec') ||
    value.includes('freenove')
  ) {
    return 'part-board';
  }

  return 'part-accessory';
}
