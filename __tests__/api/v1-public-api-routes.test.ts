/**
 * Route-level tests for Public API v1: auth, scope, rate-limit, pagination meta.
 * Covers GET/POST /api/v1/jobs, GET/PATCH/DELETE /api/v1/jobs/[id], GET/POST /api/v1/hazards,
 * GET /api/v1/reports, GET /api/v1/reports/[id].
 */

import { NextRequest } from 'next/server'
import { hashApiKey } from '@/lib/middleware/apiKeyAuth'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const KEY_ID = 'key-11111111-2222-4333-8444-555555555555'
const VALID_KEY = 'rm_test_' + 'a'.repeat(32)
const VALID_KEY_HASH = hashApiKey(VALID_KEY)
const validKeyRow = {
  id: KEY_ID,
  organization_id: ORG_ID,
  scopes: ['jobs:read', 'jobs:write', 'hazards:read', 'hazards:write', 'reports:read'],
  revoked_at: null,
  expires_at: null,
}

let apiKeysMaybeSingle: jest.Mock
let rpcMock: jest.Mock
let fromMock: jest.Mock

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => fromMock(table),
    rpc: (name: string, params: unknown) => rpcMock(name, params),
  })),
}))

jest.mock('@/lib/entitlements', () => ({
  getOrgEntitlementsForApiKey: jest.fn().mockResolvedValue({
    jobs_monthly_limit: null,
    tier: 'pro',
    status: 'active',
    period_end: null,
    permit_packs: false,
    version_history: false,
    evidence_verification: false,
    job_assignment: false,
    seats_limit: null,
  }),
}))

jest.mock('@/lib/webhooks/trigger', () => ({
  triggerWebhookEvent: jest.fn().mockResolvedValue(undefined),
}))

