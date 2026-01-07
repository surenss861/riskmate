/**
 * Pure Helper Functions for Executive Brief PDF
 * 
 * These functions have no side effects and don't depend on:
 * - Database connections
 * - Authentication
 * - Environment variables
 * - Global state
 * 
 * They can be safely used in tests and shared across modules.
 */

import { PDF_TOKENS } from './tokens'

/**
 * Sanitize text for PDF output - removes ALL C0/C1 control chars, normalizes quotes, fixes bullets
 * This fixes the '\x05' and other control character leaks
 */
export function sanitizeText(text: string): string {
  if (!text) return ''
  
  return String(text)
    // Remove ALL C0 control characters (\u0000-\u001F) and DEL (\u007F)
    // Keep only newline (\n), carriage return (\r), tab (\t) for formatting
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Remove ALL C1 control characters (\u0080-\u009F)
    .replace(/[\u0080-\u009F]/g, '')
    // CRITICAL: Comprehensive hyphen/dash/replacement character normalizer
    // Replace ALL problematic characters with standard hyphen BEFORE any other processing
    // This MUST catch: \uFFFE (replacement character that causes "high￾risk")
    // Also catches: \uFFFF, \uFFFD, \u00AD (soft hyphen), \u2010-\u2015 (various dashes), \u2212 (minus), etc.
    .replace(/[\uFFFE\uFFFF\uFFFD\u00AD\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    // Also catch any remaining dash-like characters using explicit ranges
    // Note: JavaScript regex doesn't support \p{Pd} directly, so we use explicit ranges
    .replace(/[\u002D\u058A\u05BE\u1400\u1806\u2E17\u2E1A\u2E3A\u2E3B\u301C\u3030\u30A0\uFE31\uFE32]/g, '-')
    // Replace smart quotes with ASCII equivalents (do this AFTER control char removal)
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[""]/g, '"')
    // Replace various bullet/arrow characters with hyphen
    .replace(/[•\u2022\u25CF\u25E6\u2043\u2219\u2023\u2024]/g, '-')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // CRITICAL: Collapse weird hyphen spacing (but preserve negative numbers)
    // Pattern: whitespace-hyphen-whitespace or whitespace-hyphen or hyphen-whitespace
    // But NOT: number-hyphen-number (negative numbers) or hyphen-number (negative numbers)
    .replace(/(\S)\s+-\s+(\S)/g, '$1-$2') // space-hyphen-space between words
    .replace(/(\S)\s+-(\S)/g, '$1-$2') // space-hyphen-word
    .replace(/(\S)-\s+(\S)/g, '$1-$2') // word-hyphen-space
    // Normalize whitespace (preserve intentional spaces)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Format delta with sign
 * Returns "No change" for 0 or undefined, otherwise formatted with sign
 */
export function formatDelta(delta?: number): string {
  // CRITICAL: Only return "No change" when delta is explicitly 0 (computed comparison)
  // If delta is undefined, caller should handle as "N/A" (prior unavailable)
  if (delta === undefined) return 'N/A' // Prior period unavailable
  if (delta === 0) return 'No change' // Actual comparison resulted in no change
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}`
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number | string): string {
  if (typeof num === 'string') return num
  return num.toLocaleString('en-US')
}

/**
 * Pluralize helper (1 incident vs 2 incidents)
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular
  return plural || `${singular}s`
}

/**
 * Format time range label
 */
export function formatTimeRange(timeRange: string): string {
  const labels: Record<string, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    'all': 'All time',
  }
  return sanitizeText(labels[timeRange] || timeRange)
}

/**
 * Get exposure level color
 */
export function getExposureColor(level: string): string {
  switch (level) {
    case 'high': return PDF_TOKENS.colors.riskHigh
    case 'moderate': return PDF_TOKENS.colors.riskMedium
    default: return PDF_TOKENS.colors.riskLow
  }
}

/**
 * Truncate text to fit width with ellipsis
 * Note: This requires a PDFDocument instance, so it's not fully pure
 * but it's a formatting helper that doesn't touch DB/auth
 */
export function truncateText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  fontSize: number = PDF_TOKENS.sizes.body
): string {
  doc.fontSize(fontSize)
  const textWidth = doc.widthOfString(text)
  if (textWidth <= maxWidth) return text
  
  // Binary search for truncation point
  let low = 0
  let high = text.length
  let result = text
  
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = text.substring(0, mid) + '...'
    const candidateWidth = doc.widthOfString(candidate)
    
    if (candidateWidth <= maxWidth) {
      result = candidate
      low = mid + 1
    } else {
      high = mid
    }
  }
  
  return result
}

