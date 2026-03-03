/**
 * Single source of truth for API key scopes.
 * Used by API key routes (validation, error messages) and UI (CreateApiKeyModal).
 * Add or rename scopes here only; backend and frontend stay in sync.
 */

export const API_KEY_SCOPES = [
  'jobs:read',
  'jobs:write',
  'hazards:read',
  'hazards:write',
  'reports:read',
  'team:read',
  'webhooks:manage',
] as const

const ALLOWED_SCOPES_SET = new Set<string>(API_KEY_SCOPES)

/** Ensure scopes is an array of strings. Returns false if provided but malformed. */
export function isScopesArrayOfStrings(scopes: unknown): scopes is string[] {
  return Array.isArray(scopes) && scopes.every((s) => typeof s === 'string')
}

/** Validate scopes: return invalid values if any; otherwise return deduped allowed scopes. Call only when scopes is already an array of strings. */
export function validateAndNormalizeScopes(scopes: string[]): { valid: string[]; invalid: string[] } {
  const invalid = scopes.filter((s) => !ALLOWED_SCOPES_SET.has(s))
  const valid = [...new Set(scopes.filter((s) => ALLOWED_SCOPES_SET.has(s)))]
  return { valid, invalid }
}
