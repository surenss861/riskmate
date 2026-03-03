/**
 * Strict integer parsing for public API query params.
 * Rejects non-canonical values (e.g. "1abc", "2.5", " 1 ") to enforce strict API contracts.
 */

/** Only digits, no sign, no decimals, no leading/trailing whitespace. */
const STRICT_INTEGER = /^\d+$/

export interface StrictIntOptions {
  min?: number
  max?: number
}

/**
 * Parse a string as a strict non-negative integer. Returns null if the string
 * is not exactly digits (e.g. "1abc", "2.5") or if the value is outside optional min/max.
 */
export function parseStrictInt(
  str: string,
  options?: StrictIntOptions
): number | null {
  if (typeof str !== 'string' || !STRICT_INTEGER.test(str)) return null
  const value = parseInt(str, 10)
  if (!Number.isFinite(value)) return null
  if (options?.min !== undefined && value < options.min) return null
  if (options?.max !== undefined && value > options.max) return null
  return value
}
