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

const ALLOWED_SCOPES_SET = new Set<string>(API_KEY_SCOPES)

/** Validate scopes: return invalid values if any; otherwise return deduped allowed scopes. */
function validateAndNormalizeScopes(scopes: unknown): { valid: string[]; invalid: string[] } {
  const arr = Array.isArray(scopes) ? (scopes as unknown[]).map((s) => String(s)) : []
  const invalid = arr.filter((s) => !ALLOWED_SCOPES_SET.has(s))
  const valid = [...new Set(arr.filter((s) => ALLOWED_SCOPES_SET.has(s)))]
  return { valid, invalid }
}

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
  if (error) return { queryError: true, notFound: false, key: null, organization_id: null }
  if (!key) return { queryError: false, notFound: true, key: null, organization_id: null }
  return { queryError: false, notFound: false, key, organization_id }
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
    if (result.queryError) {
      const { response, errorId } = createErrorResponse(
        'Failed to look up API key',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (result.notFound || !result.key) {
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
      const { valid, invalid } = validateAndNormalizeScopes(scopes)
      if (invalid.length > 0) {
        const { response, errorId } = createErrorResponse(
          `Invalid scope(s): ${invalid.join(', ')}. Allowed: ${API_KEY_SCOPES.join(', ')}`,
          'INVALID_FORMAT',
          { requestId, statusCode: 400, details: { invalid_scopes: invalid } }
        )
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      updateData.scopes = valid
    }
    if (expires_at !== undefined) {
      if (expires_at === null || expires_at === '') {
        updateData.expires_at = null
      } else if (typeof expires_at === 'string') {
        const parsed = Date.parse(expires_at)
        if (Number.isNaN(parsed)) {
          const { response, errorId } = createErrorResponse(
            'expires_at must be a valid ISO 8601 date string or null',
            'INVALID_FORMAT',
            { requestId, statusCode: 400 }
          )
          return NextResponse.json(response, {
            status: 400,
            headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
          })
        }
        updateData.expires_at = new Date(parsed).toISOString()
      } else {
        const { response, errorId } = createErrorResponse(
          'expires_at must be a valid ISO 8601 date string or null',
          'INVALID_FORMAT',
          { requestId, statusCode: 400 }
        )
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
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
    if (result.queryError) {
      const { response, errorId } = createErrorResponse(
        'Failed to look up API key',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (result.notFound || !result.key) {
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
