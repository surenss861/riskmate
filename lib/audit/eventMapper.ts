/**
 * Audit Event Mapper
 * Converts raw event types into compliance-grade, human-readable labels
 */

export type EventCategory = 'governance' | 'operations' | 'access'
export type EventSeverity = 'info' | 'material' | 'critical'
export type EventOutcome = 'allowed' | 'blocked'

export interface EventMapping {
  title: string
  category: EventCategory
  severity: EventSeverity
  outcome: EventOutcome
  description: string
  policyStatement?: string
  whyItMatters?: string
  exposure?: {
    insurance?: string
    regulatory?: string
    owner?: string
  }
}

const EVENT_MAPPINGS: Record<string, EventMapping> = {
  // Governance Enforcement
  'auth.role_violation': {
    title: 'Capability Blocked: Unauthorized Action Attempted',
    category: 'governance',
    severity: 'critical',
    outcome: 'blocked',
    description: 'Action blocked due to insufficient role permissions',
    policyStatement: 'Role-based access control prevents unauthorized actions',
    whyItMatters: 'Prevents unauthorized record tampering and maintains audit integrity',
    exposure: {
      insurance: 'Weakens defensibility if approvals can be bypassed',
      regulatory: 'Non-compliant change control on safety artifacts',
      owner: 'Breaks separation of duties; increases dispute risk',
    },
  },
  'job.flagged_for_review': {
    title: 'Job Flagged for Review',
    category: 'governance',
    severity: 'material',
    outcome: 'allowed',
    description: 'Job marked for safety lead review',
    policyStatement: 'High-risk jobs require safety lead oversight',
    whyItMatters: 'Establishes accountability and escalation protocol',
    exposure: {
      insurance: 'Demonstrates proactive risk management and oversight',
      regulatory: 'Shows compliance with safety review requirements',
      owner: 'Establishes clear accountability chain for high-risk work',
    },
  },
  'job.unflagged': {
    title: 'Job Review Flag Removed',
    category: 'governance',
    severity: 'info',
    outcome: 'allowed',
    description: 'Job no longer requires review',
  },
  'job.review_assigned': {
    title: 'Review Assigned',
    category: 'governance',
    severity: 'info',
    outcome: 'allowed',
    description: 'Review responsibility assigned to specific role',
  },
  'job.review_note_added': {
    title: 'Review Note Added',
    category: 'governance',
    severity: 'info',
    outcome: 'allowed',
    description: 'Review comment or note recorded',
  },
  'job.review_resolved': {
    title: 'Review Resolved',
    category: 'governance',
    severity: 'material',
    outcome: 'allowed',
    description: 'Review completed with resolution outcome',
  },
  'job.risk_score_changed': {
    title: 'Risk Score Changed',
    category: 'operations',
    severity: 'material',
    outcome: 'allowed',
    description: 'Job risk score updated due to factor changes',
  },
  'mitigation.completed': {
    title: 'Mitigation Completed',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Risk mitigation action completed',
  },
  'mitigation.updated': {
    title: 'Mitigation Updated',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Mitigation checklist item modified',
  },
  'account.organization_updated': {
    title: 'Organization Settings Changed',
    category: 'governance',
    severity: 'material',
    outcome: 'allowed',
    description: 'Organization name or settings modified',
  },

  // Operational Actions
  'job.created': {
    title: 'Job Created',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'New job record created',
  },
  'job.updated': {
    title: 'Job Updated',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Job details modified',
  },
  'job.archived': {
    title: 'Job Archived',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Job moved to archived status',
  },
  'job.deleted': {
    title: 'Job Deleted',
    category: 'operations',
    severity: 'material',
    outcome: 'allowed',
    description: 'Job permanently removed from system',
  },
  'hazard.added': {
    title: 'Hazard Identified',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'New hazard added to job',
  },
  'hazard.removed': {
    title: 'Hazard Removed',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Hazard removed from job',
  },
  'mitigation.completed': {
    title: 'Mitigation Completed',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Risk mitigation action completed',
  },
  'photo.uploaded': {
    title: 'Photo Uploaded',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Evidence photo added to job',
  },
  'document.uploaded': {
    title: 'Document Uploaded',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'Document attached to job',
  },
  'proof_pack.generated': {
    title: 'Proof Pack Generated',
    category: 'operations',
    severity: 'material',
    outcome: 'allowed',
    description: 'Exportable proof pack created (Insurance/Audit/Incident/Compliance)',
  },
  'signoff.created': {
    title: 'Sign-off Recorded',
    category: 'operations',
    severity: 'material',
    outcome: 'allowed',
    description: 'Digital sign-off captured with timestamp and IP',
  },

  // Access & Security
  'team.invite_sent': {
    title: 'Team Invitation Sent',
    category: 'access',
    severity: 'info',
    outcome: 'allowed',
    description: 'User invitation sent',
  },
  'team.invite_accepted': {
    title: 'Team Invitation Accepted',
    category: 'access',
    severity: 'info',
    outcome: 'allowed',
    description: 'User joined organization',
  },
  'team.member_removed': {
    title: 'Access Revoked',
    category: 'access',
    severity: 'material',
    outcome: 'allowed',
    description: 'User access deactivated',
  },
  'team.role_changed': {
    title: 'Role Changed',
    category: 'access',
    severity: 'material',
    outcome: 'allowed',
    description: 'User role modified',
  },
  'security.login': {
    title: 'User Login',
    category: 'access',
    severity: 'info',
    outcome: 'allowed',
    description: 'User authenticated',
  },
  'security.password_changed': {
    title: 'Password Changed',
    category: 'access',
    severity: 'material',
    outcome: 'allowed',
    description: 'User password updated',
  },
  'security.session_revoked': {
    title: 'Session Revoked',
    category: 'access',
    severity: 'info',
    outcome: 'allowed',
    description: 'User session terminated',
  },
}

export function getEventMapping(eventType: string): EventMapping {
  return EVENT_MAPPINGS[eventType] || {
    title: eventType?.replace(/_/g, ' ').replace(/\./g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown Event',
    category: 'operations',
    severity: 'info',
    outcome: 'allowed',
    description: 'System event recorded',
  }
}

export function categorizeEvent(eventType: string): EventCategory {
  const mapping = getEventMapping(eventType)
  return mapping.category
}

export function getEventSeverity(eventType: string): EventSeverity {
  const mapping = getEventMapping(eventType)
  return mapping.severity
}

export function getEventOutcome(eventType: string): EventOutcome {
  const mapping = getEventMapping(eventType)
  return mapping.outcome
}

