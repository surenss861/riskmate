/**
 * Regression test: manual retry of terminally failed webhook deliveries uses
 * create_webhook_delivery_retry RPC. Asserts route behavior for each RPC outcome
 * and for endpoint-paused / already-scheduled app-level branches.
 */

import { NextRequest } from 'next/server'

const DELIVERY_ID = 'dddddddd-eeee-4fff-8000-111122223333'
const NEW_DELIVERY_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
const ENDPOINT_ID = 'eeeeeeee-ffff-4000-8111-222233334444'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const EVENT_TYPE = 'job.created'
const PAYLOAD = { id: 'evt_1', type: EVENT_TYPE, created: new Date().toISOString(), organization_id: ORG_ID, data: { object: { id: 'job_1', title: 'Test' } } }

const defaultDeliveryRow = {
  id: DELIVERY_ID,
  endpoint_id: ENDPOINT_ID,
  event_type: EVENT_TYPE,
  payload: PAYLOAD,
  delivered_at: null,
  next_retry_at: null,
  processing_since: null,
  terminal_outcome: 'failed',
  webhook_endpoints: { organization_id: ORG_ID, is_active: true },
}

const buildSelectSingleMock = (data: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null }),
})

let deliveryRow: Record<string, unknown> = { ...defaultDeliveryRow }
let endpointNow: { is_active: boolean } | null = { is_active: true }
let rpcResult: { outcome: string; retry_id: string | null }[] | null = [{ outcome: 'created', retry_id: NEW_DELIVERY_ID }]

let supabaseMock: { from: jest.Mock; rpc: jest.Mock }

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(supabaseMock)),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => supabaseMock),
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

jest.mock('@/lib/webhooks/trigger', () => ({
  wakeBackendWebhookWorker: jest.fn().mockResolvedValue(undefined),
}))

function buildAdminMock() {
  return {
    from: jest.fn((table: string) => {
      if (table === 'webhook_deliveries') {
        return buildSelectSingleMock(deliveryRow)
      }
      if (table === 'webhook_endpoints') {
        return buildSelectSingleMock(endpointNow)
      }
      return buildSelectSingleMock(null)
    }),
    rpc: jest.fn((name: string, args: Record<string, unknown>) => {
      if (name === 'create_webhook_delivery_retry' && rpcResult != null) {
        return Promise.resolve({ data: rpcResult, error: null })
      }
      return Promise.resolve({ data: null, error: new Error('Unexpected RPC') })
    }),
  }
}

describe('POST /api/webhooks/deliveries/[deliveryId]/retry', () => {
  beforeEach(() => {
    deliveryRow = { ...defaultDeliveryRow }
    endpointNow = { is_active: true }
    rpcResult = [{ outcome: 'created', retry_id: NEW_DELIVERY_ID }]
    supabaseMock = buildAdminMock()
  })

  it('returns 201 and retry delivery_id when RPC outcome is created', async () => {
    rpcResult = [{ outcome: 'created', retry_id: NEW_DELIVERY_ID }]
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data?.message).toBe('Retry scheduled')
    expect(body.data?.delivery_id).toBe(NEW_DELIVERY_ID)
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_webhook_delivery_retry', {
      p_source_delivery_id: DELIVERY_ID,
    })
  })

  it('returns 400 ALREADY_SCHEDULED when RPC outcome is already_scheduled', async () => {
    rpcResult = [{ outcome: 'already_scheduled', retry_id: null }]
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('ALREADY_SCHEDULED')
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_webhook_delivery_retry', {
      p_source_delivery_id: DELIVERY_ID,
    })
  })

  it('returns 400 INELIGIBLE when RPC outcome is ineligible', async () => {
    rpcResult = [{ outcome: 'ineligible', retry_id: null }]
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('INELIGIBLE')
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_webhook_delivery_retry', {
      p_source_delivery_id: DELIVERY_ID,
    })
  })

  it('returns 404 NOT_FOUND when RPC outcome is not_found', async () => {
    rpcResult = [{ outcome: 'not_found', retry_id: null }]
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe('NOT_FOUND')
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_webhook_delivery_retry', {
      p_source_delivery_id: DELIVERY_ID,
    })
  })

  it('returns 400 ENDPOINT_PAUSED when endpoint is_active is false on delivery join and does not call RPC', async () => {
    deliveryRow = {
      ...defaultDeliveryRow,
      webhook_endpoints: { organization_id: ORG_ID, is_active: false },
    }
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('ENDPOINT_PAUSED')
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('returns 400 ENDPOINT_PAUSED when endpoint re-fetch returns is_active false and does not call RPC', async () => {
    endpointNow = { is_active: false }
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('ENDPOINT_PAUSED')
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it('returns 400 ALREADY_SCHEDULED when delivery has next_retry_at set (app-level branch)', async () => {
    deliveryRow = {
      ...defaultDeliveryRow,
      next_retry_at: new Date().toISOString(),
    }
    supabaseMock = buildAdminMock()

    const { POST } = await import('@/app/api/webhooks/deliveries/[deliveryId]/retry/route')
    const request = new NextRequest(`http://localhost/api/webhooks/deliveries/${DELIVERY_ID}/retry`, {
      method: 'POST',
    })

    const response = await POST(request, {
      params: Promise.resolve({ deliveryId: DELIVERY_ID }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('ALREADY_SCHEDULED')
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })
})
