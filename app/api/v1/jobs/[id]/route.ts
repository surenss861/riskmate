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
import { triggerWebhookEvent } from '@/lib/webhooks/trigger'

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

  const admin = createSupabaseAdminClient()

  const { data: job, error: fetchError } = await admin
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', context.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError) {
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
      .select('*')
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

    const res = v1Json({
      ...job,
      risk_score_detail: riskScore || null,
      hazards: hazards || [],
      controls: controls || [],
    })
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  }

  if (method === 'PATCH') {
    if (!context.scopes.includes(V1_SCOPES.jobsWrite)) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('FORBIDDEN', 'Insufficient scope for updates', requestId),
          { status: 403, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const body = await request.json().catch(() => ({}))
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

    const updateData: Record<string, unknown> = {}
    if (client_name !== undefined) updateData.client_name = client_name
    if (client_type !== undefined) updateData.client_type = client_type
    if (job_type !== undefined) updateData.job_type = job_type
    if (location !== undefined) updateData.location = location
    if (description !== undefined) updateData.description = description
    if (start_date !== undefined) updateData.start_date = start_date || null
    if (end_date !== undefined) updateData.end_date = end_date || null
    if (status !== undefined) updateData.status = status

    if (Object.keys(updateData).length === 0) {
      const res = v1Json(job)
      return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
    }

    const { data: updated, error: updateError } = await admin
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)
      .eq('organization_id', context.organization_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('[v1/jobs/[id]] PATCH error:', updateError)
      const pgCode = (updateError as { code?: string }).code
      const isCheckOrEnumViolation =
        pgCode === '23514' || pgCode === 'check_violation'
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

    const res = v1Json(updated)
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  }

  if (method === 'DELETE') {
    if (!context.scopes.includes(V1_SCOPES.jobsWrite)) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('FORBIDDEN', 'Insufficient scope for delete', requestId),
          { status: 403, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

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
