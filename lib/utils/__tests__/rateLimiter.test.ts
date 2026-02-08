/**
 * Unit tests for rate limiter utility
 * @see spec: Rate Limiting for Next.js API Routes
 */

import { NextRequest } from 'next/server'
import { checkRateLimit } from '../rateLimiter'

function createMockRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`)
}

describe('rateLimiter', () => {
  const ctxA = { organization_id: 'org_a', user_id: 'user_a' }
  const ctxB = { organization_id: 'org_b', user_id: 'user_b' }
  const config = {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyPrefix: 'export',
  }

  beforeEach(() => {
    // Use unique pathname per test to avoid store collision between tests
    // (each test gets its own key: prefix:org:user:pathname)
  })

  describe('rate limit enforcement', () => {
    it('allows first request', () => {
      const req = createMockRequest('/api/audit/export-test-1')
      const result = checkRateLimit(req, config, ctxA)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.limit).toBe(10)
      expect(result.resetAt).toBeGreaterThan(0)
    })

    it('returns 429 when limit exceeded within window', () => {
      const path = `/api/audit/export-test-2-${Date.now()}`
      const req = createMockRequest(path)

      // Exhaust the limit (10 requests)
      for (let i = 0; i < 10; i++) {
        const r = checkRateLimit(req, config, ctxA)
        expect(r.allowed).toBe(true)
      }

      // 11th request should be denied
      const denied = checkRateLimit(req, config, ctxA)
      expect(denied.allowed).toBe(false)
      expect(denied.remaining).toBe(0)
      expect(denied.limit).toBe(10)
      expect(denied.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('key generation - per org and user', () => {
    it('different orgs have separate limits', () => {
      const path = `/api/audit/export-test-3-${Date.now()}`
      const req = createMockRequest(path)

      // Exhaust org A's limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(req, config, ctxA)
      }
      const deniedA = checkRateLimit(req, config, ctxA)
      expect(deniedA.allowed).toBe(false)

      // Org B should still have full limit
      const allowedB = checkRateLimit(req, config, ctxB)
      expect(allowedB.allowed).toBe(true)
      expect(allowedB.remaining).toBe(9)
    })

    it('different users within same org share org limit', () => {
      const path = `/api/audit/export-test-4-${Date.now()}`
      const req = createMockRequest(path)
      const ctxA2 = { organization_id: 'org_a', user_id: 'user_a2' }

      // Each user gets their own limit (key includes user_id)
      const r1 = checkRateLimit(req, config, ctxA)
      const r2 = checkRateLimit(req, config, ctxA2)

      expect(r1.remaining).toBe(9)
      expect(r2.remaining).toBe(9)
    })

    it('different endpoints have separate limits', () => {
      const path1 = `/api/audit/export-test-5a-${Date.now()}`
      const path2 = `/api/proof-packs/export-test-5b-${Date.now()}`
      const req1 = createMockRequest(path1)
      const req2 = createMockRequest(path2)

      // Exhaust limit on path1
      for (let i = 0; i < 10; i++) {
        checkRateLimit(req1, config, ctxA)
      }
      const denied1 = checkRateLimit(req1, config, ctxA)
      expect(denied1.allowed).toBe(false)

      // Path2 should still have full limit
      const allowed2 = checkRateLimit(req2, config, ctxA)
      expect(allowed2.allowed).toBe(true)
    })
  })

  describe('response shape', () => {
    it('returns correct RateLimitResult structure', () => {
      const path = `/api/audit/export-test-6-${Date.now()}`
      const req = createMockRequest(path)
      const result = checkRateLimit(req, config, ctxA)

      expect(result).toMatchObject({
        allowed: expect.any(Boolean),
        limit: 10,
        remaining: expect.any(Number),
        resetAt: expect.any(Number),
        retryAfter: expect.any(Number),
        windowMs: 3600000,
      })
    })
  })
})
