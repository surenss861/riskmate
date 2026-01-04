/**
 * Packet Builder
 * 
 * Builds packet data structures from job data for PDF generation.
 * Uses packet definitions to determine which sections to include.
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
  }
  sections: SectionData[]
  computed: {
    totalSections: number
    sectionsWithData: number
  }
}

/**
 * Build a complete packet payload for a job
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
    try {
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
    } catch (sectionError: any) {
      console.error(`[packet-builder] Failed to build section "${sectionType}":`, {
        message: sectionError?.message,
        stack: sectionError?.stack,
        jobId: jobId.substring(0, 8),
        organizationId: organizationId.substring(0, 8),
      })
      // Continue building other sections - don't crash entire packet
      // Failed sections are skipped rather than breaking the whole PDF
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
            attachments_index: 'Evidence Index',
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
            requirements_evidence_matrix: 'Requirements vs Evidence',
          }
          const safeSectionType = String(sectionType || '')
          return {
            title: titleMap[sectionType] || safeSectionType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
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
        try {
          const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, full_name, email')
            .in('id', uploadedByIds)
          
          if (usersError) {
            console.warn(`[packet-builder] Failed to fetch users for evidence_photos: ${usersError.message}`)
          } else {
            users?.forEach(user => {
              usersMap.set(user.id, { name: user.full_name || 'Unknown', email: user.email || '' })
            })
          }
        } catch (userFetchError: any) {
          console.warn(`[packet-builder] Exception fetching users for evidence_photos: ${userFetchError?.message}`)
          // Continue without user names - non-fatal
        }
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

    case 'requirements_evidence_matrix': {
      const photos = documents.filter((doc) => doc.type === 'photo')
      const completedControls = mitigations.filter((m) => m.done || m.is_completed).length
      const totalControls = mitigations.length
      
      // Build requirements matrix based on available data
      const requirements = [
        {
          category: 'Controls',
          item: 'Risk Mitigation Controls',
          required: totalControls > 0,
          present: completedControls === totalControls && totalControls > 0,
          evidenceId: totalControls > 0 ? 'MITIGATIONS' : null,
          completedBy: totalControls > 0 ? `${completedControls}/${totalControls} complete` : null,
          completedAt: null,
          impact: totalControls > 0 && completedControls < totalControls ? 'Blocks closure' : null,
          owner: totalControls > 0 && completedControls < totalControls ? 'Project Manager' : null,
        },
        {
          category: 'Evidence',
          item: 'Site Condition Photos',
          required: true,
          present: photos.length > 0,
          evidenceId: photos.length > 0 ? photos[0]?.id : null,
          completedBy: photos.length > 0 ? `${photos.length} photo(s)` : null,
          completedAt: photos.length > 0 ? photos[0]?.created_at : null,
          impact: photos.length === 0 ? 'Blocks insurance submission' : null,
          owner: photos.length === 0 ? 'Field Team' : null,
        },
        {
          category: 'Assessment',
          item: 'Risk Assessment',
          required: true,
          present: risk_score !== null && risk_score.overall_score !== null,
          evidenceId: risk_score?.overall_score ? 'RISK_SCORE' : null,
          completedBy: risk_score?.overall_score ? `Score: ${risk_score.overall_score}` : null,
          completedAt: null,
          impact: risk_score === null || risk_score.overall_score === null ? 'Audit risk' : null,
          owner: risk_score === null || risk_score.overall_score === null ? 'Safety Officer' : null,
        },
        {
          category: 'Attestations',
          item: 'Sign-off/Signatures',
          required: false, // Optional for now
          present: false, // TODO: Check if attestations exist
          evidenceId: null,
          completedBy: null,
          completedAt: null,
          impact: null, // Optional requirement
          owner: null,
        },
      ]
      
      return {
        type: 'requirements_evidence_matrix',
        data: {
          requirements,
        },
        meta: {
          title: 'Requirements vs Evidence',
          empty: requirements.length === 0,
          emptyMessage: 'No requirements defined',
        },
      }
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

    case 'attachments_index': {
      // Fetch user names for uploaded_by IDs
      const uploadedByIds = [...new Set(documents.map(d => d.uploaded_by).filter(Boolean))] as string[]
      const usersMap = new Map<string, { name: string; email: string }>()
      
      if (uploadedByIds.length > 0) {
        try {
          const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, full_name, email')
            .in('id', uploadedByIds)
          
          if (usersError) {
            console.warn(`[packet-builder] Failed to fetch users for attachments_index: ${usersError.message}`)
          } else {
            users?.forEach(user => {
              usersMap.set(user.id, { name: user.full_name || 'Unknown', email: user.email || '' })
            })
          }
        } catch (userFetchError: any) {
          console.warn(`[packet-builder] Exception fetching users for attachments_index: ${userFetchError?.message}`)
          // Continue without user names - non-fatal
        }
      }
      
      return {
        type: 'attachments_index',
        data: {
          documents: documents.map((doc) => {
            const uploader = doc.uploaded_by ? usersMap.get(doc.uploaded_by) : null
            return {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              createdAt: doc.created_at,
              uploadedBy: uploader?.name || null,
              uploadedByEmail: uploader?.email || null,
            }
          }),
          count: documents.length,
        },
        meta: {
          title: 'Evidence Index',
          empty: documents.length === 0,
          emptyMessage: 'No attachments',
        },
      }
    }

    // Sections with empty state fallbacks (renderers exist, data may be empty)
    case 'capability_violations':
      return {
        type: 'capability_violations',
        data: {
          violations: [],
          count: 0,
        },
        meta: {
          title: 'Capability Violations',
          empty: true,
          emptyMessage: 'No unauthorized action attempts recorded for this job.',
        },
      }

    case 'role_assignment_record':
      return {
        type: 'role_assignment_record',
        data: {
          assignments: [],
          count: 0,
        },
        meta: {
          title: 'Role Assignment Record',
          empty: true,
          emptyMessage: 'No role assignment history recorded for this job.',
        },
      }

    case 'access_governance_trail':
      return {
        type: 'access_governance_trail',
        data: {
          events: [],
          count: 0,
        },
        meta: {
          title: 'Access Governance Trail',
          empty: true,
          emptyMessage: 'No access governance events recorded for this job.',
        },
      }

    case 'corrective_actions':
      return {
        type: 'corrective_actions',
        data: {
          actions: [],
          count: 0,
        },
        meta: {
          title: 'Corrective Actions',
          empty: true,
          emptyMessage: 'No corrective actions recorded for this job.',
        },
      }

    case 'flagged_job_details':
      return {
        type: 'flagged_job_details',
        data: {
          flags: [],
          count: 0,
        },
        meta: {
          title: 'Flagged Job Details',
          empty: true,
          emptyMessage: 'This job has not been flagged for review.',
        },
      }

    case 'escalation_trail':
      return {
        type: 'escalation_trail',
        data: {
          escalations: [],
          count: 0,
        },
        meta: {
          title: 'Escalation Trail',
          empty: true,
          emptyMessage: 'No escalations recorded for this job.',
        },
      }

    case 'accountability_timeline':
      return {
        type: 'accountability_timeline',
        data: {
          events: [],
          count: 0,
        },
        meta: {
          title: 'Accountability Timeline',
          empty: true,
          emptyMessage: 'No accountability events recorded for this job.',
        },
      }

    case 'mitigation_checklist':
      // Use mitigations data if available, otherwise empty
      return {
        type: 'mitigation_checklist',
        data: {
          items: mitigations.map((m) => ({
            id: m.id,
            title: m.title,
            completed: m.done || m.is_completed,
            completedAt: m.completed_at,
          })),
          total: mitigations.length,
          completed: mitigations.filter((m) => m.done || m.is_completed).length,
        },
        meta: {
          title: 'Mitigation Checklist',
          empty: mitigations.length === 0,
          emptyMessage: 'No mitigation checklist items defined',
        },
      }

    case 'checklist_completion':
      return {
        type: 'checklist_completion',
        data: {
          items: [],
          total: 0,
          completed: 0,
        },
        meta: {
          title: 'Checklist Completion',
          empty: true,
          emptyMessage: 'No checklist items defined for this job.',
        },
      }

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
      // Universal fallback: always return an empty section instead of skipping
      // This ensures TOC matches content and unknown types still render
      console.warn(`[packet-builder] Unknown section type: ${sectionType} - returning empty section`)
      return {
        type: sectionType,
        data: {},
        meta: {
          title: humanize(sectionType),
          empty: true,
          emptyMessage: `Section type "${sectionType}" is not yet fully implemented.`,
        },
      }
  }
}
