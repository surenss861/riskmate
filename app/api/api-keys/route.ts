/**
 * API Key Management: GET (list org keys), POST (create key; full key returned once).
 * Session auth; owners/admins only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, requireOwnerOrAdmin } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'
import { hashApiKey, getKeyPrefix } from '@/lib/middleware/apiKeyAuth'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

const ROUTE = '/api/api-keys'

const API_KEY_SCOPES = [
  'jobs:read',
  'jobs:write',
  'hazards:read',
  'hazards:write',
  'reports:read',
  'team:read',
  'webhooks:manage',
] as const

function generateSecureKey(prefix: string): string {
  const bytes = randomBytes(32)
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

/** POST - Create API key; return full key once; store hash only */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext(request)
    requireOwnerOrAdmin(user_role)

    const body = await request.json().catch(() => ({}))
    const { name, scopes = [], expires_at } = body

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

    const validScopes = Array.isArray(scopes)
      ? (scopes as string[]).filter((s) => API_KEY_SCOPES.includes(s as any))
      : []
    const expiresAt =
      expires_at && typeof expires_at === 'string' && !Number.isNaN(Date.parse(expires_at))
        ? new Date(expires_at).toISOString()
        : null

    const plainKey = generateSecureKey('rm_live_')
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
