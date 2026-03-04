/**
 * Integration test: selected organization is sent as header/query when making API requests.
 * Mocks fetch, Supabase client, and selectedOrganization so we can assert request shape.
 */

const getSelectedOrganizationIdMock = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'mock-token' } }, error: null }),
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
    },
  }),
}))

jest.mock('@/lib/selectedOrganization', () => ({
  getSelectedOrganizationId: (...args: unknown[]) => getSelectedOrganizationIdMock(...args),
  setSelectedOrganizationId: () => {},
}))

describe('API client sends selected organization (integration)', () => {
  let fetchMock: jest.Mock

  beforeAll(() => {
    ;(global as any).window = {}
  })

  afterAll(() => {
    delete (global as any).window
  })

  beforeEach(() => {
    jest.clearAllMocks()
    const responseBody = { org_id: 'org-1', range_days: 30, job_counts_by_status: {}, risk_level_distribution: {}, evidence_statistics: { total_items: 0, jobs_with_evidence: 0, jobs_without_evidence: 0 }, team_activity: [] }
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    })
    global.fetch = fetchMock
  })

  it('includes X-Organization-Id and organization_id in request when selected org is set', async () => {
    getSelectedOrganizationIdMock.mockReturnValue('org-selected-123')
    const { analyticsApi } = await import('@/lib/api')
    await analyticsApi.summary({ range: '30d' })
    expect(fetchMock).toHaveBeenCalled()
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('organization_id=org-selected-123')
    expect((options?.headers as Record<string, string>)?.['X-Organization-Id']).toBe('org-selected-123')
  })

  it('does not include org when none selected', async () => {
    getSelectedOrganizationIdMock.mockReturnValue(null)
    const { analyticsApi } = await import('@/lib/api')
    await analyticsApi.summary({ range: '30d' })
    expect(fetchMock).toHaveBeenCalled()
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).not.toMatch(/organization_id=/)
    expect((options?.headers as Record<string, string>)?.['X-Organization-Id']).toBeUndefined()
  })
})
