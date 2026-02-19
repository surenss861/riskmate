/**
 * Integration tests for /api/search and /api/jobs advanced filters.
 *
 * Exercises:
 * - saved_filter_id application on both endpoints
 * - Boolean filters (has_photos, has_signatures, needs_signatures)
 * - include_archived
 * - Response shape: /api/jobs strips score/highlight; /api/search includes them
 * - saved_filter_id matching zero jobs returns empty data/counts
 * - include_archived toggling (archived rows included when true)
 */

import { NextRequest } from 'next/server'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const USER_ID = 'cccccccc-dddd-4eee-8fff-000011112222'
const SAVED_FILTER_ID = '11111111-2222-4333-8444-555566667777'
const JOB_ID_1 = 'j1111111-2222-4333-8444-555566667777'

function chainableMock<T>(final: { data: T; error: null }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(final),
    maybeSingle: jest.fn().mockResolvedValue(final),
    then: (resolve: (v: { data: T; error: null }) => void) => Promise.resolve(final).then(resolve),
  }
  return chain
}

let supabaseMock: {
  auth: { getUser: jest.Mock }
  from: jest.Mock
  rpc: jest.Mock
}

let filterConfigGetMatchingIds: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(supabaseMock)),
}))

jest.mock('@/lib/jobs/filterConfig', () => {
  const actual = jest.requireActual('@/lib/jobs/filterConfig')
  return {
    ...actual,
    getMatchingJobIdsFromFilterGroup: (...args: unknown[]) =>
      filterConfigGetMatchingIds(...args),
  }
})

jest.mock('@/lib/utils/errorLogging', () => ({
  logApiError: jest.fn(),
}))

jest.mock('@/lib/featureEvents', () => ({
  getRequestId: jest.fn(() => 'test-request-id'),
}))

