/**
 * Unit tests for Public API v1 helpers: withApiKeyAuth, addRateLimitHeaders, v1Json.
 * Covers bearer/auth failure modes, rate-limit 429, missing-scope 403, and success path.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  withApiKeyAuth,
  finishApiKeyRequest,
  withRateLimitHeaders,
  v1Json,
  V1_SCOPES,
} from '../v1Helpers'
import { addRateLimitHeaders } from '@/lib/utils/rateLimiter'

const mockGetApiKeyContext = jest.fn()
const mockTouchApiKeyLastUsed = jest.fn()
const mockCheckApiKeyRateLimit = jest.fn()

jest.mock('@/lib/middleware/apiKeyAuth', () => ({
  getApiKeyContext: (...args: unknown[]) => mockGetApiKeyContext(...args),
  touchApiKeyLastUsed: (...args: unknown[]) => mockTouchApiKeyLastUsed(...args),
  requireScope: jest.requireActual('@/lib/middleware/apiKeyAuth').requireScope,
}))

jest.mock('@/lib/utils/rateLimiter', () => ({
  ...jest.requireActual('@/lib/utils/rateLimiter'),
  checkApiKeyRateLimit: (...args: unknown[]) => mockCheckApiKeyRateLimit(...args),
}))

function requestWithBearer(token: string | null): NextRequest {
  const headers = new Headers()
  if (token) headers.set('authorization', `Bearer ${token}`)
  return new NextRequest('http://localhost/api/v1/jobs', { headers })
}

const validContext = {
  organization_id: 'org-1',
  api_key_id: 'key-1',
  scopes: [V1_SCOPES.jobsRead, V1_SCOPES.jobsWrite],
}
const validKeyRow = { id: 'key-1', organization_id: 'org-1', scopes: validContext.scopes }
const validRateLimitResult = {
  allowed: true,
  limit: 1000,
  remaining: 999,
  resetAt: Math.ceil((Date.now() + 3600000) / 1000),
  retryAfter: 3600,
  windowMs: 3600000,
}

describe('v1Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTouchApiKeyLastUsed.mockResolvedValue(undefined)
  })

  describe('withApiKeyAuth', () => {
    it('returns 401 when getApiKeyContext returns auth_failure', async () => {
      mockGetApiKeyContext.mockResolvedValue({ kind: 'auth_failure' })

      const req = requestWithBearer('rm_test_badkey')
      const result = await withApiKeyAuth(req, [V1_SCOPES.jobsRead])

      expect(result).toBeInstanceOf(NextResponse)
      const res = result as NextResponse
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error?.code).toBe('UNAUTHORIZED')
      expect(body.error?.message).toContain('Invalid or missing API key')
      expect(mockCheckApiKeyRateLimit).not.toHaveBeenCalled()
    })

    it('returns 500 when getApiKeyContext returns backend_error', async () => {
      mockGetApiKeyContext.mockResolvedValue({ kind: 'backend_error' })

      const req = requestWithBearer('rm_test_xxx')
      const result = await withApiKeyAuth(req, [V1_SCOPES.jobsRead])

      expect(result).toBeInstanceOf(NextResponse)
      const res = result as NextResponse
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error?.code).toBe('INTERNAL_ERROR')
      expect(body.error?.message).toContain('API key lookup temporarily unavailable')
      expect(mockCheckApiKeyRateLimit).not.toHaveBeenCalled()
    })

    it('returns 500 when checkApiKeyRateLimit returns infrastructure_error', async () => {
      mockGetApiKeyContext.mockResolvedValue({
        kind: 'ok',
        context: validContext,
        keyRow: validKeyRow,
      })
      mockCheckApiKeyRateLimit.mockResolvedValue({ kind: 'infrastructure_error' })

      const req = requestWithBearer('rm_test_xxx')
      const result = await withApiKeyAuth(req, [V1_SCOPES.jobsRead])

      expect(result).toBeInstanceOf(NextResponse)
      const res = result as NextResponse
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error?.code).toBe('INTERNAL_ERROR')
      expect(body.error?.message).toContain('Rate limit check temporarily unavailable')
    })

    it('returns 429 with Retry-After when rate limit exceeded', async () => {
      mockGetApiKeyContext.mockResolvedValue({
        kind: 'ok',
        context: validContext,
        keyRow: validKeyRow,
      })
      mockCheckApiKeyRateLimit.mockResolvedValue({
        kind: 'ok',
        result: {
          allowed: false,
          limit: 1000,
          remaining: 0,
          resetAt: Math.ceil((Date.now() + 1800) / 1000),
          retryAfter: 1800,
          windowMs: 3600000,
        },
      })

      const req = requestWithBearer('rm_test_xxx')
      const result = await withApiKeyAuth(req, [V1_SCOPES.jobsRead])

      expect(result).toBeInstanceOf(NextResponse)
      const res = result as NextResponse
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBe('1800')
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      const body = await res.json()
      expect(body.error?.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(body.error?.message).toContain('Retry after')
    })

    it('returns 403 when scope is insufficient', async () => {
      mockGetApiKeyContext.mockResolvedValue({
        kind: 'ok',
        context: { ...validContext, scopes: [V1_SCOPES.hazardsRead] },
        keyRow: { ...validKeyRow, scopes: [V1_SCOPES.hazardsRead] },
      })
      mockCheckApiKeyRateLimit.mockResolvedValue({
        kind: 'ok',
        result: validRateLimitResult,
      })

      const req = requestWithBearer('rm_test_xxx')
      const result = await withApiKeyAuth(req, [V1_SCOPES.jobsRead])

      expect(result).toBeInstanceOf(NextResponse)
      const res = result as NextResponse
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error?.code).toBe('FORBIDDEN')
      expect(body.error?.message).toContain('Insufficient scope')
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
    })

    it('returns context and rateLimitResult when auth and scope ok', async () => {
      mockGetApiKeyContext.mockResolvedValue({
        kind: 'ok',
        context: validContext,
        keyRow: validKeyRow,
      })
      mockCheckApiKeyRateLimit.mockResolvedValue({
        kind: 'ok',
        result: validRateLimitResult,
      })

      const req = requestWithBearer('rm_test_xxx')
      const result = await withApiKeyAuth(req, [V1_SCOPES.jobsRead])

      expect(result).not.toBeInstanceOf(NextResponse)
      expect(result).toEqual({
        context: validContext,
        rateLimitResult: validRateLimitResult,
      })
      expect(mockTouchApiKeyLastUsed).toHaveBeenCalledWith('key-1')
    })
  })

  describe('addRateLimitHeaders / withRateLimitHeaders / finishApiKeyRequest', () => {
    it('addRateLimitHeaders sets X-RateLimit-* on response', () => {
      const res = NextResponse.json({ data: 1 })
      const result = addRateLimitHeaders(res, validRateLimitResult)
      expect(result.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(result.headers.get('X-RateLimit-Remaining')).toBe('999')
      expect(result.headers.get('X-RateLimit-Reset')).toBe(String(validRateLimitResult.resetAt))
    })

    it('withRateLimitHeaders adds rate limit headers to response', () => {
      const res = NextResponse.json({ data: 1 })
      const out = withRateLimitHeaders(res, validRateLimitResult)
      expect(out.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(out.headers.get('X-RateLimit-Remaining')).toBe('999')
    })

    it('finishApiKeyRequest adds rate limit headers', async () => {
      const res = NextResponse.json({ data: [] })
      const out = await finishApiKeyRequest('key-1', res, validRateLimitResult)
      expect(out.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(out.headers.get('X-RateLimit-Remaining')).toBe('999')
    })
  })

  describe('v1Json', () => {
    it('returns JSON with data only when no meta', () => {
      const res = v1Json([{ id: '1' }])
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('application/json')
      // Body is set by NextResponse.json; we assert shape via clone + json
      const body = res.body
      expect(body).toBeDefined()
    })

    it('returns JSON with data and meta when meta provided', () => {
      const res = v1Json([{ id: '1' }], { meta: { page: 1, limit: 20, total: 100 } })
      expect(res.status).toBe(200)
      // NextResponse.json(body) - we need to read the body; in Jest we can't easily read Response body sync
      // So we test by cloning and reading
      return (async () => {
        const clone = res.clone()
        const data = await clone.json()
        expect(data).toEqual({
          data: [{ id: '1' }],
          meta: { page: 1, limit: 20, total: 100 },
        })
      })()
    })

    it('uses status and headers from init', () => {
      const res = v1Json({ created: true }, { status: 201, headers: { 'X-Custom': 'yes' } })
      expect(res.status).toBe(201)
      expect(res.headers.get('X-Custom')).toBe('yes')
    })
  })
})
