/**
 * Regression test: manual retry of terminally failed webhook deliveries must reset
 * attempt_count so the worker (which selects attempt_count <= MAX_ATTEMPTS) can process them again.
 */

import { NextRequest } from 'next/server'

const DELIVERY_ID = 'dddddddd-eeee-4fff-8000-111122223333'
const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

let lastUpdatePayload: Record<string, unknown> | null = null

const buildSelectSingleMock = (data: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null }),
})

let supabaseMock: {
  from: jest.Mock
}

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(supabaseMock)),
}))

jest.mock('@/lib/utils/organizationGuard', () => ({
  getOrganizationContext: jest.fn().mockResolvedValue({
    organization_id: ORG_ID,
  }),
}))

describe('POST /api/webhooks/deliveries/[deliveryId]/retry', () => {
  beforeEach(() => {
    lastUpdatePayload = null
    let webhookDeliveriesCallCount = 0
    supabaseMock = {
      from: jest.fn((table: string) => {
        if (table === 'webhook_deliveries') {
          webhookDeliveriesCallCount += 1
          if (webhookDeliveriesCallCount === 1) {
            return buildSelectSingleMock({
              id: DELIVERY_ID,
              endpoint_id: ENDPOINT_ID,
              delivered_at: null,
              next_retry_at: null,
            })
          }
          return {
            update: jest.fn((payload: Record<string, unknown>) => {
              lastUpdatePayload = payload
              return {
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: DELIVERY_ID }, error: null }),
              }
            }),
          }
        }
        if (table === 'webhook_endpoints') {
          return buildSelectSingleMock({ id: ENDPOINT_ID, organization_id: ORG_ID })
        }
        return buildSelectSingleMock(null)
      }),
    }
  })

  it('resets attempt_count to 1 when retrying terminal delivery so worker can process it again', async () => {
    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data?.message).toBe('Retry scheduled')
    expect(body.data?.delivery_id).toBe(DELIVERY_ID)

    expect(lastUpdatePayload).not.toBeNull()
    expect(lastUpdatePayload).toMatchObject({
      attempt_count: 1,
      processing_since: null,
    })
    expect(lastUpdatePayload!.next_retry_at).toBeDefined()
    expect(typeof lastUpdatePayload!.next_retry_at).toBe('string')
  })
})