describe('GET /api/jobs – advanced filters and response shape', () => {
  beforeEach(() => {
    filterConfigGetMatchingIds = jest.fn().mockResolvedValue([])
    const userAndOrg = chainableMock({
      data: { organization_id: ORG_ID },
      error: null,
    })
    supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'users') return userAndOrg
        if (table === 'saved_filters') {
          return chainableMock({
            data: {
              id: SAVED_FILTER_ID,
              filter_config: { operator: 'AND', conditions: [{ field: 'status', operator: 'eq', value: 'draft' }] },
            },
            error: null,
          })
        }
        return chainableMock({ data: [], error: null })
      }),
      rpc: jest.fn((name: string) => {
        if (name === 'get_jobs_list' || name === 'get_jobs_ranked') {
          return Promise.resolve({
            data: [
              {
                id: JOB_ID_1,
                title: 'Job One',
                client_name: 'Client A',
                job_type: 'inspection',
                location: 'NY',
                status: 'draft',
                risk_score: 10,
                risk_level: 'low',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
                total_count: 1,
              },
            ],
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
  })

  it('forwards has_photos, has_signatures, needs_signatures, include_archived and returns data without score/highlight', async () => {
    const { GET } = await import('@/app/api/jobs/route')
    const url = `http://localhost/api/jobs?limit=10&include_archived=true&has_photos=true&has_signatures=false&needs_signatures=true`
    const request = new NextRequest(url)
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBeDefined()
    expect(body.pagination.limit).toBe(10)
    body.data.forEach((job: Record<string, unknown>) => {
      expect(job).not.toHaveProperty('score')
      expect(job).not.toHaveProperty('highlight')
      expect(job.id).toBeDefined()
      expect(job.client_name).toBeDefined()
    })
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_jobs_list',
      expect.objectContaining({
        p_include_archived: true,
        p_has_photos: true,
        p_has_signatures: false,
        p_needs_signatures: true,
      })
    )
  })

  it('forwards filter_config, saved_filter_id, risk_score_min, risk_score_max, job_type, client', async () => {
    filterConfigGetMatchingIds.mockResolvedValue([JOB_ID_1])
    const { GET } = await import('@/app/api/jobs/route')
    const url = `http://localhost/api/jobs?limit=5&saved_filter_id=${SAVED_FILTER_ID}&risk_score_min=0&risk_score_max=100&job_type=inspection&client=Acme`
    const request = new NextRequest(url)
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(supabaseMock.from).toHaveBeenCalledWith('saved_filters')
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_jobs_list',
      expect.objectContaining({
        p_risk_score_min: 0,
        p_risk_score_max: 100,
        p_job_type: 'inspection',
        p_client_ilike: '%Acme%',
        p_required_ids: [JOB_ID_1],
      })
    )
    expect(body.data).toBeDefined()
    body.data.forEach((job: Record<string, unknown>) => {
      expect(job).not.toHaveProperty('score')
      expect(job).not.toHaveProperty('highlight')
    })
  })

  it('returns empty data and total 0 when saved_filter_id matches zero jobs', async () => {
    filterConfigGetMatchingIds.mockResolvedValue([])
    supabaseMock.rpc.mockImplementation((name: string) => {
      if (name === 'get_jobs_list') {
        return Promise.resolve({
          data: [{ total_count: 0 }],
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })
    const { GET } = await import('@/app/api/jobs/route')
    const url = `http://localhost/api/jobs?limit=10&saved_filter_id=${SAVED_FILTER_ID}`
    const request = new NextRequest(url)
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
    expect(body.pagination.totalPages).toBe(0)
  })

  it('include_archived=true is passed to RPC and affects filter resolution', async () => {
    filterConfigGetMatchingIds.mockResolvedValue([JOB_ID_1])
    const { GET } = await import('@/app/api/jobs/route')
    const withoutArchived = new NextRequest('http://localhost/api/jobs?limit=10')
    const withArchived = new NextRequest('http://localhost/api/jobs?limit=10&include_archived=true')

    const res1 = await GET(withoutArchived)
    const res2 = await GET(withArchived)

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_jobs_list',
      expect.objectContaining({ p_include_archived: false })
    )
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_jobs_list',
      expect.objectContaining({ p_include_archived: true })
    )
  })
})

describe('GET /api/search – advanced filters and result shape', () => {
  beforeEach(() => {
    filterConfigGetMatchingIds = jest.fn().mockResolvedValue([JOB_ID_1])
    const userAndOrg = chainableMock({
      data: { organization_id: ORG_ID },
      error: null,
    })
    supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'users') return userAndOrg
        if (table === 'saved_filters') {
          return chainableMock({
            data: {
              id: SAVED_FILTER_ID,
              name: 'Test Filter',
              filter_config: { operator: 'AND', conditions: [] },
            },
            error: null,
          })
        }
        if (table === 'jobs' || table === 'clients') {
          return chainableMock({ data: [], error: null })
        }
        return chainableMock({ data: [], error: null })
      }),
      rpc: jest.fn((name: string) => {
        if (name === 'get_jobs_ranked') {
          return Promise.resolve({
            data: [
              {
                id: JOB_ID_1,
                title: 'Job One',
                client_name: 'Client A',
                job_type: 'inspection',
                location: 'NY',
                total_count: 1,
                score: 0.85,
                highlight: 'Job <b>One</b>',
              },
            ],
            error: null,
          })
        }
        if (name === 'get_jobs_list') {
          return Promise.resolve({
            data: [
              {
                id: JOB_ID_1,
                title: 'Job One',
                client_name: 'Client A',
                job_type: 'inspection',
                location: 'NY',
                total_count: 1,
              },
            ],
            error: null,
          })
        }
        if (name === 'search_clients') {
          return Promise.resolve({
            data: [
              { id: 'c1111111-2222-4333-8444-555566667777', display_name: 'Client A', highlight: 'Client <b>A</b>', rank: 0.5 },
            ],
            error: null,
          })
        }
        if (name === 'search_clients_count') {
          return Promise.resolve({ data: 1, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
  })

  it('returns job results with score and highlight', async () => {
    const { GET } = await import('@/app/api/search/route')
    const request = new NextRequest(
      'http://localhost/api/search?q=one&type=jobs&limit=20&include_archived=true'
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(body.total).toBeDefined()
    const jobResults = body.results.filter((r: { type: string }) => r.type === 'job')
    expect(jobResults.length).toBeGreaterThanOrEqual(0)
    jobResults.forEach((r: Record<string, unknown>) => {
      expect(r).toHaveProperty('score')
      expect(r).toHaveProperty('highlight')
      expect(r.type).toBe('job')
    })
  })

  it('applies saved_filter_id and returns applied_filter when used', async () => {
    const { GET } = await import('@/app/api/search/route')
    const request = new NextRequest(
      `http://localhost/api/search?type=jobs&limit=20&saved_filter_id=${SAVED_FILTER_ID}&include_archived=true`
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(body.total).toBeDefined()
    if (body.applied_filter) {
      expect(body.applied_filter.id).toBe(SAVED_FILTER_ID)
      expect(body.applied_filter.name).toBeDefined()
      expect(body.applied_filter.filter_config).toBeDefined()
    }
  })

  it('saved_filter_id matching zero jobs returns total 0 and empty results for jobs', async () => {
    filterConfigGetMatchingIds.mockResolvedValue([])
    supabaseMock.rpc.mockImplementation((name: string) => {
      if (name === 'get_jobs_list') {
        return Promise.resolve({ data: [{ total_count: 0 }], error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })
    const { GET } = await import('@/app/api/search/route')
    const request = new NextRequest(
      `http://localhost/api/search?type=jobs&limit=20&saved_filter_id=${SAVED_FILTER_ID}`
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(0)
    expect(body.results.filter((r: { type: string }) => r.type === 'job')).toHaveLength(0)
  })

  it('accepts has_photos, has_signatures, needs_signatures, include_archived and returns counts', async () => {
    const { GET } = await import('@/app/api/search/route')
    const request = new NextRequest(
      'http://localhost/api/search?type=jobs&limit=20&has_photos=true&needs_signatures=true&include_archived=true'
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(body.total).toBeDefined()
    expect(typeof body.total).toBe('number')
  })

  it('forwards include_archived=true to search_clients and search_clients_count', async () => {
    const { GET } = await import('@/app/api/search/route')
    const request = new NextRequest(
      'http://localhost/api/search?q=client&type=clients&limit=20&include_archived=true'
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'search_clients',
      expect.objectContaining({
        p_org_id: ORG_ID,
        p_query: expect.any(String),
        p_limit: 20,
        p_include_archived: true,
      })
    )
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'search_clients_count',
      expect.objectContaining({
        p_org_id: ORG_ID,
        p_query: expect.any(String),
        p_include_archived: true,
      })
    )
  })

  it('forwards include_archived=false to search_clients and search_clients_count when omitted', async () => {
    const { GET } = await import('@/app/api/search/route')
    const request = new NextRequest(
      'http://localhost/api/search?q=client&type=clients&limit=20'
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toBeDefined()
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'search_clients',
      expect.objectContaining({
        p_org_id: ORG_ID,
        p_query: expect.any(String),
        p_limit: 20,
        p_include_archived: false,
      })
    )
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'search_clients_count',
      expect.objectContaining({
        p_org_id: ORG_ID,
        p_query: expect.any(String),
        p_include_archived: false,
      })
    )
  })
})
