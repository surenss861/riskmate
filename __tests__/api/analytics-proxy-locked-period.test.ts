/**
 * Route-level tests: locked proxy analytics responses (compliance-rate, hazard-frequency,
 * job-completion) derive period metadata from explicit since/until when provided,
 * matching risk-heatmap and team-performance behavior.
 */

import { NextRequest } from 'next/server'

const REQUEST_ID = 'req-proxy-locked-123'

let proxyToBackendMock: jest.Mock

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

jest.mock('@/lib/api/proxy-helpers', () => ({
  proxyToBackend: jest.fn(),
}))

function requestFor(path: string, params?: { period?: string; since?: string; until?: string }) {
  const search = new URLSearchParams()
  if (params?.period != null) search.set('period', params.period)
  if (params?.since != null) search.set('since', params.since)
  if (params?.until != null) search.set('until', params.until)
  const qs = search.toString()
  const url = `http://localhost${path}${qs ? `?${qs}` : ''}`
  return new NextRequest(url) as NextRequest
}

async function setupLockedContext() {
  const { getAnalyticsContext } = await import('@/lib/utils/analyticsAuth')
  ;(getAnalyticsContext as jest.Mock).mockResolvedValue({
    orgId: 'org-1',
    requestId: REQUEST_ID,
    hasAnalytics: false,
    isActive: true,
    status: 'none',
    supabase: {},
  })
}

describe('GET /api/analytics/compliance-rate locked response period parity', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    proxyToBackendMock = jest.fn()
    const proxyHelpers = await import('@/lib/api/proxy-helpers')
    ;(proxyHelpers.proxyToBackend as jest.Mock).mockImplementation(proxyToBackendMock)
    await setupLockedContext()
    const mod = await import('@/app/api/analytics/compliance-rate/route')
    GET = mod.GET
  })

  it('locked response includes period from period=30d', async () => {
    const res = await GET(requestFor('/api/analytics/compliance-rate', { period: '30d' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ period: '30d', locked: true })
  })

  it('locked response includes period from explicit since/until (custom range)', async () => {
    const res = await GET(
      requestFor('/api/analytics/compliance-rate', { since: '2025-01-01', until: '2025-01-10' })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ period: '10d', locked: true })
  })
})

describe('GET /api/analytics/hazard-frequency locked response period parity', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    proxyToBackendMock = jest.fn()
    const proxyHelpers = await import('@/lib/api/proxy-helpers')
    ;(proxyHelpers.proxyToBackend as jest.Mock).mockImplementation(proxyToBackendMock)
    await setupLockedContext()
    const mod = await import('@/app/api/analytics/hazard-frequency/route')
    GET = mod.GET
  })

  it('locked response includes period from period=30d', async () => {
    const res = await GET(requestFor('/api/analytics/hazard-frequency', { period: '30d' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ period: '30d', locked: true })
  })

  it('locked response includes period from explicit since/until (custom range)', async () => {
    const res = await GET(
      requestFor('/api/analytics/hazard-frequency', { since: '2025-01-01', until: '2025-01-10' })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ period: '10d', locked: true })
  })
})

describe('GET /api/analytics/job-completion locked response period parity', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()
    proxyToBackendMock = jest.fn()
    const proxyHelpers = await import('@/lib/api/proxy-helpers')
    ;(proxyHelpers.proxyToBackend as jest.Mock).mockImplementation(proxyToBackendMock)
    await setupLockedContext()
    const mod = await import('@/app/api/analytics/job-completion/route')
    GET = mod.GET
  })

  it('locked response includes period from period=30d', async () => {
    const res = await GET(requestFor('/api/analytics/job-completion', { period: '30d' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ period: '30d', locked: true })
  })

  it('locked response includes period from explicit since/until (custom range)', async () => {
    const res = await GET(
      requestFor('/api/analytics/job-completion', { since: '2025-01-01', until: '2025-01-10' })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ period: '10d', locked: true })
  })
})
