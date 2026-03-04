/**
 * Unit tests for getOrganizationContextWithMemberships (organizationGuard).
 * Covers legacy path: users.organization_id present + empty organization_members.
 */

import { NextRequest } from 'next/server'
import { getOrganizationContextWithMemberships } from '@/lib/utils/organizationGuard'

const ORG_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const USER_ID = 'user-11111111-2222-4333-8444-555555555555'

function createChain() {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  }
  return chain
}

let serverGetUserMock: jest.Mock
let mockUsersChain: ReturnType<typeof createChain>
let mockOrgMembersChain: ReturnType<typeof createChain>
let mockOrgsChain: ReturnType<typeof createChain>

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: (...args: unknown[]) => serverGetUserMock(...args),
    },
  }),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: (table: string) => {
      if (table === 'users') return mockUsersChain
      if (table === 'organization_members') return mockOrgMembersChain
      if (table === 'organizations') return mockOrgsChain
      return createChain()
    },
  }),
}))

function request(headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/me/context', {
    method: 'GET',
    headers: headers ?? { Authorization: `Bearer token-${USER_ID}` },
  })
}

describe('getOrganizationContextWithMemberships', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    serverGetUserMock = jest.fn().mockImplementation((token?: string) => {
      if (token !== undefined) {
        return Promise.resolve({ data: { user: { id: USER_ID } }, error: null })
      }
      return Promise.resolve({ data: { user: null }, error: null })
    })

    mockUsersChain = createChain()
    mockUsersChain.maybeSingle.mockResolvedValue({
      data: { organization_id: ORG_A, role: 'member' },
      error: null,
    })

    mockOrgMembersChain = createChain()
    mockOrgMembersChain.order.mockResolvedValue({ data: [], error: null })
    mockOrgMembersChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    mockOrgsChain = createChain()
    mockOrgsChain.in.mockResolvedValue({
      data: [{ id: ORG_A, name: 'Legacy Org' }],
      error: null,
    })
  })

  it('returns context when users.organization_id is present and organization_members is empty (legacy path)', async () => {
    const result = await getOrganizationContextWithMemberships(request())

    expect(result.organization_id).toBe(ORG_A)
    expect(result.user_id).toBe(USER_ID)
    expect(result.user_role).toBe('member')
    expect(result.memberships).toHaveLength(1)
    expect(result.memberships[0]).toEqual({ id: ORG_A, name: 'Legacy Org' })
  })
})

describe('getOrganizationContextWithMemberships (org-scoped role)', () => {
  const ORG_B = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'

  beforeEach(() => {
    jest.clearAllMocks()
    serverGetUserMock = jest.fn().mockImplementation((token?: string) => {
      if (token !== undefined) {
        return Promise.resolve({ data: { user: { id: USER_ID } }, error: null })
      }
      return Promise.resolve({ data: { user: null }, error: null })
    })

    mockUsersChain = createChain()
    mockUsersChain.maybeSingle.mockResolvedValue({
      data: { organization_id: ORG_A, role: 'admin' },
      error: null,
    })

    mockOrgMembersChain = createChain()
    mockOrgMembersChain.order.mockResolvedValue({
      data: [
        { organization_id: ORG_A },
        { organization_id: ORG_B },
      ],
      error: null,
    })
    mockOrgMembersChain.maybeSingle.mockImplementation(({ data }: { data?: { role: string } } = {}) => {
      return Promise.resolve({ data: data ?? null, error: null })
    })

    mockOrgsChain = createChain()
    mockOrgsChain.in.mockResolvedValue({
      data: [
        { id: ORG_A, name: 'Org A' },
        { id: ORG_B, name: 'Org B' },
      ],
      error: null,
    })
  })

  it('honors X-Organization-Id for role derivation when multiple memberships', async () => {
    mockOrgMembersChain.maybeSingle.mockImplementation(() => {
      const eqCalls = mockOrgMembersChain.eq.mock.calls as [string, string][]
      const orgEq = eqCalls.find((c) => c[0] === 'organization_id')
      const orgId = orgEq?.[1]
      const role = orgId === ORG_B ? 'member' : 'admin'
      return Promise.resolve({ data: { role }, error: null })
    })

    const req = request({ Authorization: `Bearer token-${USER_ID}`, 'X-Organization-Id': ORG_B })
    const result = await getOrganizationContextWithMemberships(req)

    expect(result.organization_id).toBe(ORG_B)
    expect(result.user_role).toBe('member')
    expect(result.memberships).toHaveLength(2)
  })
})
