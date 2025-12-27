/**
 * Signature SVG validation
 * 
 * Validates signature SVG to prevent malicious or oversized inputs.
 */

const MAX_SVG_SIZE = 100 * 1024 // 100KB max
const MAX_PATH_LENGTH = 100000 // Max characters in path data

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateSignatureSvg(svg: string): ValidationResult {
  if (!svg || typeof svg !== 'string') {
    return { valid: false, error: 'Signature SVG must be a non-empty string' }
  }

  if (svg.length > MAX_SVG_SIZE) {
    return {
      valid: false,
      error: `Signature SVG exceeds maximum size of ${MAX_SVG_SIZE} bytes`,
    }
  }

  // Basic SVG structure validation
  if (!svg.trim().startsWith('<svg') && !svg.trim().startsWith('<?xml')) {
    return {
      valid: false,
      error: 'Signature must be a valid SVG',
    }
  }

  // Check for potentially malicious content
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onload, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(svg)) {
      return {
        valid: false,
        error: 'Signature SVG contains potentially dangerous content',
      }
    }
  }

  // Check path data length (if present)
  const pathMatch = svg.match(/<path[^>]*d=["']([^"']+)["']/gi)
  if (pathMatch) {
    const totalPathLength = pathMatch.reduce((sum, match) => {
      const dMatch = match.match(/d=["']([^"']+)["']/i)
      return sum + (dMatch ? dMatch[1].length : 0)
    }, 0)

    if (totalPathLength > MAX_PATH_LENGTH) {
      return {
        valid: false,
        error: `Path data exceeds maximum length of ${MAX_PATH_LENGTH} characters`,
      }
    }
  }

  return { valid: true }
}

