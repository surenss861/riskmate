/**
 * Regression test: manual retry of terminally failed webhook deliveries creates a new
 * webhook_deliveries row (clone of endpoint/event/payload) and enqueues it; the original
 * row is left immutable so delivery logs show all historical attempts.
 */

import { NextRequest } from 'next/server'

const DELIVERY_ID = 'dddddddd-eeee-4fff-8000-111122223333'
const NEW_DELIVERY_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const EVENT_TYPE = 'job.created'
const PAYLOAD = { id: 'evt_1', type: EVENT_TYPE, created: new Date().toISOString(), organization_id: ORG_ID, data: { object: { id: 'job_1', title: 'Test' } } }

let lastInsertPayload: Record<string, unknown> | null = null

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
  getWebhookOrganizationContext: jest.fn().mockResolvedValue({
    organization_ids: [ORG_ID],
  }),
}))

describe('POST /api/webhooks/deliveries/[deliveryId]/retry', () => {
  beforeEach(() => {
    lastInsertPayload = null
    let webhookDeliveriesCallCount = 0
    supabaseMock = {
      from: jest.fn((table: string) => {
        if (table === 'webhook_deliveries') {
          webhookDeliveriesCallCount += 1
          if (webhookDeliveriesCallCount === 1) {
            return buildSelectSingleMock({
              id: DELIVERY_ID,
              endpoint_id: ENDPOINT_ID,
              event_type: EVENT_TYPE,
              payload: PAYLOAD,
              delivered_at: null,
              next_retry_at: null,
            })
          }
          return {
            insert: jest.fn((payload: Record<string, unknown> | Record<string, unknown>[]) => {
              lastInsertPayload = Array.isArray(payload) ? payload[0] ?? null : payload
              return {
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: { id: NEW_DELIVERY_ID }, error: null }),
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

  it('creates a new delivery row (clone of endpoint/event/payload) and returns the new delivery_id', async () => {
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
    expect(body.data?.delivery_id).toBe(NEW_DELIVERY_ID)

    expect(lastInsertPayload).not.toBeNull()
    expect(lastInsertPayload).toMatchObject({
      endpoint_id: ENDPOINT_ID,
      event_type: EVENT_TYPE,
      payload: PAYLOAD,
      attempt_count: 1,
    })
    expect(lastInsertPayload!.next_retry_at).toBeDefined()
    expect(typeof lastInsertPayload!.next_retry_at).toBe('string')
  })
})
