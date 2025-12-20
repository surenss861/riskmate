/**
 * Industry-specific language mapping
 * Transforms generic terms into vertical-native language
 */

export type IndustryVertical = 
  | 'facilities' 
  | 'fire_life_safety' 
  | 'heavy_civil' 
  | 'commercial_contractors' 
  | 'residential_trades' 
  | 'default'

export interface IndustryLanguage {
  job: string
  site: string
  proofPack: string
  compliancePacket: string
  workOrder: string
  facility: string
  project: string
  corridor: string
}

const LANGUAGE_MAP: Record<IndustryVertical, IndustryLanguage> = {
  facilities: {
    job: 'Work Order',
    site: 'Facility',
    proofPack: 'Compliance Packet',
    compliancePacket: 'Compliance Packet',
    workOrder: 'Work Order',
    facility: 'Facility',
    project: 'Project',
    corridor: 'Corridor',
  },
  fire_life_safety: {
    job: 'Inspection',
    site: 'Location',
    proofPack: 'Inspection Report',
    compliancePacket: 'Regulatory Compliance Packet',
    workOrder: 'Work Order',
    facility: 'Facility',
    project: 'Project',
    corridor: 'Corridor',
  },
  heavy_civil: {
    job: 'Work Package',
    site: 'Project / Corridor',
    proofPack: 'Owner/Regulator Packet',
    compliancePacket: 'Owner/Regulator Packet',
    workOrder: 'Work Package',
    facility: 'Site',
    project: 'Project',
    corridor: 'Corridor',
  },
  commercial_contractors: {
    job: 'Job',
    site: 'Site',
    proofPack: 'Client Compliance Packet',
    compliancePacket: 'Client Compliance Packet',
    workOrder: 'Job',
    facility: 'Site',
    project: 'Project',
    corridor: 'Corridor',
  },
  residential_trades: {
    job: 'Job',
    site: 'Location',
    proofPack: 'Insurance Packet',
    compliancePacket: 'Insurance Packet',
    workOrder: 'Job',
    facility: 'Location',
    project: 'Project',
    corridor: 'Corridor',
  },
  default: {
    job: 'Job',
    site: 'Site',
    proofPack: 'Proof Pack',
    compliancePacket: 'Compliance Packet',
    workOrder: 'Job',
    facility: 'Site',
    project: 'Project',
    corridor: 'Corridor',
  },
}

export function getIndustryLanguage(vertical?: string | null): IndustryLanguage {
  if (!vertical) return LANGUAGE_MAP.default
  
  const normalized = vertical.toLowerCase().replace(/[^a-z0-9]/g, '_')
  
  if (normalized.includes('facilities') || normalized.includes('building_services')) {
    return LANGUAGE_MAP.facilities
  }
  if (normalized.includes('fire') || normalized.includes('life_safety')) {
    return LANGUAGE_MAP.fire_life_safety
  }
  if (normalized.includes('heavy_civil') || normalized.includes('infrastructure')) {
    return LANGUAGE_MAP.heavy_civil
  }
  if (normalized.includes('commercial') || normalized.includes('contractor')) {
    return LANGUAGE_MAP.commercial_contractors
  }
  if (normalized.includes('residential') || normalized.includes('trade')) {
    return LANGUAGE_MAP.residential_trades
  }
  
  return LANGUAGE_MAP.default
}

