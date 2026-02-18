/**
 * Unit tests for Next bulk export endpoint: response includes poll_url
 * so clients can fetch status and download URL when ready.
 */

import { NextRequest } from 'next/server'

const JOB_ID = '11111111-2222-4333-8444-555566667777'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const USER_ID = 'cccccccc-dddd-4eee-8fff-000011112222'
const EXPORT_ID = 'export-uuid-12345'

const buildChainableMock = (returnData: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: returnData, error: null }),
  then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: returnData, error: null }).then(resolve),
})

let exportSupabaseMock: {
  from: jest.Mock
  storage?: unknown
}

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(exportSupabaseMock)),
}))

jest.mock('@/lib/utils/organizationGuard', () => ({
  getOrganizationContext: jest.fn().mockResolvedValue({
    organization_id: ORG_ID,
    user_id: USER_ID,
  }),
}))

jest.mock('@/lib/utils/permissions', () => ({
  hasPermission: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/audit/auditLogger', () => ({
  recordAuditLog: jest.fn().mockResolvedValue(undefined),
}))

describe('Next POST /api/jobs/bulk/export – poll_url and retrieval pointer', () => {
  beforeEach(() => {
    exportSupabaseMock = {
      from: jest.fn((table: string) => {
        if (table === 'users') return buildChainableMock({ role: 'owner' })
        if (table === 'jobs') {
          return buildChainableMock([
            { id: JOB_ID, client_name: 'Test', job_type: 'inspection', location: null, status: 'draft', risk_score: null, risk_level: null, owner_name: null, created_at: '', updated_at: '' },
          ])
        }
        if (table === 'exports') {
          const chain = {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: EXPORT_ID }, error: null }),
          }
          return chain
        }
        return buildChainableMock([])
      }),
    }
  })

  it('returns poll_url and export_id so client can fetch download URL when ready', async () => {
    const { POST } = await import('@/app/api/jobs/bulk/export/route')
    const request = new NextRequest('http://localhost/api/jobs/bulk/export', {
      method: 'POST',
      body: JSON.stringify({ job_ids: [JOB_ID], formats: ['csv'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.success).toBe(true)
    expect(body.export_id).toBe(EXPORT_ID)
    expect(body.status).toBe('queued')
    expect(body.poll_url).toBe(`/api/exports/${EXPORT_ID}`)
    expect(body.poll_url).toMatch(/^\/api\/exports\/[\w-]+$/)
  })
})
