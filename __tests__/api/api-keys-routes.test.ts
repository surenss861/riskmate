/**
 * Route-level tests for API Key Management: GET/POST /api/api-keys, PATCH/DELETE /api/api-keys/[id].
 * Verifies full key shown once on creation, and auth/error behavior.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const USER_ID = 'user-11111111-2222-4333-8444-555555555555'

let fromMock: jest.Mock

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => fromMock(table),
  })),
}))

jest.mock('@/lib/utils/organizationGuard', () => ({
  getOrganizationContext: jest.fn().mockResolvedValue({
    organization_id: ORG_ID,
    user_id: USER_ID,
    user_role: 'owner',
  }),
  requireOwnerOrAdmin: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
  }),
}))

function request(opts: { method?: string; body?: unknown; headers?: HeadersInit } = {}) {
  return new NextRequest('http://localhost/api/api-keys', {
    method: opts.method ?? 'GET',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headers: opts.headers,
  })
}

describe('API Key Management routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockResolvedValue({
      organization_id: ORG_ID,
      user_id: USER_ID,
      user_role: 'owner',
    })
  })

  describe('GET /api/api-keys', () => {
    it('returns 200 with list of keys (no full key, only prefix)', async () => {
      const keys = [
        { id: 'key-1', name: 'Key 1', key_prefix: 'rm_test_abcd1234', scopes: ['jobs:read'], last_used_at: null, expires_at: null, created_at: '2025-01-01T00:00:00Z', revoked_at: null },
      ]
      fromMock = jest.fn((table: string) => {
        if (table === 'api_keys') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: keys, error: null }),
          }
        }
        return {}
      })

      const { GET } = await import('@/app/api/api-keys/route')
      const res = await GET(request())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).toHaveProperty('key_prefix', 'rm_test_abcd1234')
      expect(body.data[0]).not.toHaveProperty('key')
    })

    it('returns 401 when getOrganizationContext throws', async () => {
      const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
      getOrganizationContext.mockRejectedValue(new Error('Unauthorized'))

      const { GET } = await import('@/app/api/api-keys/route')
      const res = await GET(request())
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.code || body.error?.code).toBeTruthy()
    })
  })

  describe('POST /api/api-keys', () => {
    it('returns 200 with full key in response once and warning', async () => {
      const insertedRow = {
        id: 'new-key-id',
        name: 'My Key',
        key_prefix: 'rm_test_abcd1234',
        scopes: ['jobs:read'],
        expires_at: null,
        created_at: new Date().toISOString(),
      }
      fromMock = jest.fn((table: string) => {
        if (table === 'api_keys') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: insertedRow, error: null }),
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/api-keys/route')
      const req = request({ method: 'POST', body: { name: 'My Key', scopes: ['jobs:read'] } })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toBeDefined()
      expect(body.data.key).toBeDefined()
      expect(typeof body.data.key).toBe('string')
      expect(body.data.key).toMatch(/^rm_test_[a-f0-9]{32}$/)
      expect(body.data.warning).toBe('Save this key — it will not be shown again.')
      expect(body.data.id).toBe(insertedRow.id)
      expect(body.data.name).toBe(insertedRow.name)
      expect(body.data.key_prefix).toBeDefined()
    })

    it('returns 400 when name is missing', async () => {
      fromMock = jest.fn(() => ({}))

      const { POST } = await import('@/app/api/api-keys/route')
      const res = await POST(request({ method: 'POST', body: {} }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.code || body.message).toBeTruthy()
    })
  })

  describe('PATCH /api/api-keys/[id]', () => {
    it('returns 401 when getOrganizationContext throws', async () => {
      const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
      getOrganizationContext.mockRejectedValue(new Error('Unauthorized'))

      const { PATCH } = await import('@/app/api/api-keys/[id]/route')
      const res = await PATCH(request({ method: 'PATCH', body: { name: 'New Name' } }), {
        params: Promise.resolve({ id: '11111111-2222-4333-8444-555555555555' }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 200 with updated key when auth and body valid', async () => {
      const keyId = '11111111-2222-4333-8444-555555555555'
      const updated = {
        id: keyId,
        name: 'Updated Name',
        key_prefix: 'rm_test_abcd1234',
        scopes: ['jobs:read', 'jobs:write'],
        expires_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
      }
      fromMock = jest.fn((table: string) => {
        if (table === 'api_keys') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: keyId, organization_id: ORG_ID, name: 'Old', scopes: [], expires_at: null, revoked_at: null },
              error: null,
            }),
            update: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: updated, error: null }),
          }
        }
        return {}
      })

      const { PATCH } = await import('@/app/api/api-keys/[id]/route')
      const res = await PATCH(request({ method: 'PATCH', body: { name: 'Updated Name', scopes: ['jobs:read', 'jobs:write'] } }), {
        params: Promise.resolve({ id: keyId }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.name).toBe('Updated Name')
      expect(body.data).not.toHaveProperty('key')
    })
  })

  describe('DELETE /api/api-keys/[id]', () => {
    it('returns 401 when getOrganizationContext throws', async () => {
      const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
      getOrganizationContext.mockRejectedValue(new Error('Unauthorized'))

      const { DELETE } = await import('@/app/api/api-keys/[id]/route')
      const res = await DELETE(request({ method: 'DELETE' }), {
        params: Promise.resolve({ id: '11111111-2222-4333-8444-555555555555' }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 200 with revoked key when auth ok', async () => {
      const keyId = '11111111-2222-4333-8444-555555555555'
      const revoked = { id: keyId, name: 'Key', key_prefix: 'rm_test_abcd1234', revoked_at: new Date().toISOString() }
      fromMock = jest.fn((table: string) => {
        if (table === 'api_keys') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: keyId, organization_id: ORG_ID, name: 'Key', scopes: [], expires_at: null, revoked_at: null },
              error: null,
            }),
            update: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: revoked, error: null }),
          }
        }
        return {}
      })

      const { DELETE } = await import('@/app/api/api-keys/[id]/route')
      const res = await DELETE(request({ method: 'DELETE' }), {
        params: Promise.resolve({ id: keyId }),
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.revoked_at).toBeTruthy()
    })
  })
})
