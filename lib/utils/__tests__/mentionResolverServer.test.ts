/**
 * Tests for plain @mention resolution: strict token extraction and exact-only matching.
 * Verifies that @risk, @job (or other substrings) do not resolve to any user,
 * while exact @Full Name and @email@example.com do.
 */

import {
  extractPlainMentionTokens,
  resolveMentionUserIds,
} from '../mentionResolverServer'
import type { SupabaseClient } from '@supabase/supabase-js'

const ORG_ID = 'test-org-id'
const USERS = [
  { id: 'u1', email: 'email@example.com', full_name: 'Full Name' },
  { id: 'u2', email: 'other@example.com', full_name: 'Risk Manager' },
]

function createMockSupabase(): SupabaseClient {
  const from = (table: string) => ({
    select: (cols: string) => ({
      eq: (_key: string, val: string) => {
        if (table === 'organization_members' && val === ORG_ID) {
          return Promise.resolve({
            data: [{ user_id: 'u1' }, { user_id: 'u2' }],
            error: null,
          })
        }
        return Promise.resolve({ data: [], error: null })
      },
      in: (_key: string, ids: string[]) => {
        if (table === 'users') {
          const data = USERS.filter((u) => ids.includes(u.id))
          return Promise.resolve({ data, error: null })
        }
        return Promise.resolve({ data: [], error: null })
      },
    }),
  })
  return { from } as unknown as SupabaseClient
}

describe('extractPlainMentionTokens', () => {
  it('ignores tokens shorter than 3 chars', () => {
    expect(extractPlainMentionTokens('@ab')).toEqual([])
    expect(extractPlainMentionTokens('@x')).toEqual([])
    expect(extractPlainMentionTokens('@a @xy')).toEqual([])
  })

  it('keeps name-like tokens of length >= 3', () => {
    expect(extractPlainMentionTokens('@risk')).toEqual(['risk'])
    expect(extractPlainMentionTokens('@job')).toEqual(['job'])
    expect(extractPlainMentionTokens('@Full Name')).toEqual(['Full Name'])
  })

  it('keeps full email tokens', () => {
    expect(extractPlainMentionTokens('@email@example.com')).toEqual([
      'email@example.com',
    ])
  })

  it('skips name token when it is local part of an email in the same text', () => {
    const tokens = extractPlainMentionTokens(
      'Contact @user@example.com or @user'
    )
    expect(tokens).toContain('user@example.com')
    expect(tokens).not.toContain('user')
  })

  it('returns empty for empty or non-string input', () => {
    expect(extractPlainMentionTokens('')).toEqual([])
    expect(extractPlainMentionTokens(null as any)).toEqual([])
  })
})

describe('resolveMentionUserIds (plain @mention resolution)', () => {
  it('does not resolve @risk to any user (substring of "Risk Manager")', async () => {
    const mock = createMockSupabase()
    const ids = await resolveMentionUserIds(mock, 'Please check @risk', ORG_ID)
    expect(ids).toEqual([])
  })

  it('does not resolve @job to any user', async () => {
    const mock = createMockSupabase()
    const ids = await resolveMentionUserIds(mock, 'Assign this @job', ORG_ID)
    expect(ids).toEqual([])
  })

  it('resolves exact @Full Name to user u1 (case-insensitive)', async () => {
    const mock = createMockSupabase()
    const ids = await resolveMentionUserIds(mock, 'Hi @Full Name', ORG_ID)
    expect(ids).toContain('u1')
    expect(ids).toHaveLength(1)
  })

  it('resolves exact @email@example.com to user u1', async () => {
    const mock = createMockSupabase()
    const ids = await resolveMentionUserIds(
      mock,
      'Notify @email@example.com',
      ORG_ID
    )
    expect(ids).toContain('u1')
    expect(ids).toHaveLength(1)
  })

  it('resolves @full name (lowercase) to u1 via case-insensitive match', async () => {
    const mock = createMockSupabase()
    const ids = await resolveMentionUserIds(mock, 'Hi @full name', ORG_ID)
    expect(ids).toContain('u1')
  })
})
