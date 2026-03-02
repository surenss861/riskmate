/**
 * Public API v1: GET /api/v1/reports?job_id=xxx (list report runs for a job).
 * Requires API key with reports:read.
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

export const runtime = 'nodejs'

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

export async function GET(request: NextRequest) {
  const authResult = await withApiKeyAuth(request, [V1_SCOPES.reportsRead])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)

  const jobId = request.nextUrl.searchParams.get('job_id')
  if (!jobId) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INVALID_FORMAT', 'Missing required query: job_id', requestId),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const admin = createSupabaseAdminClient()

  const { data: job } = await admin
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', context.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!job) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('NOT_FOUND', 'Job not found', requestId),
        { status: 404, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const limitRaw = request.nextUrl.searchParams.get('limit') ?? '20'
  const offsetRaw = request.nextUrl.searchParams.get('offset') ?? '0'
  const limitParsed = parseInt(limitRaw, 10)
  const offsetParsed = parseInt(offsetRaw, 10)
  if (
    !Number.isFinite(limitParsed) ||
    !Number.isFinite(offsetParsed) ||
    limitParsed < 1 ||
    limitParsed > 100 ||
    offsetParsed < 0
  ) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody(
          'INVALID_FORMAT',
          'Invalid pagination: limit must be between 1 and 100, offset must be a non-negative integer',
          requestId
        ),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
  const limit = limitParsed
  const offset = offsetParsed

  const { data: runs, error, count } = await admin
    .from('report_runs')
    .select('*', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('organization_id', context.organization_id)
    .order('generated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[v1/reports] GET error:', error)
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to list reports', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const total = count ?? (runs?.length ?? 0)
  const page = Math.floor(offset / limit) + 1
  const res = v1Json(runs || [], { meta: { page, limit, total } })
  return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
}
