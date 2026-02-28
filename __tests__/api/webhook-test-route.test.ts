/**
 * Regression test: test webhook payloads must use the same canonical normalization
 * as production (buildWebhookEventObject) so integrators validating against "Send test"
 * see the same data.object shape as live events. In particular, evidence.uploaded must
 * include canonical data.object.id (production emits id; raw test object uses document_id).
 */

import { NextRequest } from 'next/server'

const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

let lastInsertPayload: { payload?: { data?: { object?: Record<string, unknown> } } } | null = null

let supabaseServerMock: { from: jest.Mock }
let supabaseAdminMock: { from: jest.Mock }

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(supabaseServerMock)),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => supabaseAdminMock),
}))

jest.mock('@/lib/utils/organizationGuard', () => ({
  getWebhookOrganizationContext: jest.fn().mockResolvedValue({
    organization_id: ORG_ID,
    organization_ids: [ORG_ID],
    user_id: 'user-id-for-test',
  }),
}))

jest.mock('@/lib/utils/adminAuth', () => ({
  getUserRole: jest.fn().mockResolvedValue('admin'),
  requireAdminOrOwner: jest.fn(),
}))

const buildSelectSingleMock = (data: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null }),
})

describe('POST /api/webhooks/[id]/test', () => {
  beforeEach(() => {
    lastInsertPayload = null
    supabaseServerMock = {
      from: jest.fn((table: string) => {
        if (table === 'webhook_endpoints') {
          return buildSelectSingleMock({
            id: ENDPOINT_ID,
            organization_id: ORG_ID,
            events: ['evidence.uploaded', 'job.created'],
            is_active: true,
          })
        }
        return buildSelectSingleMock(null)
      }),
    }
    supabaseAdminMock = {
      from: jest.fn((table: string) => {
        if (table === 'webhook_deliveries') {
          return {
            insert: jest.fn((row: Record<string, unknown>) => {
              lastInsertPayload = row as typeof lastInsertPayload
              return Promise.resolve({ data: null, error: null })
            }),
          }
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    }
  })

  it('evidence.uploaded test payload includes canonical data.object.id shape expected from live events', async () => {
    const { POST } = await import('@/app/api/webhooks/[id]/test/route')
    const request = new NextRequest(`http://localhost/api/webhooks/${ENDPOINT_ID}/test`, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'evidence.uploaded' }),
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: ENDPOINT_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data?.event_type).toBe('evidence.uploaded')

    expect(lastInsertPayload).not.toBeNull()
    expect(lastInsertPayload?.payload).toBeDefined()
    expect(lastInsertPayload?.payload?.data?.object).toBeDefined()
    const dataObject = lastInsertPayload!.payload!.data!.object as Record<string, unknown>
    expect(dataObject.id).toBeDefined()
    expect(typeof dataObject.id).toBe('string')
    expect(dataObject.id).not.toBe('')
  })
})
