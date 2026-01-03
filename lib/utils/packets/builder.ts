/**
 * Packet Builder
 * 
 * Builds job packet data for any packet type.
 * Sections are independent - no section relies on DOM/layout to compute anything.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildJobReport } from '@/lib/utils/jobReport'
import type { JobReportPayload } from '@/lib/utils/jobReport'
import { getPacketDefinition, type PacketType, type SectionType } from './types'

export interface SectionData {
  type: SectionType
  data: any
  meta?: {
    title?: string
    empty?: boolean
    emptyMessage?: string
  }
}

export interface JobPacketPayload {
  meta: {
    jobId: string
    organizationId: string
    packetType: PacketType
    packetTitle: string
    generatedAt: string
    generatedBy?: string
  }
  sections: SectionData[]
  computed: {
    totalSections: number
    sectionsWithData: number
  }
}

/**
 * Build job packet data for a specific packet type
 */
export async function buildJobPacket({
  jobId,
  packetType,
  organizationId,
  supabaseClient,
}: {
  jobId: string
  packetType: PacketType
  organizationId: string
  supabaseClient?: SupabaseClient
}): Promise<JobPacketPayload> {
  // Get packet definition
  const packetDef = getPacketDefinition(packetType)

  // Build base job report (contains all raw data)
  const baseReport = await buildJobReport(organizationId, jobId, supabaseClient)

  // Build sections based on packet definition
  const sections: SectionData[] = []

  // Get supabase client if not provided
  const client = supabaseClient || await (await import('@/lib/supabase/server')).createSupabaseServerClient()

  for (const sectionType of packetDef.sections) {
    const sectionData = await buildSectionData({
      sectionType,
      baseReport,
      packetDef,
      organizationId,
      jobId,
      supabaseClient: client,
    })

    if (sectionData) {
      sections.push(sectionData)
    }
  }

  // Compute metadata
  const sectionsWithData = sections.filter((s) => !s.meta?.empty).length

  return {
    meta: {
      jobId,
      organizationId,
      packetType,
      packetTitle: packetDef.title,
      generatedAt: new Date().toISOString(),
    },
    sections,
    computed: {
      totalSections: sections.length,
      sectionsWithData,
    },
  }
}

/**
 * Build data for a specific section type
 */