function requestWithAuth(token: string | null, opts: { method?: string; url?: string; body?: unknown } = {}) {
  const url = opts.url ?? 'http://localhost/api/v1/jobs'
  const headers = new Headers()
  if (token) headers.set('authorization', `Bearer ${token}`)
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

function setupSupabaseMocks(options: {
  keyFound?: boolean
  keyRevoked?: boolean
  keyExpired?: boolean
  rateLimitAllowed?: boolean
  jobsList?: unknown[]
  jobsListTotal?: number
  jobSingle?: unknown
  mitigationItems?: unknown[]
  reportRuns?: unknown[]
  reportSingle?: unknown
  reportSignatures?: unknown[]
  jobRiskScore?: unknown
}) {
  const {
    keyFound = true,
    keyRevoked = false,
    keyExpired = false,
    rateLimitAllowed = true,
    jobsList = [],
    jobsListTotal = 0,
    jobSingle = null,
    mitigationItems = [],
    reportRuns = [],
    reportSingle = null,
    reportSignatures = [],
    jobRiskScore = null,
  } = options

  apiKeysMaybeSingle = jest.fn().mockImplementation(() => {
    if (!keyFound)
      return Promise.resolve({ data: null, error: null })
    return Promise.resolve({
      data: {
        ...validKeyRow,
        revoked_at: keyRevoked ? new Date().toISOString() : null,
        expires_at: keyExpired ? new Date(Date.now() - 86400000).toISOString() : null,
      },
      error: null,
    })
  })

  rpcMock = jest.fn().mockImplementation((name: string) => {
    if (name === 'increment_api_key_rate_limit') {
      return Promise.resolve({
        data: rateLimitAllowed
          ? [{ allowed: true, count: 1, remaining: 999, reset_at_epoch: Math.ceil((Date.now() + 3600000) / 1000), retry_after_seconds: 3600 }]
          : [{ allowed: false, count: 1001, remaining: 0, reset_at_epoch: Math.ceil((Date.now() + 1800) / 1000), retry_after_seconds: 1800 }],
        error: null,
      })
    }
    if (name === 'get_jobs_list') {
      const list = jobsList.length ? jobsList : (jobsListTotal ? [{ id: 'j1', total_count: jobsListTotal }] : [])
      return Promise.resolve({ data: list, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  const buildChain = (result: { data: unknown; error: null } | { data: unknown[]; count: number | null; error: null }) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(
      'count' in result
        ? { data: result.data, count: result.count, error: null }
        : { data: Array.isArray(result.data) ? result.data : [result.data], error: null }
    ),
    maybeSingle: jest.fn().mockResolvedValue(
      Array.isArray(result.data) ? { data: (result.data as unknown[])[0] ?? null, error: null } : result
    ),
    single: jest.fn().mockResolvedValue(
      Array.isArray(result.data) ? { data: (result.data as unknown[])[0], error: null } : result
    ),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  })

  fromMock = jest.fn((table: string) => {
    if (table === 'api_keys') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn((col: string, val: string) => {
          if (col === 'key_hash' && val === VALID_KEY_HASH) return { maybeSingle: apiKeysMaybeSingle }
          return { maybeSingle: () => Promise.resolve({ data: null, error: null }) }
        }),
        maybeSingle: apiKeysMaybeSingle,
      }
    }
    if (table === 'jobs') {
      if (jobSingle) {
        return buildChain({ data: jobSingle, error: null })
      }
      return buildChain({ data: [], count: jobsListTotal, error: null })
    }
    if (table === 'mitigation_items') {
      return buildChain({ data: mitigationItems, count: mitigationItems.length, error: null })
    }
    if (table === 'report_runs') {
      const runData = reportSingle ?? (reportRuns.length ? reportRuns[0] : null)
      return buildChain({ data: runData, error: null })
    }
    if (table === 'report_signatures') {
      return buildChain({ data: reportSignatures, count: reportSignatures.length, error: null })
    }
    if (table === 'job_risk_scores') {
      return buildChain({ data: jobRiskScore, error: null })
    }
    return buildChain({ data: null, error: null })
  })
}

describe('Public API v1 routes', () => {
  beforeEach(() => {
    setupSupabaseMocks({})
  })

  describe('GET /api/v1/jobs', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const { GET } = await import('@/app/api/v1/jobs/route')
      const res = await GET(requestWithAuth(null))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error?.code).toBe('UNAUTHORIZED')
    })

    it('returns 401 when Bearer token has wrong prefix', async () => {
      const { GET } = await import('@/app/api/v1/jobs/route')
      const res = await GET(requestWithAuth('unknown_xxx'))
      expect(res.status).toBe(401)
    })

    it('returns 401 when key is revoked', async () => {
      setupSupabaseMocks({ keyRevoked: true })
      const { GET } = await import('@/app/api/v1/jobs/route')
      const res = await GET(requestWithAuth(VALID_KEY))
      expect(res.status).toBe(401)
    })

    it('returns 403 when key lacks required scope', async () => {
      setupSupabaseMocks({})
      apiKeysMaybeSingle.mockResolvedValue({
        data: { ...validKeyRow, scopes: ['hazards:read'] },
        error: null,
      })
      const { GET } = await import('@/app/api/v1/jobs/route')
      const res = await GET(requestWithAuth(VALID_KEY))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error?.code).toBe('FORBIDDEN')
    })

    it('returns 429 with Retry-After and X-RateLimit-* when rate limit exceeded', async () => {
      setupSupabaseMocks({ rateLimitAllowed: false })
      const { GET } = await import('@/app/api/v1/jobs/route')
      const res = await GET(requestWithAuth(VALID_KEY))
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      const body = await res.json()
      expect(body.error?.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('returns 200 with data and pagination meta when auth and scope ok', async () => {
      setupSupabaseMocks({ jobsList: [{ id: 'j1', title: 'Job 1', total_count: 1 }], jobsListTotal: 1 })
      const { GET } = await import('@/app/api/v1/jobs/route')
      const res = await GET(requestWithAuth(VALID_KEY, { url: 'http://localhost/api/v1/jobs?page=1&limit=20' }))
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.meta).toEqual({ page: 1, limit: 20, total: expect.any(Number) })
    })
  })

  describe('POST /api/v1/jobs', () => {
    const validBody = {
      client_name: 'Acme',
      client_type: 'commercial',
      job_type: 'inspection',
      location: 'NYC',
      status: 'draft',
    }

    it('returns 401 when Authorization is missing', async () => {
      const { POST } = await import('@/app/api/v1/jobs/route')
      const res = await POST(requestWithAuth(null, { method: 'POST', body: validBody }))
      expect(res.status).toBe(401)
    })

    it('returns 403 when key has no jobs:write scope', async () => {
      apiKeysMaybeSingle.mockResolvedValue({
        data: { ...validKeyRow, scopes: ['jobs:read'] },
        error: null,
      })
      const { POST } = await import('@/app/api/v1/jobs/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', body: validBody }))
      expect(res.status).toBe(403)
    })

    it('returns 400 INVALID_FORMAT when body is null', async () => {
      const { POST } = await import('@/app/api/v1/jobs/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', body: null }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error?.code).toBe('INVALID_FORMAT')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('returns 400 INVALID_FORMAT when body is an array', async () => {
      const { POST } = await import('@/app/api/v1/jobs/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', body: [] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error?.code).toBe('INVALID_FORMAT')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('returns 400 INVALID_FORMAT when body is a primitive', async () => {
      const { POST } = await import('@/app/api/v1/jobs/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', body: 'not an object' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error?.code).toBe('INVALID_FORMAT')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('returns 200 with job when key has jobs:write and body valid', async () => {
      const insertedJob = { id: 'new-job-id', title: 'Acme – inspection – NYC', ...validBody }
      fromMock = jest.fn((table: string) => {
        if (table === 'api_keys') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn((col: string, val: string) => {
              if (col === 'key_hash' && val === VALID_KEY_HASH)
                return { maybeSingle: apiKeysMaybeSingle }
              return { maybeSingle: () => Promise.resolve({ data: null, error: null }) }
            }),
            maybeSingle: apiKeysMaybeSingle,
          }
        }
        if (table === 'jobs') {
          return {
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: insertedJob, error: null }),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
          }
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) }
      })
      const { POST } = await import('@/app/api/v1/jobs/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', body: validBody }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
    })
  })

  describe('GET /api/v1/jobs/[id]', () => {
    it('returns 401 when Authorization is missing', async () => {
      const { GET } = await import('@/app/api/v1/jobs/[id]/route')
      const res = await GET(requestWithAuth(null), { params: Promise.resolve({ id: '11111111-2222-4333-8444-555555555555' }) })
      expect(res.status).toBe(401)
    })

    it('returns 403 when key lacks scope', async () => {
      apiKeysMaybeSingle.mockResolvedValue({
        data: { ...validKeyRow, scopes: ['reports:read'] },
        error: null,
      })
      const { GET } = await import('@/app/api/v1/jobs/[id]/route')
      const res = await GET(requestWithAuth(VALID_KEY), { params: Promise.resolve({ id: '11111111-2222-4333-8444-555555555555' }) })
      expect(res.status).toBe(403)
    })

    it('returns 200 with job and rate limit headers when found', async () => {
      const job = { id: '11111111-2222-4333-8444-555555555555', organization_id: ORG_ID, title: 'Test' }
      setupSupabaseMocks({ jobSingle: job, jobRiskScore: null })
      const { GET } = await import('@/app/api/v1/jobs/[id]/route')
      const res = await GET(requestWithAuth(VALID_KEY), { params: Promise.resolve({ id: job.id }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
    })
  })

  describe('GET /api/v1/hazards', () => {
    it('returns 401 when Authorization is missing', async () => {
      const { GET } = await import('@/app/api/v1/hazards/route')
      const res = await GET(requestWithAuth(null, { url: 'http://localhost/api/v1/hazards?job_id=11111111-2222-4333-8444-555555555555' }))
      expect(res.status).toBe(401)
    })

    it('returns 403 when key lacks hazards scope', async () => {
      apiKeysMaybeSingle.mockResolvedValue({
        data: { ...validKeyRow, scopes: ['jobs:read'] },
        error: null,
      })
      const { GET } = await import('@/app/api/v1/hazards/route')
      const res = await GET(requestWithAuth(VALID_KEY, { url: 'http://localhost/api/v1/hazards?job_id=11111111-2222-4333-8444-555555555555' }))
      expect(res.status).toBe(403)
    })

    it('returns 200 with data and pagination meta', async () => {
      setupSupabaseMocks({
        jobSingle: { id: '11111111-2222-4333-8444-555555555555', organization_id: ORG_ID },
        mitigationItems: [{ id: 'm1', title: 'Hazard 1' }],
      })
      const { GET } = await import('@/app/api/v1/hazards/route')
      const res = await GET(requestWithAuth(VALID_KEY, { url: 'http://localhost/api/v1/hazards?job_id=11111111-2222-4333-8444-555555555555&page=1&limit=20' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.meta).toEqual({ page: 1, limit: 20, total: expect.any(Number) })
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
    })
  })

  describe('POST /api/v1/hazards', () => {
    it('returns 400 INVALID_FORMAT when body is null', async () => {
      const { POST } = await import('@/app/api/v1/hazards/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', url: 'http://localhost/api/v1/hazards', body: null }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error?.code).toBe('INVALID_FORMAT')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('returns 400 INVALID_FORMAT when body is an array', async () => {
      const { POST } = await import('@/app/api/v1/hazards/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', url: 'http://localhost/api/v1/hazards', body: [] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error?.code).toBe('INVALID_FORMAT')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('returns 400 INVALID_FORMAT when body is a primitive', async () => {
      const { POST } = await import('@/app/api/v1/hazards/route')
      const res = await POST(requestWithAuth(VALID_KEY, { method: 'POST', url: 'http://localhost/api/v1/hazards', body: 42 }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error?.code).toBe('INVALID_FORMAT')
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })
  })

  describe('GET /api/v1/reports', () => {
    it('returns 401 when Authorization is missing', async () => {
      const { GET } = await import('@/app/api/v1/reports/route')
      const res = await GET(requestWithAuth(null, { url: 'http://localhost/api/v1/reports?job_id=11111111-2222-4333-8444-555555555555' }))
      expect(res.status).toBe(401)
    })

    it('returns 403 when key lacks reports:read scope', async () => {
      apiKeysMaybeSingle.mockResolvedValue({
        data: { ...validKeyRow, scopes: ['jobs:read'] },
        error: null,
      })
      const { GET } = await import('@/app/api/v1/reports/route')
      const res = await GET(requestWithAuth(VALID_KEY, { url: 'http://localhost/api/v1/reports?job_id=11111111-2222-4333-8444-555555555555' }))
      expect(res.status).toBe(403)
    })

    it('returns 200 with data and pagination meta', async () => {
      setupSupabaseMocks({
        jobSingle: { id: '11111111-2222-4333-8444-555555555555', organization_id: ORG_ID },
        reportRuns: [{ id: 'r1', job_id: '11111111-2222-4333-8444-555555555555' }],
      })
      const { GET } = await import('@/app/api/v1/reports/route')
      const res = await GET(requestWithAuth(VALID_KEY, { url: 'http://localhost/api/v1/reports?job_id=11111111-2222-4333-8444-555555555555&page=1&limit=20' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.meta).toEqual({ page: 1, limit: 20, total: expect.any(Number) })
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
    })

    it('returns list response with only documented v1 report run fields', async () => {
      const reportRunPublicFields = [
        'id', 'job_id', 'status', 'packet_type', 'generated_at', 'data_hash',
        'pdf_path', 'pdf_signed_url', 'pdf_generated_at', 'created_at', 'updated_at',
      ].sort()
      setupSupabaseMocks({
        jobSingle: { id: '11111111-2222-4333-8444-555555555555', organization_id: ORG_ID },
        reportRuns: [
          {
            id: 'r1',
            job_id: '11111111-2222-4333-8444-555555555555',
            organization_id: ORG_ID,
            status: 'completed',
            generated_at: '2025-01-01T00:00:00Z',
            data_hash: 'abc',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
      })
      const { GET } = await import('@/app/api/v1/reports/route')
      const res = await GET(requestWithAuth(VALID_KEY, { url: 'http://localhost/api/v1/reports?job_id=11111111-2222-4333-8444-555555555555' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      for (const item of body.data) {
        const keys = Object.keys(item).sort()
        expect(keys).toEqual(reportRunPublicFields)
      }
    })
  })

  describe('GET /api/v1/reports/[id]', () => {
    it('returns 401 when Authorization is missing', async () => {
      const { GET } = await import('@/app/api/v1/reports/[id]/route')
      const res = await GET(requestWithAuth(null), { params: Promise.resolve({ id: '11111111-2222-4333-8444-555555555555' }) })
      expect(res.status).toBe(401)
    })

    it('returns 403 when key lacks reports:read scope', async () => {
      apiKeysMaybeSingle.mockResolvedValue({
        data: { ...validKeyRow, scopes: ['jobs:read'] },
        error: null,
      })
      const { GET } = await import('@/app/api/v1/reports/[id]/route')
      const res = await GET(requestWithAuth(VALID_KEY), { params: Promise.resolve({ id: '11111111-2222-4333-8444-555555555555' }) })
      expect(res.status).toBe(403)
    })

    it('returns 200 with report and signatures when found', async () => {
      const reportRun = { id: '11111111-2222-4333-8444-555555555555', organization_id: ORG_ID }
      setupSupabaseMocks({ reportSingle: reportRun, reportSignatures: [] })
      const { GET } = await import('@/app/api/v1/reports/[id]/route')
      const res = await GET(requestWithAuth(VALID_KEY), { params: Promise.resolve({ id: reportRun.id }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('1000')
      const body = await res.json()
      expect(body.data).toBeDefined()
    })
  })
})
