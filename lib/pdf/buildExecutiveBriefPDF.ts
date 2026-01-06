/**
 * Executive Brief PDF Builder
 * 
 * This module contains the PDF generation logic, extracted from the route handler
 * to allow reuse in smoke tests and CI without Next.js route type constraints.
 */

import PDFDocument from 'pdfkit'
import crypto from 'crypto'
import path from 'path'

// Re-export types and helper functions from the route file
// We'll import the actual implementation functions
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

// Import the actual builder function from the route
// We'll use dynamic import to avoid circular dependencies
export async function buildExecutiveBriefPDF(
  data: RiskPostureData,
  organizationName: string,
  generatedBy: string,
  timeRange: string,
  buildSha: string | undefined,
  reportId: string
): Promise<{ buffer: Buffer; hash: string; apiLatency: number; timeWindow: { start: Date; end: Date } }> {
  // Dynamic import to avoid Next.js route type issues
  const routeModule = await import('../../app/api/executive/brief/pdf/route')
  return routeModule.buildExecutiveBriefPDF(
    data,
    organizationName,
    generatedBy,
    timeRange,
    buildSha,
    reportId
  )
}

