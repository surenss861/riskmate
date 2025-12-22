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

    // Count metrics (current period)
    const highRiskJobs = (jobs || []).filter(j => j.risk_score !== null && j.risk_score > 75).length
    const flaggedJobs = (jobs || []).filter(j => j.review_flag === true).length
    const openIncidents = (jobs || []).filter(j => 
      j.status === 'incident' || (j.review_flag === true && j.risk_score !== null && j.risk_score > 75)
    ).length

    // Compute previous period counts for deltas (only if time range is not "all")
    let previousPeriodCounts = {
      highRiskJobs: 0,
      openIncidents: 0,
      violations: 0,
      flaggedJobs: 0,
      pendingSignoffs: 0,
      signedCount: 0,
      proofPacks: 0,
    }

    if (dateCutoff && timeRangeValue !== 'all') {
      // Calculate previous period dates
      const periodDays = timeRangeValue === '7d' ? 7 : timeRangeValue === '30d' ? 30 : 90
      const previousPeriodStart = new Date(dateCutoff)
      previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays)
      const previousPeriodEnd = dateCutoff

      // Count jobs in previous period
      const { data: prevJobs } = await supabase
        .from('jobs')
        .select('id, risk_score, risk_level, review_flag, status')
        .eq('organization_id', organization_id)
        .is('deleted_at', null)
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString())

      previousPeriodCounts.highRiskJobs = (prevJobs || []).filter(j => j.risk_score !== null && j.risk_score > 75).length
      previousPeriodCounts.flaggedJobs = (prevJobs || []).filter(j => j.review_flag === true).length
      previousPeriodCounts.openIncidents = (prevJobs || []).filter(j => 
        j.status === 'incident' || (j.review_flag === true && j.risk_score !== null && j.risk_score > 75)
      ).length

      // Count violations in previous period
      const { count: prevViolationsCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .eq('event_type', 'auth.role_violation')
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString())
      previousPeriodCounts.violations = prevViolationsCount || 0

      // Count proof packs in previous period
      const { count: prevProofPacksCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .like('event_type', 'proof_pack.%')
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString())
      previousPeriodCounts.proofPacks = prevProofPacksCount || 0

      // Count signoffs in previous period
      if (prevJobs && prevJobs.length > 0) {
        const { data: prevSignoffs } = await supabase
          .from('job_signoffs')
          .select('job_id, status')
          .in('job_id', prevJobs.map(j => j.id))

        const prevSigned = (prevSignoffs || []).filter(s => s.status === 'signed').length
        previousPeriodCounts.signedCount = prevSigned
        previousPeriodCounts.pendingSignoffs = prevJobs.length - prevSigned
      }
    }

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

    // Verify ledger integrity (check hash chain) - deterministic check
    const { data: allLogs, error: integrityError } = await supabase
      .from('audit_logs')
      .select('id, hash, prev_hash, created_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true })

    let ledgerIntegrity: 'verified' | 'error' | 'not_verified' = 'not_verified'
    let lastVerifiedAt: string | null = null
    let verifiedThroughEventId: string | null = null
    let integrityErrorDetails: { failingEventId?: string; expectedHash?: string; gotHash?: string; eventIndex?: number } | null = null

    if (!integrityError && allLogs && allLogs.length > 0) {
      // Verify hash chain: each log's prev_hash should match the previous log's hash
      let isVerified = true
      let lastGoodIndex = -1

      for (let i = 1; i < allLogs.length; i++) {
        const current = allLogs[i]
        const previous = allLogs[i - 1]

        // Skip if prev_hash is null (first log) or if either hash is missing
        if (!current.prev_hash || !previous.hash) {
          if (i === 1 && !current.prev_hash) {
            // First log can have null prev_hash - that's fine
            lastGoodIndex = i
            continue
          }
          // Missing hashes indicate incomplete verification
          isVerified = false
          integrityErrorDetails = {
            failingEventId: current.id,
            eventIndex: i,
            expectedHash: previous.hash || '(missing)',
            gotHash: current.prev_hash || '(missing)',
          }
          break
        }

        // Check if prev_hash matches previous log's hash
        if (current.prev_hash !== previous.hash) {
          isVerified = false
          integrityErrorDetails = {
            failingEventId: current.id,
            eventIndex: i,
            expectedHash: previous.hash,
            gotHash: current.prev_hash,
          }
          break
        }

        lastGoodIndex = i
      }

      if (isVerified && lastGoodIndex >= 0) {
        ledgerIntegrity = 'verified'
        lastVerifiedAt = new Date().toISOString() // Verification just completed
        verifiedThroughEventId = allLogs[lastGoodIndex].id
      } else if (integrityErrorDetails) {
        // Found a mismatch - return details
        ledgerIntegrity = 'error'
        lastVerifiedAt = new Date().toISOString()
        verifiedThroughEventId = integrityErrorDetails.failingEventId || null
      } else {
        // No logs to verify or incomplete chain
        ledgerIntegrity = 'not_verified'
      }
    } else if (integrityError) {
      ledgerIntegrity = 'error'
      lastVerifiedAt = new Date().toISOString()
      integrityErrorDetails = { eventIndex: 0 }
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

    // Helper function to compute top drivers
    type Driver = { key: string; label: string; count: number; href?: string }
    const getTopDrivers = async (): Promise<{
      highRiskJobs: Driver[]
      openIncidents: Driver[]
      violations: Driver[]
      flagged: Driver[]
      pending: Driver[]
      signed: Driver[]
      proofPacks: Driver[]
    }> => {
      const drivers = {
        highRiskJobs: [] as Driver[],
        openIncidents: [] as Driver[],
        violations: [] as Driver[],
        flagged: [] as Driver[],
        pending: [] as Driver[],
        signed: [] as Driver[],
        proofPacks: [] as Driver[],
      }

      // High Risk Jobs drivers: Check for missing evidence on high-risk jobs
      const highRiskJobIds = (jobs || []).filter(j => j.risk_score !== null && j.risk_score > 75).map(j => j.id)
      if (highRiskJobIds.length > 0) {
        // Count jobs with missing evidence (simplified: assume all high-risk jobs need evidence)
        drivers.highRiskJobs.push({
          key: 'MISSING_EVIDENCE.HIGH_RISK',
          label: 'Missing evidence on high-risk records',
          count: highRiskJobIds.length,
          href: `/operations/audit/readiness?category=evidence&severity=high${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        })
      }

      // Open Incidents drivers
      const incidentJobs = (jobs || []).filter(j => j.status === 'incident')
      if (incidentJobs.length > 0) {
        drivers.openIncidents.push({
          key: 'INCIDENT.OPEN',
          label: 'Open incidents requiring resolution',
          count: incidentJobs.length,
          href: `/operations/audit?view=incident-review&status=open${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        })
      }

      // Violations drivers: Group by metadata reason if available
      let violationsQuery = supabase
        .from('audit_logs')
        .select('id, metadata')
        .eq('organization_id', organization_id)
        .eq('event_type', 'auth.role_violation')
      
      if (dateCutoff) {
        violationsQuery = violationsQuery.gte('created_at', dateCutoff.toISOString())
      }

      const { data: violations } = await violationsQuery
      if (violations && violations.length > 0) {
        // Group by attempted action from metadata
        const reasonCounts: Record<string, number> = {}
        violations.forEach((v: any) => {
          const reason = v.metadata?.attempted_action || v.metadata?.reason || 'Unknown violation'
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
        })
        
        const topReason = Object.entries(reasonCounts)
          .sort(([, a], [, b]) => b - a)[0]
        
        if (topReason) {
          const reasonLabel = topReason[0].replace(/\./g, ' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          drivers.violations.push({
            key: `VIOLATION.${topReason[0]}`,
            label: `${reasonLabel} blocked`,
            count: topReason[1],
            href: `/operations/audit?tab=governance&outcome=blocked${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
          })
        } else {
          // Fallback: unknown violation
          drivers.violations.push({
            key: 'VIOLATION.UNKNOWN',
            label: 'Unknown action blocked',
            count: violations.length,
            href: `/operations/audit?tab=governance&outcome=blocked${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
          })
        }
      }

      // Flagged drivers
      const flaggedJobIds = (jobs || []).filter(j => j.review_flag === true).map(j => j.id)
      if (flaggedJobIds.length > 0) {
        drivers.flagged.push({
          key: 'FLAGGED.REVIEW_REQUIRED',
          label: 'Jobs flagged for safety review',
          count: flaggedJobIds.length,
          href: `/operations/audit?view=review-queue${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        })
      }

      // Pending drivers: Use readiness-related events or job_signoffs
      if (jobs && jobs.length > 0) {
        const { data: pendingSignoffs } = await supabase
          .from('job_signoffs')
          .select('job_id, status')
          .in('job_id', jobs.map(j => j.id))
          .neq('status', 'signed')
        
        const pendingCount = pendingSignoffs?.length || 0
        if (pendingCount > 0) {
          drivers.pending.push({
            key: 'PENDING.ATTESTATIONS',
            label: 'Attestations overdue',
            count: pendingCount,
            href: `/operations/audit/readiness?category=attestations&status=open${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
          })
        }
      }

      // Signed drivers
      if (signedCount > 0) {
        drivers.signed.push({
          key: 'SIGNED.COMPLETED',
          label: 'Completed attestations',
          count: signedCount,
          href: `/operations/audit?tab=operations&event_name=signoff&status=signed${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        })
      }

      // Proof Packs drivers
      if (proofPacksCount && proofPacksCount > 0) {
        drivers.proofPacks.push({
          key: 'PROOF_PACKS.GENERATED',
          label: 'Proof packs generated',
          count: proofPacksCount,
          href: `/operations/audit?view=insurance-ready${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        })
      } else {
        drivers.proofPacks.push({
          key: 'PROOF_PACKS.NONE',
          label: 'No proof packs generated',
          count: 0,
        })
      }

      return drivers
    }

    const topDrivers = await getTopDrivers()

    // Generate executive action plan (top 3 recommended actions)
    const actionPlan: Array<{ priority: number; action: string; href: string; reason: string }> = []
    
    // Priority 1: Critical violations
    if (violationsCount && violationsCount > 0) {
      actionPlan.push({
        priority: 1,
        action: `Review ${violationsCount} blocked violation${violationsCount > 1 ? 's' : ''}`,
        href: `/operations/audit?tab=governance&outcome=blocked${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        reason: 'Role violations indicate unauthorized access attempts',
      })
    }

    // Priority 2: High-risk jobs without evidence
    if (highRiskJobs > 0 && topDrivers.highRiskJobs[0]?.key === 'MISSING_EVIDENCE.HIGH_RISK') {
      actionPlan.push({
        priority: 2,
        action: `Add evidence to ${highRiskJobs} high-risk job${highRiskJobs > 1 ? 's' : ''}`,
        href: `/operations/audit/readiness?category=evidence&severity=high${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        reason: 'High-risk jobs require documented evidence for defensibility',
      })
    }

    // Priority 3: Overdue attestations
    if (pendingSignoffs > 0) {
      actionPlan.push({
        priority: 3,
        action: `Request ${pendingSignoffs} pending attestation${pendingSignoffs > 1 ? 's' : ''}`,
        href: `/operations/audit/readiness?category=attestations&status=open${dateCutoff ? `&time_range=${timeRangeValue}` : ''}`,
        reason: 'Unsigned approvals weaken audit defensibility',
      })
    }

    // Sort by priority and take top 3
    const recommendedActions = actionPlan.sort((a, b) => a.priority - b.priority).slice(0, 3)

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
      ledger_integrity_last_verified_at: lastVerifiedAt,
      ledger_integrity_verified_through_event_id: verifiedThroughEventId,
      ledger_integrity_error_details: integrityErrorDetails || undefined,
      // Raw counts for cards
      flagged_jobs: flaggedJobs,
      signed_jobs: signedCount,
      unsigned_jobs: pendingSignoffs,
      recent_violations: violationsCount || 0,
      // Top drivers
      drivers: topDrivers,
      // Deltas (change from previous period)
      deltas: {
        high_risk_jobs: highRiskJobs - previousPeriodCounts.highRiskJobs,
        open_incidents: openIncidents - previousPeriodCounts.openIncidents,
        violations: (violationsCount || 0) - previousPeriodCounts.violations,
        flagged_jobs: flaggedJobs - previousPeriodCounts.flaggedJobs,
        pending_signoffs: pendingSignoffs - previousPeriodCounts.pendingSignoffs,
        signed_signoffs: signedCount - previousPeriodCounts.signedCount,
        proof_packs: (proofPacksCount || 0) - previousPeriodCounts.proofPacks,
      },
      // Executive action plan
      recommended_actions: recommendedActions,
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
// Invalidates all time_range variants for the organization
export function invalidateExecutiveCache(organizationId: string) {
  const timeRanges = ['7d', '30d', '90d', 'all']
  timeRanges.forEach(timeRange => {
    const cacheKey = `executive:${organizationId}:${timeRange}`
    executiveCache.delete(cacheKey)
  })
}

