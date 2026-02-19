/**
 * Normalizes a user search query for PostgreSQL to_tsquery so that spaces,
 * punctuation, and tsquery operators do not cause syntax errors.
 * Splits on whitespace, joins terms with &, and strips operator characters.
 */
export function normalizeSearchQueryForTsquery(raw: string): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return trimmed

  // Replace tsquery operators, apostrophes, and problematic punctuation with space so they
  // are not passed through to to_tsquery (would throw on e.g. "foo | bar", "a:b", or "john's").
  const safe = trimmed.replace(/[():|&!*\\']/g, ' ')
  const tokens = safe.split(/\s+/).filter((t) => t.length > 0)
  if (tokens.length === 0) return ''

  // Join with & for AND semantics; safe for to_tsquery('english', result).
  const joined = tokens.join(' & ')
  return joined
}
