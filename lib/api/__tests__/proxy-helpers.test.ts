/**
 * Unit tests for proxy-helpers: getSessionToken Authorization parsing and proxyToBackend forwarding.
 * Covers Bearer (case-insensitive), X-Organization-Id forwarding, and malformed headers.
 */

import { NextRequest } from 'next/server'
import { getSessionToken, proxyToBackend } from '../proxy-helpers'

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

  describe('proxyToBackend organization selector forwarding', () => {
    const originalFetch = globalThis.fetch
    let fetchMock: jest.Mock
    const savedBackendUrl = process.env.BACKEND_URL

    beforeAll(() => {
      process.env.BACKEND_URL = 'https://backend.test'
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      })
      globalThis.fetch = fetchMock
    })

    afterAll(() => {
      globalThis.fetch = originalFetch
      if (savedBackendUrl !== undefined) process.env.BACKEND_URL = savedBackendUrl
      else delete process.env.BACKEND_URL
    })

    beforeEach(() => {
      fetchMock.mockClear()
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      })
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    })

    it('forwards X-Organization-Id from request to backend fetch', async () => {
      const req = new NextRequest('http://localhost/api/sync/batch', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-xyz',
          'X-Organization-Id': 'org-selected-123',
        },
      })
      await proxyToBackend(req, '/api/sync/batch', { method: 'POST', body: {} })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [, init] = fetchMock.mock.calls[0]
      expect(init?.headers).toBeDefined()
      const headers = init.headers as Record<string, string>
      expect(headers['X-Organization-Id']).toBe('org-selected-123')
    })

    it('forwards organization_id from query to backend as X-Organization-Id when present', async () => {
      const req = new NextRequest('http://localhost/api/analytics/trends?organization_id=org-query-456', {
        method: 'GET',
        headers: { Authorization: 'Bearer token-xyz' },
      })
      await proxyToBackend(req, '/api/analytics/trends', { method: 'GET' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain('organization_id=org-query-456')
      const headers = init?.headers as Record<string, string>
      expect(headers['X-Organization-Id']).toBe('org-query-456')
    })
  })
})
