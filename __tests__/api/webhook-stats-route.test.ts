/**
 * GET /api/webhooks/stats returns stats using admin client with explicit org scoping
 * so Bearer and cookie auth behave identically.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'

let supabaseAdminMock: { rpc: jest.Mock; from: jest.Mock }

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
}))

describe('GET /api/webhooks/stats', () => {
  beforeEach(() => {
    supabaseAdminMock = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          {
            endpoint_id: ENDPOINT_ID,
            delivered: 5,
            pending: 0,
            failed: 1,
            last_delivery: '2025-01-15T12:00:00Z',
            last_success_at: '2025-01-15T12:00:00Z',
            last_terminal_failure_at: '2025-01-14T10:00:00Z',
            last_failure_at: '2025-01-14T10:00:00Z',
          },
        ],
        error: null,
      }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
  })

  it('returns non-empty data when get_webhook_endpoint_stats returns rows', async () => {
    const { GET } = await import('@/app/api/webhooks/stats/route')
    const request = new NextRequest('http://localhost/api/webhooks/stats', { method: 'GET' })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(typeof body.data).toBe('object')
    expect(body.data[ENDPOINT_ID]).toBeDefined()
    expect(body.data[ENDPOINT_ID].delivered).toBe(5)
    expect(body.data[ENDPOINT_ID].failed).toBe(1)
    expect(body.data[ENDPOINT_ID].lastDelivery).toBe('2025-01-15T12:00:00Z')
  })

  it('aggregates stats from multiple orgs when user is admin in more than one', async () => {
    const org2 = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const endpoint2 = 'ffffffff-ffff-4000-8111-222233334444'
    const { getWebhookOrganizationContext } = await import('@/lib/utils/organizationGuard')
    const { getUserRole } = await import('@/lib/utils/adminAuth')
    ;(getWebhookOrganizationContext as jest.Mock).mockResolvedValue({
      organization_ids: [ORG_ID, org2],
      user_id: 'user-id-for-test',
    })
    ;(getUserRole as jest.Mock).mockImplementation(
      async (_admin: unknown, _userId: string, orgId: string) => (orgId === ORG_ID || orgId === org2 ? 'admin' : 'member')
    )
    supabaseAdminMock.rpc.mockImplementation((_name: string, args: { p_org_id: string }) => {
      if (args.p_org_id === ORG_ID) {
        return Promise.resolve({
          data: [{ endpoint_id: ENDPOINT_ID, delivered: 2, pending: 0, failed: 0, last_delivery: null, last_success_at: null, last_terminal_failure_at: null, last_failure_at: null }],
          error: null,
        })
      }
      if (args.p_org_id === org2) {
        return Promise.resolve({
          data: [{ endpoint_id: endpoint2, delivered: 3, pending: 1, failed: 0, last_delivery: '2025-01-16T00:00:00Z', last_success_at: '2025-01-16T00:00:00Z', last_terminal_failure_at: null, last_failure_at: null }],
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    })

    const { GET } = await import('@/app/api/webhooks/stats/route')
    const request = new NextRequest('http://localhost/api/webhooks/stats', { method: 'GET' })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data[ENDPOINT_ID].delivered).toBe(2)
    expect(body.data[endpoint2].delivered).toBe(3)
    expect(body.data[endpoint2].pending).toBe(1)
  })
})
