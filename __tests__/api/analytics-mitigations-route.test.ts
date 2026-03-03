/**
 * Route-level tests for GET /api/analytics/mitigations.
 * Asserts successful non-locked response path and prevents regressions of missing Supabase client initialization.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'org-mitigations-test-1111-2222-3333-4444'
const REQUEST_ID = 'req-mitigations-test-123'

let rpcMock: jest.Mock

jest.mock('next/server', () => {
  const actual = jest.requireActual<typeof import('next/server')>('next/server')
  class MockNextRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
      super(url, init)
    }
  }
  return { ...actual, NextRequest: MockNextRequest }
})

jest.mock('@/lib/utils/analyticsAuth', () => ({
  getAnalyticsContext: jest.fn(),
}))

function mitigationsRequest(params?: { range?: string; since?: string; until?: string; crew_id?: string }) {
  const search = new URLSearchParams()
  if (params?.range != null) search.set('range', params.range)
  if (params?.since != null) search.set('since', params.since)
  if (params?.until != null) search.set('until', params.until)
  if (params?.crew_id != null) search.set('crew_id', params.crew_id)
  const qs = search.toString()
  const url = `http://localhost/api/analytics/mitigations${qs ? `?${qs}` : ''}`
  return new NextRequest(url) as NextRequest
}

describe('GET /api/analytics/mitigations', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    rpcMock = jest.fn((name: string, args: Record<string, unknown>) => {
      if (name === 'get_mitigations_analytics_kpis') {
        return Promise.resolve({
          data: [{
            jobs_total: 10,
            completion_rate: 0.85,
            avg_time_to_close_hours: 2.5,
            high_risk_jobs: 2,
            evidence_count: 8,
            jobs_with_evidence: 8,
            jobs_without_evidence: 2,
            avg_time_to_first_evidence_hours: 1.2,
            jobs_scored: 10,
            jobs_with_any_evidence: 8,
            jobs_with_photo_evidence: 6,
            jobs_missing_required_evidence: 1,
            avg_time_to_first_photo_minutes: 45,
          }],
          error: null,
        })
      }
      if (name === 'get_mitigations_analytics_trend') {
        return Promise.resolve({
          data: [
            { period_key: '2025-03-01', completion_rate: 80 },
            { period_key: '2025-03-02', completion_rate: 90 },
          ],
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })
    const { getAnalyticsContext } = await import('@/lib/utils/analyticsAuth')
    ;(getAnalyticsContext as jest.Mock).mockResolvedValue({
      orgId: ORG_ID,
      requestId: REQUEST_ID,
      hasAnalytics: true,
      isActive: true,
      status: 'active',
      supabase: { rpc: rpcMock },
    })
    const mod = await import('@/app/api/analytics/mitigations/route')
    GET = mod.GET
  })

  it('succeeds with bearer-only request (no cookies)', async () => {
    const req = new NextRequest('http://localhost/api/analytics/mitigations?range=30d', {
      headers: { Authorization: 'Bearer test-token' },
    }) as NextRequest
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('org_id', ORG_ID)
    expect(body).toHaveProperty('trend')
    expect(Array.isArray(body.trend)).toBe(true)
  })

  it('returns 200 with full metrics and trend when client is initialized (non-locked path)', async () => {
    const res = await GET(mitigationsRequest({ range: '30d' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.locked).toBeUndefined()
    expect(body.org_id).toBe(ORG_ID)
    expect(body.range_days).toBe(30)
    expect(body.completion_rate).toBe(0.85)
    expect(body.avg_time_to_close_hours).toBe(2.5)
    expect(body.high_risk_jobs).toBe(2)
    expect(body.jobs_total).toBe(10)
    expect(body.trend).toBeDefined()
    expect(Array.isArray(body.trend)).toBe(true)
    expect(body.trend.length).toBeGreaterThan(0)
    expect(body.trend_empty_reason).toBeNull()
    expect(res.headers.get('X-Request-ID')).toBe(REQUEST_ID)
  })

  it('calls both KPI and trend RPCs with the same Supabase client', async () => {
    await GET(mitigationsRequest({ range: '7d' }))

    expect(rpcMock).toHaveBeenCalledWith('get_mitigations_analytics_kpis', expect.objectContaining({
      p_org_id: ORG_ID,
      p_crew_id: null,
    }))
    expect(rpcMock).toHaveBeenCalledWith('get_mitigations_analytics_trend', expect.objectContaining({
      p_org_id: ORG_ID,
      p_crew_id: null,
    }))
  })

  it('returns 400 VALIDATION_ERROR when since or until has invalid format', async () => {
    const res = await GET(mitigationsRequest({ since: 'notadate', until: '2025-01-15' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid date format for since or until',
    })
    expect(res.headers.get('X-Request-ID')).toBe(REQUEST_ID)
    expect(res.headers.get('X-Error-ID')).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR when since is after until (reversed range)', async () => {
    const res = await GET(mitigationsRequest({ since: '2025-01-15', until: '2025-01-01' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid date range: since must be before or equal to until',
    })
    expect(res.headers.get('X-Request-ID')).toBe(REQUEST_ID)
    expect(res.headers.get('X-Error-ID')).toBeDefined()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
