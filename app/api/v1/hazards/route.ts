/**
 * Public API v1: GET /api/v1/hazards?job_id=xxx (list), POST /api/v1/hazards (create).
 * Hazards are represented as mitigation_items. Requires hazards:read (GET) or hazards:write (POST).
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
import { parseStrictInt } from '@/lib/utils/parseStrictInt'
import { triggerWebhookEvent } from '@/lib/webhooks/trigger'

export const runtime = 'nodejs'

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

export async function GET(request: NextRequest) {
  const authResult = await withApiKeyAuth(request, [
    V1_SCOPES.hazardsRead,
    V1_SCOPES.hazardsWrite,
  ])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)

  const { searchParams } = request.nextUrl
  const jobId = searchParams.get('job_id')
  if (!jobId) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INVALID_FORMAT', 'Missing required query: job_id', requestId),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
  if (!isValidUUID(jobId)) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INVALID_FORMAT', 'Invalid job_id format', requestId),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const pageRaw = searchParams.get('page') ?? '1'
  const limitRaw = searchParams.get('limit') ?? '20'
  const page = parseStrictInt(pageRaw, { min: 1 })
  const limit = parseStrictInt(limitRaw, { min: 1, max: 100 })
  if (page === null || limit === null) {
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
  const offset = (page - 1) * limit

  const admin = createSupabaseAdminClient()

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', context.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (jobError) {
    const pgCode = (jobError as { code?: string }).code
    if (pgCode === '22P02') {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid job_id format', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    console.error('[v1/hazards] job lookup error:', jobError)
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to look up job', requestId),
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

  const baseQuery = admin
    .from('mitigation_items')
    .select('id, job_id, title, description, done, is_completed, completed_at, created_at, hazard_id', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('organization_id', context.organization_id)
    .is('hazard_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const { data: items, error, count } = await baseQuery.range(offset, offset + limit - 1)

  if (error) {
    console.error('[v1/hazards] GET error:', error)
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to list hazards', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const total = count ?? (items?.length ?? 0)
  const res = v1Json(items || [], { meta: { page, limit, total } })
  return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
}

export async function POST(request: NextRequest) {
  const authResult = await withApiKeyAuth(request, [V1_SCOPES.hazardsWrite])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)

  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Request body must be a JSON object', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    const { job_id, title: rawTitle, description } = body

    // Validate required title as non-empty string before any normalization
    if (rawTitle === undefined || rawTitle === null) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Missing required field: title', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    if (typeof rawTitle !== 'string') {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'title must be a string', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    const title = rawTitle.trim()
    if (!title) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'title cannot be empty', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    if (!job_id) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Missing required field: job_id', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    if (!isValidUUID(String(job_id))) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid job_id format', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'description must be a string or null', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    const admin = createSupabaseAdminClient()

    const { data: job, error: jobError } = await admin
      .from('jobs')
      .select('id')
      .eq('id', job_id)
      .eq('organization_id', context.organization_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (jobError) {
      const pgCode = (jobError as { code?: string }).code
      if (pgCode === '22P02') {
        return withRateLimitHeaders(
          NextResponse.json(
            errorBody('INVALID_FORMAT', 'Invalid job_id format', requestId),
            { status: 400, headers: { 'X-Request-ID': requestId } }
          ),
          rateLimitResult
        )
      }
      console.error('[v1/hazards] job lookup error:', jobError)
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to look up job', requestId),
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

    const { data: inserted, error } = await admin
      .from('mitigation_items')
      .insert({
        job_id,
        organization_id: context.organization_id,
        title,
        description: description != null && description !== '' ? description : '',
        done: false,
        is_completed: false,
      })
      .select('id, job_id, title, description, done, is_completed, created_at')
      .single()

    if (error) {
      console.error('[v1/hazards] POST error:', error)
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('QUERY_ERROR', 'Failed to create hazard', requestId),
          { status: 500, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }

    if (inserted) {
      await triggerWebhookEvent(context.organization_id, 'hazard.created', {
        id: inserted.id,
        job_id,
        title: inserted.title,
        description: inserted.description ?? '',
        created_at: inserted.created_at,
      }).catch(() => {})
    }

    const res = v1Json(inserted)
    return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
  } catch (e) {
    console.error('[v1/hazards] POST error:', e)
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INTERNAL_ERROR', 'Internal server error', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
}
