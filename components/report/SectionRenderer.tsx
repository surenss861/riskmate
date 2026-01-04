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
  RequirementsEvidenceMatrixSection,
  CapabilityViolationsSection,
  RoleAssignmentRecordSection,
  AccessGovernanceTrailSection,
  CorrectiveActionsSection,
  FlaggedJobDetailsSection,
  EscalationTrailSection,
  AccountabilityTimelineSection,
  ChecklistCompletionSection,
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

    case 'requirements_evidence_matrix':
      return (
        <RequirementsEvidenceMatrixSection
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

    case 'capability_violations':
      return (
        <CapabilityViolationsSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'role_assignment_record':
      return (
        <RoleAssignmentRecordSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'access_governance_trail':
      return (
        <AccessGovernanceTrailSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'corrective_actions':
      return (
        <CorrectiveActionsSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'flagged_job_details':
      return (
        <FlaggedJobDetailsSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'escalation_trail':
      return (
        <EscalationTrailSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'accountability_timeline':
      return (
        <AccountabilityTimelineSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    case 'checklist_completion':
      return (
        <ChecklistCompletionSection
          data={section.data}
          empty={section.meta?.empty}
          emptyMessage={section.meta?.emptyMessage}
        />
      )

    default:
      console.warn(`[SectionRenderer] Unknown section type: ${section.type}`)
      return null
  }
}

