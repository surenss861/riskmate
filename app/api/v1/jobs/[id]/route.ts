/**
 * Public API v1: GET /api/v1/jobs/[id], PATCH /api/v1/jobs/[id], DELETE /api/v1/jobs/[id].
 * Requires API key with jobs:read (GET) or jobs:write (PATCH, DELETE).
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
import { isValidUUID } from '@/lib/utils/uuid'
import { triggerWebhookEvent } from '@/lib/webhooks/trigger'
import {
  VALID_JOB_STATUSES_SET,
  VALID_CLIENT_TYPES_SET,
  VALID_JOB_TYPES_SET,
} from '@/lib/api/v1JobsConstants'
import {
  JOB_PUBLIC_FIELDS,
  JOB_RISK_SCORE_PUBLIC_FIELDS,
  mapJobRowToDto,
  mapJobRiskScoreRowToDto,
} from '@/lib/api/v1Dtos'

export const runtime = 'nodejs'

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

async function handler(
  request: NextRequest,
  params: Promise<{ id: string }>,
  method: 'GET' | 'PATCH' | 'DELETE'
) {
  const authResult = await withApiKeyAuth(request, [
    V1_SCOPES.jobsRead,
    V1_SCOPES.jobsWrite,
  ])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)
  const { id: jobId } = await params

  if (!isValidUUID(jobId)) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INVALID_FORMAT', 'Invalid job id format', requestId),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  // Enforce write scope before resource lookup so missing scope returns 403, not 404.
  if ((method === 'PATCH' || method === 'DELETE') && !context.scopes.includes(V1_SCOPES.jobsWrite)) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('FORBIDDEN', 'Insufficient scope', requestId),
        { status: 403, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const admin = createSupabaseAdminClient()

  const { data: job, error: fetchError } = await admin
    .from('jobs')
    .select(JOB_PUBLIC_FIELDS)
    .eq('id', jobId)
    .eq('organization_id', context.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError) {
    const pgCode = (fetchError as { code?: string }).code
    if (pgCode === '22P02') {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid job id format', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to load job', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
  if (!job) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('NOT_FOUND', 'Job not found', requestId),
        { status: 404, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  if (method === 'GET') {
    const requireWrite = false
    if (requireWrite && !context.scopes.includes(V1_SCOPES.jobsWrite)) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('FORBIDDEN', 'Insufficient scope', requestId),
          { status: 403, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const { data: riskScore, error: riskScoreError } = await admin
      .from('job_risk_scores')
      .select(JOB_RISK_SCORE_PUBLIC_FIELDS)
      .eq('job_id', jobId)
      .maybeSingle()

    if (riskScoreError) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to load job details', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const hazardsQuery = admin
      .from('mitigation_items')
      .select('id, title, description, done, is_completed, completed_at, created_at')
      .eq('job_id', jobId)
      .eq('organization_id', context.organization_id)
      .is('hazard_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    const controlsQuery = admin
      .from('mitigation_items')
      .select('id, hazard_id, title, description, done, is_completed, completed_at, created_at')
      .eq('job_id', jobId)
      .eq('organization_id', context.organization_id)
      .not('hazard_id', 'is', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    const [
      { data: hazards, error: hazardsError },
      { data: controls, error: controlsError },
    ] = await Promise.all([hazardsQuery, controlsQuery])

    if (hazardsError || controlsError) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to load job details', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const jobDto = mapJobRowToDto(job as Record<string, unknown>)
    const res = v1Json({
      ...jobDto,
      risk_score_detail: mapJobRiskScoreRowToDto(riskScore as Record<string, unknown> | null),
      hazards: hazards || [],
      controls: controls || [],
    })
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  }

  if (method === 'PATCH') {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid JSON body', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Request body must be a JSON object', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      status,
    } = body

    // Reject null or invalid values for required/mutable fields so client mistakes return 400, not 500.
    const invalidFormatBody = () =>
      withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid or null value for client_name, location, client_type, job_type, status, or dates', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    const validDate = (v: unknown): boolean =>
      v === null ||
      v === '' ||
      (typeof v === 'string' && isFinite(Date.parse(v)))
    if (client_name !== undefined) {
      if (client_name === null || typeof client_name !== 'string' || client_name.trim() === '') {
        return invalidFormatBody()
      }
    }
    if (location !== undefined) {
      if (location === null || typeof location !== 'string' || location.trim() === '') {
        return invalidFormatBody()
      }
    }
    if (client_type !== undefined) {
      if (client_type === null || !VALID_CLIENT_TYPES_SET.has(String(client_type).toLowerCase())) {
        return invalidFormatBody()
      }
    }
    if (job_type !== undefined) {
      if (job_type === null || !VALID_JOB_TYPES_SET.has(String(job_type).toLowerCase())) {
        return invalidFormatBody()
      }
    }
    if (status !== undefined) {
      const st = String(status).toLowerCase()
      if (status === null || !VALID_JOB_STATUSES_SET.has(st)) {
        return invalidFormatBody()
      }
    }
    if (start_date !== undefined && start_date !== null && start_date !== '' && !validDate(start_date)) {
      return invalidFormatBody()
    }
    if (end_date !== undefined && end_date !== null && end_date !== '' && !validDate(end_date)) {
      return invalidFormatBody()
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return invalidFormatBody()
    }

    const updateData: Record<string, unknown> = {}
    if (client_name !== undefined) updateData.client_name = (client_name as string).trim()
    if (client_type !== undefined) updateData.client_type = String(client_type).toLowerCase()
    if (job_type !== undefined) updateData.job_type = String(job_type).toLowerCase()
    if (location !== undefined) updateData.location = (location as string).trim()
    if (description !== undefined) updateData.description = description !== null && description !== '' ? String(description) : null
    if (start_date !== undefined) updateData.start_date = start_date === null || start_date === '' ? null : start_date
    if (end_date !== undefined) updateData.end_date = end_date === null || end_date === '' ? null : end_date
    if (status !== undefined) updateData.status = String(status).toLowerCase()

    if (Object.keys(updateData).length === 0) {
      const res = v1Json(mapJobRowToDto(job as Record<string, unknown>))
      return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
    }

    const { data: updated, error: updateError } = await admin
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)
      .eq('organization_id', context.organization_id)
      .select(JOB_PUBLIC_FIELDS)
      .single()

    if (updateError) {
      console.error('[v1/jobs/[id]] PATCH error:', updateError)
      const pgCode = (updateError as { code?: string }).code
      const isCheckOrEnumViolation =
        pgCode === '23514' || pgCode === 'check_violation'
      const isInvalidDateOrType =
        pgCode === '22007' || pgCode === '22P02'
      const isNotNullViolation = pgCode === '23502'
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
      if (isNotNullViolation) {
        return withRateLimitHeaders(
          NextResponse.json(
            errorBody(
              'INVALID_FORMAT',
              'Required field missing or null: client_name, location, client_type, or job_type',
              requestId
            ),
            { status: 400, headers: { 'X-Request-ID': requestId } }
          ),
          rateLimitResult
        )
      }
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to update job', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const previousStatus = (job as { status?: string }).status
    const transitionedToCompleted =
      updated?.status === 'completed' && previousStatus !== 'completed'

    await triggerWebhookEvent(context.organization_id, 'job.updated', { ...updated }).catch(() => {})
    if (transitionedToCompleted) {
      await triggerWebhookEvent(context.organization_id, 'job.completed', { ...updated }).catch(() => {})
    }

    const res = v1Json(mapJobRowToDto(updated as Record<string, unknown>))
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  }

  if (method === 'DELETE') {
    const { error: deleteError } = await admin
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('organization_id', context.organization_id)

    if (deleteError) {
      console.error('[v1/jobs/[id]] DELETE error:', deleteError)
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to delete job', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    await triggerWebhookEvent(context.organization_id, 'job.deleted', { id: jobId }).catch(() => {})

    const res = v1Json({ id: jobId, deleted: true })
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  }

  return withRateLimitHeaders(
    NextResponse.json(
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed', requestId),
      { status: 405, headers: { 'X-Request-ID': requestId } }
    ),
    rateLimitResult
  )
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handler(request, ctx.params, 'GET')
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handler(request, ctx.params, 'PATCH')
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handler(request, ctx.params, 'DELETE')
}
