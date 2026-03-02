/**
 * Normalize API key expiry input for storage.
 * - Date-only (YYYY-MM-DD) is interpreted as end of that day UTC, so keys remain valid for the full day.
 * - Full ISO 8601 datetimes with explicit timezone (Z or ±HH:mm / ±HHmm) are accepted; all other input is rejected.
 * Use this in create/update API key routes so expiry semantics are consistent and documented.
 */
export function normalizeExpiresAt(expires_at: string): string | null {
  const trimmed = typeof expires_at === 'string' ? expires_at.trim() : ''
  if (!trimmed) return null
  // Date-only: YYYY-MM-DD (no time part) → end of that day UTC
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed)
  if (dateOnlyMatch) {
    const endOfDay = `${trimmed}T23:59:59.999Z`
    const parsed = Date.parse(endOfDay)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
    return null
  }
  // Strict ISO 8601 datetime: YYYY-MM-DDTHH:mm:ss[.sss](Z|±HH:mm|±HHmm) — explicit timezone required
  const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/
  if (!isoDatetimeRegex.test(trimmed)) return null
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}
