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
  v1Json,
  V1_SCOPES,
} from '@/lib/api/v1Helpers'

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

  const admin = createSupabaseAdminClient()

  const { data: reportRun, error: runError } = await admin
    .from('report_runs')
    .select('*')
    .eq('id', reportId)
    .eq('organization_id', context.organization_id)
    .maybeSingle()

  if (runError || !reportRun) {
    return NextResponse.json(
      errorBody('NOT_FOUND', 'Report not found', requestId),
      { status: 404, headers: { 'X-Request-ID': requestId } }
    )
  }

  const { data: signatures } = await admin
    .from('report_signatures')
    .select('id, signer_name, signer_title, signature_role, signed_at, created_at')
    .eq('report_run_id', reportId)
    .is('revoked_at', null)
    .order('signed_at', { ascending: true })

  const res = v1Json({
    ...reportRun,
    signatures: signatures || [],
  })
  return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
}
