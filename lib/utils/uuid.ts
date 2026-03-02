/**
 * UUID validation for API path/query/body parameters.
 * Use before passing IDs to Supabase/Postgres to return 400 instead of 500 for malformed input.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUID(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s)
}
