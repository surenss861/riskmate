/**
 * Route-level tests for GET /api/analytics/trends.
 * Covers day buckets, week/month (MV and fallback), locked-plan responses, and RPC fallback behavior.
 * Week/month query parsing is exercised via mocked NextRequest (preserves full URL) and backend route tests.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'org-trends-test-1111-2222-3333-4444'
const USER_ID = 'user-trends-test-1111-2222-3333-4444'

let fromMock: jest.Mock
let rpcMock: jest.Mock

// Preserve full URL (including query) so route receives correct searchParams (NextRequest in Jest can drop query).
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

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-trends-test-1111-2222-3333-4444' } },
        error: null,
      }),
    },
    from: (table: string) => fromMock(table),
    rpc: (...args: unknown[]) => rpcMock(...args),
  }),
}))

function trendsRequest(params: { period?: string; groupBy?: string; metric?: string }) {
  const search = new URLSearchParams()
  if (params.period != null) search.set('period', params.period)
  if (params.groupBy != null) search.set('groupBy', params.groupBy)
  if (params.metric != null) search.set('metric', params.metric)
  const qs = search.toString()
  const url = `http://localhost/api/analytics/trends${qs ? `?${qs}` : ''}`
  return new NextRequest(url) as NextRequest
}

/** Chain that resolves range() to { data, error }. Use for MV tables and jobs (fallback). */
function mvChain(result: { data: unknown[]; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(result),
  }
}

describe('GET /api/analytics/trends', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    const mod = await import('@/app/api/analytics/trends/route')
    GET = mod.GET
    rpcMock = jest.fn((name: string) => {
      if (name === 'get_trends_day_buckets') {
        return Promise.resolve({
          data: [
            { period_key: '2025-02-01', value: 5 },
            { period_key: '2025-02-02', value: 10 },
          ],
          error: null,
        })
      }
      if (name === 'refresh_analytics_weekly_job_stats') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })
    fromMock = jest.fn((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
        }
      }
      if (table === 'org_subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { plan_code: 'pro', status: 'active' },
            error: null,
          }),
        }
      }
      return {}
    })
  })

  it('returns 200 with period, groupBy, metric, data (trends response shape)', async () => {
    const res = await GET(trendsRequest({ period: '30d', groupBy: 'day', metric: 'jobs' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('period')
    expect(body).toHaveProperty('groupBy')
    expect(body).toHaveProperty('metric')
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  describe('locked-plan', () => {
    it('returns 200 with data [] and locked true when subscription has no analytics', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'none', status: 'inactive' },
              error: null,
            }),
          }
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'week', metric: 'jobs' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.locked).toBe(true)
      expect(body.data).toEqual([])
    })
  })

  describe('day RPC fallback', () => {
    it('returns 200 with empty data when get_trends_day_buckets RPC fails', async () => {
      rpcMock = jest.fn((name: string) => {
        if (name === 'get_trends_day_buckets') {
          return Promise.resolve({ data: null, error: { message: 'RPC not available' } })
        }
        return Promise.resolve({ data: null, error: null })
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'day', metric: 'jobs' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.groupBy).toBe('day')
      expect(body.metric).toBe('jobs')
      expect(body.data).toEqual([])
    })
  })

  describe('groupBy=week', () => {
    it('returns 200 with data shape for metric=jobs from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_created: 12, avg_risk: 2.5 },
              { week_start: '2025-02-10', jobs_created: 8, avg_risk: 1.8 },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'week', metric: 'jobs' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.metric).toBe('jobs')
      expect(Array.isArray(body.data)).toBe(true)
      if (body.data.length > 0) {
        body.data.forEach((p: { period: string; value: number; label: string }) => {
          expect(p).toHaveProperty('period')
          expect(p).toHaveProperty('value')
          expect(p).toHaveProperty('label')
        })
      }
    })

    it('returns 200 with data shape for metric=risk from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_created: 10, avg_risk: 3.2 },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'week', metric: 'risk' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
    })

    it('returns 200 with data shape for metric=completion from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_completion_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_completed: 5 },
              { week_start: '2025-02-10', jobs_completed: 4 },
            ],
            error: null,
          })
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_created: 10 },
              { week_start: '2025-02-10', jobs_created: 8 },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'week', metric: 'completion' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
      body.data.forEach((p: { period: string; value: number; label: string }) => {
        expect(typeof p.value).toBe('number')
        expect(p.value).toBeGreaterThanOrEqual(0)
        expect(p.value).toBeLessThanOrEqual(100)
      })
    })

    it('returns 200 with data shape for metric=jobs_completed from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_completion_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_completed: 7 },
              { week_start: '2025-02-10', jobs_completed: 3 },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'week', metric: 'jobs_completed' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
    })
  })

  describe('groupBy=month', () => {
    it('returns 200 with data shape for metric=jobs from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_created: 10, avg_risk: 2 },
              { week_start: '2025-02-17', jobs_created: 14, avg_risk: null },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '90d', groupBy: 'month', metric: 'jobs' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.metric).toBe('jobs')
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('returns 200 with data shape for metric=risk from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_created: 5, avg_risk: 2.5 },
              { week_start: '2025-02-10', jobs_created: 5, avg_risk: 1.5 },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '90d', groupBy: 'month', metric: 'risk' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
    })

    it('returns 200 with data shape for metric=completion from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_completion_stats') {
          return mvChain({
            data: [{ week_start: '2025-02-03', jobs_completed: 6 }],
            error: null,
          })
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({
            data: [{ week_start: '2025-02-03', jobs_created: 10 }],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '90d', groupBy: 'month', metric: 'completion' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('returns 200 with data shape for metric=jobs_completed from MV', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_completion_stats') {
          return mvChain({
            data: [
              { week_start: '2025-02-03', jobs_completed: 4 },
              { week_start: '2025-02-10', jobs_completed: 6 },
            ],
            error: null,
          })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '90d', groupBy: 'month', metric: 'jobs_completed' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
    })
  })

  describe('RPC fallback for week/month', () => {
    it('returns 200 with empty or fallback data when MV tables return empty', async () => {
      fromMock = jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { organization_id: ORG_ID }, error: null }),
          }
        }
        if (table === 'org_subscriptions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { plan_code: 'pro', status: 'active' },
              error: null,
            }),
          }
        }
        if (table === 'analytics_weekly_job_stats') {
          return mvChain({ data: [], error: null })
        }
        if (table === 'analytics_weekly_completion_stats') {
          return mvChain({ data: [], error: null })
        }
        if (table === 'jobs') {
          return mvChain({ data: [], error: null })
        }
        return {}
      })
      const res = await GET(trendsRequest({ period: '30d', groupBy: 'week', metric: 'jobs' }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(Array.isArray(body.data)).toBe(true)
      expect(body).toHaveProperty('metric')
    })
  })
})
