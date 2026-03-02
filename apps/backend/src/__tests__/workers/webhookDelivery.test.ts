/**
 * Tests for webhook delivery worker: attempt persistence failure is a first-class error path.
 * When recording an attempt to webhook_delivery_attempts fails, the worker must not report
 * the delivery as successful and must terminalize with a clear "attempt persistence failed" message.
 */

const mockFrom = jest.fn()
const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockUpsert = jest.fn()
const mockSelect = jest.fn()
const mockSingle = jest.fn()
const mockMaybeSingle = jest.fn()
const mockRpc = jest.fn().mockResolvedValue({ data: 0, error: null })

function chain(handlers: Record<string, unknown>) {
  const chainable = {
    select: () => chainable,
    eq: () => chainable,
    single: () => Promise.resolve(handlers.single),
    maybeSingle: () => Promise.resolve(handlers.maybeSingle),
    upsert: () => Promise.resolve(handlers.upsert),
    update: (payload: unknown) => {
      ;(handlers.update as (p: unknown) => void)?.(payload)
      return { eq: () => Promise.resolve(handlers.updateEq) }
    },
  }
  return chainable
}

let endpointsSingle: { data: unknown; error: { message: string; code: string } | null }
let secretsMaybeSingle: { data: unknown; error: null }
let attemptsUpsertResult: { error: { message: string; code: string } | null }
let deliveryUpdatePayload: unknown

jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      mockFrom(table)
      if (table === 'webhook_endpoints') {
        return chain({
          single: endpointsSingle,
          maybeSingle: { data: null, error: null },
          upsert: { error: null },
          update: (p: unknown) => { deliveryUpdatePayload = p },
          updateEq: { error: null },
        })
      }
      if (table === 'webhook_endpoint_secrets') {
        return chain({
          single: { data: null, error: null },
          maybeSingle: secretsMaybeSingle,
          upsert: { error: null },
          update: (p: unknown) => { deliveryUpdatePayload = p },
          updateEq: { error: null },
        })
      }
      if (table === 'webhook_delivery_attempts') {
        return chain({
          single: { data: null, error: null },
          maybeSingle: { data: null, error: null },
          upsert: attemptsUpsertResult,
          update: (p: unknown) => { deliveryUpdatePayload = p },
          updateEq: { error: null },
        })
      }
      if (table === 'webhook_deliveries') {
        return chain({
          single: { data: null, error: null },
          maybeSingle: { data: null, error: null },
          upsert: { error: null },
          update: (p: unknown) => { deliveryUpdatePayload = p },
          updateEq: { error: null },
        })
      }
      return chain({
        single: { data: null, error: null },
        maybeSingle: { data: null, error: null },
        upsert: { error: null },
        update: (p: unknown) => { deliveryUpdatePayload = p },
        updateEq: { error: null },
      })
    },
  },
}))

jest.mock('../../utils/webhookSigning', () => ({ buildSignatureHeaders: () => ({}) }))
jest.mock('../../utils/secretEncryption', () => ({
  decryptWebhookSecret: () => 'decrypted-secret',
  validateWebhookSecretEncryptionKey: () => ({ valid: true }),
}))
const mockValidateWebhookUrl = jest.fn()
jest.mock('../../utils/webhookUrl', () => ({ validateWebhookUrl: (...args: unknown[]) => mockValidateWebhookUrl(...args) }))

/** Success shape for URL validation when tests need the fetch path (IP pinning). */
const validUrlResolution = {
  valid: true as const,
  hostname: 'example.com',
  resolvedAddress: '93.184.216.34',
  port: 443,
  protocol: 'https' as const,
  path: '/webhook',
  hostHeader: 'example.com',
}
jest.mock('../../utils/email', () => ({ sendEmail: () => Promise.resolve() }))
jest.mock('../../utils/webhookPayloads', () => ({ buildWebhookEventObject: (x: unknown) => x }))

import { sendDelivery, parseSafeBoundedInt } from '../../workers/webhookDelivery'

describe('webhookDelivery – attempt persistence failure', () => {
  const deliveryRow = {
    id: 'delivery-1',
    endpoint_id: 'ep-1',
    event_type: 'job.created',
    payload: {},
    response_status: null,
    response_body: null,
    duration_ms: null,
    attempt_count: 1,
    delivered_at: null,
    next_retry_at: new Date().toISOString(),
    processing_since: null,
    created_at: new Date().toISOString(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    deliveryUpdatePayload = undefined
    mockValidateWebhookUrl.mockResolvedValue(validUrlResolution)
    // Default: endpoint missing so we hit recordAttempt immediately without fetch
    endpointsSingle = {
      data: null,
      error: { message: 'Row not found', code: 'PGRST116' },
    }
    secretsMaybeSingle = { data: null, error: null }
    attemptsUpsertResult = { error: null }
  })

  it('when attempt upsert fails, delivery is marked with attempt persistence failed and not as normal outcome', async () => {
    attemptsUpsertResult = { error: { message: 'duplicate key', code: '23505' } }

    await sendDelivery(deliveryRow)

    expect(mockFrom).toHaveBeenCalledWith('webhook_delivery_attempts')
    expect(deliveryUpdatePayload).toBeDefined()
    const payload = deliveryUpdatePayload as Record<string, unknown>
    expect(payload.terminal_outcome).toBe('failed')
    expect(payload.response_body).toContain('Attempt persistence failed')
    expect(payload.response_body).toContain('incomplete')
    // Must not be the "Endpoint not found" message — we took the persistence-failure path
    expect(payload.response_body).not.toBe('Endpoint not found (deleted)')
  })

  it('when attempt upsert succeeds, delivery is updated with the normal terminal outcome for that path', async () => {
    attemptsUpsertResult = { error: null }

    await sendDelivery(deliveryRow)

    const payload = deliveryUpdatePayload as Record<string, unknown>
    expect(payload.terminal_outcome).toBe('failed')
    expect(payload.response_body).toBe('Endpoint not found (deleted)')
    expect(payload.response_body).not.toContain('Attempt persistence failed')
  })
})

