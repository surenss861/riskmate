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
      return {
        type: 'attestations',
        data: {
          items: [], // Will be populated when signatures are implemented
        },
        meta: {
          title: 'Attestations',
          empty: true,
          emptyMessage: 'No attestations available',
        },
      }

    case 'evidence_photos':
      const photos = documents.filter((doc) => doc.type === 'photo')
      return {
        type: 'evidence_photos',
        data: {
          photos: photos.map((photo) => ({
            id: photo.id,
            name: photo.name,
            url: photo.url,
            createdAt: photo.created_at,
          })),
          count: photos.length,
        },
        meta: {
          title: 'Evidence Photos',
          empty: photos.length === 0,
          emptyMessage: 'No photos attached',
        },
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
      // TODO: Fetch audit logs if available
      return {
        type: 'audit_timeline',
        data: {
          events: [], // Will be populated from audit logs
        },
        meta: {
          title: 'Audit Timeline',
          empty: true,
          emptyMessage: 'No audit events available',
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

    default:
      console.warn(`[packet-builder] Unknown section type: ${sectionType}`)
      return null
  }
}

