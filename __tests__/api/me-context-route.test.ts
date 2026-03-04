/**
 * Route tests for GET /api/me/context: bootstrap and org switcher context.
 * Covers multi-membership (no selector required), single membership, and error mapping (401/403/500).
 */

import { NextRequest } from 'next/server'
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/adminAuth'

const ORG_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ORG_B = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const USER_ID = 'user-11111111-2222-4333-8444-555555555555'

jest.mock('@/lib/utils/organizationGuard', () => ({
  getOrganizationContextWithMemberships: jest.fn(),
  getOrganizationContext: jest.fn(),
}))

function request(headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/me/context', {
    method: 'GET',
    headers: headers ?? { Authorization: `Bearer token-${USER_ID}` },
  })
}

describe('GET /api/me/context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with user_role, organization_id, and memberships when multi-membership and no selector', async () => {
    const { getOrganizationContextWithMemberships } = require('@/lib/utils/organizationGuard')
    getOrganizationContextWithMemberships.mockResolvedValue({
      user_role: 'admin',
      organization_id: ORG_A,
      user_id: USER_ID,
      memberships: [
        { id: ORG_A, name: 'Org A' },
        { id: ORG_B, name: 'Org B' },
      ],
    })

    const { GET } = await import('@/app/api/me/context/route')
    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user_role).toBe('admin')
    expect(body.organization_id).toBe(ORG_A)
    expect(body.memberships).toHaveLength(2)
    expect(body.memberships.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining([ORG_A, ORG_B]))
  })

  it('returns 200 with single membership when selector not provided', async () => {
    const { getOrganizationContextWithMemberships } = require('@/lib/utils/organizationGuard')
    getOrganizationContextWithMemberships.mockResolvedValue({
      user_role: 'owner',
      organization_id: ORG_A,
      user_id: USER_ID,
      memberships: [{ id: ORG_A, name: 'Only Org' }],
    })

    const { GET } = await import('@/app/api/me/context/route')
    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.organization_id).toBe(ORG_A)
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0].id).toBe(ORG_A)
  })

  it('returns 200 when user has only users.organization_id (empty organization_members) - legacy/invited path', async () => {
    const { getOrganizationContextWithMemberships } = require('@/lib/utils/organizationGuard')
    getOrganizationContextWithMemberships.mockResolvedValue({
      user_role: 'member',
      organization_id: ORG_A,
      user_id: USER_ID,
      memberships: [{ id: ORG_A, name: 'Legacy Org' }],
    })

    const { GET } = await import('@/app/api/me/context/route')
    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.user_role).toBe('member')
    expect(body.organization_id).toBe(ORG_A)
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0]).toEqual({ id: ORG_A, name: 'Legacy Org' })
  })

  it('returns 401 with UNAUTHORIZED when UnauthorizedError', async () => {
    const { getOrganizationContextWithMemberships } = require('@/lib/utils/organizationGuard')
    getOrganizationContextWithMemberships.mockRejectedValue(new UnauthorizedError('Unauthorized: User not authenticated'))

    const { GET } = await import('@/app/api/me/context/route')
    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
    expect(body.ok).toBe(false)
  })

  it('returns 403 with NO_ORGANIZATION when ForbiddenError (no organization membership)', async () => {
    const { getOrganizationContextWithMemberships } = require('@/lib/utils/organizationGuard')
    getOrganizationContextWithMemberships.mockRejectedValue(new ForbiddenError('User has no organization membership'))

    const { GET } = await import('@/app/api/me/context/route')
    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('NO_ORGANIZATION')
    expect(body.ok).toBe(false)
  })

  it('returns 500 with QUERY_ERROR when generic Error', async () => {
    const { getOrganizationContextWithMemberships } = require('@/lib/utils/organizationGuard')
    getOrganizationContextWithMemberships.mockRejectedValue(new Error('Failed to get organization ID'))

    const { GET } = await import('@/app/api/me/context/route')
    const res = await GET(request())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.code).toBe('QUERY_ERROR')
    expect(body.ok).toBe(false)
  })
})
