/**
 * Tests for getBulkAuth in app/api/jobs/bulk/shared.ts.
 * Verifies 403 with ORGANIZATION_SELECTION_REQUIRED / ORGANIZATION_NOT_ACCESSIBLE / NO_ORGANIZATION
 * for org-access denials instead of 500.
 */

import { NextRequest } from 'next/server'
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/adminAuth'

const ORG_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const USER_ID = 'user-11111111-2222-4333-8444-555555555555'

jest.mock('@/lib/utils/organizationGuard', () => ({
  getOrganizationContext: jest.fn(),
}))

function request(headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/jobs/bulk/status', {
    method: 'POST',
    body: JSON.stringify({ job_ids: ['job-1'] }),
    headers: {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    },
  })
}

describe('getBulkAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockResolvedValue({
      organization_id: ORG_ID,
      user_id: USER_ID,
    })
  })

  it('returns organization_id and user_id when getOrganizationContext succeeds', async () => {
    const { getBulkAuth } = await import('@/app/api/jobs/bulk/shared')
    const result = await getBulkAuth(request())

    expect('errorResponse' in result).toBe(false)
    expect(result).toEqual({ organization_id: ORG_ID, user_id: USER_ID })
  })

  it('returns 401 with UNAUTHORIZED when UnauthorizedError', async () => {
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockRejectedValue(new UnauthorizedError('Unauthorized: User not authenticated'))

    const { getBulkAuth } = await import('@/app/api/jobs/bulk/shared')
    const result = await getBulkAuth(request())

    expect(result).toHaveProperty('errorResponse')
    const res = (result as { errorResponse: Response }).errorResponse
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 with ORGANIZATION_SELECTION_REQUIRED when multi-membership and no selector', async () => {
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockRejectedValue(
      new ForbiddenError(
        'User belongs to multiple organizations. Provide X-Organization-Id header or organization_id query parameter.'
      )
    )

    const { getBulkAuth } = await import('@/app/api/jobs/bulk/shared')
    const result = await getBulkAuth(request())

    expect(result).toHaveProperty('errorResponse')
    const res = (result as { errorResponse: Response }).errorResponse
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('ORGANIZATION_SELECTION_REQUIRED')
  })

  it('returns 403 with ORGANIZATION_NOT_ACCESSIBLE when selector is not a membership', async () => {
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockRejectedValue(
      new ForbiddenError('The specified organization is not one of your memberships.')
    )

    const { getBulkAuth } = await import('@/app/api/jobs/bulk/shared')
    const result = await getBulkAuth(request({ 'X-Organization-Id': 'other-org-id' }))

    expect(result).toHaveProperty('errorResponse')
    const res = (result as { errorResponse: Response }).errorResponse
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('ORGANIZATION_NOT_ACCESSIBLE')
  })

  it('returns 403 with NO_ORGANIZATION when user has no organization membership', async () => {
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockRejectedValue(new ForbiddenError('User has no organization membership'))

    const { getBulkAuth } = await import('@/app/api/jobs/bulk/shared')
    const result = await getBulkAuth(request())

    expect(result).toHaveProperty('errorResponse')
    const res = (result as { errorResponse: Response }).errorResponse
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('NO_ORGANIZATION')
  })

  it('returns 500 with QUERY_ERROR when generic backend/query error', async () => {
    const { getOrganizationContext } = require('@/lib/utils/organizationGuard')
    getOrganizationContext.mockRejectedValue(new Error('Failed to get organization ID'))

    const { getBulkAuth } = await import('@/app/api/jobs/bulk/shared')
    const result = await getBulkAuth(request())

    expect(result).toHaveProperty('errorResponse')
    const res = (result as { errorResponse: Response }).errorResponse
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.code).toBe('QUERY_ERROR')
  })
})
