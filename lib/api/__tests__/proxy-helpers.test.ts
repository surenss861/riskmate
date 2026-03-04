/**
 * Unit tests for proxy-helpers: getSessionToken Authorization parsing.
 * Covers Bearer (case-insensitive), bearer, BEARER, whitespace trimming, and malformed headers.
 */

import { NextRequest } from 'next/server'
import { getSessionToken } from '../proxy-helpers'

const mockGetSession = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getSession: (...args: unknown[]) => mockGetSession(...args),
      },
    }),
}))

function requestWithAuth(value: string | null): NextRequest {
  const headers = new Headers()
  if (value !== null) headers.set('authorization', value)
  return new NextRequest('http://localhost/api/sync/batch', { headers })
}

describe('getSessionToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  describe('Bearer scheme (case-insensitive)', () => {
    it('accepts "Bearer <token>" and returns trimmed token', async () => {
      const req = requestWithAuth('Bearer my-jwt-token')
      const token = await getSessionToken(req)
      expect(token).toBe('my-jwt-token')
      expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('accepts "bearer <token>" (lowercase) and returns token', async () => {
      const req = requestWithAuth('bearer my-jwt-token')
      const token = await getSessionToken(req)
      expect(token).toBe('my-jwt-token')
      expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('accepts "BEARER <token>" (uppercase) and returns token', async () => {
      const req = requestWithAuth('BEARER my-jwt-token')
      const token = await getSessionToken(req)
      expect(token).toBe('my-jwt-token')
      expect(mockGetSession).not.toHaveBeenCalled()
    })

    it('trims whitespace around token', async () => {
      const req = requestWithAuth('Bearer   \t token_with_spaces  \t ')
      const token = await getSessionToken(req)
      expect(token).toBe('token_with_spaces')
      expect(mockGetSession).not.toHaveBeenCalled()
    })
  })

  describe('malformed Authorization headers', () => {
    it('returns null for "Basic xxx" (non-Bearer scheme)', async () => {
      const req = requestWithAuth('Basic dXNlcjpwYXNz')
      const token = await getSessionToken(req)
      expect(token).toBeNull()
      expect(mockGetSession).toHaveBeenCalled()
    })

    it('returns null for "Bearer" with no token', async () => {
      const req = requestWithAuth('Bearer')
      const token = await getSessionToken(req)
      expect(token).toBeNull()
      expect(mockGetSession).toHaveBeenCalled()
    })

    it('returns null for "Bearer " with only whitespace', async () => {
      const req = requestWithAuth('Bearer   ')
      const token = await getSessionToken(req)
      expect(token).toBeNull()
      expect(mockGetSession).toHaveBeenCalled()
    })

    it('returns null when Authorization header is missing', async () => {
      const req = requestWithAuth(null)
      const token = await getSessionToken(req)
      expect(token).toBeNull()
      expect(mockGetSession).toHaveBeenCalled()
    })

    it('returns null for empty string header', async () => {
      const req = requestWithAuth('')
      const token = await getSessionToken(req)
      expect(token).toBeNull()
      expect(mockGetSession).toHaveBeenCalled()
    })
  })

  describe('cookie fallback', () => {
    it('falls back to session when valid Bearer not present and session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'cookie-token' } },
        error: null,
      })
      const req = requestWithAuth('Basic x')
      const token = await getSessionToken(req)
      expect(token).toBe('cookie-token')
    })

    it('returns null when no header and no session', async () => {
      const req = requestWithAuth(null)
      const token = await getSessionToken(req)
      expect(token).toBeNull()
    })
  })
})
