/**
 * Type definitions for Executive Brief PDF
 */

export interface RiskPostureData {
  posture_score?: number
  exposure_level?: 'low' | 'moderate' | 'high'
  delta?: number
  deltas?: {
    high_risk_jobs?: number
    open_incidents?: number
    violations?: number
    flagged_jobs?: number
    pending_signoffs?: number
    proof_packs?: number
  }
  high_risk_jobs: number
  open_incidents: number
  violations: number
  flagged_jobs: number
  signed_signoffs: number
  pending_signoffs: number
  proof_packs_generated: number
  total_jobs: number
  total_incidents: number
  evidence_coverage_pct?: number
  attestation_coverage_pct?: number
  last_job_date?: string
  top_drivers?: Array<{ label: string; value: number }>
}

export interface ExecutiveBriefInput {
  data: RiskPostureData
  organizationName: string
  generatedBy: string
  timeRange: string
  buildSha: string | undefined
  reportId: string
  baseUrl?: string
}

export interface ExecutiveBriefOutput {
  buffer: Buffer
  hash: string
  apiLatency: number
  timeWindow: { start: Date; end: Date }
}

