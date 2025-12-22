import express from 'express'
import { supabase } from '../lib/supabaseClient'
import { authenticate, AuthenticatedRequest } from '../middleware/auth'
import { RequestWithId } from '../middleware/requestId'
import { createErrorResponse, logErrorForSupport } from '../utils/errorResponse'

export const executiveRouter = express.Router()

// Cache for executive metrics - invalidated only on material events
// Cache structure: { data: RiskPosture, timestamp: number, basis_event_ids: string[] }
const executiveCache = new Map<string, { data: any; timestamp: number; basis_event_ids: string[] }>()

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

    // Parse time_range parameter (default to 30d)
    const timeRange = (authReq.query.time_range as string) || '30d'
    const validTimeRanges = ['7d', '30d', '90d', 'all']
    const timeRangeValue = validTimeRanges.includes(timeRange) ? timeRange : '30d'

    // Calculate date cutoff based on time range
    let dateCutoff: Date | null = null
    if (timeRangeValue !== 'all') {
      const days = timeRangeValue === '7d' ? 7 : timeRangeValue === '30d' ? 30 : 90
      dateCutoff = new Date()
      dateCutoff.setDate(dateCutoff.getDate() - days)
    }

    // Check cache (include time_range in cache key)
    const cacheKey = `executive:${organization_id}:${timeRangeValue}`
    const cached = executiveCache.get(cacheKey)
    if (cached) {
      // Return cached data with provenance
      return res.json({ 
        data: {
          ...cached.data,
          _provenance: {
            generated_at: new Date(cached.timestamp).toISOString(),
            basis_event_count: cached.basis_event_ids.length,
            time_range: timeRangeValue,
          }
        }
      })
    }

    // Build jobs query with time range filter
    let jobsQuery = supabase
      .from('jobs')
      .select('id, risk_score, risk_level, review_flag, status, created_at')
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
    
    if (dateCutoff) {
      jobsQuery = jobsQuery.gte('created_at', dateCutoff.toISOString())
    }

    const { data: jobs, error: jobsError } = await jobsQuery

    if (jobsError) throw jobsError

    // Count metrics
    const highRiskJobs = (jobs || []).filter(j => j.risk_score !== null && j.risk_score > 75).length
    const flaggedJobs = (jobs || []).filter(j => j.review_flag === true).length
    const openIncidents = (jobs || []).filter(j => 
      j.status === 'incident' || (j.review_flag === true && j.risk_score !== null && j.risk_score > 75)
    ).length

    // Count sign-offs (only if there are jobs)
    let signedCount = 0
    let pendingSignoffs = 0
    if (jobs && jobs.length > 0) {
      const { data: signoffs } = await supabase
        .from('job_signoffs')
        .select('job_id, status')
        .in('job_id', jobs.map(j => j.id))

      signedCount = (signoffs || []).filter(s => s.status === 'signed').length
      pendingSignoffs = jobs.length - signedCount
    }

    // Count violations (within time range)
    let violationsQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .eq('event_type', 'auth.role_violation')
    
    if (dateCutoff) {
      violationsQuery = violationsQuery.gte('created_at', dateCutoff.toISOString())
    }

    const { count: violationsCount } = await violationsQuery

    // Count proof packs generated (within time range)
    let proofPacksQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .like('event_type', 'proof_pack.%')
    
    if (dateCutoff) {
      proofPacksQuery = proofPacksQuery.gte('created_at', dateCutoff.toISOString())
    }

    const { count: proofPacksCount } = await proofPacksQuery

    // Get last material event (within time range, may not exist)
    let lastMaterialEventQuery = supabase
      .from('audit_logs')
      .select('created_at')
      .eq('organization_id', organization_id)
      .in('severity', ['material', 'critical'])
    
    if (dateCutoff) {
      lastMaterialEventQuery = lastMaterialEventQuery.gte('created_at', dateCutoff.toISOString())
    }

    const { data: lastMaterialEvent } = await lastMaterialEventQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle() instead of single() to handle no results

    // Verify ledger integrity (check hash chain)
    const { data: integrityCheck, error: integrityError } = await supabase
      .from('audit_logs')
      .select('id, hash, prev_hash')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true })
      .limit(100) // Sample check

    let ledgerIntegrity: 'verified' | 'pending' | 'error' = 'verified'
    if (integrityError) {
      console.warn('Failed to check ledger integrity:', integrityError)
      ledgerIntegrity = 'pending'
    } else if (integrityCheck && integrityCheck.length > 0) {
      // Simple integrity check: verify prev_hash links exist
      const hashes = new Set(integrityCheck.map((e: any) => e.hash).filter(Boolean))
      const brokenLinks = integrityCheck.filter((e: any) => 
        e.prev_hash !== null && e.prev_hash !== undefined && !hashes.has(e.prev_hash)
      )
      if (brokenLinks.length > 0) {
        ledgerIntegrity = 'error'
      } else {
        ledgerIntegrity = 'verified'
      }
    } else {
      // No audit logs yet
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

    // Collect basis event IDs for provenance (material events that influenced posture)
    const basisEventIds: string[] = []
    
    // Get recent material events that influenced this posture
    const { data: materialEvents } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('organization_id', organization_id)
      .in('severity', ['material', 'critical'])
      .order('created_at', { ascending: false })
      .limit(10)

    if (materialEvents) {
      basisEventIds.push(...materialEvents.map((e: any) => e.id))
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

    // Cache the result with provenance (cache key includes time_range)
    executiveCache.set(cacheKey, { 
      data: riskPosture, 
      timestamp: Date.now(),
      basis_event_ids: basisEventIds,
    })

    res.json({ 
      data: {
        ...riskPosture,
        _provenance: {
          generated_at: new Date().toISOString(),
          basis_event_count: basisEventIds.length,
          time_range: timeRangeValue,
        }
      }
    })
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

