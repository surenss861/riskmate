/**
 * Route-level tests for GET /api/analytics/risk-heatmap.
 * Covers period metadata for explicit since/until (custom range) so response period reflects requested range.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'org-risk-heatmap-test-1111'
const REQUEST_ID = 'req-risk-heatmap-123'

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

function riskHeatmapRequest(params?: { period?: string; since?: string; until?: string }) {
  const search = new URLSearchParams()
  if (params?.period != null) search.set('period', params.period)
  if (params?.since != null) search.set('since', params.since)
  if (params?.until != null) search.set('until', params.until)
  const qs = search.toString()
  const url = `http://localhost/api/analytics/risk-heatmap${qs ? `?${qs}` : ''}`
  return new NextRequest(url) as NextRequest
}

describe('GET /api/analytics/risk-heatmap', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    rpcMock = jest.fn(() =>
      Promise.resolve({
        data: [
          { job_type: 'inspection', day_of_week: 1, avg_risk: 2.5, count: 10 },
        ],
        error: null,
      })
    )
    const { getAnalyticsContext } = await import('@/lib/utils/analyticsAuth')
    ;(getAnalyticsContext as jest.Mock).mockResolvedValue({
      orgId: ORG_ID,
      requestId: REQUEST_ID,
      hasAnalytics: true,
      isActive: true,
      status: 'active',
      supabase: { rpc: rpcMock },
    })
    const mod = await import('@/app/api/analytics/risk-heatmap/route')
    GET = mod.GET
  })

  it('returns 200 with buckets and period', async () => {
    const res = await GET(riskHeatmapRequest({ period: '30d' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('period', '30d')
    expect(body).toHaveProperty('buckets')
    expect(Array.isArray(body.buckets)).toBe(true)
  })

  it('succeeds with bearer-only request (no cookies)', async () => {
    const req = new NextRequest('http://localhost/api/analytics/risk-heatmap?period=30d', {
      headers: { Authorization: 'Bearer test-token' },
    }) as NextRequest
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('buckets')
    expect(Array.isArray(body.buckets)).toBe(true)
  })

  it('explicit since/until: period metadata reflects requested range (not 30d)', async () => {
    const since = '2025-01-01T00:00:00.000Z'
    const until = '2025-01-15T23:59:59.999Z'
    const res = await GET(riskHeatmapRequest({ since, until }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.period).toBe('15d')
    expect(Array.isArray(body.buckets)).toBe(true)
  })

  it('explicit since/until spanning >=365 days: period is 1y', async () => {
    const since = '2024-01-01T00:00:00.000Z'
    const until = '2024-12-31T23:59:59.999Z'
    const res = await GET(riskHeatmapRequest({ since, until }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.period).toBe('1y')
    expect(Array.isArray(body.buckets)).toBe(true)
  })
})
