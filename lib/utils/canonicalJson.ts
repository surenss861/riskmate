/**
 * Canonical JSON stringify helper
 * 
 * Ensures stable, deterministic JSON stringification for hashing.
 * Handles:
 * - Key sorting (deterministic order)
 * - Null/undefined normalization
 * - Date normalization (ISO strings, UTC)
 * - Array stability
 * - Deep object normalization
 */
export function canonicalStringify(obj: any): string {
  // Normalize null and undefined to consistent representation
  if (obj === null) {
    return 'null'
  }
  
  if (obj === undefined) {
    return 'null' // Treat undefined as null for consistency
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  // Handle Date objects - normalize to ISO UTC string
  if (obj instanceof Date) {
    return JSON.stringify(obj.toISOString())
  }

  // Handle arrays - maintain order but normalize elements
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalStringify(item)).join(',') + ']'
  }

  // Handle objects - sort keys for deterministic output
  const sortedKeys = Object.keys(obj).sort()
  const pairs = sortedKeys
    .filter((key) => {
      // Filter out undefined values (but keep null)
      const value = obj[key]
      return value !== undefined
    })
    .map((key) => {
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

