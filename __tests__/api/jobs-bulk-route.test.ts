/**
 * Tests for POST /api/jobs/bulk proxy: delegated fetch target must use
 * server-controlled canonical origin only; request Host/URL must not influence target.
 */

import { NextRequest } from 'next/server'

const TRUSTED_ORIGIN = 'https://trusted.example.com'

jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  APP_ORIGIN: TRUSTED_ORIGIN,
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
      body: JSON.stringify({ action: 'status', job_ids: [] }),
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
