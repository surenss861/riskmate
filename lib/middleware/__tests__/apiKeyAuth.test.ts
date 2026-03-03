/**
 * Unit tests for Public API Key Authentication Middleware.
 * Covers bearer parsing, prefix rules, requireScope, and getApiKeyContext failure modes.
 */

import { NextRequest } from 'next/server'
import {
  KEY_PREFIX_LIVE,
  KEY_PREFIX_TEST,
  getBearerApiKey,
  getAllowedPrefixesForAuth,
  getDefaultKeyPrefix,
  getKeyPrefix,
  hashApiKey,
  requireScope,
  getApiKeyContext,
  type ApiKeyContext,
} from '../apiKeyAuth'

let adminFromMock: (table: string) => { select: jest.Mock; eq: jest.Mock; maybeSingle: jest.Mock } = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn((table: string) => adminFromMock(table)),
  })),
}))

function requestWithAuth(authValue: string | null): NextRequest {
  const headers = new Headers()
  if (authValue !== null) headers.set('authorization', authValue)
  return new NextRequest('http://localhost/api/v1/jobs', { headers })
}

function setNodeEnv(value: string) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value
}

describe('apiKeyAuth', () => {
  describe('getBearerApiKey', () => {
    const origEnv = process.env.NODE_ENV
    afterEach(() => {
      setNodeEnv(origEnv ?? 'test')
      delete process.env.RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD
    })

    it('returns null when Authorization header is missing', () => {
      expect(getBearerApiKey(requestWithAuth(null))).toBeNull()
    })

    it('returns null when scheme is not Bearer', () => {
      expect(getBearerApiKey(requestWithAuth('Basic abc'))).toBeNull()
      expect(getBearerApiKey(requestWithAuth('Digest x'))).toBeNull()
    })

    it('accepts Bearer scheme case-insensitively', () => {
      setNodeEnv('test')
      expect(getBearerApiKey(requestWithAuth('Bearer rm_test_abc123'))).toBe('rm_test_abc123')
      expect(getBearerApiKey(requestWithAuth('bearer rm_test_abc123'))).toBe('rm_test_abc123')
      expect(getBearerApiKey(requestWithAuth('BEARER rm_test_abc123'))).toBe('rm_test_abc123')
    })

    it('returns null when there is no space after scheme', () => {
      expect(getBearerApiKey(requestWithAuth('Bearerm_test_abc'))).toBeNull()
    })

    it('returns null for token without allowed prefix in test env', () => {
      setNodeEnv('test')
      process.env.RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD = 'false'
      expect(getBearerApiKey(requestWithAuth('Bearer rm_live_abc'))).toBeNull()
      expect(getBearerApiKey(requestWithAuth('Bearer unknown_xxx'))).toBeNull()
    })

    it('returns token when prefix is rm_test_ in test env', () => {
      setNodeEnv('test')
      expect(getBearerApiKey(requestWithAuth('Bearer rm_test_abcd1234abcd1234'))).toBe(
        'rm_test_abcd1234abcd1234'
      )
    })

    it('returns token when prefix is rm_live_ in production', () => {
      setNodeEnv('production')
      expect(getBearerApiKey(requestWithAuth('Bearer rm_live_abcd1234abcd1234'))).toBe(
        'rm_live_abcd1234abcd1234'
      )
    })

    it('returns null for rm_test_ in production', () => {
      setNodeEnv('production')
      expect(getBearerApiKey(requestWithAuth('Bearer rm_test_abcd1234abcd1234'))).toBeNull()
    })

    it('in non-production with RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD accepts rm_live_', () => {
      setNodeEnv('test')
      process.env.RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD = 'true'
      expect(getBearerApiKey(requestWithAuth('Bearer rm_live_abcd1234abcd1234'))).toBe(
        'rm_live_abcd1234abcd1234'
      )
    })
  })

  describe('getAllowedPrefixesForAuth', () => {
    const origEnv = process.env.NODE_ENV
    afterEach(() => {
      setNodeEnv(origEnv ?? 'test')
      delete process.env.RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD
    })

    it('production returns only rm_live_', () => {
      setNodeEnv('production')
      expect(getAllowedPrefixesForAuth()).toEqual([KEY_PREFIX_LIVE])
    })

    it('non-production without flag returns only rm_test_', () => {
      setNodeEnv('test')
      expect(getAllowedPrefixesForAuth()).toEqual([KEY_PREFIX_TEST])
    })

    it('non-production with RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD returns both', () => {
      setNodeEnv('test')
      process.env.RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD = 'true'
      expect(getAllowedPrefixesForAuth()).toEqual([KEY_PREFIX_TEST, KEY_PREFIX_LIVE])
    })

    it('non-production with RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD=1 returns both', () => {
      setNodeEnv('test')
      process.env.RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD = '1'
      expect(getAllowedPrefixesForAuth()).toEqual([KEY_PREFIX_TEST, KEY_PREFIX_LIVE])
    })
  })

  describe('getDefaultKeyPrefix', () => {
    const origEnv = process.env.NODE_ENV
    afterEach(() => {
      setNodeEnv(origEnv ?? 'test')
    })

    it('production returns rm_live_', () => {
      setNodeEnv('production')
      expect(getDefaultKeyPrefix()).toBe(KEY_PREFIX_LIVE)
    })

    it('non-production returns rm_test_', () => {
      setNodeEnv('test')
      expect(getDefaultKeyPrefix()).toBe(KEY_PREFIX_TEST)
    })
  })

  describe('hashApiKey', () => {
    it('returns SHA-256 hex of UTF-8 input', () => {
      const h = hashApiKey('rm_test_abc')
      expect(h).toMatch(/^[a-f0-9]{64}$/)
      expect(hashApiKey('rm_test_abc')).toBe(h)
      expect(hashApiKey('rm_test_abd')).not.toBe(h)
    })
  })

  describe('getKeyPrefix', () => {
    it('returns first 8 chars after rm_live_ for live key', () => {
      expect(getKeyPrefix('rm_live_abcd1234extra')).toBe('rm_live_abcd1234')
    })

    it('returns first 8 chars after rm_test_ for test key', () => {
      expect(getKeyPrefix('rm_test_abcd1234extra')).toBe('rm_test_abcd1234')
    })

    it('returns first 12 chars for unknown prefix', () => {
      expect(getKeyPrefix('unknown_prefix_xxx')).toBe('unknown_pref')
    })
  })

  describe('requireScope', () => {
    const ctx: ApiKeyContext = {
      organization_id: 'org-1',
      api_key_id: 'key-1',
      scopes: ['jobs:read', 'hazards:read'],
    }

    it('returns true when context has one of the allowed scopes', () => {
      expect(requireScope(ctx, ['jobs:read'])).toBe(true)
      expect(requireScope(ctx, ['hazards:read'])).toBe(true)
      expect(requireScope(ctx, ['jobs:write', 'jobs:read'])).toBe(true)
    })

    it('returns false when context has none of the allowed scopes', () => {
      expect(requireScope(ctx, ['reports:read'])).toBe(false)
      expect(requireScope(ctx, ['jobs:write'])).toBe(false)
      expect(requireScope(ctx, [])).toBe(false)
    })
  })

  describe('getApiKeyContext', () => {
    let mockMaybeSingle: jest.Mock
    let mockEq: jest.Mock
    let mockSelect: jest.Mock

    beforeEach(() => {
      setNodeEnv('test')
      mockMaybeSingle = jest.fn()
      mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      adminFromMock = jest.fn((table: string) => ({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      }))
    })

    it('returns auth_failure when no Bearer key', async () => {
      const req = requestWithAuth(null)
      const result = await getApiKeyContext(req)
      expect(result).toEqual({ kind: 'auth_failure' })
      expect(adminFromMock).not.toHaveBeenCalled()
    })

    it('returns auth_failure when key has wrong prefix', async () => {
      const req = requestWithAuth('Bearer unknown_xxx')
      const result = await getApiKeyContext(req)
      expect(result).toEqual({ kind: 'auth_failure' })
    })

    it('returns auth_failure when key not found in DB', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      const req = requestWithAuth('Bearer rm_test_abcd1234abcd1234abcd1234abcd1234')
      const result = await getApiKeyContext(req)
      expect(result).toEqual({ kind: 'auth_failure' })
      expect(adminFromMock).toHaveBeenCalledWith('api_keys')
      expect(mockSelect).toHaveBeenCalledWith('id, organization_id, scopes, revoked_at, expires_at')
      expect(mockEq).toHaveBeenCalledWith('key_hash', expect.any(String))
    })

    it('returns auth_failure when key is revoked', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'key-id',
          organization_id: 'org-id',
          scopes: ['jobs:read'],
          revoked_at: new Date().toISOString(),
          expires_at: null,
        },
        error: null,
      })

      const req = requestWithAuth('Bearer rm_test_abcd1234abcd1234abcd1234abcd1234')
      const result = await getApiKeyContext(req)
      expect(result).toEqual({ kind: 'auth_failure' })
    })

    it('returns auth_failure when key is expired', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'key-id',
          organization_id: 'org-id',
          scopes: ['jobs:read'],
          revoked_at: null,
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
        error: null,
      })

      const req = requestWithAuth('Bearer rm_test_abcd1234abcd1234abcd1234abcd1234')
      const result = await getApiKeyContext(req)
      expect(result).toEqual({ kind: 'auth_failure' })
    })

    it('returns backend_error when Supabase returns error', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      const req = requestWithAuth('Bearer rm_test_abcd1234abcd1234abcd1234abcd1234')
      const result = await getApiKeyContext(req)
      expect(result).toEqual({ kind: 'backend_error' })
    })

    it('returns ok with context when key is valid', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: {
          id: 'key-id',
          organization_id: 'org-id',
          scopes: ['jobs:read', 'jobs:write'],
          revoked_at: null,
          expires_at: null,
        },
        error: null,
      })

      const req = requestWithAuth('Bearer rm_test_abcd1234abcd1234abcd1234abcd1234')
      const result = await getApiKeyContext(req)
      expect(result).toEqual({
        kind: 'ok',
        context: {
          organization_id: 'org-id',
          api_key_id: 'key-id',
          scopes: ['jobs:read', 'jobs:write'],
        },
        keyRow: {
          id: 'key-id',
          organization_id: 'org-id',
          scopes: ['jobs:read', 'jobs:write'],
        },
      })
    })
  })
})
