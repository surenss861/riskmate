/**
 * String helper utilities for safe string operations
 * Prevents crashes from undefined/null values
 */

/**
 * Safely convert value to string with fallback
 */
export function safeStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback
  return String(v)
}

/**
 * Humanize a string (convert snake_case/kebab-case to Title Case)
 * Safe wrapper that handles undefined/null
 */
export function humanize(v: unknown, fallback = "—"): string {
  const s = safeStr(v, "").trim()
  if (!s) return fallback
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

