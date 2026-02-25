import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { planFeatures, type PlanCode } from '@/lib/utils/planRules'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/mitigations'

const PAGE_SIZE = 2000

function parseRangeDays(range?: string): number {
  if (range === '30d') return 30
  if (range === '90d') return 90
  return 30
}

function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

/** Fetch all rows by paginating; no cap. */
async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ data: T[] | null; error: any }>
): Promise<{ data: T[]; error: any }> {
  const out: T[] = []
  let offset = 0
  let hasMore = true
  let lastError: any = null
  while (hasMore) {
    const { data, error } = await fetchPage(offset, PAGE_SIZE)
    if (error) return { data: out, error }
    lastError = error
    const chunk = data ?? []
    out.push(...chunk)
    hasMore = chunk.length === PAGE_SIZE
    offset += chunk.length
  }
  return { data: out, error: lastError }
}

/** Chunk array into batches of at most size. */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
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

    // Subscription/feature gating (match backend analytics routes)
    const { data: orgSub, error: orgSubError } = await supabase
      .from('org_subscriptions')
      .select('plan_code, status')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (orgSubError && orgSubError.code !== 'PGRST116') {
      const { response, errorId } = createErrorResponse(
        'Failed to get subscription',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const planCode: PlanCode =
      orgSub?.plan_code && orgSub.plan_code !== 'none' ? (orgSub.plan_code as PlanCode) : 'none'
    const status = orgSub?.status ?? (planCode === 'none' ? 'none' : 'inactive')
    const isActive = ['active', 'trialing', 'free'].includes(status)
    const features = isActive ? planFeatures(planCode) : []
    const hasAnalytics = features.includes('analytics')

    if (!isActive || !hasAnalytics) {
      const rangeDays = parseRangeDays(new URL(request.url).searchParams.get('range') || undefined)
      return NextResponse.json(
        {
          org_id: orgId,
          range_days: rangeDays,
          completion_rate: 0,
          avg_time_to_close_hours: 0,
          high_risk_jobs: 0,
          evidence_count: 0,
          jobs_with_evidence: 0,
          jobs_without_evidence: 0,
          avg_time_to_first_evidence_hours: 0,
          trend: [],
          jobs_total: 0,
          jobs_scored: 0,
          jobs_with_any_evidence: 0,
          jobs_with_photo_evidence: 0,
          jobs_missing_required_evidence: 0,
          required_evidence_policy: null,
          avg_time_to_first_photo_minutes: null,
          trend_empty_reason: 'no_jobs',
          locked: true,
          message:
            status === 'none'
              ? 'Analytics requires an active subscription'
              : 'Analytics not available on your current plan',
        },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    const { searchParams } = new URL(request.url)
    const rangeDays = parseRangeDays(searchParams.get('range') || undefined)
    const crewId = searchParams.get('crew_id') || undefined

    const sinceDate = new Date()
    sinceDate.setHours(0, 0, 0, 0)
    sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1))
    const sinceIso = sinceDate.toISOString()

    // When crew_id is supplied, scope jobs to those that have mitigation activity by this crew (denominators consistent with crew filter).
    let jobIdsFilter: string[] | null = null
    if (crewId) {
      const { data: crewMitigationRows } = await fetchAllPages<{ job_id: string }>(
        async (offset, limit) => {
          const { data, error } = await supabase
            .from('mitigation_items')
            .select('job_id')
            .eq('organization_id', orgId)
            .eq('completed_by', crewId)
            .or(`created_at.gte.${sinceIso},completed_at.gte.${sinceIso}`)
            .range(offset, offset + limit - 1)
          return { data, error }
        }
      )
      const crewJobIdsSet = new Set((crewMitigationRows ?? []).map((r) => r.job_id))
      jobIdsFilter = crewJobIdsSet.size > 0 ? [...crewJobIdsSet] : []
    }

    let jobs: Array<{ id: string; risk_score: number | null; created_at: string }>
    if (jobIdsFilter !== null) {
      if (jobIdsFilter.length === 0) {
        jobs = []
      } else {
        const jobsList: Array<{ id: string; risk_score: number | null; created_at: string }> = []
        for (const idChunk of chunk(jobIdsFilter, 500)) {
          const { data, error } = await supabase
            .from('jobs')
            .select('id, risk_score, created_at')
            .eq('organization_id', orgId)
            .is('deleted_at', null)
            .in('id', idChunk)
          if (error) throw error
          jobsList.push(...(data ?? []))
        }
        jobs = jobsList
      }
    } else {
      const { data: jobsData, error: jobsError } = await fetchAllPages<{
        id: string
        risk_score: number | null
        created_at: string
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, risk_score, created_at')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .range(offset, offset + limit - 1)
        return { data, error }
      })
      if (jobsError) throw jobsError
      jobs = jobsData ?? []
    }
    const jobIds = jobs.map((j) => j.id)

    if (jobIds.length === 0) {
      const rangeDaysOut = parseRangeDays(searchParams.get('range') || undefined)
      return NextResponse.json({
        org_id: orgId,
        range_days: rangeDaysOut,
        completion_rate: 0,
        avg_time_to_close_hours: 0,
        high_risk_jobs: 0,
        evidence_count: 0,
        jobs_with_evidence: 0,
        jobs_without_evidence: 0,
        avg_time_to_first_evidence_hours: 0,
        trend: [],
        jobs_total: 0,
        jobs_scored: 0,
        jobs_with_any_evidence: 0,
        jobs_with_photo_evidence: 0,
        jobs_missing_required_evidence: 0,
        required_evidence_policy: 'Photo required for high-risk jobs',
        avg_time_to_first_photo_minutes: null,
        trend_empty_reason: 'no_jobs',
      }, { status: 200, headers: { 'X-Request-ID': requestId } })
    }

    const mitigationsByChunk = chunk(jobIds, 500)
    const { data: mitigationsRaw, error: mitigationsError } = await (async () => {
      const out: any[] = []
      for (const ids of mitigationsByChunk) {
        const { data, error } = await fetchAllPages<any>(async (offset, limit) => {
          const res = await supabase
            .from('mitigation_items')
            .select('id, job_id, created_at, completed_at, completed_by')
            .in('job_id', ids)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1)
          return { data: res.data, error: res.error }
        })
        if (error) return { data: [] as any[], error }
        out.push(...(data ?? []))
      }
      return { data: out, error: null }
    })()
    if (mitigationsError) throw mitigationsError

    const documentsByChunk = chunk(jobIds, 500)
    const { data: documentsRaw, error: documentsError } = await (async () => {
      const out: any[] = []
      for (const ids of documentsByChunk) {
        const { data, error } = await fetchAllPages<any>(async (offset, limit) => {
          const res = await supabase
            .from('documents')
            .select('id, job_id, created_at, type')
            .eq('organization_id', orgId)
            .in('job_id', ids)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1)
          return { data: res.data, error: res.error }
        })
        if (error) return { data: [] as any[], error }
        out.push(...(data ?? []))
      }
      return { data: out, error: null }
    })()
    if (documentsError) throw documentsError

    const mitigations = (mitigationsRaw ?? []).filter((item: any) => {
      if (!crewId) return true
      return item.completed_by === crewId
    })

    const documents = documentsRaw ?? []

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
      return job.risk_score >= 70
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

    // Photo evidence: only documents with type === "photo" (match backend)
    const photoDocuments = documents.filter((d: { type?: string }) => d.type === 'photo')
    const jobPhotoMap = photoDocuments.reduce<Record<string, string>>((acc, doc) => {
      if (!acc[doc.job_id] || new Date(doc.created_at) < new Date(acc[doc.job_id])) {
        acc[doc.job_id] = doc.created_at
      }
      return acc
    }, {})
    const jobsWithPhotoEvidence = Object.keys(jobPhotoMap).length

    const jobsTotal = jobIds.length
    const jobsScored = (jobs || []).filter((job) => job.risk_score != null).length
    const highRiskJobIds = (jobs || [])
      .filter((job) => job.risk_score != null && job.risk_score >= 70)
      .map((job) => job.id)
    const jobsMissingRequiredEvidence = highRiskJobIds.filter(
      (jobId) => !jobPhotoMap[jobId]
    ).length

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

    const avgTimeToFirstPhotoMinutes =
      jobsWithPhotoEvidence === 0
        ? 0
        : Object.entries(jobPhotoMap).reduce((acc, [jobId, firstPhotoAt]) => {
            const job = jobs?.find((item) => item.id === jobId)
            if (!job) return acc
            const jobCreated = new Date(job.created_at).getTime()
            const photoCreated = new Date(firstPhotoAt).getTime()
            const diffMinutes = (photoCreated - jobCreated) / (1000 * 60)
            return acc + Math.max(diffMinutes, 0)
          }, 0) / jobsWithPhotoEvidence

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

    const trendEmptyReason =
      jobsTotal === 0 ? 'no_jobs' : totalMitigations === 0 ? 'no_events' : null

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
      jobs_total: jobsTotal,
      jobs_scored: jobsScored,
      jobs_with_any_evidence: jobsWithEvidence,
      jobs_with_photo_evidence: jobsWithPhotoEvidence,
      jobs_missing_required_evidence: jobsMissingRequiredEvidence,
      required_evidence_policy: 'Photo required for high-risk jobs',
      avg_time_to_first_photo_minutes: Math.round(avgTimeToFirstPhotoMinutes),
      trend_empty_reason: trendEmptyReason,
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

