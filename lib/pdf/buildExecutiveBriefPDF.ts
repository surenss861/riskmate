/**
 * Executive Brief PDF Builder
 * 
 * This module re-exports the PDF generation function for use in smoke tests and CI.
 * The actual implementation lives in app/api/executive/brief/pdf/route.ts
 * but we can't export it directly from a Next.js route file due to type constraints.
 * 
 * Solution: We'll make the function accessible via a module-level export pattern.
 */

// Re-export types
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

// Export the builder function
// NOTE: The actual implementation is in app/api/executive/brief/pdf/route.ts
// but we can't import it directly due to Next.js route type constraints.
// For smoke tests, we'll need to either:
// 1. Call the API endpoint directly (requires a running server)
// 2. Move the PDF building logic to a shared module (recommended)
// 
// For now, this is a placeholder that documents the limitation.
export async function buildExecutiveBriefPDF(
  data: RiskPostureData,
  organizationName: string,
  generatedBy: string,
  timeRange: string,
  buildSha: string | undefined,
  reportId: string
): Promise<{ buffer: Buffer; hash: string; apiLatency: number; timeWindow: { start: Date; end: Date } }> {
  // TODO: Move PDF building logic to a shared module (lib/pdf/generateExecutiveBrief.ts)
  // For now, smoke tests should call the API endpoint instead
  throw new Error(
    'buildExecutiveBriefPDF: PDF building logic must be moved to a shared module. ' +
    'For smoke tests, call the API endpoint /api/executive/brief/pdf instead.'
  )
}
