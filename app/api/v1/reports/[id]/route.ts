/**
 * Public API v1: GET /api/v1/reports/[id] (single report run with signatures).
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
import { isValidUUID } from '@/lib/utils/uuid'

export const runtime = 'nodejs'

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authResult = await withApiKeyAuth(request, [V1_SCOPES.reportsRead])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)
  const { id: reportId } = await ctx.params

  if (!isValidUUID(reportId)) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('INVALID_FORMAT', 'Invalid report id format', requestId),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const admin = createSupabaseAdminClient()

  const { data: reportRun, error: runError } = await admin
    .from('report_runs')
    .select('*')
    .eq('id', reportId)
    .eq('organization_id', context.organization_id)
    .maybeSingle()

  if (runError) {
    const pgCode = (runError as { code?: string }).code
    if (pgCode === '22P02') {
      return withRateLimitHeaders(
        NextResponse.json(
          errorBody('INVALID_FORMAT', 'Invalid report id format', requestId),
          { status: 400, headers: { 'X-Request-ID': requestId } }
        ),
        rateLimitResult
      )
    }
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to load report', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }
  if (!reportRun) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('NOT_FOUND', 'Report not found', requestId),
        { status: 404, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const { data: signatures, error: signaturesError } = await admin
    .from('report_signatures')
    .select('id, signer_name, signer_title, signature_role, signed_at, created_at')
    .eq('report_run_id', reportId)
    .eq('organization_id', context.organization_id)
    .is('revoked_at', null)
    .order('signed_at', { ascending: true })

  if (signaturesError) {
    return withRateLimitHeaders(
      NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to load report details', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
      ),
      rateLimitResult
    )
  }

  const res = v1Json({
    ...reportRun,
    signatures: signatures || [],
  })
  return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
}
