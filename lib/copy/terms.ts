/**
 * Defensibility Terminology Dictionary
 * 
 * Centralizes all user-facing terminology for RiskMate's "Defensibility OS" positioning.
 * This ensures consistent language across the entire product and prevents drift.
 * 
 * IMPORTANT: These are DISPLAY strings only. Do NOT use for:
 * - API endpoint names
 * - Database column names
 * - Event type strings (e.g., event_type in audit_logs)
 * - Route paths
 * - Variable/function names
 * 
 * Last Updated: January 10, 2026
 */

export const defensibilityTerms = {
  // Core entities (already standardized in lib/terms.ts, but kept here for reference)
  workRecord: 'Work Record',
  control: 'Control',
  evidence: 'Evidence',
  attestation: 'Attestation',
  ledger: 'Compliance Ledger',
  ledgerEvent: 'Ledger Event',
  chainOfCustody: 'Chain of Custody',
  
  // Actions (defensibility language)
  actions: {
    // Audit/ledger actions
    record: 'Record', // Instead of "save" for audit events
    mutate: 'Mutate', // Instead of "update" for ledger events
    archive: 'Archive', // Instead of "delete" for soft deletes
    seal: 'Seal Record', // Instead of "sign off"
    
    // Export/generation actions
    generatePack: 'Generate Proof Pack', // Instead of "export report"
    generateProofPack: 'Generate Proof Pack',
    exportCSV: 'Export CSV', // CSV exports are fine (human workflow)
    
    // View actions
    viewLedger: 'View in Ledger',
    viewChainOfCustody: 'View Chain of Custody',
    
    // Governance actions
    governance: 'Governance', // Instead of "permissions"
  },
  
  // UI Labels
  labels: {
    activityLog: 'Chain of Custody', // Never use "activity log"
    ledgerEvents: 'Ledger Events', // Never use "user actions"
    governance: 'Governance', // Never use "permissions"
    proofPack: 'Proof Pack', // Never use "report"
    sealRecord: 'Seal Record', // Never use "sign off" or "sign off"
    attestation: 'Attestation', // Prefer over "signature" in legal context
    evidence: 'Evidence', // Prefer over "document" or "file"
    integrityStatus: 'Integrity Status',
    verificationBadge: 'Verification Badge',
    enforcementOutcome: 'Enforcement Outcome',
  },
  
  // Button labels (common patterns)
  buttons: {
    generateProofPack: 'Generate Proof Pack',
    exportCSV: 'Export CSV',
    viewInLedger: 'View in Ledger',
    sealRecord: 'Seal Record',
    recordEvent: 'Record Event',
    viewChainOfCustody: 'View Chain of Custody',
    archive: 'Archive', // Soft delete
  },
  
  // Empty states
  emptyStates: {
    noLedgerEvents: 'No ledger events yet',
    noChainOfCustody: 'No chain of custody entries',
    noEvidence: 'No evidence files',
    noAttestations: 'No attestations yet',
    noProofPacks: 'No proof packs generated',
  },
  
  // Confirmation messages
  confirmations: {
    willBeLogged: 'This will be logged as a ledger event',
    willCreateAttestation: 'This will create an attestation and seal the record',
    willGeneratePack: 'This will generate a proof pack with verification hash',
    willArchive: 'This will archive the record (audit trail preserved)',
  },
  
  // Tooltips
  tooltips: {
    ledgerEvent: 'Immutable ledger event showing who, when, what, and why',
    integrityStatus: 'Tamper-evident status of this record',
    proofPack: 'Deterministic proof pack with verification hash',
    chainOfCustody: 'Complete chain of custody for this record',
    governance: 'Role-based governance and access controls',
  },
  
  // Error messages (defensibility language)
  errors: {
    governanceViolation: 'Governance policy blocked this action',
    ledgerWriteFailed: 'Failed to record ledger event',
    integrityMismatch: 'Integrity check failed - record may have been tampered',
    verificationFailed: 'Proof pack verification failed',
  },
} as const

/**
 * Helper function to get a term by key path
 * Usage: getTerm('labels.activityLog') => 'Chain of Custody'
 */
export function getTerm(path: string): string {
  const keys = path.split('.')
  let value: any = defensibilityTerms
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as any)[key]
    } else {
      console.warn(`Term not found: ${path}`)
      return path // Fallback to path if not found
    }
  }
  
  return typeof value === 'string' ? value : path
}

/**
 * Banned phrases that should never appear in UI strings
 * Use this for linting or validation
 */
export const bannedPhrases = [
  'activity log',
  'Activity log',
  'Activity Log',
  'export report',
  'Export report',
  'Export Report',
  'user actions',
  'User actions',
  'User Actions',
  'sign off', // Use "Seal Record" instead
  'Sign off',
  'Sign Off',
  'signoff', // Use "Seal Record" or "Attestation" instead
  'Signoff',
] as const

/**
 * Preferred replacements for banned phrases
 */
export const phraseReplacements: Record<string, string> = {
  'activity log': 'chain of custody',
  'Activity log': 'Chain of Custody',
  'Activity Log': 'Chain of Custody',
  'export report': 'generate proof pack',
  'Export report': 'Generate Proof Pack',
  'Export Report': 'Generate Proof Pack',
  'user actions': 'ledger events',
  'User actions': 'Ledger Events',
  'User Actions': 'Ledger Events',
  'sign off': 'seal record',
  'Sign off': 'Seal Record',
  'Sign Off': 'Seal Record',
  'signoff': 'attestation',
  'Signoff': 'Attestation',
}

