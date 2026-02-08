import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/mitigations'

const MAX_FETCH_LIMIT = 1000

function parseRangeDays(range?: string): number {
  if (range === '30d') return 30
  if (range === '90d') return 90
  return 30
}

function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access analytics',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, userData?.organization_id, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const orgId = userData.organization_id
    const { searchParams } = new URL(request.url)
    const rangeDays = parseRangeDays(searchParams.get('range') || undefined)
    const crewId = searchParams.get('crew_id') || undefined

    const sinceDate = new Date()
    sinceDate.setHours(0, 0, 0, 0)
    sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1))
    const sinceIso = sinceDate.toISOString()

    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, risk_score, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', sinceIso)
      .limit(MAX_FETCH_LIMIT)

    if (jobsError) throw jobsError

    const jobIds = (jobs || []).map((job) => job.id)

    const [mitigationsResponse, documentsResponse] = await Promise.all([
      jobIds.length
        ? supabase
            .from('mitigation_items')
            .select('id, job_id, created_at, completed_at, completed_by')
            .in('job_id', jobIds)
            .order('created_at', { ascending: true })
            .limit(MAX_FETCH_LIMIT)
        : Promise.resolve({ data: [] as any[], error: null }),
      jobIds.length
        ? supabase
            .from('documents')
            .select('id, job_id, created_at')
            .in('job_id', jobIds)
            .order('created_at', { ascending: true })
            .limit(MAX_FETCH_LIMIT)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    if (mitigationsResponse.error) throw mitigationsResponse.error
    if (documentsResponse.error) throw documentsResponse.error

    const mitigations = (mitigationsResponse.data || []).filter((item) => {
      if (!crewId) return true
      return item.completed_by === crewId
    })

    const documents = documentsResponse.data || []

    const totalMitigations = mitigations.length
    const completedMitigations = mitigations.filter((item) => item.completed_at)

    const completionRate =
      totalMitigations === 0
        ? 0
        : completedMitigations.length / totalMitigations

    const avgTimeToCloseHours =
      completedMitigations.length === 0
        ? 0
        : completedMitigations.reduce((acc, item) => {
            const createdAt = new Date(item.created_at).getTime()
            const completedAt = new Date(item.completed_at as string).getTime()
            const diffHours = (completedAt - createdAt) / (1000 * 60 * 60)
            return acc + Math.max(diffHours, 0)
          }, 0) / completedMitigations.length

    const highRiskJobs = (jobs || []).filter((job) => {
      if (job.risk_score === null || job.risk_score === undefined) {
        return false
      }
      return job.risk_score > 75
    }).length

    const evidenceCount = documents.length

    const jobEvidenceMap = documents.reduce<Record<string, string>>((acc, doc) => {
      if (!acc[doc.job_id] || new Date(doc.created_at) < new Date(acc[doc.job_id])) {
        acc[doc.job_id] = doc.created_at
      }
      return acc
    }, {})

    const jobsWithEvidence = Object.keys(jobEvidenceMap).length
    const jobsWithoutEvidence = Math.max(jobIds.length - jobsWithEvidence, 0)

    const avgTimeToFirstEvidenceHours =
      jobsWithEvidence === 0
        ? 0
        : Object.entries(jobEvidenceMap).reduce((acc, [jobId, firstEvidence]) => {
            const job = jobs?.find((item) => item.id === jobId)
            if (!job) return acc
            const jobCreated = new Date(job.created_at).getTime()
            const evidenceCreated = new Date(firstEvidence).getTime()
            const diffHours = (evidenceCreated - jobCreated) / (1000 * 60 * 60)
            return acc + Math.max(diffHours, 0)
          }, 0) / jobsWithEvidence

    // Trend (daily)
    const trend: { date: string; completion_rate: number }[] = []
    const dateCursor = new Date(sinceDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    while (dateCursor <= today) {
      const dateKey = toDateKey(dateCursor)
      const itemsForDay = mitigations.filter(
        (item) => toDateKey(item.created_at) === dateKey
      )
      const dayCompleted = itemsForDay.filter((item) => {
        if (!item.completed_at) return false
        return toDateKey(item.completed_at) === dateKey
      })

      const dayRate =
        itemsForDay.length === 0
          ? 0
          : dayCompleted.length / itemsForDay.length

      trend.push({
        date: dateKey,
        completion_rate: Number(dayRate.toFixed(3)),
      })

      dateCursor.setDate(dateCursor.getDate() + 1)
    }

    return NextResponse.json({
      org_id: orgId,
      range_days: rangeDays,
      completion_rate: Number(completionRate.toFixed(3)),
      avg_time_to_close_hours: Number(avgTimeToCloseHours.toFixed(2)),
      high_risk_jobs: highRiskJobs,
      evidence_count: evidenceCount,
      jobs_with_evidence: jobsWithEvidence,
      jobs_without_evidence: jobsWithoutEvidence,
      avg_time_to_first_evidence_hours: Number(avgTimeToFirstEvidenceHours.toFixed(2)),
      trend,
    })
  } catch (error: any) {
    console.error('Analytics metrics error:', error)
    const requestId = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch analytics metrics',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

