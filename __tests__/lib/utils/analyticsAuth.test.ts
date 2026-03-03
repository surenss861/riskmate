/**
 * Route-level auth semantics for analytics (getAnalyticsContext used by all analytics routes).
 * Covers: valid bearer with no cookie, invalid bearer with valid cookie (must 401), no bearer with valid cookie.
 */

import { NextRequest } from 'next/server'
import { getAnalyticsContext } from '@/lib/utils/analyticsAuth'

const ORG_ID = 'org-auth-test-1111'
const USER_ID = 'user-auth-test-1111'

let serverGetUserMock: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: (...args: unknown[]) => serverGetUserMock(...args),
    },
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { organization_id: ORG_ID },
            error: null,
          }),
        }
      }
      if (table === 'org_subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { plan_code: 'business', status: 'active' },
            error: null,
          }),
        }
      }
      return {}
    },
  }),
}))

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  const url = 'http://localhost/api/analytics/trends'
  return new NextRequest(url, { headers })
}

describe('getAnalyticsContext (analytics route auth)', () => {
  const ROUTE = '/api/analytics/trends'

  beforeEach(() => {
    jest.clearAllMocks()
    serverGetUserMock = jest.fn()
  })

  describe('valid bearer, no cookie', () => {
    it('returns context when Authorization Bearer is valid and cookie session is absent', async () => {
      // Bearer path: getUser(token) returns user; cookie getUser() is never called
      serverGetUserMock.mockImplementation((token?: string) => {
        if (token !== undefined) {
          return Promise.resolve({
            data: { user: { id: USER_ID } },
            error: null,
          })
        }
        return Promise.resolve({ data: { user: null }, error: null })
      })

      const req = requestWithHeaders({ Authorization: 'Bearer valid-token' })
      const result = await getAnalyticsContext(req, ROUTE)

      expect(serverGetUserMock).toHaveBeenCalledWith('valid-token')
      expect(serverGetUserMock).not.toHaveBeenCalledWith()
      expect(result).not.toBeInstanceOf(Response)
      if (typeof result === 'object' && result !== null && 'orgId' in result) {
        expect(result.orgId).toBe(ORG_ID)
        expect(result.hasAnalytics).toBe(true)
        expect(result.isActive).toBe(true)
      }
    })
  })

  describe('invalid bearer, valid cookie', () => {
    it('returns 401 when Authorization Bearer is invalid even if cookie would be valid (no cookie fallback)', async () => {
      serverGetUserMock.mockImplementation((token?: string) => {
        if (token !== undefined) {
          return Promise.resolve({
            data: { user: null },
            error: { message: 'Invalid token' },
          })
        }
        return Promise.resolve({
          data: { user: { id: USER_ID } },
          error: null,
        })
      })

      const req = requestWithHeaders({ Authorization: 'Bearer invalid-token' })
      const result = await getAnalyticsContext(req, ROUTE)

      expect(serverGetUserMock).toHaveBeenCalledTimes(1)
      expect(serverGetUserMock).toHaveBeenCalledWith('invalid-token')
      expect(result).toBeInstanceOf(Response)
      const res = result as Response
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe('UNAUTHORIZED')
    })
  })

  describe('no bearer, valid cookie', () => {
    it('returns context when no Authorization header and cookie session is valid', async () => {
      serverGetUserMock.mockImplementation(() =>
        Promise.resolve({
          data: { user: { id: USER_ID } },
          error: null,
        })
      )

      const req = requestWithHeaders({})
      const result = await getAnalyticsContext(req, ROUTE)

      expect(serverGetUserMock).toHaveBeenCalledWith()
      expect(result).not.toBeInstanceOf(Response)
      if (typeof result === 'object' && result !== null && 'orgId' in result) {
        expect(result.orgId).toBe(ORG_ID)
        expect(result.hasAnalytics).toBe(true)
      }
    })
  })

  describe('malformed Authorization header (no cookie fallback)', () => {
    it('returns 401 for Authorization: Bearer with no token and does not call cookie auth', async () => {
      serverGetUserMock.mockImplementation(() =>
        Promise.resolve({
          data: { user: { id: USER_ID } },
          error: null,
        })
      )

      const req = requestWithHeaders({ Authorization: 'Bearer' })
      const result = await getAnalyticsContext(req, ROUTE)

      expect(serverGetUserMock).not.toHaveBeenCalled()
      expect(result).toBeInstanceOf(Response)
      const res = result as Response
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe('UNAUTHORIZED')
    })

    it('returns 401 for Authorization: Basic ... and does not call cookie auth', async () => {
      serverGetUserMock.mockImplementation(() =>
        Promise.resolve({
          data: { user: { id: USER_ID } },
          error: null,
        })
      )

      const req = requestWithHeaders({ Authorization: 'Basic dXNlcjpwYXNz' })
      const result = await getAnalyticsContext(req, ROUTE)

      expect(serverGetUserMock).not.toHaveBeenCalled()
      expect(result).toBeInstanceOf(Response)
      const res = result as Response
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe('UNAUTHORIZED')
    })
  })
})
