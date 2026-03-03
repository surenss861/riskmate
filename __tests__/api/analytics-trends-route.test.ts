/**
 * Route-level tests for GET /api/analytics/trends.
 * Week/month aggregation for 30d/90d/1y is covered by backend route tests:
 * apps/backend/src/__tests__/routes/analytics-trends-week-month.test.ts
 * This file verifies the Next.js route returns 200 and correct shape for day buckets.
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'org-trends-test-1111-2222-3333-4444'
const USER_ID = 'user-trends-test-1111-2222-3333-4444'

let fromMock: jest.Mock
let rpcMock: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
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
  return new NextRequest(url)
}

describe('GET /api/analytics/trends', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    rpcMock = jest.fn().mockResolvedValue({
      data: [
        { period_key: '2025-02-01', value: 5 },
        { period_key: '2025-02-02', value: 10 },
      ],
      error: null,
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
    const { GET } = await import('@/app/api/analytics/trends/route')
    const res = await GET(trendsRequest({ period: '30d', groupBy: 'day', metric: 'jobs' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('period')
    expect(body).toHaveProperty('groupBy')
    expect(body).toHaveProperty('metric')
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })
})
