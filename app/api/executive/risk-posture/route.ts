import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'

const PAGE_SIZE = 1000

/**
 * Fetches all rows for a paginated Supabase query by requesting pages of PAGE_SIZE
 * until a partial page is returned. Avoids PostgREST default ~1k row limit.
 * Accepts PromiseLike so Supabase client's thenable return type is valid.
 */
async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const acc: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await fetchPage(offset, PAGE_SIZE)
    if (error) throw error
    const list = data ?? []
    acc.push(...list)
    if (list.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return acc
}

/**
 * GET /api/executive/risk-posture
 * Returns risk posture metrics for executive dashboard
 * Response structure matches backend API: { data: { ... } }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

      // Resolve organization context (shared helper)
      const orgContext = await resolveOrgContext(user)

      if (!orgContext) {
        return NextResponse.json(
          { message: 'Organization not found or access denied' },
          { status: 403 }
        )
      }

      // Verify executive role
      if (orgContext.role !== 'executive' && orgContext.role !== 'owner' && orgContext.role !== 'admin') {
        return NextResponse.json(
          { message: 'Executive access required' },
          { status: 403 }
        )
      }

    // Calculate time window for filtering
    const endDate = new Date()
    const startDate = new Date()
    switch (time_range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(endDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(endDate.getDate() - 90)
        break
      case 'all':
        startDate.setFullYear(2020, 0, 1) // Arbitrary early date
        break
      default:
        startDate.setDate(endDate.getDate() - 30)
    }

    // Query jobs scoped to organization_id (paginated to avoid ~1k limit)
    let jobsList: Array<{ id: string; risk_score: number | null; risk_level: string | null; status: string | null; review_flag: boolean | null; flagged_at: string | null; created_at: string }> = []
    try {
      jobsList = await fetchAllPages(async (offset, limit) => {
        const r = await supabase
          .from('jobs')
          .select('id, risk_score, risk_level, status, review_flag, flagged_at, created_at')
          .eq('organization_id', orgContext.orgId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .range(offset, offset + limit - 1)
        return { data: r.data, error: r.error }
      })
    } catch (e) {
      console.error('[executive/risk-posture] Error fetching jobs:', e)
    }

    const totalJobs = jobsList.length

    // High risk jobs (risk_score >= 70 or risk_level = 'high' or 'critical')
    const highRiskJobs = jobsList.filter(job =>
      (job.risk_score && job.risk_score >= 70) ||
      job.risk_level === 'high' ||
      job.risk_level === 'critical'
    ).length

    // Flagged jobs (review_flag = true or flagged_at is not null)
    const flaggedJobs = jobsList.filter(job =>
      job.review_flag === true || job.flagged_at !== null
    ).length

    // Query incidents scoped to organization_id (paginated)
    let incidentsList: Array<{ id: string; status: string | null; created_at: string }> = []
    try {
      incidentsList = await fetchAllPages(async (offset, limit) => {
        const r = await supabase
          .from('incidents')
          .select('id, status, created_at')
          .eq('organization_id', orgContext.orgId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: true })
          .range(offset, offset + limit - 1)
        return { data: r.data, error: r.error }
      })
    } catch (e) {
      console.error('[executive/risk-posture] Error fetching incidents:', e)
    }

    const openIncidents = incidentsList.filter(inc => inc.status !== 'resolved' && inc.status !== 'closed').length

    // Query signoffs scoped to organization_id (report_signatures has organization_id); paginated to avoid full-table scan and ~1k limit
    let orgSignoffs: Array<{ id: string; report_run_id: string; signed_at: string }> = []
    try {
      orgSignoffs = await fetchAllPages(async (offset, limit) => {
        const r = await supabase
          .from('report_signatures')
          .select('id, report_run_id, signed_at')
          .eq('organization_id', orgContext.orgId)
          .gte('signed_at', startDate.toISOString())
          .lte('signed_at', endDate.toISOString())
          .order('signed_at', { ascending: true })
          .range(offset, offset + limit - 1)
        return { data: r.data, error: r.error }
      })
    } catch (e) {
      console.error('[executive/risk-posture] Error fetching signoffs:', e)
    }

    const signedSignoffs = orgSignoffs.length

    // Query pending signoffs (report_runs with status = 'ready_for_signatures')
    const { data: pendingRuns } = await supabase
      .from('report_runs')
      .select('id')
      .eq('organization_id', orgContext.orgId)
      .eq('status', 'ready_for_signatures')

    const pendingSignoffs = (pendingRuns || []).length

    // Calculate risk posture score (0-100, higher = lower risk)
    // Simple formula: penalize high risk jobs and open incidents
    let postureScore = 100
    if (totalJobs > 0) {
      const highRiskRatio = highRiskJobs / totalJobs
      const incidentRatio = openIncidents / Math.max(totalJobs, 1)
      postureScore = Math.max(0, Math.min(100, 100 - (highRiskRatio * 50) - (incidentRatio * 30)))
    } else {
      postureScore = 0 // No data = can't compute
    }

    // Determine exposure level
    let exposure_level: 'low' | 'moderate' | 'high' = 'low'
    if (postureScore < 50) {
      exposure_level = 'high'
    } else if (postureScore < 75) {
      exposure_level = 'moderate'
    }

    // Confidence statement based on actual data
    let confidence_statement = 'No unresolved governance violations. All jobs within acceptable risk thresholds.'
    if (totalJobs === 0) {
      confidence_statement = 'Insufficient job volume in selected window to compute posture score.'
    } else if (highRiskJobs > 0 || openIncidents > 0) {
      confidence_statement = `${highRiskJobs} high-risk job${highRiskJobs > 1 ? 's' : ''} and ${openIncidents} open incident${openIncidents > 1 ? 's' : ''} require attention.`
    }

    // Get last job timestamp for data coverage
    const lastJob = jobsList.length > 0
      ? jobsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null

    const riskPostureData = {
      exposure_level,
      unresolved_violations: flaggedJobs,
      open_reviews: flaggedJobs,
      high_risk_jobs: highRiskJobs,
      open_incidents: openIncidents,
      pending_signoffs: pendingSignoffs,
      signed_signoffs: signedSignoffs,
      proof_packs_generated: signedSignoffs, // Using signed signoffs as proxy
      last_material_event_at: incidentsList.length > 0 
        ? incidentsList[incidentsList.length - 1].created_at 
        : null,
      confidence_statement,
      ledger_integrity: 'not_verified' as const,
      ledger_integrity_last_verified_at: null,
      ledger_integrity_verified_through_event_id: null,
      flagged_jobs: flaggedJobs,
      signed_jobs: signedSignoffs,
      unsigned_jobs: pendingSignoffs,
      recent_violations: flaggedJobs,
      posture_score: totalJobs > 0 ? Math.round(postureScore) : undefined,
      delta: undefined, // TODO: Calculate delta vs previous period
      // Data coverage fields
      total_jobs: totalJobs,
      last_job_at: lastJob?.created_at || null,
    }

    // Wrap in data property to match backend API response structure
    const response = NextResponse.json({
      data: riskPostureData,
    })

    // Debug headers (only in non-prod or when explicitly enabled)
    // These help verify org resolution is consistent across endpoints
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_HEADERS === 'true') {
      response.headers.set('X-Org-Id-Hash', hashId(orgContext.orgId))
      response.headers.set('X-User-Id-Hash', hashId(orgContext.userId))
      response.headers.set('X-Resolved-From', orgContext.resolvedFrom)
      response.headers.set('X-Org-Name', orgContext.orgName.substring(0, 50)) // Truncated for safety
      response.headers.set('X-Time-Range', time_range)
      response.headers.set('X-Data-Window-Start', startDate.toISOString().split('T')[0])
      response.headers.set('X-Data-Window-End', endDate.toISOString().split('T')[0])
    }

    return response
  } catch (error: any) {
    console.error('[executive/risk-posture] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

