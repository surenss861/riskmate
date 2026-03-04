/**
 * Shared date/period helpers for analytics routes (trends, risk-heatmap, team-performance).
 */

export const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const
export type PeriodKey = keyof typeof PERIOD_DAYS

export function parsePeriod(value?: string | null): { days: number; key: PeriodKey } {
  const str = value ? String(value).trim() : '30d'
  const key = (str === '7d' || str === '30d' || str === '90d' || str === '1y' ? str : '30d') as PeriodKey
  return { days: PERIOD_DAYS[key], key }
}

export type ParseSinceUntilResult =
  | { since: string; until: string }
  | { error: 'invalid_order' }
  | { error: 'invalid_format' }
  | { error: 'missing_bound' }
  | null

/** ISO date: YYYY-MM-DD. ISO datetime: YYYY-MM-DDTHH:mm:ss[.sss][Z|±HH:mm]. */
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|([+-])(\d{2}):(\d{2}))?$/

/**
 * Parse a string as ISO date or ISO datetime and validate that the calendar date exists
 * (reject e.g. 2024-02-30). Returns ISO string or null if invalid.
 */
function parseStrictDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  let year: number
  let month: number
  let day: number

  const dateOnly = ISO_DATE_REGEX.exec(trimmed)
  if (dateOnly) {
    year = parseInt(dateOnly[1], 10)
    month = parseInt(dateOnly[2], 10)
    day = parseInt(dateOnly[3], 10)
  } else {
    const dateTime = ISO_DATETIME_REGEX.exec(trimmed)
    if (!dateTime) return null
    year = parseInt(dateTime[1], 10)
    month = parseInt(dateTime[2], 10)
    day = parseInt(dateTime[3], 10)
  }

  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const utcMs = Date.UTC(year, month - 1, day)
  if (Number.isNaN(utcMs)) return null
  const d = new Date(utcMs)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null
  }

  if (dateOnly) {
    return new Date(Date.UTC(year, month - 1, day)).toISOString()
  }

  // Datetime: timezone-less values are normalized to UTC so results are identical across environments
  const dateTimeMatch = ISO_DATETIME_REGEX.exec(trimmed)!
  const hasTz = dateTimeMatch[8] !== undefined // group 8: Z or sign of offset
  const hour = parseInt(dateTimeMatch[4], 10)
  const min = parseInt(dateTimeMatch[5], 10)
  const sec = parseInt(dateTimeMatch[6], 10) || 0
  let ms = 0
  if (dateTimeMatch[7] != null && dateTimeMatch[7] !== '') {
    ms = parseInt(dateTimeMatch[7].padEnd(3, '0').slice(0, 3), 10)
  }
  if (hour > 23 || min > 59 || sec > 59 || ms > 999) return null

  if (!hasTz) {
    // Normalize timezone-less datetime to UTC so results are identical across environments
    const utcDateTimeMs = Date.UTC(year, month - 1, day, hour, min, sec, ms)
    if (Number.isNaN(utcDateTimeMs)) return null
    const dt = new Date(utcDateTimeMs)
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day ||
      dt.getUTCHours() !== hour ||
      dt.getUTCMinutes() !== min ||
      dt.getUTCSeconds() !== sec
    ) {
      return null
    }
    return dt.toISOString()
  }

  const fullParsed = new Date(trimmed)
  if (Number.isNaN(fullParsed.getTime())) return null
  return fullParsed.toISOString()
}

/** For date-only (YYYY-MM-DD) until: return end-of-day UTC (23:59:59.999). Datetime inputs unchanged. */
function toEndOfDayUTC(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  return new Date(Date.UTC(y, m, day, 23, 59, 59, 999)).toISOString()
}

export function parseSinceUntil(
  sinceParam?: string | null,
  untilParam?: string | null
): ParseSinceUntilResult {
  const since = sinceParam?.trim() ?? ''
  const until = untilParam?.trim() ?? ''
  if (!since && !until) return null
  if (!since || !until) return { error: 'missing_bound' }
  const sinceIso = parseStrictDate(since)
  const untilIso = parseStrictDate(until)
  if (sinceIso === null || untilIso === null) return { error: 'invalid_format' }
  const sinceMs = new Date(sinceIso).getTime()
  const untilMs = new Date(untilIso).getTime()
  if (sinceMs > untilMs) return { error: 'invalid_order' }
  // Normalize date-only bounds: since is already start-of-day UTC; until → end-of-day UTC when date-only
  const untilNormalized = ISO_DATE_REGEX.test(until) ? toEndOfDayUTC(untilIso) : untilIso
  return { since: sinceIso, until: untilNormalized }
}

export function dateRangeForDays(days: number): { since: string; until: string } {
  const until = new Date()
  until.setHours(23, 59, 59, 999)
  const since = new Date(until.getTime())
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)
  return { since: since.toISOString(), until: until.toISOString() }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Derive effective span in days from explicit since/until (inclusive calendar-day span).
 * Normalizes both timestamps to UTC day boundaries; minimum 1 day when since <= until.
 * Used for period metadata and MV eligibility when callers send explicit range instead of period.
 */
export function effectiveDaysFromRange(since: string, until: string): number {
  const sinceMs = new Date(since).getTime()
  const untilMs = new Date(until).getTime()
  if (Number.isNaN(sinceMs) || Number.isNaN(untilMs) || untilMs < sinceMs) return 30
  const sinceDayIndex = Math.floor(sinceMs / MS_PER_DAY)
  const untilDayIndex = Math.floor(untilMs / MS_PER_DAY)
  const inclusiveDays = untilDayIndex - sinceDayIndex + 1
  return Math.max(1, inclusiveDays)
}

/**
 * Period label for response metadata: "1y" when span >= 365 days, otherwise "{days}d".
 */
export function periodLabelFromDays(days: number): string {
  return days >= 365 ? '1y' : `${days}d`
}
