/**
 * Section Renderer Component
 * Renders the appropriate section component based on section type
 */

import type { SectionData } from '@/lib/utils/packets/builder'
import {
  JobSummarySection,
  RiskScoreSection,
  MitigationsSection,
  HazardChecklistSection,
  EvidencePhotosSection,
  AttachmentsIndexSection,
  ComplianceStatusSection,
  ExecutiveSummarySection,
  IntegrityVerificationSection,
  TableOfContentsSection,
  AuditTimelineSection,
} from './sections'

interface SectionRendererProps {
  section: SectionData
}

export function SectionRenderer({ section }: SectionRendererProps) {
  // Skip empty sections entirely (no empty pages)
  if (section.meta?.empty) {
    return null
  }

  switch (section.type) {
    case 'table_of_contents':
      return <TableOfContentsSection data={section.data} />

    case 'executive_summary':
      return <ExecutiveSummarySection data={section.data} />

    case 'job_summary':
      return <JobSummarySection data={section.data} />

    case 'risk_score':
      return (
        <RiskScoreSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'mitigations':
      return (
        <MitigationsSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'mitigation_checklist':
      // For now, use hazard checklist for mitigation checklist
      return (
        <HazardChecklistSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'evidence_photos':
      return (
        <EvidencePhotosSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'attachments_index':
      return (
        <AttachmentsIndexSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'compliance_status':
      return <ComplianceStatusSection data={section.data} />

    case 'audit_timeline':
      return (
        <AuditTimelineSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'integrity_verification':
      return <IntegrityVerificationSection data={section.data} />

    case 'attestations':
      // Skip empty attestations (no empty page)
      // Will show when signatures are implemented
      return null

    // Placeholder sections (to be implemented)
    case 'audit_timeline':
    case 'capability_violations':
    case 'role_assignment_record':
    case 'access_governance_trail':
    case 'corrective_actions':
    case 'flagged_job_details':
    case 'escalation_trail':
    case 'accountability_timeline':
    case 'checklist_completion':
      // Skip unimplemented sections (no empty pages)
      return null

    default:
      console.warn(`[SectionRenderer] Unknown section type: ${section.type}`)
      return null
  }
}

