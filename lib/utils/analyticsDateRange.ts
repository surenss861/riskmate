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

export function parseSinceUntil(
  sinceParam?: string | null,
  untilParam?: string | null
): { since: string; until: string } | null {
  const since = sinceParam?.trim() ?? ''
  const until = untilParam?.trim() ?? ''
  if (!since || !until) return null
  const sinceDate = new Date(since)
  const untilDate = new Date(until)
  if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime())) return null
  return { since: sinceDate.toISOString(), until: untilDate.toISOString() }
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
 * Derive effective span in days from explicit since/until (covers full calendar days in range).
 * Used for period metadata and MV eligibility when callers send explicit range instead of period.
 */
export function effectiveDaysFromRange(since: string, until: string): number {
  const sinceMs = new Date(since).getTime()
  const untilMs = new Date(until).getTime()
  if (Number.isNaN(sinceMs) || Number.isNaN(untilMs) || untilMs < sinceMs) return 30
  return Math.ceil((untilMs - sinceMs) / MS_PER_DAY)
}

/**
 * Period label for response metadata: "1y" when span >= 365 days, otherwise "{days}d".
 */
export function periodLabelFromDays(days: number): string {
  return days >= 365 ? '1y' : `${days}d`
}