describe('webhookDelivery – malformed URL is terminal (no retries)', () => {
  const deliveryRow = {
    id: 'delivery-2',
    endpoint_id: 'ep-2',
    event_type: 'job.created',
    payload: {},
    response_status: null,
    response_body: null,
    duration_ms: null,
    attempt_count: 1,
    delivered_at: null,
    next_retry_at: new Date().toISOString(),
    processing_since: null,
    created_at: new Date().toISOString(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    deliveryUpdatePayload = undefined
    mockValidateWebhookUrl.mockResolvedValue(validUrlResolution)
    endpointsSingle = { data: { url: 'https://not-a-valid-url', is_active: true }, error: null }
    secretsMaybeSingle = { data: { secret: 'encrypted' }, error: null }
    attemptsUpsertResult = { error: null }
  })

  it('when URL is invalid (terminal), delivery is terminalized with no next_retry_at', async () => {
    mockValidateWebhookUrl.mockResolvedValue({
      valid: false,
      reason: 'Invalid URL',
      terminal: true,
    })

    await sendDelivery(deliveryRow)

    expect(mockValidateWebhookUrl).toHaveBeenCalledWith('https://not-a-valid-url')
    const payload = deliveryUpdatePayload as Record<string, unknown>
    expect(payload.terminal_outcome).toBe('cancelled_policy')
    expect(payload.next_retry_at).toBeNull()
  })

  it('cancelled_policy does not increment consecutive_failures or trigger admin alert', async () => {
    mockRpc.mockClear()
    mockValidateWebhookUrl.mockResolvedValue({
      valid: false,
      reason: 'Blocked by policy',
      terminal: true,
    })

    await sendDelivery(deliveryRow)

    expect(deliveryUpdatePayload).toBeDefined()
    const payload = deliveryUpdatePayload as Record<string, unknown>
    expect(payload.terminal_outcome).toBe('cancelled_policy')
    expect(mockRpc).not.toHaveBeenCalledWith(
      'increment_webhook_endpoint_consecutive_failures',
      expect.any(Object)
    )
  })
})

describe('webhookDelivery – env parser (parseSafeBoundedInt)', () => {
  it('returns default when value is non-numeric string (concurrency 1..10, default 5)', () => {
    expect(parseSafeBoundedInt('abc', 5, 1, 10)).toBe(5)
    expect(parseSafeBoundedInt('nope', 5, 1, 10)).toBe(5)
    expect(parseSafeBoundedInt('5x', 5, 1, 10)).toBe(5)
  })

  it('returns default when value is non-numeric string (interval >= 2000, default 2000)', () => {
    expect(parseSafeBoundedInt('abc', 2000, 2000, 86400000)).toBe(2000)
    expect(parseSafeBoundedInt('2s', 2000, 2000, 86400000)).toBe(2000)
  })

  it('returns default for empty string and undefined', () => {
    expect(parseSafeBoundedInt('', 5, 1, 10)).toBe(5)
    expect(parseSafeBoundedInt(undefined, 5, 1, 10)).toBe(5)
    expect(parseSafeBoundedInt('', 2000, 2000, 86400000)).toBe(2000)
    expect(parseSafeBoundedInt(undefined, 2000, 2000, 86400000)).toBe(2000)
  })

  it('clamps concurrency to 1..10 and uses default for NaN', () => {
    expect(parseSafeBoundedInt('3', 5, 1, 10)).toBe(3)
    expect(parseSafeBoundedInt('1', 5, 1, 10)).toBe(1)
    expect(parseSafeBoundedInt('10', 5, 1, 10)).toBe(10)
    expect(parseSafeBoundedInt('0', 5, 1, 10)).toBe(1)
    expect(parseSafeBoundedInt('11', 5, 1, 10)).toBe(10)
    expect(parseSafeBoundedInt('-1', 5, 1, 10)).toBe(1)
  })

  it('clamps interval to >= 2000 and uses default for invalid', () => {
    expect(parseSafeBoundedInt('2000', 2000, 2000, 86400000)).toBe(2000)
    expect(parseSafeBoundedInt('5000', 2000, 2000, 86400000)).toBe(5000)
    expect(parseSafeBoundedInt('0', 2000, 2000, 86400000)).toBe(2000)
    expect(parseSafeBoundedInt('1000', 2000, 2000, 86400000)).toBe(2000)
    expect(parseSafeBoundedInt('999999999', 2000, 2000, 86400000)).toBe(86400000)
  })

  it('guarantees fallback prevents zero workers and 0ms interval (claimed-but-unprocessed regression)', () => {
    // Concurrency 0 would create zero workers; parser must never return 0 for 1..10 range
    const concurrency = parseSafeBoundedInt('not-a-number', 5, 1, 10)
    expect(concurrency).toBeGreaterThanOrEqual(1)
    expect(concurrency).toBeLessThanOrEqual(10)
    // Interval 0 would cause setInterval(..., 0) tight-loop; parser must never return < 2000 when min is 2000
    const intervalMs = parseSafeBoundedInt('invalid', 2000, 2000, 86400000)
    expect(intervalMs).toBeGreaterThanOrEqual(2000)
    expect(Number.isFinite(intervalMs)).toBe(true)
  })
})
