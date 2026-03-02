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
  v1Json,
  V1_SCOPES,
} from '@/lib/api/v1Helpers'
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

  const jobId = request.nextUrl.searchParams.get('job_id')
  if (!jobId) {
    return NextResponse.json(
      errorBody('INVALID_FORMAT', 'Missing required query: job_id', requestId),
      { status: 400, headers: { 'X-Request-ID': requestId } }
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
    return NextResponse.json(
      errorBody('NOT_FOUND', 'Job not found', requestId),
      { status: 404, headers: { 'X-Request-ID': requestId } }
    )
  }

  const { data: items, error } = await admin
    .from('mitigation_items')
    .select('id, job_id, title, description, done, is_completed, completed_at, created_at, hazard_id')
    .eq('job_id', jobId)
    .eq('organization_id', context.organization_id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[v1/hazards] GET error:', error)
    return NextResponse.json(
      errorBody('QUERY_ERROR', 'Failed to list hazards', requestId),
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }

  const res = v1Json(items || [])
  return finishApiKeyRequest(context.api_key_id, res, rateLimitResult)
}

export async function POST(request: NextRequest) {
  const authResult = await withApiKeyAuth(request, [V1_SCOPES.hazardsWrite])
  if (authResult instanceof NextResponse) return authResult
  const { context, rateLimitResult } = authResult
  const requestId = getRequestId(request)

  try {
    const body = await request.json().catch(() => ({}))
    const { job_id, title, description } = body

    if (!job_id || !title) {
      return NextResponse.json(
        errorBody(
          'INVALID_FORMAT',
          'Missing required fields: job_id, title',
          requestId
        ),
        { status: 400, headers: { 'X-Request-ID': requestId } }
      )
    }

    const admin = createSupabaseAdminClient()

    const { data: job } = await admin
      .from('jobs')
      .select('id')
      .eq('id', job_id)
      .eq('organization_id', context.organization_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!job) {
      return NextResponse.json(
        errorBody('NOT_FOUND', 'Job not found', requestId),
        { status: 404, headers: { 'X-Request-ID': requestId } }
      )
    }

    const { data: inserted, error } = await admin
      .from('mitigation_items')
      .insert({
        job_id,
        organization_id: context.organization_id,
        title: String(title).trim(),
        description: description != null ? String(description) : '',
        done: false,
        is_completed: false,
      })
      .select('id, job_id, title, description, done, is_completed, created_at')
      .single()

    if (error) {
      console.error('[v1/hazards] POST error:', error)
      return NextResponse.json(
        errorBody('QUERY_ERROR', 'Failed to create hazard', requestId),
        { status: 500, headers: { 'X-Request-ID': requestId } }
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
    return NextResponse.json(
      errorBody('INTERNAL_ERROR', 'Internal server error', requestId),
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }
}
