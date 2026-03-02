/**
 * Public API v1: GET /api/v1/jobs (list), POST /api/v1/jobs (create).
 * Requires API key with jobs:read (GET) or jobs:write (POST).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getRequestId } from '@/lib/utils/requestId'
import {
  withApiKeyAuth,
  finishApiKeyRequest,
  withRateLimitHeaders,
  v1Json,
  V1_SCOPES,
} from '@/lib/api/v1Helpers'
import { triggerWebhookEvent } from '@/lib/webhooks/trigger'
import { getOrgEntitlementsForApiKey } from '@/lib/entitlements'

export const runtime = 'nodejs'

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

export async function GET(request: NextRequest) {
  const authResult = await withApiKeyAuth(request, [
    V1_SCOPES.jobsRead,
    V1_SCOPES.jobsWrite,
  ])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)

  try {
    const { searchParams } = new URL(request.url)
    const pageRaw = searchParams.get('page') ?? '1'
    const limitRaw = searchParams.get('limit') ?? '20'
    const pageParsed = parseInt(pageRaw, 10)
    const limitParsed = parseInt(limitRaw, 10)
    if (
      !Number.isFinite(pageParsed) ||
      !Number.isFinite(limitParsed) ||
      pageParsed < 1 ||
      limitParsed < 1 ||
      limitParsed > 100
    ) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody(
            'INVALID_FORMAT',
            'Invalid pagination: page must be a positive integer, limit must be between 1 and 100',
            requestId
          ),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    const page = pageParsed
    const limit = limitParsed
    const status = searchParams.get('status') || null
    const offset = (page - 1) * limit

    const admin = createSupabaseAdminClient()
    const { data: rows, error } = await admin.rpc('get_jobs_list', {
      p_org_id: context.organization_id,
      p_limit: limit,
      p_offset: offset,
      p_include_archived: false,
      p_sort_column: 'created_at',
      p_sort_order: 'desc',
      p_status: status,
      p_risk_level: null,
      p_assigned_to_id: null,
      p_risk_score_min: null,
      p_risk_score_max: null,
      p_job_type: null,
      p_client_ilike: null,
      p_required_ids: null,
      p_excluded_ids: null,
      p_overdue: null,
      p_unassigned: null,
      p_recent_days: null,
      p_has_photos: null,
      p_has_signatures: null,
      p_needs_signatures: null,
      p_template_source: null,
      p_template_id: null,
      p_due_soon: null,
      p_reference_date: null,
      p_insight_deadline_risk: null,
      p_insight_pending_signatures_near_deadline: null,
      p_insight_overdue: null,
      p_created_after: null,
      p_created_before: null,
      p_completed_after: null,
      p_completed_before: null,
    })

    if (error) {
      console.error('[v1/jobs] get_jobs_list error:', error)
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to list jobs', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const list = (rows || []) as Array<Record<string, unknown>>
    const total = (list[0]?.total_count as number) ?? 0
    const jobs = list.map(({ total_count: _t, ...j }) => j)

    const res = v1Json(jobs, {
      meta: { page, limit, total },
    })
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  } catch (e) {
    console.error('[v1/jobs] GET error:', e)
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INTERNAL_ERROR', 'Internal server error', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
}

export async function POST(request: NextRequest) {
  const authResult = await withApiKeyAuth(request, [V1_SCOPES.jobsWrite])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)

  try {
    const body = await request.json().catch(() => ({}))
    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      status = 'draft',
    } = body

    if (!client_name || !client_type || !job_type || !location) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody(
            'INVALID_FORMAT',
            'Missing required fields: client_name, client_type, job_type, location',
            requestId
          ),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const validStatuses = ['draft', 'in_progress', 'completed', 'archived']
    const validClientTypes = ['residential', 'commercial', 'industrial', 'government', 'mixed']
    const validJobTypes = ['repair', 'maintenance', 'installation', 'inspection', 'renovation', 'new_construction', 'remodel', 'other']

    const st = String(status).toLowerCase()
    const ct = String(client_type).toLowerCase()
    const jt = String(job_type).toLowerCase()
    if (!validStatuses.includes(st) || !validClientTypes.includes(ct) || !validJobTypes.includes(jt)) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid status, client_type, or job_type', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const entitlements = await getOrgEntitlementsForApiKey(context.organization_id)
    if (entitlements.jobs_monthly_limit !== null) {
      const periodStart = entitlements.period_end
        ? new Date(new Date(entitlements.period_end).getTime() - 30 * 24 * 60 * 60 * 1000)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

      const adminForCount = createSupabaseAdminClient()
      const { count, error: countError } = await adminForCount
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', context.organization_id)
        .gte('created_at', periodStart.toISOString())

      if (countError) {
        console.error('[v1/jobs] entitlement count error:', countError)
        return withRateLimitHeaders(
          NextResponse.json(
            errorBody('QUERY_ERROR', 'Failed to check job limit', requestId),
            { status: 500, headers: { 'X-Request-ID': requestId } }
          ),
          rateLimitResult
        )
      }
      if ((count ?? 0) >= entitlements.jobs_monthly_limit) {
        return withRateLimitHeaders(
          NextResponse.json(
            errorBody(
              'ENTITLEMENTS_JOB_LIMIT_REACHED',
              `${entitlements.tier === 'starter' ? 'Starter' : 'Plan'} limit reached (${entitlements.jobs_monthly_limit} jobs/month). Upgrade to Pro for unlimited jobs.`,
              requestId
            ),
            { status: 403, headers: { 'X-Request-ID': requestId } }
          ),
          rateLimitResult
        )
      }
    }

    const admin = createSupabaseAdminClient()
    const { data: job, error } = await admin
      .from('jobs')
      .insert({
        organization_id: context.organization_id,
        title: [client_name, job_type, location].filter(Boolean).join(' – ') || 'Untitled Job',
        client_name: String(client_name).trim(),
        client_type: ct,
        job_type: jt,
        location: String(location).trim(),
        description: description != null ? String(description) : null,
        start_date: start_date || null,
        end_date: end_date || null,
        status: st,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[v1/jobs] POST insert error:', error)
      const pgCode = (error as { code?: string }).code
      const isCheckOrEnumViolation =
        pgCode === '23514' || pgCode === 'check_violation'
      const isInvalidDateOrType =
        pgCode === '22007' || pgCode === '22P02'
      if (isCheckOrEnumViolation) {
        return withRateLimitHeaders(
          NextResponse.json(
            errorBody(
              'INVALID_FORMAT',
              'Invalid status, client_type, or job_type; check allowed values',
              requestId
            ),
            { status: 400, headers: { 'X-Request-ID': requestId } }
          ),
          rateLimitResult
        )
      }
      if (isInvalidDateOrType) {
        return withRateLimitHeaders(
          NextResponse.json(
            errorBody(
              'INVALID_FORMAT',
              'Invalid date or type format for start_date or end_date',
              requestId
            ),
            { status: 400, headers: { 'X-Request-ID': requestId } }
          ),
          rateLimitResult
        )
      }
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to create job', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    await triggerWebhookEvent(context.organization_id, 'job.created', { ...job }).catch(() => {})

    const res = v1Json(job)
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  } catch (e) {
    console.error('[v1/jobs] POST error:', e)
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INTERNAL_ERROR', 'Internal server error', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
}
