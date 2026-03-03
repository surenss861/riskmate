/**
 * Route-level tests for GET /api/analytics/team-performance.
 * Covers period metadata for explicit since/until (custom range) so response period reflects requested range.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'org-team-perf-test-1111'
const REQUEST_ID = 'req-team-perf-123'

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

function teamPerformanceRequest(params?: { period?: string; since?: string; until?: string }) {
  const search = new URLSearchParams()
  if (params?.period != null) search.set('period', params.period)
  if (params?.since != null) search.set('since', params.since)
  if (params?.until != null) search.set('until', params.until)
  const qs = search.toString()
  const url = `http://localhost/api/analytics/team-performance${qs ? `?${qs}` : ''}`
  return new NextRequest(url) as NextRequest
}

describe('GET /api/analytics/team-performance', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    rpcMock = jest.fn((name: string) => {
      if (name === 'get_team_performance_kpis') {
        return Promise.resolve({
          data: [
            { user_id: 'u1', jobs_assigned: 10, jobs_completed: 8, sum_days: 16, count_completed: 8, overdue_count: 0 },
          ],
          error: null,
        })
      }
      if (name === 'get_team_member_display_names') {
        return Promise.resolve({ data: [{ user_id: 'u1', display_name: 'User One' }], error: null })
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
    const mod = await import('@/app/api/analytics/team-performance/route')
    GET = mod.GET
  })

  it('returns 200 with members and period', async () => {
    const res = await GET(teamPerformanceRequest({ period: '30d' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('period', '30d')
    expect(body).toHaveProperty('members')
    expect(Array.isArray(body.members)).toBe(true)
  })

  it('succeeds with bearer-only request (no cookies)', async () => {
    const req = new NextRequest('http://localhost/api/analytics/team-performance?period=30d', {
      headers: { Authorization: 'Bearer test-token' },
    }) as NextRequest
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('members')
    expect(Array.isArray(body.members)).toBe(true)
  })

  it('explicit since/until: period metadata reflects requested range (not 30d)', async () => {
    const since = '2025-01-01T00:00:00.000Z'
    const until = '2025-01-20T23:59:59.999Z'
    const res = await GET(teamPerformanceRequest({ since, until }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.period).toBe('20d')
    expect(Array.isArray(body.members)).toBe(true)
  })

  it('explicit since/until spanning >=365 days: period is 1y', async () => {
    const since = '2024-01-01T00:00:00.000Z'
    const until = '2024-12-31T23:59:59.999Z'
    const res = await GET(teamPerformanceRequest({ since, until }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.period).toBe('1y')
    expect(Array.isArray(body.members)).toBe(true)
  })
})
