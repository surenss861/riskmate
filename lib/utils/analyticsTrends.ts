/**
 * Shared analytics trends computation helpers (period/date bucketing, pagination).
 * Used by app/api/analytics/trends/route.ts and apps/backend/src/routes/analytics.ts
 * to keep MV bucketing and fallback logic in sync.
 */

export const PAGE_SIZE = 500
export const MV_COVERAGE_DAYS = 730

export function calendarYearBounds(): { since: string; until: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const since = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
  const until = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  return { since: since.toISOString(), until: until.toISOString() }
}

export function weekStart(d: Date): string {
  const x = new Date(d)
  const day = x.getDay()
  const diff = x.getDate() - day + (day === 0 ? -6 : 1)
  x.setDate(diff)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

export function monthStart(d: Date): string {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

export function toDateKey(value: string): string {
  return value.slice(0, 10)
}

export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = []
  let offset = 0
  let hasMore = true
  let lastError: unknown = null
  while (hasMore) {
    const { data, error } = await fetchPage(offset, PAGE_SIZE)
    if (error) return { data: out, error }
    lastError = error
    const chunkData = data ?? []
    out.push(...chunkData)
    hasMore = chunkData.length === PAGE_SIZE
    offset += chunkData.length
  }
  return { data: out, error: lastError }
}
