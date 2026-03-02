/**
 * API Key Management: PATCH (update name, scopes, expiry), DELETE (revoke).
 * Session auth; owners/admins only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, requireOwnerOrAdmin } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/api-keys/[id]'

const API_KEY_SCOPES = [
  'jobs:read',
  'jobs:write',
  'hazards:read',
  'hazards:write',
  'reports:read',
  'team:read',
  'webhooks:manage',
] as const

async function getKeyAndCheckAuth(request: NextRequest, id: string) {
  const { organization_id, user_role } = await getOrganizationContext(request)
  requireOwnerOrAdmin(user_role)
  const admin = createSupabaseAdminClient()
  const { data: key, error } = await admin
    .from('api_keys')
    .select('id, organization_id, name, scopes, expires_at, revoked_at')
    .eq('id', id)
    .eq('organization_id', organization_id)
    .maybeSingle()
  if (error || !key) return { error: true, key: null, organization_id: null }
  return { error: false, key, organization_id }
}

/** PATCH - Update name, scopes, expiry */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  const { id } = await ctx.params
  try {
    const result = await getKeyAndCheckAuth(request, id)
    if (result.error || !result.key) {
      const { response, errorId } = createErrorResponse(
        'API key not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (result.key.revoked_at) {
      const { response, errorId } = createErrorResponse(
        'Cannot update a revoked key',
        'INVALID_STATE',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const body = await request.json().catch(() => ({}))
    const { name, scopes, expires_at } = body
    const updateData: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim()
    if (Array.isArray(scopes)) {
      updateData.scopes = (scopes as string[]).filter((s) =>
        (API_KEY_SCOPES as readonly string[]).includes(s)
      )
    }
    if (expires_at !== undefined) {
      updateData.expires_at =
        expires_at && !Number.isNaN(Date.parse(expires_at))
          ? new Date(expires_at).toISOString()
          : null
    }

    if (Object.keys(updateData).length === 0) {
      const admin = createSupabaseAdminClient()
      const { data: current } = await admin
        .from('api_keys')
        .select('id, name, key_prefix, scopes, expires_at, last_used_at, created_at')
        .eq('id', id)
        .single()
      return NextResponse.json({ data: current })
    }

    const admin = createSupabaseAdminClient()
    const { data: updated, error } = await admin
      .from('api_keys')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', result.organization_id!)
      .select('id, name, key_prefix, scopes, expires_at, last_used_at, created_at')
      .single()

    if (error) {
      const { response, errorId } = createErrorResponse(
        error.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    return NextResponse.json({ data: updated })
  } catch (e: any) {
    if (e.message?.includes('Unauthorized') || e.message?.includes('organization')) {
      const { response, errorId } = createErrorResponse(
        e.message || 'Unauthorized',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (e.message?.includes('Requires one of')) {
      const { response, errorId } = createErrorResponse(
        'Only owners and admins can manage API keys',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    throw e
  }
}

/** DELETE - Revoke key (set revoked_at) */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  const { id } = await ctx.params
  try {
    const result = await getKeyAndCheckAuth(request, id)
    if (result.error || !result.key) {
      const { response, errorId } = createErrorResponse(
        'API key not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const admin = createSupabaseAdminClient()
    const { data: updated, error } = await admin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', result.organization_id!)
      .select('id, name, key_prefix, revoked_at')
      .single()

    if (error) {
      const { response, errorId } = createErrorResponse(
        error.message,
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    return NextResponse.json({ data: updated })
  } catch (e: any) {
    if (e.message?.includes('Unauthorized') || e.message?.includes('organization')) {
      const { response, errorId } = createErrorResponse(
        e.message || 'Unauthorized',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (e.message?.includes('Requires one of')) {
      const { response, errorId } = createErrorResponse(
        'Only owners and admins can manage API keys',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    throw e
  }
}
