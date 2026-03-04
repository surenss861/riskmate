/**
 * Tests for POST /api/jobs/bulk proxy: delegated fetch target must use
 * server-controlled canonical origin only; request Host/URL must not influence target.
 */

import { NextRequest } from 'next/server'

const TRUSTED_ORIGIN = 'https://trusted.example.com'

jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  APP_ORIGIN: TRUSTED_ORIGIN,
  APP_ORIGIN_ALLOWED_PATTERN: /^https?:\/\/trusted\.example\.com(\/|$)/i,
  isAppOriginLocalhost: () => false,
  isProductionNonVercel: () => false,
}))

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue(
    new Response(JSON.stringify({ results: [], summary: { succeeded: 0, failed: 0 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
  global.fetch = fetchMock
})

describe('POST /api/jobs/bulk – delegated fetch target', () => {
  it('uses APP_ORIGIN for target URL; request host does not influence fetch target', async () => {
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const maliciousOrigin = 'https://evil-attacker.com'
    const request = new NextRequest(`${maliciousOrigin}/api/jobs/bulk`, {
      method: 'POST',
      body: JSON.stringify({ action: 'status', job_ids: ['job-1'] }),
      headers: {
        'Content-Type': 'application/json',
        Host: 'evil-attacker.com',
        Authorization: 'Bearer secret',
        Cookie: 'session=abc',
      },
    })

    await POST(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl] = fetchMock.mock.calls[0]
    expect(targetUrl).toBe(`${TRUSTED_ORIGIN}/api/jobs/bulk/status`)
    expect(targetUrl).not.toContain('evil-attacker')
    expect(targetUrl).not.toContain(maliciousOrigin)
  })

  it('delegates to correct sub-route for action=delete', async () => {
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', job_ids: ['job-1'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(fetchMock).toHaveBeenCalledWith(
      `${TRUSTED_ORIGIN}/api/jobs/bulk/delete`,
      expect.any(Object)
    )
  })
})

describe('POST /api/jobs/bulk – transport errors', () => {
  it('returns 502 and structured JSON when fetch throws (e.g. DNS failure)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'))
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'status', job_ids: ['job-1'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(request)
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body).toMatchObject({
      code: 'BULK_DELEGATION_ERROR',
      message: expect.stringMatching(/connectivity|failed/i),
    })
    expect(typeof body.message).toBe('string')
  })

  it('returns 502 and stable code when fetch throws TypeError (e.g. network)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'assign', job_ids: ['j1'], worker_id: 'w1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(request)
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.code).toBe('BULK_DELEGATION_ERROR')
    expect(body.message).toBeDefined()
  })
})

describe('POST /api/jobs/bulk – organization selector forwarding', () => {
  it('forwards X-Organization-Id header to delegated sub-route', async () => {
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'status', job_ids: ['job-1'] }),
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': 'org-selected-123',
      },
    })

    await POST(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl, opts] = fetchMock.mock.calls[0]
    expect(targetUrl).toBe(`${TRUSTED_ORIGIN}/api/jobs/bulk/status`)
    expect(opts?.headers?.get?.('x-organization-id') ?? opts?.headers?.['x-organization-id']).toBe('org-selected-123')
  })

  it('propagates organization_id query param to delegated target URL', async () => {
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk?organization_id=org-query-456', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', job_ids: ['job-1'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl] = fetchMock.mock.calls[0]
    expect(targetUrl).toBe(`${TRUSTED_ORIGIN}/api/jobs/bulk/delete?organization_id=org-query-456`)
  })

  it('forwards both X-Organization-Id and organization_id when present (POST)', async () => {
    const { POST } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk?organization_id=org-query-789', {
      method: 'POST',
      body: JSON.stringify({ action: 'assign', job_ids: ['j1'], worker_id: 'w1' }),
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': 'org-header-789',
      },
    })

    await POST(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl, opts] = fetchMock.mock.calls[0]
    expect(targetUrl).toContain('organization_id=org-query-789')
    const headerVal = opts?.headers?.get?.('x-organization-id') ?? opts?.headers?.['x-organization-id']
    expect(headerVal).toBe('org-header-789')
  })
})

describe('PATCH /api/jobs/bulk – organization selector forwarding', () => {
  it('forwards X-Organization-Id and organization_id to delegated sub-route', async () => {
    const { PATCH } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk?organization_id=org-patch-1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'status', job_ids: ['job-1'], status: 'in_progress' }),
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': 'org-patch-header',
      },
    })

    await PATCH(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl, opts] = fetchMock.mock.calls[0]
    expect(targetUrl).toBe(`${TRUSTED_ORIGIN}/api/jobs/bulk/status?organization_id=org-patch-1`)
    const headerVal = opts?.headers?.get?.('x-organization-id') ?? opts?.headers?.['x-organization-id']
    expect(headerVal).toBe('org-patch-header')
  })
})

describe('DELETE /api/jobs/bulk – organization selector forwarding', () => {
  it('forwards organization_id query and X-Organization-Id to delegated sub-route', async () => {
    const { DELETE } = await import('@/app/api/jobs/bulk/route')
    const request = new NextRequest('https://any-host/api/jobs/bulk?organization_id=org-delete-1', {
      method: 'DELETE',
      body: JSON.stringify({ job_ids: ['job-1'] }),
      headers: {
        'Content-Type': 'application/json',
        'X-Organization-Id': 'org-delete-header',
      },
    })

    await DELETE(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [targetUrl, opts] = fetchMock.mock.calls[0]
    expect(targetUrl).toBe(`${TRUSTED_ORIGIN}/api/jobs/bulk/delete?organization_id=org-delete-1`)
    const headerVal = opts?.headers?.get?.('x-organization-id') ?? opts?.headers?.['x-organization-id']
    expect(headerVal).toBe('org-delete-header')
  })
})