async function buildSectionData({
  sectionType,
  baseReport,
  packetDef,
  organizationId,
  jobId,
  supabaseClient,
}: {
  sectionType: SectionType
  baseReport: JobReportPayload
  packetDef: any
  organizationId: string
  jobId: string
  supabaseClient: SupabaseClient
}): Promise<SectionData | null> {
  const { job, risk_score, mitigations, documents, organization, audit } = baseReport

  switch (sectionType) {
    case 'table_of_contents':
      // Generate TOC from packet definition sections
      const tocSections = packetDef.sections
        .filter((s: SectionType) => s !== 'table_of_contents' && s !== 'integrity_verification')
        .map((sectionType: SectionType) => {
          // Map section types to titles
          const titleMap: Record<string, string> = {
            executive_summary: 'Executive Summary',
            job_summary: 'Job Summary',
            risk_score: 'Risk Assessment',
            mitigations: 'Controls Applied',
            audit_timeline: 'Audit Timeline',
            attachments_index: 'Attachments',
            attestations: 'Attestations',
            evidence_photos: 'Evidence Photos',
            compliance_status: 'Compliance Status',
            checklist_completion: 'Checklist Completion',
            capability_violations: 'Capability Violations',
            role_assignment_record: 'Role Assignment Record',
            access_governance_trail: 'Access Governance Trail',
            corrective_actions: 'Corrective Actions',
            flagged_job_details: 'Flagged Job Details',
            escalation_trail: 'Escalation Trail',
            accountability_timeline: 'Accountability Timeline',
            mitigation_checklist: 'Mitigation Checklist',
          }
          return {
            title: titleMap[sectionType] || sectionType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            page: undefined, // Page numbers would need to be computed after rendering
          }
        })
      
      return {
        type: 'table_of_contents',
        data: {
          sections: tocSections,
        },
        meta: {
          title: 'Table of Contents',
        },
      }

    case 'executive_summary': {
      const photos = documents.filter((doc) => doc.type === 'photo')
      const completedControls = mitigations.filter((m) => m.done || m.is_completed).length
      const totalControls = mitigations.length
      const hazardCount = risk_score?.factors?.length || 0
      
      return {
        type: 'executive_summary',
        data: {
          riskScore: risk_score?.overall_score || null,
          riskLevel: risk_score?.risk_level || null,
          hazardCount,
          controlsTotal: totalControls,
          controlsComplete: completedControls,
          attestationsCount: 0, // TODO: Fetch actual attestations
          evidenceCount: photos.length,
          jobStatus: job.status,
          packetType: packetDef.title,
        },
        meta: {
          title: 'Executive Summary',
        },
      }
    }

    case 'job_summary':
      return {
        type: 'job_summary',
        data: {
          client: job.client_name,
          location: job.location,
          jobType: job.job_type,
          status: job.status,
          startDate: job.start_date,
          endDate: job.end_date,
          description: packetDef.clientFacingOnly ? job.description : job.description, // Could redact internal notes
        },
        meta: {
          title: 'Job Summary',
        },
      }

    case 'risk_score':
      return {
        type: 'risk_score',
        data: {
          overallScore: risk_score?.overall_score || 0,
          riskLevel: risk_score?.risk_level || 'unknown',
          factors: risk_score?.factors || [],
        },
        meta: {
          title: 'Risk Assessment',
          empty: !risk_score || !risk_score.factors?.length,
          emptyMessage: 'No risk assessment data available',
        },
      }

    case 'mitigations':
      return {
        type: 'mitigations',
        data: {
          items: mitigations.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            completed: m.done || m.is_completed,
            completedAt: m.completed_at,
          })),
          total: mitigations.length,
          completed: mitigations.filter((m) => m.done || m.is_completed).length,
        },
        meta: {
          title: 'Controls Applied',
          empty: mitigations.length === 0,
          emptyMessage: 'No controls applied',
        },
      }

    case 'attestations':
      // TODO: Fetch attestations/signatures if available
      // Mark as empty to skip rendering (no empty pages)
      return {
        type: 'attestations',
        data: {
          items: [], // Will be populated when signatures are implemented
        },
        meta: {
          title: 'Attestations',
          empty: true, // Skip empty sections - no page rendered
          emptyMessage: 'Attestations required for closure — pending',
        },
      }

    case 'evidence_photos': {
      const photos = documents.filter((doc) => doc.type === 'photo')
      
      // Fetch user names for uploaded_by IDs
      const uploadedByIds = [...new Set(photos.map(p => p.uploaded_by).filter(Boolean))] as string[]
      const usersMap = new Map<string, { name: string; email: string }>()
      
      if (uploadedByIds.length > 0) {
        const { data: users } = await supabaseClient
          .from('users')
          .select('id, full_name, email')
          .in('id', uploadedByIds)
        
        users?.forEach(user => {
          usersMap.set(user.id, { name: user.full_name || 'Unknown', email: user.email || '' })
        })
      }
      
      return {
        type: 'evidence_photos',
        data: {
          photos: photos.map((photo) => {
            const uploader = photo.uploaded_by ? usersMap.get(photo.uploaded_by) : null
            return {
              id: photo.id,
              name: photo.name,
              url: photo.url,
              createdAt: photo.created_at,
              uploadedBy: uploader?.name || null,
              uploadedByEmail: uploader?.email || null,
            }
          }),
          count: photos.length,
        },
        meta: {
          title: 'Evidence Photos',
          empty: photos.length === 0,
          emptyMessage: 'No photos attached',
        },
      }
    }

    case 'compliance_status':
      return {
        type: 'compliance_status',
        data: {
          status: job.status,
          riskLevel: risk_score?.risk_level || 'unknown',
          controlsComplete: mitigations.filter((m) => m.done || m.is_completed).length === mitigations.length && mitigations.length > 0,
          hasAttestations: false, // TODO: Check if attestations exist
        },
        meta: {
          title: 'Compliance Status',
        },
      }

    case 'audit_timeline':
      const auditEvents = audit || []
      return {
        type: 'audit_timeline',
        data: {
          events: auditEvents.map((event) => ({
            id: event.id,
            eventType: event.event_type,
            userName: event.user_name || event.actor_name,
            createdAt: event.created_at,
            metadata: event.metadata,
          })),
          count: auditEvents.length,
        },
        meta: {
          title: 'Audit Timeline',
          empty: auditEvents.length === 0,
          emptyMessage: 'No audit events recorded',
        },
      }

    case 'attachments_index':
      return {
        type: 'attachments_index',
        data: {
          documents: documents.map((doc) => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            createdAt: doc.created_at,
          })),
          count: documents.length,
        },
        meta: {
          title: 'Attachments',
          empty: documents.length === 0,
          emptyMessage: 'No attachments',
        },
      }

    // Placeholder sections (to be implemented)
    case 'capability_violations':
    case 'role_assignment_record':
    case 'access_governance_trail':
    case 'corrective_actions':
    case 'flagged_job_details':
    case 'escalation_trail':
    case 'accountability_timeline':
    case 'mitigation_checklist':
    case 'checklist_completion':
      // These sections require additional data sources
      // For now, return null to skip them
      console.warn(`[packet-builder] Section type "${sectionType}" not yet implemented`)
      return null

    case 'integrity_verification':
      // This section will be populated by the print page with run ID and hash
      // Return placeholder - actual data comes from report_run and computed hash
      return {
        type: 'integrity_verification',
        data: {
          reportRunId: '', // Will be set by print page
          documentHash: '', // Will be set by print page
          hashAlgorithm: 'SHA-256',
          generatedAt: new Date().toISOString(),
          jobId,
          packetType: packetDef.title,
        },
        meta: {
          title: 'Integrity & Verification',
        },
      }

    default:
      console.warn(`[packet-builder] Unknown section type: ${sectionType}`)
      return null
  }
}

