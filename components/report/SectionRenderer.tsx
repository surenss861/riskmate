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
} from './sections'

interface SectionRendererProps {
  section: SectionData
}

export function SectionRenderer({ section }: SectionRendererProps) {
  switch (section.type) {
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

    case 'attestations':
      // Placeholder - will implement when signatures are ready
      return (
        <div className="page">
          <h2 className="section-header">Attestations</h2>
          <p className="empty-state">
            {section.meta?.emptyMessage || 'No attestations available'}
          </p>
        </div>
      )

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
      // Skip unimplemented sections for now
      return null

    default:
      console.warn(`[SectionRenderer] Unknown section type: ${section.type}`)
      return null
  }
}

