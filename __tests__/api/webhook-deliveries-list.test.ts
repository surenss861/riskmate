/**
 * GET /api/webhooks/[id]/deliveries: list delivery logs with can_retry.
 * can_retry must align with retry route eligibility: modern (terminal_outcome='failed')
 * and legacy (terminal_outcome IS NULL) terminal rows that are undelivered, unscheduled,
 * and not processing should have can_retry true so "Retry failed" works for historical deliveries.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'
const DELIVERY_MODERN = 'dddddddd-eeee-4fff-8000-111122223331'
const DELIVERY_LEGACY = 'dddddddd-eeee-4fff-8000-111122223332'

let supabaseAdminMock: { from: jest.Mock }

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

jest.mock('@/lib/webhooks/endpointGuard', () => ({
  getEndpointAndCheckOrg: jest.fn(),
}))

describe('GET /api/webhooks/[id]/deliveries', () => {
  beforeEach(async () => {
    const { getEndpointAndCheckOrg } = await import('@/lib/webhooks/endpointGuard')
    ;(getEndpointAndCheckOrg as jest.Mock).mockResolvedValue({
      id: ENDPOINT_ID,
      organization_id: ORG_ID,
      is_active: true,
    })

    let deliveryCallCount = 0
    supabaseAdminMock = {
      from: jest.fn((table: string) => {
        if (table === 'webhook_deliveries') {
          deliveryCallCount += 1
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({
              data: [
                {
                  id: DELIVERY_MODERN,
                  event_type: 'job.created',
                  payload: {},
                  response_status: 500,
                  response_body: 'Error',
                  duration_ms: 100,
                  attempt_count: 5,
                  delivered_at: null,
                  next_retry_at: null,
                  processing_since: null,
                  terminal_outcome: 'failed',
                  created_at: '2025-01-15T12:00:00Z',
                },
                {
                  id: DELIVERY_LEGACY,
                  event_type: 'job.created',
                  payload: {},
                  response_status: 502,
                  response_body: 'Bad Gateway',
                  duration_ms: 200,
                  attempt_count: 5,
                  delivered_at: null,
                  next_retry_at: null,
                  processing_since: null,
                  terminal_outcome: null,
                  created_at: '2025-01-14T10:00:00Z',
                },
              ],
              error: null,
            }),
          }
        }
        if (table === 'webhook_delivery_attempts') {
          const chain: { select: jest.Mock; in: jest.Mock; order: jest.Mock; then: (resolve: (v: { data: unknown[]; error: null }) => void) => void; catch: () => void } = {
            select: jest.fn(),
            in: jest.fn(),
            order: jest.fn(),
            then: (resolve) => resolve({ data: [], error: null }),
            catch: () => ({}),
          }
          chain.select.mockReturnValue(chain)
          chain.in.mockReturnValue(chain)
          chain.order.mockReturnValue(chain)
          return chain
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
      }),
    }
  })

  it('sets can_retry true for modern terminal row (terminal_outcome=failed)', async () => {
    const { GET } = await import('@/app/api/webhooks/[id]/deliveries/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}/deliveries`, { method: 'GET' })

    const response = await GET(request, { params: Promise.resolve({ id: ENDPOINT_ID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.data)).toBe(true)
    const modern = body.data.find((d: { id: string }) => d.id === DELIVERY_MODERN)
    expect(modern).toBeDefined()
    expect(modern.terminal_outcome).toBe('failed')
    expect(modern.can_retry).toBe(true)
  })

  it('sets can_retry true for legacy terminal row (terminal_outcome=null)', async () => {
    const { GET } = await import('@/app/api/webhooks/[id]/deliveries/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}/deliveries`, { method: 'GET' })

    const response = await GET(request, { params: Promise.resolve({ id: ENDPOINT_ID }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    const legacy = body.data.find((d: { id: string }) => d.id === DELIVERY_LEGACY)
    expect(legacy).toBeDefined()
    expect(legacy.terminal_outcome).toBeNull()
    expect(legacy.can_retry).toBe(true)
  })
})
