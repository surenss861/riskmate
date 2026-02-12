/**
 * Packet Engine Types
 * 
 * Defines the structure for config-driven report packet generation.
 * Each packet type specifies which sections to include and their ordering.
 */

export type PacketType = 'insurance' | 'audit' | 'incident' | 'client_compliance'

export type SectionType =
  | 'table_of_contents'
  | 'executive_summary'
  | 'job_summary'
  | 'risk_score'
  | 'mitigations'
  | 'audit_timeline'
  | 'attachments_index'
  | 'capability_violations'
  | 'role_assignment_record'
  | 'access_governance_trail'
  | 'corrective_actions'
  | 'flagged_job_details'
  | 'escalation_trail'
  | 'accountability_timeline'
  | 'mitigation_checklist'
  | 'attestations'
  | 'checklist_completion'
  | 'evidence_photos'
  | 'compliance_status'
  | 'requirements_evidence_matrix'
  | 'integrity_verification'
  | 'signature_proof'

export interface PacketDefinition {
  /** Display title for the packet */
  title: string
  /** Sections to include in order */
  sections: SectionType[]
  /** Permissions required to export this packet */
  permissions?: string[]
  /** Storage path pattern (optional, defaults to standard pattern) */
  storagePath?: string
  /** Whether to redact internal-only data */
  redactInternal?: boolean
  /** Whether client-facing only */
  clientFacingOnly?: boolean
}

export interface PacketConfig {
  [key: string]: PacketDefinition
}

/**
 * Packet definitions - single source of truth for all packet types
 */
export const PACKETS: Record<PacketType, PacketDefinition> = {
  insurance: {
    title: 'Insurance Report',
    sections: [
      'table_of_contents',
      'executive_summary',
      'job_summary',
      'risk_score',
      'mitigations',
      'audit_timeline',
      'attachments_index',
      'integrity_verification',
    ],
    clientFacingOnly: false, // Insurance may include internal notes
    redactInternal: false,
  },
  audit: {
    title: 'Audit Report',
    sections: [
      'table_of_contents',
      'executive_summary',
      'capability_violations',
      'role_assignment_record',
      'access_governance_trail',
      'corrective_actions',
      'job_summary',
      'risk_score',
      'integrity_verification',
    ],
    redactInternal: false, // Audit includes governance data
    clientFacingOnly: false,
  },
  incident: {
    title: 'Incident Report',
    sections: [
      'table_of_contents',
      'executive_summary',
      'flagged_job_details',
      'escalation_trail',
      'accountability_timeline',
      'mitigation_checklist',
      'risk_score',
      'integrity_verification',
    ],
    redactInternal: false,
    clientFacingOnly: false,
  },
  client_compliance: {
    title: 'Client Compliance Report',
    sections: [
      'table_of_contents',
      'executive_summary',
      'job_summary',
      'compliance_status',
      'requirements_evidence_matrix',
      'mitigations',
      'attestations',
      'checklist_completion',
      'evidence_photos',
      'attachments_index',
      'integrity_verification',
    ],
    clientFacingOnly: true, // Client-facing only, redact internal data
    redactInternal: true,
  },
}

/**
 * Get packet definition by type
 */
export function getPacketDefinition(packetType: PacketType): PacketDefinition {
  const definition = PACKETS[packetType]
  if (!definition) {
    throw new Error(`Unknown packet type: ${packetType}`)
  }
  return definition
}

/**
 * Validate packet type
 */
export function isValidPacketType(type: string): type is PacketType {
  return type in PACKETS
}

