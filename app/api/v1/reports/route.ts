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
import { REPORT_RUN_PUBLIC_FIELDS, mapReportRunRowToDto } from '@/lib/api/v1Dtos'
import { isValidUUID } from '@/lib/utils/uuid'
import { parseStrictInt } from '@/lib/utils/parseStrictInt'

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
  if (!isValidUUID(jobId)) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INVALID_FORMAT', 'Invalid job_id format', requestId),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

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
    console.error('[v1/reports] job lookup error:', jobError)
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

  // Pagination: page + limit (v1 list contract); offset is optional legacy fallback (page takes precedence).
  const pageRaw = request.nextUrl.searchParams.get('page')
  const limitRaw = request.nextUrl.searchParams.get('limit') ?? '20'
  const offsetRaw = request.nextUrl.searchParams.get('offset')
  const limit = parseStrictInt(limitRaw, { min: 1, max: 100 })
  const pageParsed = pageRaw != null ? parseStrictInt(pageRaw, { min: 1 }) : null
  const offsetParsed = offsetRaw != null ? parseStrictInt(offsetRaw, { min: 0 }) : null

  if (limit === null) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody(
          'INVALID_FORMAT',
          'Invalid pagination: limit must be between 1 and 100',
          requestId
        ),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  let offset: number
  let page: number
  if (pageRaw != null) {
    if (pageParsed === null) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody(
            'INVALID_FORMAT',
            'Invalid pagination: page must be a positive integer',
            requestId
          ),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    page = pageParsed
    offset = (page - 1) * limit
  } else if (offsetRaw != null) {
    if (offsetParsed === null) {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody(
            'INVALID_FORMAT',
            'Invalid pagination: offset must be a non-negative integer',
            requestId
          ),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    offset = offsetParsed
    page = Math.floor(offset / limit) + 1
  } else {
    page = 1
    offset = 0
  }

  const { data: runs, error, count } = await admin
    .from('report_runs')
    .select(REPORT_RUN_PUBLIC_FIELDS, { count: 'exact' })
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
  const dtos = (runs || []).map((row) => mapReportRunRowToDto(row as Record<string, unknown>)).filter((dto): dto is NonNullable<typeof dto> => dto != null)
  const res = v1Json(dtos, { meta: { page, limit, total } })
  return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
}
