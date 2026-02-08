/**
 * Unit tests for rate limiter utility
 * @see spec: Rate Limiting for Next.js API Routes
 */

import { NextRequest } from 'next/server'
import { checkRateLimitWithContext, runCleanup } from '../rateLimiter'

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
    it('first request within window succeeds', () => {
      const req = createMockRequest('/api/audit/export-test-1')
      const result = checkRateLimitWithContext(req, config, ctxA)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.limit).toBe(10)
      expect(result.resetAt).toBeGreaterThan(0)
    })

    it('request at limit boundary returns allowed: false', () => {
      const path = `/api/audit/export-test-2-${Date.now()}`
      const req = createMockRequest(path)

      // Exhaust the limit (10 requests)
      for (let i = 0; i < 10; i++) {
        const r = checkRateLimitWithContext(req, config, ctxA)
        expect(r.allowed).toBe(true)
      }

      // 11th request should be denied
      const denied = checkRateLimitWithContext(req, config, ctxA)
      expect(denied.allowed).toBe(false)
      expect(denied.remaining).toBe(0)
      expect(denied.limit).toBe(10)
      expect(denied.retryAfter).toBeGreaterThan(0)
    })

    it('request after window reset succeeds', async () => {
      const path = `/api/audit/export-test-reset-${Date.now()}`
      const req = createMockRequest(path)
      const shortWindowConfig = { windowMs: 10, maxRequests: 2, keyPrefix: 'export' }

      // Exhaust limit
      checkRateLimitWithContext(req, shortWindowConfig, ctxA)
      checkRateLimitWithContext(req, shortWindowConfig, ctxA)
      const denied = checkRateLimitWithContext(req, shortWindowConfig, ctxA)
      expect(denied.allowed).toBe(false)

      // Wait for window to expire, then run cleanup
      await new Promise((r) => setTimeout(r, 20))
      runCleanup()

      // Next request should get a new window
      const allowed = checkRateLimitWithContext(req, shortWindowConfig, ctxA)
      expect(allowed.allowed).toBe(true)
      expect(allowed.remaining).toBe(1)
    })
  })

  describe('key generation - per org and user', () => {
    it('different orgs have separate limits', () => {
      const path = `/api/audit/export-test-3-${Date.now()}`
      const req = createMockRequest(path)

      // Exhaust org A's limit
      for (let i = 0; i < 10; i++) {
        checkRateLimitWithContext(req, config, ctxA)
      }
      const deniedA = checkRateLimitWithContext(req, config, ctxA)
      expect(deniedA.allowed).toBe(false)

      // Org B should still have full limit
      const allowedB = checkRateLimitWithContext(req, config, ctxB)
      expect(allowedB.allowed).toBe(true)
      expect(allowedB.remaining).toBe(9)
    })

    it('different users within org have separate limits', () => {
      const path = `/api/audit/export-test-4-${Date.now()}`
      const req = createMockRequest(path)
      const ctxA2 = { organization_id: 'org_a', user_id: 'user_a2' }

      // Each user gets their own limit (key includes user_id)
      const r1 = checkRateLimitWithContext(req, config, ctxA)
      const r2 = checkRateLimitWithContext(req, config, ctxA2)

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
        checkRateLimitWithContext(req1, config, ctxA)
      }
      const denied1 = checkRateLimitWithContext(req1, config, ctxA)
      expect(denied1.allowed).toBe(false)

      // Path2 should still have full limit
      const allowed2 = checkRateLimitWithContext(req2, config, ctxA)
      expect(allowed2.allowed).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('cleanup removes expired entries', async () => {
      const path = `/api/audit/export-test-cleanup-${Date.now()}`
      const req = createMockRequest(path)
      const shortConfig = { windowMs: 5, maxRequests: 3, keyPrefix: 'export' }

      // Create an entry (1 request)
      checkRateLimitWithContext(req, shortConfig, ctxA)
      // Exhaust so next request would be denied
      checkRateLimitWithContext(req, shortConfig, ctxA)
      checkRateLimitWithContext(req, shortConfig, ctxA)
      const denied = checkRateLimitWithContext(req, shortConfig, ctxA)
      expect(denied.allowed).toBe(false)

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 15))
      runCleanup()

      // Same key should get a fresh window (entry was removed)
      const allowed = checkRateLimitWithContext(req, shortConfig, ctxA)
      expect(allowed.allowed).toBe(true)
      expect(allowed.remaining).toBe(2)
    })
  })

  describe('response shape', () => {
    it('returns correct RateLimitResult structure', () => {
      const path = `/api/audit/export-test-6-${Date.now()}`
      const req = createMockRequest(path)
      const result = checkRateLimitWithContext(req, config, ctxA)

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
