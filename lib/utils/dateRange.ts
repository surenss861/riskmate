/**
 * Shared custom date-range utilities. All custom ranges are stored and passed as
 * local date-only strings (YYYY-MM-DD) to avoid timezone shifts on refresh/share.
 * API since/until boundaries are derived from these date-only values in one place.
 */

/** Custom range as explicit local date-only fields (YYYY-MM-DD). */
export type CustomRange = { start: string; end: string };

/** Format a Date as local YYYY-MM-DD for <input type="date"> (avoids UTC shift). */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalize ISO datetime or date string to YYYY-MM-DD. */
export function toDateOnly(value: string): string {
  if (!value || value.length < 10) return value;
  return value.slice(0, 10);
}

/**
 * Derive API since/until boundaries from date-only values (YYYY-MM-DD).
 * All date ranges are UTC-based: start is UTC midnight of startDateOnly,
 * until is UTC end-of-day of endDateOnly. The UI date picker should be
 * labeled accordingly (e.g. "Date range (UTC)") so users west of UTC
 * do not experience off-by-one-day boundaries.
 */
export function dateOnlyToApiBounds(startDateOnly: string, endDateOnly: string): { since: string; until: string } {
  const since = new Date(startDateOnly + 'T00:00:00.000Z');
  const until = new Date(endDateOnly + 'T23:59:59.999Z');
  return { since: since.toISOString(), until: until.toISOString() };
}

export type PresetPeriod = '7d' | '30d' | '90d' | '1y';

/** Compute API since/until for a preset period (rolling window or calendar year for 1y). */
export function presetPeriodToApiBounds(period: PresetPeriod): { since: string; until: string } {
  const now = new Date();
  if (period === '1y') {
    const y = now.getUTCFullYear();
    const since = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const until = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { since: since.toISOString(), until: until.toISOString() };
  }
  const until = new Date(now);
  until.setHours(23, 59, 59, 999);
  const days = parseInt(period.replace('d', ''), 10) || 30;
  const since = new Date(until.getTime());
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
}
