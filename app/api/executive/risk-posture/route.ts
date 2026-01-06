import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'

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

    // Query jobs scoped to organization_id
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, risk_score, risk_level, status, review_flag, flagged_at, created_at')
      .eq('organization_id', orgContext.orgId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .is('deleted_at', null)

    if (jobsError) {
      console.error('[executive/risk-posture] Error fetching jobs:', jobsError)
    }

    const jobsList = jobs || []
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

    // Query incidents scoped to organization_id
    const { data: incidents, error: incidentsError } = await supabase
      .from('incidents')
      .select('id, status, created_at')
      .eq('organization_id', orgContext.orgId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (incidentsError) {
      console.error('[executive/risk-posture] Error fetching incidents:', incidentsError)
    }

    const incidentsList = incidents || []
    const openIncidents = incidentsList.filter(inc => inc.status !== 'resolved' && inc.status !== 'closed').length

    // Query attestations/signoffs scoped to organization_id
    // Note: Adjust table/column names based on your actual schema
    const { data: signoffs, error: signoffsError } = await supabase
      .from('report_signatures')
      .select('id, report_run_id, signed_at')
      .gte('signed_at', startDate.toISOString())
      .lte('signed_at', endDate.toISOString())

    if (signoffsError) {
      console.error('[executive/risk-posture] Error fetching signoffs:', signoffsError)
    }

    // Get report runs to filter by org (if report_runs has organization_id)
    const { data: reportRuns } = await supabase
      .from('report_runs')
      .select('id, organization_id')
      .eq('organization_id', orgContext.orgId)

    const orgReportRunIds = new Set((reportRuns || []).map(r => r.id))
    const orgSignoffs = (signoffs || []).filter(s => 
      s.report_run_id && orgReportRunIds.has(s.report_run_id)
    )

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
    }

    // Wrap in data property to match backend API response structure
    return NextResponse.json({
      data: riskPostureData,
    })
  } catch (error: any) {
    console.error('[executive/risk-posture] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

