/**
 * PATCH /api/webhooks/[id]: update endpoint URL, events, is_active, description.
 * Tests that description can be set, cleared (explicit null), and that no-op detection still works.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'

const endpointRow = {
  id: ENDPOINT_ID,
  organization_id: ORG_ID,
  url: 'https://example.com/hook',
  events: ['job.created'],
  is_active: true,
  description: 'old description',
  updated_at: '2025-01-15T12:00:00Z',
}

let supabaseAdminMock: {
  from: jest.Mock
  _updatePayload: Record<string, unknown> | null
  _singleResponse: { data: unknown; error: null }
}

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => supabaseAdminMock),
}))

jest.mock('@/lib/utils/organizationGuard', () => ({
  getWebhookOrganizationContext: jest.fn().mockResolvedValue({
    organization_ids: [ORG_ID],
    user_id: 'user-id-for-test',
  }),
}))

jest.mock('@/lib/utils/adminAuth', () => ({
  getUserRole: jest.fn().mockResolvedValue('admin'),
  requireAdminOrOwner: jest.fn(),
}))

function buildChain(singleData: unknown) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: singleData, error: null }),
    update: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      supabaseAdminMock._updatePayload = payload
      return chain
    }),
  }
  return chain
}

describe('PATCH /api/webhooks/[id]', () => {
  beforeEach(() => {
    supabaseAdminMock = {
      _updatePayload: null,
      _singleResponse: { data: endpointRow, error: null },
      from: jest.fn((table: string) => {
        if (table !== 'webhook_endpoints') {
          return buildChain(null)
        }
        const chain = buildChain(endpointRow)
        chain.single.mockImplementation(() => {
          const data = supabaseAdminMock._updatePayload
            ? { ...endpointRow, ...supabaseAdminMock._updatePayload, updated_at: new Date().toISOString() }
            : endpointRow
          return Promise.resolve({ data, error: null })
        })
        return chain
      }),
    }
  })

  it('sets description when body.description is a non-empty string', async () => {
    const { PATCH } = await import('@/app/api/webhooks/[id]/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: '  new description  ' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: ENDPOINT_ID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(body.data.description).toBe('new description')
    expect(supabaseAdminMock._updatePayload).toEqual({ description: 'new description' })
  })

  it('clears description when body.description is explicit null', async () => {
    const { PATCH } = await import('@/app/api/webhooks/[id]/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: null }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: ENDPOINT_ID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(body.data.description).toBeNull()
    expect(supabaseAdminMock._updatePayload).toEqual({ description: null })
  })

  it('trims and normalizes empty string description to null', async () => {
    const { PATCH } = await import('@/app/api/webhooks/[id]/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: '   ' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: ENDPOINT_ID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(body.data.description).toBeNull()
    expect(supabaseAdminMock._updatePayload).toEqual({ description: null })
  })

  it('no-op when no fields sent returns current endpoint without calling update', async () => {
    let fromCallCount = 0
    const updateMock = jest.fn()
    supabaseAdminMock.from = jest.fn((table: string) => {
      if (table !== 'webhook_endpoints') return buildChain(null)
      fromCallCount++
      const chain = buildChain(endpointRow)
      chain.update = updateMock.mockReturnThis()
      chain.single.mockImplementation(() => {
        if (fromCallCount === 1) {
          return Promise.resolve({ data: { id: ENDPOINT_ID, organization_id: ORG_ID }, error: null })
        }
        return Promise.resolve({ data: endpointRow, error: null })
      })
      return chain
    })

    const { PATCH } = await import('@/app/api/webhooks/[id]/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: ENDPOINT_ID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(body.data.description).toBe('old description')
    expect(updateMock).not.toHaveBeenCalled()
  })
})
