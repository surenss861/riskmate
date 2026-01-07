/**
 * Types for Executive Brief PDF Builder
 * 
 * Strict types for all PDF inputs - ensures consistency across route handler and tests
 */

export interface RiskPostureData {
  exposure_level: 'low' | 'moderate' | 'high'
  posture_score?: number
  delta?: number
  high_risk_jobs: number
  open_incidents: number
  recent_violations: number
  flagged_jobs: number
  pending_signoffs: number
  signed_signoffs: number
  proof_packs_generated: number
  confidence_statement: string
  ledger_integrity: 'verified' | 'error' | 'not_verified'
  ledger_integrity_last_verified_at: string | null
  // For data coverage
  total_jobs?: number
  last_job_at?: string | null
  drivers?: {
    highRiskJobs?: Array<{ label: string; count: number }>
    openIncidents?: Array<{ label: string; count: number }>
    violations?: Array<{ label: string; count: number }>
  }
  deltas?: {
    high_risk_jobs?: number
    open_incidents?: number
    violations?: number
    flagged_jobs?: number
    pending_signoffs?: number
    signed_signoffs?: number
    proof_packs?: number
  }
  recommended_actions?: Array<{
    priority: number
    action: string
    reason: string
  }>
}

export interface ExecutiveBriefInput {
  data: RiskPostureData
  organizationName: string
  generatedBy: string
  timeRange: string
  buildSha?: string
  reportId: string
  generatedAt: Date
  baseUrl?: string // For QR code verification links (optional)
}

export interface ExecutiveBriefOutput {
  buffer: Buffer
  hash: string
  apiLatency: number
  timeWindow: { start: Date; end: Date }
}

