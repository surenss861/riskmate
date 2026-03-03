/**
 * API Key Management: GET (list org keys), POST (create key; full key returned once).
 * Session auth; owners/admins only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, requireOwnerOrAdmin } from '@/lib/utils/organizationGuard'
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/adminAuth'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'
import { normalizeExpiresAt } from '@/lib/utils/apiKeyExpiry'
import { hashApiKey, getKeyPrefix, getDefaultKeyPrefix } from '@/lib/middleware/apiKeyAuth'
import { randomBytes } from 'crypto'
import { API_KEY_SCOPES, isScopesArrayOfStrings, validateAndNormalizeScopes } from '@/lib/api/apiKeyScopes'

export const runtime = 'nodejs'

const ROUTE = '/api/api-keys'

/** 32 random hex characters (16 bytes) after prefix to match documented format. */
function generateSecureKey(prefix: string): string {
  const bytes = randomBytes(16)
  const hex = bytes.toString('hex')
  return `${prefix}${hex}`
}


/** GET - List API keys for the org (prefix, scopes, last_used, never full key) */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_id, user_role } = await getOrganizationContext(request)
    requireOwnerOrAdmin(user_role)

    const admin = createSupabaseAdminClient()
    const { data: keys, error } = await admin
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, expires_at, created_at, revoked_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })

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

    return NextResponse.json({
      data: (keys || []).map((k) => ({
        id: k.id,
        name: k.name,
        key_prefix: k.key_prefix,
        scopes: k.scopes ?? [],
        last_used_at: k.last_used_at,
        expires_at: k.expires_at,
        created_at: k.created_at,
        revoked_at: k.revoked_at,
      })),
    })
  } catch (e: any) {
    if (e instanceof UnauthorizedError) {
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
    if (e instanceof ForbiddenError || e.message?.includes('Requires one of') || e.message?.includes('no organization') || e.message?.includes('organization membership')) {
      const { response, errorId } = createErrorResponse(
        e instanceof ForbiddenError ? e.message : 'Only owners and admins can manage API keys',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    console.error('[api-keys] GET error:', e)
    const { response, errorId } = createErrorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      { requestId, statusCode: 500 }
    )
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

/** POST - Create API key; return full key once; store hash only */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext(request)
    requireOwnerOrAdmin(user_role)

    const body = await request.json().catch(() => ({}))
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      const { response, errorId } = createErrorResponse(
        'Request body must be a JSON object',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const { name, scopes, expires_at } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      const { response, errorId } = createErrorResponse(
        'Name is required',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (scopes !== undefined && !isScopesArrayOfStrings(scopes)) {
      const { response, errorId } = createErrorResponse(
        'scopes must be an array of strings',
        'INVALID_FORMAT',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const scopesToValidate = scopes !== undefined ? scopes : []
    const { valid: validScopes, invalid: invalidScopes } = validateAndNormalizeScopes(scopesToValidate)
    if (invalidScopes.length > 0) {
      const { response, errorId } = createErrorResponse(
        `Invalid scope(s): ${invalidScopes.join(', ')}. Allowed: ${API_KEY_SCOPES.join(', ')}`,
        'INVALID_FORMAT',
        { requestId, statusCode: 400, details: { invalid_scopes: invalidScopes } }
      )
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    let expiresAt: string | null = null
    if (expires_at !== undefined && expires_at !== null && expires_at !== '') {
      const normalized = normalizeExpiresAt(expires_at)
      if (!normalized) {
        const { response, errorId } = createErrorResponse(
          'expires_at must be a valid ISO 8601 date/datetime or date-only (YYYY-MM-DD). Date-only values are interpreted as end of that day UTC.',
          'INVALID_FORMAT',
          { requestId, statusCode: 400 }
        )
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      expiresAt = normalized
    }

    const prefix = getDefaultKeyPrefix()
    const plainKey = generateSecureKey(prefix)
    const keyHash = hashApiKey(plainKey)
    const keyPrefix = getKeyPrefix(plainKey)

    const admin = createSupabaseAdminClient()
    const { data: row, error } = await admin
      .from('api_keys')
      .insert({
        organization_id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: validScopes,
        expires_at: expiresAt,
        created_by: user_id,
      })
      .select('id, name, key_prefix, scopes, expires_at, created_at')
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

    return NextResponse.json({
      data: {
        ...row,
        key: plainKey,
        warning: 'Save this key — it will not be shown again.',
      },
    })
  } catch (e: any) {
    if (e instanceof UnauthorizedError) {
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
    if (e instanceof ForbiddenError || e.message?.includes('Requires one of') || e.message?.includes('no organization') || e.message?.includes('organization membership')) {
      const { response, errorId } = createErrorResponse(
        e instanceof ForbiddenError ? e.message : 'Only owners and admins can manage API keys',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    console.error('[api-keys] POST error:', e)
    const { response, errorId } = createErrorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      { requestId, statusCode: 500 }
    )
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
