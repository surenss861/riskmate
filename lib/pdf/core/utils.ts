/**
 * Core PDF Utility Functions
 * 
 * Pure helper functions for all PDF reports
 * These functions have no side effects and don't depend on:
 * - Database connections
 * - Authentication
 * - Environment variables
 * - Global state
 * 
 * They can be safely used in tests and shared across modules.
 */

import type PDFKit from 'pdfkit'
import { PDF_CORE_TOKENS } from './tokens'

/**
 * Sanitize text for PDF output - removes ALL C0/C1 control chars, normalizes quotes, fixes bullets
 * This fixes the '\x05' and other control character leaks
 */
/**
 * Sanitize text for normal content (names, descriptions, etc.)
 * Preserves international characters but normalizes problematic ones
 */
export function sanitizeText(input: unknown): string {
  let s = String(input ?? '')

  // Canonicalize Unicode (NFKC normalization)
  s = s.normalize('NFKC')

  // Remove format/zero-width + BOM
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '')

  // Remove soft hyphen entirely (this is usually the "￾" leak)
  s = s.replace(/\u00AD/g, '')

  // Normalize dash variants + noncharacters/replacements -> "-"
  s = s.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\uFFFE\uFFFF\uFFFD]/g, '-')

  // Cleanup spacing around hyphens like "high - risk" -> "high-risk"
  // (keeps negative numbers intact)
  s = s.replace(/(\D)\s*-\s*(\D)/g, '$1-$2')

  // Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ').trim()

  return s
}

/**
 * Sanitize text to strict ASCII only (for headline, chips, KPI labels, verify display)
 * This ensures clean text extraction and prevents character corruption in executive-facing content
 */
export function sanitizeAscii(input: unknown): string {
  const s = sanitizeText(input)
  // Keep ASCII printable + newlines/tabs (0x09, 0x0A, 0x0D, 0x20-0x7E)
  return s.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
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
    case 'high': return PDF_CORE_TOKENS.colors.riskHigh
    case 'moderate': return PDF_CORE_TOKENS.colors.riskMedium
    default: return PDF_CORE_TOKENS.colors.riskLow
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
  fontSize: number = PDF_CORE_TOKENS.sizes.body
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

