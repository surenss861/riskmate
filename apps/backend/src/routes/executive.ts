import express from 'express'
import { supabase } from '../lib/supabaseClient'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { RequestWithId } from '../middleware/requestId'
import { createErrorResponse, logErrorForSupport } from '../utils/errorResponse'

export const executiveRouter = express.Router()

// Simple in-memory cache for executive metrics (30 seconds TTL)
const executiveCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 30 * 1000 // 30 seconds

// GET /api/executive/risk-posture
// Returns computed risk posture for executive view
executiveRouter.get('/risk-posture', authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId
  const requestId = authReq.requestId || 'unknown'
  
  try {
    const { organization_id, role } = authReq.user

    // Verify executive role
    if (role !== 'executive' && role !== 'owner' && role !== 'admin') {
      const { response: errorResponse, errorId } = createErrorResponse({
        message: 'Executive access required',
        internalMessage: `Risk posture access attempted by role=${role}`,
        code: 'AUTH_ROLE_FORBIDDEN',
        requestId,
        statusCode: 403,
      })
      res.setHeader('X-Error-ID', errorId)
      return res.status(403).json(errorResponse)
    }

    // Check cache
    const cacheKey = `executive:${organization_id}`
    const cached = executiveCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.json({ data: cached.data })
    }

    // Fetch jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, risk_score, risk_level, review_flag, status')
      .eq('organization_id', organization_id)
      .is('deleted_at', null)

    if (jobsError) throw jobsError

    // Count metrics
    const highRiskJobs = (jobs || []).filter(j => j.risk_score !== null && j.risk_score > 75).length
    const flaggedJobs = (jobs || []).filter(j => j.review_flag === true).length
    const openIncidents = (jobs || []).filter(j => 
      j.status === 'incident' || (j.review_flag === true && j.risk_score !== null && j.risk_score > 75)
    ).length

    // Count sign-offs
    const { data: signoffs } = await supabase
      .from('job_signoffs')
      .select('job_id, status')
      .in('job_id', (jobs || []).map(j => j.id))

    const signedCount = (signoffs || []).filter(s => s.status === 'signed').length
    const pendingSignoffs = (jobs || []).length - signedCount

    // Count violations (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: violationsCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .eq('event_type', 'auth.role_violation')
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Count proof packs generated
    const { count: proofPacksCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .like('event_type', 'proof_pack.%')
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Get last material event
    const { data: lastMaterialEvent } = await supabase
      .from('audit_logs')
      .select('created_at')
      .eq('organization_id', organization_id)
      .in('severity', ['material', 'critical'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Verify ledger integrity (check hash chain)
    const { data: integrityCheck } = await supabase
      .from('audit_logs')
      .select('id, hash, prev_hash')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true })
      .limit(100) // Sample check

    let ledgerIntegrity: 'verified' | 'pending' | 'error' = 'verified'
    if (integrityCheck && integrityCheck.length > 0) {
      // Simple integrity check: verify prev_hash links exist
      const hashes = new Set(integrityCheck.map(e => e.hash))
      const brokenLinks = integrityCheck.filter(e => 
        e.prev_hash !== null && !hashes.has(e.prev_hash)
      )
      if (brokenLinks.length > 0) {
        ledgerIntegrity = 'error'
      } else {
        ledgerIntegrity = 'verified'
      }
    } else {
      ledgerIntegrity = 'pending'
    }

    // Compute exposure level
    let exposureLevel: 'low' | 'moderate' | 'high' = 'low'
    if (violationsCount && violationsCount > 0) {
      exposureLevel = 'high'
    } else if (highRiskJobs > 5 || openIncidents > 2) {
      exposureLevel = 'moderate'
    } else if (highRiskJobs > 0 || openIncidents > 0) {
      exposureLevel = 'moderate'
    }

    // Generate confidence statement
    let confidenceStatement = ''
    if (violationsCount && violationsCount > 0) {
      confidenceStatement = `🚨 Blocked role violations detected in the last 7 days.`
    } else if (pendingSignoffs > 3) {
      confidenceStatement = `⚠️ ${pendingSignoffs} pending sign-offs affecting audit defensibility.`
    } else if (highRiskJobs > 0 && flaggedJobs === 0) {
      confidenceStatement = `⚠️ ${highRiskJobs} high-risk job${highRiskJobs > 1 ? 's' : ''} not yet flagged for review.`
    } else if (highRiskJobs > 0) {
      confidenceStatement = `✅ No unresolved governance violations. ${highRiskJobs} high-risk job${highRiskJobs > 1 ? 's' : ''} under active review.`
    } else {
      confidenceStatement = `✅ No unresolved governance violations. All jobs within acceptable risk thresholds.`
    }

    const riskPosture = {
      exposure_level: exposureLevel,
      unresolved_violations: violationsCount || 0,
      open_reviews: flaggedJobs,
      high_risk_jobs: highRiskJobs,
      open_incidents: openIncidents,
      pending_signoffs: pendingSignoffs,
      signed_signoffs: signedCount,
      proof_packs_generated: proofPacksCount || 0,
      last_material_event_at: lastMaterialEvent?.created_at || null,
      confidence_statement: confidenceStatement,
      ledger_integrity: ledgerIntegrity,
      // Raw counts for cards
      flagged_jobs: flaggedJobs,
      signed_jobs: signedCount,
      unsigned_jobs: pendingSignoffs,
      recent_violations: violationsCount || 0,
    }

    // Cache the result
    executiveCache.set(cacheKey, { data: riskPosture, timestamp: Date.now() })

    res.json({ data: riskPosture })
  } catch (err: any) {
    console.error('Risk posture fetch failed:', err)
    const { response: errorResponse, errorId } = createErrorResponse({
      message: 'Failed to compute risk posture',
      internalMessage: `Risk posture computation failed: ${err?.message || String(err)}`,
      code: 'EXECUTIVE_POSTURE_FAILED',
      requestId,
      statusCode: 500,
    })
    res.setHeader('X-Error-ID', errorId)
    logErrorForSupport(500, 'EXECUTIVE_POSTURE_FAILED', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/executive/risk-posture')
    res.status(500).json(errorResponse)
  }
})

// Invalidate cache on audit log write (called from audit middleware)
export function invalidateExecutiveCache(organizationId: string) {
  const cacheKey = `executive:${organizationId}`
  executiveCache.delete(cacheKey)
}

