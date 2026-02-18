/**
 * Unit tests for Next bulk delete endpoint: jobs with documents/evidence
 * are rejected with HAS_EVIDENCE, matching backend behavior.
 */

import { NextRequest } from 'next/server'

const JOB_ID_WITH_DOC = '11111111-2222-4333-8444-555566667777'
const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const USER_ID = 'cccccccc-dddd-4eee-8fff-000011112222'

let bulkDeleteSupabaseMock: ReturnType<typeof buildSupabaseMock>

function buildChainableMock(returnData: unknown) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error: null }),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: returnData, error: null }).then(resolve),
  }
  return chain
}

function buildSupabaseMock(
  jobId: string,
  opts: { hasDocuments?: boolean; hasEvidence?: boolean } = {}
) {
  const { hasDocuments = true, hasEvidence = false } = opts
  const from = jest.fn((table: string) => {
    if (table === 'users') return buildChainableMock({ role: 'owner' })
    if (table === 'jobs') {
      return buildChainableMock([
        { id: jobId, status: 'draft', deleted_at: null, archived_at: null },
      ])
    }
    if (table === 'audit_logs') return buildChainableMock([])
    if (table === 'documents') {
      return buildChainableMock(hasDocuments ? [{ job_id: jobId }] : [])
    }
    if (table === 'evidence') {
      return buildChainableMock(hasEvidence ? [{ work_record_id: jobId }] : [])
    }
    if (table === 'job_risk_scores' || table === 'reports') return buildChainableMock([])
    return buildChainableMock([])
  })
  return {
    from,
    rpc: jest.fn().mockResolvedValue({ error: null }),
  }
}

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(bulkDeleteSupabaseMock)),
}))

jest.mock('@/lib/utils/organizationGuard', () => ({
  getOrganizationContext: jest.fn().mockResolvedValue({
    organization_id: ORG_ID,
    user_id: USER_ID,
  }),
}))

describe('Next POST /api/jobs/bulk/delete – HAS_EVIDENCE', () => {
  it('rejects jobs with documents with code HAS_EVIDENCE (matching backend)', async () => {
    bulkDeleteSupabaseMock = buildSupabaseMock(JOB_ID_WITH_DOC, { hasDocuments: true, hasEvidence: false })
    const { POST } = await import('@/app/api/jobs/bulk/delete/route')
    const request = new NextRequest('http://localhost/api/jobs/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ job_ids: [JOB_ID_WITH_DOC] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
    expect(body.data.succeeded).toEqual([])
    const failed = body.data.failed ?? []
    const hasEvidenceFailure = failed.find(
      (f: { id: string; code: string }) => f.id === JOB_ID_WITH_DOC && f.code === 'HAS_EVIDENCE'
    )
    expect(hasEvidenceFailure).toBeDefined()
    expect(hasEvidenceFailure?.message).toMatch(/evidence|cannot be deleted/i)
  })

  it('rejects jobs with evidence (evidence table) with code HAS_EVIDENCE', async () => {
    const jobIdWithEvidence = '22222222-3333-4444-8555-666677778888'
    bulkDeleteSupabaseMock = buildSupabaseMock(jobIdWithEvidence, {
      hasDocuments: false,
      hasEvidence: true,
    })
    const { POST } = await import('@/app/api/jobs/bulk/delete/route')
    const request = new NextRequest('http://localhost/api/jobs/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ job_ids: [jobIdWithEvidence] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.succeeded).toEqual([])
    const failed = body.data.failed ?? []
    const hasEvidenceFailure = failed.find(
      (f: { id: string; code: string }) =>
        f.id === jobIdWithEvidence && f.code === 'HAS_EVIDENCE'
    )
    expect(hasEvidenceFailure).toBeDefined()
  })
})
