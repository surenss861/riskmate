/**
 * Canonical JSON stringify helper
 * 
 * Ensures stable, deterministic JSON stringification for hashing.
 * Keys are sorted to avoid non-deterministic object key ordering.
 */
export function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) {
    return String(obj)
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalStringify(item)).join(',') + ']'
  }

  // Sort object keys for deterministic output
  const sortedKeys = Object.keys(obj).sort()
  const pairs = sortedKeys.map((key) => {
    const value = obj[key]
    return JSON.stringify(key) + ':' + canonicalStringify(value)
  })

  return '{' + pairs.join(',') + '}'
}

/**
 * Compute SHA256 hash of canonical JSON string
 */
export function computeCanonicalHash(obj: any): string {
  const crypto = require('crypto')
  const canonical = canonicalStringify(obj)
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

