/**
 * Unit tests for lib/utils/analyticsDateRange.
 * Covers parseSinceUntil: date-only normalization (since start-of-day, until end-of-day UTC),
 * missing_bound when only one of since/until is provided, and other error cases.
 */

import { parseSinceUntil, effectiveDaysFromRange, isSinceUntilRange } from '@/lib/utils/analyticsDateRange'

describe('isSinceUntilRange', () => {
  it('returns true for valid range result', () => {
    expect(isSinceUntilRange(parseSinceUntil('2025-01-01', '2025-01-15'))).toBe(true)
    expect(isSinceUntilRange({ since: '2025-01-01T00:00:00.000Z', until: '2025-01-15T23:59:59.999Z' })).toBe(true)
  })
  it('returns false for null', () => {
    expect(isSinceUntilRange(null)).toBe(false)
  })
  it('returns false for error results', () => {
    expect(isSinceUntilRange({ error: 'missing_bound' })).toBe(false)
    expect(isSinceUntilRange({ error: 'invalid_order' })).toBe(false)
    expect(isSinceUntilRange({ error: 'invalid_format' })).toBe(false)
  })
})

describe('parseSinceUntil', () => {
  it('returns null when both since and until are omitted', () => {
    expect(parseSinceUntil(undefined, undefined)).toBeNull()
    expect(parseSinceUntil('', '')).toBeNull()
    expect(parseSinceUntil(null, null)).toBeNull()
  })

  it('returns missing_bound when only since is provided', () => {
    const result = parseSinceUntil('2025-01-01', undefined)
    expect(result).toEqual({ error: 'missing_bound' })
    expect(parseSinceUntil('2025-01-01', '')).toEqual({ error: 'missing_bound' })
  })

  it('returns missing_bound when only until is provided', () => {
    const result = parseSinceUntil(undefined, '2025-01-15')
    expect(result).toEqual({ error: 'missing_bound' })
    expect(parseSinceUntil('', '2025-01-15')).toEqual({ error: 'missing_bound' })
  })

  it('normalizes date-only until to end-of-day UTC', () => {
    const result = parseSinceUntil('2025-01-01', '2025-01-15')
    expect(result).not.toBeNull()
    expect('error' in (result ?? {})).toBe(false)
    if (result && !('error' in result)) {
      expect(result.since).toBe('2025-01-01T00:00:00.000Z')
      expect(result.until).toBe('2025-01-15T23:59:59.999Z')
    }
  })

  it('keeps date-only since as start-of-day UTC', () => {
    const result = parseSinceUntil('2025-01-01', '2025-01-15')
    expect(result).not.toBeNull()
    if (result && !('error' in result)) {
      expect(result.since).toBe('2025-01-01T00:00:00.000Z')
    }
  })

  it('leaves datetime inputs unchanged (no end-of-day for until when not date-only)', () => {
    const result = parseSinceUntil('2025-01-01T06:00:00Z', '2025-01-15T18:30:00.000Z')
    expect(result).not.toBeNull()
    if (result && !('error' in result)) {
      expect(result.since).toBe('2025-01-01T06:00:00.000Z')
      expect(result.until).toBe('2025-01-15T18:30:00.000Z')
    }
  })

  it('returns invalid_order when since is after until', () => {
    const result = parseSinceUntil('2025-02-01', '2025-01-15')
    expect(result).toEqual({ error: 'invalid_order' })
  })

  it('returns invalid_format for invalid date strings', () => {
    expect(parseSinceUntil('2024-02-30', '2024-03-15')).toEqual({ error: 'invalid_format' })
    expect(parseSinceUntil('2025-13-01', '2025-12-31')).toEqual({ error: 'invalid_format' })
    expect(parseSinceUntil('not-a-date', '2025-01-15')).toEqual({ error: 'invalid_format' })
  })

  it('normalizes timezone-less datetime to UTC (deterministic across environments)', () => {
    // 2025-01-01T06:00:00 with no Z/offset is interpreted as 06:00:00 UTC, not local time
    const result = parseSinceUntil('2025-01-01T06:00:00', '2025-01-15T18:30:00')
    expect(result).not.toBeNull()
    expect('error' in (result ?? {})).toBe(false)
    if (result && !('error' in result)) {
      expect(result.since).toBe('2025-01-01T06:00:00.000Z')
      expect(result.until).toBe('2025-01-15T18:30:00.000Z')
    }
  })

  it('accepts explicit Z and offset datetimes unchanged', () => {
    const result = parseSinceUntil('2025-01-01T06:00:00Z', '2025-01-15T18:30:00.000Z')
    expect(result).not.toBeNull()
    if (result && !('error' in result)) {
      expect(result.since).toBe('2025-01-01T06:00:00.000Z')
      expect(result.until).toBe('2025-01-15T18:30:00.000Z')
    }
    const withOffset = parseSinceUntil('2025-01-01T00:00:00+00:00', '2025-01-15T23:59:59-05:00')
    expect(withOffset).not.toBeNull()
    if (withOffset && !('error' in withOffset)) {
      expect(withOffset.since).toBe('2025-01-01T00:00:00.000Z')
      expect(withOffset.until).toBe('2025-01-16T04:59:59.000Z') // -05 → UTC
    }
  })

  it('effectiveDaysFromRange counts inclusive days for date-only normalized range', () => {
    const parsed = parseSinceUntil('2025-01-01', '2025-01-15')
    expect(parsed).not.toBeNull()
    if (parsed && !('error' in parsed)) {
      const days = effectiveDaysFromRange(parsed.since, parsed.until)
      expect(days).toBe(15)
    }
  })
})
