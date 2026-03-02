/**
 * Helpers for Public API v1: auth, rate limit, and standard error responses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequestId } from '@/lib/utils/requestId'
import {
  getApiKeyContext,
  touchApiKeyLastUsed,
  requireScope,
  type ApiKeyContext,
} from '@/lib/middleware/apiKeyAuth'
import {
  checkApiKeyRateLimit,
  addRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
  type RateLimitResult,
} from '@/lib/utils/rateLimiter'

export const V1_SCOPES = {
  jobsRead: 'jobs:read',
  jobsWrite: 'jobs:write',
  hazardsRead: 'hazards:read',
  hazardsWrite: 'hazards:write',
  reportsRead: 'reports:read',
  teamRead: 'team:read',
  webhooksManage: 'webhooks:manage',
} as const

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

/**
 * Authenticate request with API key and apply rate limit.
 * Returns { context, rateLimitResult } or a NextResponse to return (401, 403, 429).
 */
export async function withApiKeyAuth(
  request: NextRequest,
  requiredScopes: string[]
): Promise<
  | { context: ApiKeyContext; rateLimitResult: RateLimitResult }
  | NextResponse
> {
  const requestId = getRequestId(request)

  const auth = await getApiKeyContext(request)
  if (!auth) {
    return NextResponse.json(
      errorBody('UNAUTHORIZED', 'Invalid or missing API key', requestId),
      {
        status: 401,
        headers: { 'X-Request-ID': requestId },
      }
    )
  }

  touchApiKeyLastUsed(auth.context.api_key_id).catch(() => {})

  const rateLimitResult = checkApiKeyRateLimit(
    request,
    auth.keyRow.id,
    RATE_LIMIT_CONFIGS.apiKey
  )
  if (!rateLimitResult.allowed) {
    return addRateLimitHeaders(
      NextResponse.json(
        errorBody(
          'RATE_LIMIT_EXCEEDED',
          'Too many requests. Retry after the time indicated by Retry-After.',
          requestId
        ),
        {
          status: 429,
          headers: {
            'X-Request-ID': requestId,
            'Retry-After': String(rateLimitResult.retryAfter),
          },
        }
      ),
      rateLimitResult
    )
  }

  if (!requireScope(auth.context, requiredScopes)) {
    return NextResponse.json(
      errorBody('FORBIDDEN', 'Insufficient scope for this endpoint', requestId),
      {
        status: 403,
        headers: { 'X-Request-ID': requestId },
      }
    )
  }

  return { context: auth.context, rateLimitResult }
}

/**
 * Call after successful handler to add rate limit headers to response.
 * last_used_at is updated in the auth path (withApiKeyAuth).
 */
export async function finishApiKeyRequest(
  apiKeyId: string,
  response: NextResponse,
  rateLimitResult: RateLimitResult
): Promise<NextResponse> {
  return addRateLimitHeaders(response, rateLimitResult)
}

export function v1Json<T>(
  data: T,
  init?: { status?: number; headers?: HeadersInit; meta?: { page?: number; limit?: number; total?: number } }
): NextResponse {
  const body = init?.meta
    ? { data, meta: init.meta }
    : { data }
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: init?.headers,
  })
}
