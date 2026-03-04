/**
 * Unit tests for selected organization storage and bootstrap.
 * Ensures get/set persist correctly and bootstrap sets/validates org for single/multi membership.
 */

const STORAGE_KEY = 'riskmate_selected_org_id'

describe('selectedOrganization', () => {
  let storage: Record<string, string>

  beforeAll(() => {
    storage = {}
    Object.defineProperty(global, 'window', {
      value: {
        get sessionStorage() {
          return {
            getItem: (k: string) => storage[k] ?? null,
            setItem: (k: string, v: string) => {
              storage[k] = v
            },
            removeItem: (k: string) => {
              delete storage[k]
            },
          }
        },
      },
      writable: true,
    })
  })

  afterEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k])
  })

  afterAll(() => {
    // @ts-expect-error - delete global.window for other tests
    delete global.window
  })

  describe('getSelectedOrganizationId / setSelectedOrganizationId', () => {
    it('returns null when nothing is set', async () => {
      const { getSelectedOrganizationId } = await import('@/lib/selectedOrganization')
      expect(getSelectedOrganizationId()).toBeNull()
    })

    it('returns set value after setSelectedOrganizationId', async () => {
      const { getSelectedOrganizationId, setSelectedOrganizationId } = await import('@/lib/selectedOrganization')
      setSelectedOrganizationId('org-123')
      expect(getSelectedOrganizationId()).toBe('org-123')
    })

    it('returns null after setSelectedOrganizationId(null)', async () => {
      const { getSelectedOrganizationId, setSelectedOrganizationId } = await import('@/lib/selectedOrganization')
      setSelectedOrganizationId('org-123')
      setSelectedOrganizationId(null)
      expect(getSelectedOrganizationId()).toBeNull()
    })
  })
})

describe('runSelectedOrganizationBootstrap', () => {
  let storage: Record<string, string>

  beforeAll(() => {
    storage = {}
    Object.defineProperty(global, 'window', {
      value: {
        get sessionStorage() {
          return {
            getItem: (k: string) => storage[k] ?? null,
            setItem: (k: string, v: string) => {
              storage[k] = v
            },
            removeItem: (k: string) => {
              delete storage[k]
            },
          }
        },
      },
      writable: true,
    })
  })

  beforeEach(() => {
    jest.resetModules()
    Object.keys(storage).forEach((k) => delete storage[k])
  })

  afterAll(() => {
    // @ts-expect-error - delete global.window for other tests
    delete global.window
  })

  it('sets selected org when single membership', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user_role: 'owner', organization_id: 'org-one', memberships: [{ id: 'org-one', name: 'Org One' }] }),
    })
    global.fetch = fetchMock

    const { runSelectedOrganizationBootstrap } = await import('@/lib/selectedOrganizationBootstrap')
    await runSelectedOrganizationBootstrap('token')
    const mod = await import('@/lib/selectedOrganization')
    expect(mod.getSelectedOrganizationId()).toBe('org-one')
  })

  it('clears selection when multi membership and current not in list', async () => {
    const { setSelectedOrganizationId, getSelectedOrganizationId } = await import('@/lib/selectedOrganization')
    setSelectedOrganizationId('org-old')
    expect(getSelectedOrganizationId()).toBe('org-old')

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user_role: 'owner',
        organization_id: 'org-one',
        memberships: [
          { id: 'org-one', name: 'Org One' },
          { id: 'org-two', name: 'Org Two' },
        ],
      }),
    })
    global.fetch = fetchMock

    const { runSelectedOrganizationBootstrap } = await import('@/lib/selectedOrganizationBootstrap')
    await runSelectedOrganizationBootstrap('token')
    expect(getSelectedOrganizationId()).toBeNull()
  })

  it('keeps selection when multi membership and current in list', async () => {
    const { setSelectedOrganizationId, getSelectedOrganizationId } = await import('@/lib/selectedOrganization')
    setSelectedOrganizationId('org-two')
    expect(getSelectedOrganizationId()).toBe('org-two')

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user_role: 'owner',
        organization_id: 'org-one',
        memberships: [
          { id: 'org-one', name: 'Org One' },
          { id: 'org-two', name: 'Org Two' },
        ],
      }),
    })
    global.fetch = fetchMock

    const { runSelectedOrganizationBootstrap } = await import('@/lib/selectedOrganizationBootstrap')
    await runSelectedOrganizationBootstrap('token')
    expect(getSelectedOrganizationId()).toBe('org-two')
  })
})
