/**
 * Shared Normalization Layer
 * Ensures consistent data transformation across all PDF generators
 */

// Use flexible types that match the actual data structure
interface FlexibleControlRow {
  control_id?: string
  status_at_export?: string
  severity?: string
  due_date?: string
  [key: string]: any
}

interface FlexibleAttestationRow {
  attestation_id?: string
  status_at_export?: string
  attested_at?: string
  [key: string]: any
}

// ============================================================================
// STATUS NORMALIZATION
// ============================================================================

export function normalizeControlStatus(status: string | undefined | null): 'completed' | 'pending' | 'overdue' {
  const normalized = (status || '').toLowerCase().trim()
  
  if (normalized === 'completed' || normalized === 'done' || normalized === 'verified') {
    return 'completed'
  }
  
  return 'pending'
}

export function normalizeAttestationStatus(status: string | undefined | null): 'completed' | 'pending' {
  const normalized = (status || '').toLowerCase().trim()
  
  if (normalized === 'completed' || normalized === 'signed' || normalized === 'verified') {
    return 'completed'
  }
  
  return 'pending'
}

// ============================================================================
// OVERDUE LOGIC
// ============================================================================

export function isControlOverdue(
  status: string | undefined | null,
  dueDate: string | undefined | null
): boolean {
  // Can't be overdue if already completed
  if (normalizeControlStatus(status) === 'completed') {
    return false
  }
  
  // Can't be overdue if no due date
  if (!dueDate) {
    return false
  }
  
  try {
    const due = new Date(dueDate)
    const now = new Date()
    return due < now
  } catch {
    return false
  }
}

// ============================================================================
// SEVERITY RANKING
// ============================================================================

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

export function normalizeSeverity(severity: string | undefined | null): SeverityLevel {
  const normalized = (severity || 'info').toLowerCase().trim()
  
  if (normalized === 'critical' || normalized === 'crit') {
    return 'critical'
  }
  if (normalized === 'high' || normalized === 'h') {
    return 'high'
  }
  if (normalized === 'medium' || normalized === 'med' || normalized === 'm') {
    return 'medium'
  }
  if (normalized === 'low' || normalized === 'l') {
    return 'low'
  }
  
  return 'info'
}

export function isHighSeverity(severity: string | undefined | null): boolean {
  const normalized = normalizeSeverity(severity)
  return normalized === 'high' || normalized === 'critical'
}

export function compareSeverity(a: string | undefined | null, b: string | undefined | null): number {
  const order: Record<SeverityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  }
  
  const aLevel = normalizeSeverity(a)
  const bLevel = normalizeSeverity(b)
  
  return order[aLevel] - order[bLevel]
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

export function formatDate(date: string | undefined | null, format: 'short' | 'long' | 'iso' = 'short'): string {
  if (!date) return 'N/A'
  
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return 'N/A'
    
    if (format === 'iso') {
      return d.toISOString()
    }
    if (format === 'long') {
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    // short (default)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'N/A'
  }
}

export function formatDateTime(date: string | undefined | null): string {
  return formatDate(date, 'long')
}

// ============================================================================
// TEXT NORMALIZATION
// ============================================================================

export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Hard-fail guard: throws if text contains forbidden characters
 * CRITICAL: Always runs in production for PDF exports - we cannot ship corrupted PDFs
 */
export function assertNoBadChars(text: string, context?: string): void {
  // DO NOT skip in production - PDF exports must be audit-grade clean
  // If you need to disable for performance, use PDF_STRICT=0 env var instead
  if (process.env.PDF_STRICT === '0') {
    return
  }
  
  const errors: string[] = []
  
  // Check for ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(text)) {
    const matches = text.match(/[\x00-\x1F\x7F]/g) || []
    const codes = matches.map(m => `\\u${m.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', ')
    errors.push(`ASCII control characters: ${codes}`)
  }
  
  // Check for zero-width characters
  if (/[\u200B-\u200D\uFEFF]/.test(text)) {
    errors.push('Zero-width characters detected')
  }
  
  // Check for Unicode replacement/broken glyph characters
  if (/[\uFFFD-\uFFFF]/.test(text)) {
    errors.push('Unicode replacement/broken glyph characters (U+FFFD-U+FFFF)')
  }
  
  // Check for private-use area characters
  if (/[\uE000-\uF8FF]/.test(text)) {
    errors.push('Private-use area characters (U+E000-U+F8FF)')
  }
  
  // Check for Unicode Control, Format, and Private-use categories (using property escapes)
  if (/\p{Cc}|\p{Cf}|\p{Co}/u.test(text)) {
    errors.push('Unicode Control/Format/Private-use category characters')
  }
  
  if (errors.length > 0) {
    const contextMsg = context ? ` (${context})` : ''
    throw new Error(`PDF text forbidden chars${contextMsg}: ${errors.join(', ')}\nText: ${JSON.stringify(text)}`)
  }
}

/**
 * Bulletproof text sanitization using Unicode property escapes and noncharacter filtering
 * Removes all Control, Format, and Private-use characters, plus Unicode noncharacters
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return ''
  
  // Step 1: Normalize first (NFKC reduces weird forms and compatibility characters)
  let sanitized = text.normalize('NFKC')
  
  // Step 2: Remove Unicode Control (Cc), Format (Cf), and Private-use (Co) categories
  // This catches the broken glyph "￾" and similar issues
  sanitized = sanitized.replace(/\p{Cc}|\p{Cf}|\p{Co}/gu, '')
  
  // Step 3: Remove Unicode noncharacters explicitly
  // Noncharacters include: FDD0-FDEF (in Arabic Presentation Forms-B) and any codepoint ending with FFFE/FFFF
  sanitized = [...sanitized].filter((ch) => {
    const cp = ch.codePointAt(0)
    if (cp === undefined) return false
    
    // Remove noncharacters in the FDD0-FDEF range
    if (cp >= 0xFDD0 && cp <= 0xFDEF) return false
    
    // Remove any codepoint ending with FFFE or FFFF (noncharacters)
    const low = cp & 0xffff
    if (low === 0xfffe || low === 0xffff) return false
    
    return true
  }).join('')
  
  // Step 4: Replace common problematic Unicode separators with normal spaces
  sanitized = sanitized.replace(/[\u2028\u2029]/g, ' ')
  
  // Step 5: Normalize weird dashes/hyphens to standard hyphen
  sanitized = sanitized.replace(/[\u2010-\u2015\u2212]/g, '-')
  
  // Step 6: Normalize quotes to standard quotes
  sanitized = sanitized.replace(/[\u2018\u2019]/g, "'")
  sanitized = sanitized.replace(/[\u201C\u201D]/g, '"')
  
  // Step 7: Collapse repeated whitespace
  sanitized = sanitized.replace(/\s+/g, ' ')
  
  return sanitized.trim()
}

/**
 * Safe text renderer: sanitizes and validates text before PDF rendering
 * Use this as the final step before any doc.text() call
 */
export function safeTextForPdf(text: string | undefined | null, context?: string): string {
  const sanitized = sanitizeText(text)
  assertNoBadChars(sanitized, context)
  return sanitized
}

// ============================================================================
// CONTROL SORTING
// ============================================================================

export function sortControls(controls: FlexibleControlRow[]): FlexibleControlRow[] {
  return [...controls].sort((a, b) => {
    const aStatus = normalizeControlStatus(a.status_at_export)
    const bStatus = normalizeControlStatus(b.status_at_export)
    const aDueDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
    const bDueDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
    const now = Date.now()
    
    // 1. Overdue first (not completed + past due)
    const aOverdue = aStatus !== 'completed' && aDueDate < now ? 1 : 0
    const bOverdue = bStatus !== 'completed' && bDueDate < now ? 1 : 0
    if (aOverdue !== bOverdue) return bOverdue - aOverdue
    
    // 2. High severity next
    const aHigh = isHighSeverity(a.severity) ? 1 : 0
    const bHigh = isHighSeverity(b.severity) ? 1 : 0
    if (aHigh !== bHigh) return bHigh - aHigh
    
    // 3. Then by due date ascending
    return aDueDate - bDueDate
  })
}

// ============================================================================
// ATTESTATION SORTING
// ============================================================================

export function sortAttestations(attestations: FlexibleAttestationRow[]): FlexibleAttestationRow[] {
  return [...attestations].sort((a, b) => {
    const aStatus = normalizeAttestationStatus(a.status_at_export)
    const bStatus = normalizeAttestationStatus(b.status_at_export)
    const aCompleted = aStatus === 'completed'
    const bCompleted = bStatus === 'completed'
    
    // 1. Pending first
    if (aCompleted !== bCompleted) {
      return aCompleted ? 1 : -1
    }
    
    // 2. Then by most recent first
    const aTime = a.attested_at ? new Date(a.attested_at).getTime() : 0
    const bTime = b.attested_at ? new Date(b.attested_at).getTime() : 0
    return bTime - aTime
  })
}

// ============================================================================
// KPI CALCULATION
// ============================================================================

export function calculateControlKPIs(controls: FlexibleControlRow[]): {
  total: number
  completed: number
  pending: number
  overdue: number
  highSeverity: number
} {
  let completed = 0
  let pending = 0
  let overdue = 0
  let highSeverity = 0
  
  controls.forEach(control => {
    const status = normalizeControlStatus(control.status_at_export)
    if (status === 'completed') {
      completed++
    } else {
      pending++
    }
    
    if (isControlOverdue(control.status_at_export, control.due_date)) {
      overdue++
    }
    
    if (isHighSeverity(control.severity)) {
      highSeverity++
    }
  })
  
  return {
    total: controls.length,
    completed,
    pending,
    overdue,
    highSeverity,
  }
}

export function calculateAttestationKPIs(attestations: FlexibleAttestationRow[]): {
  total: number
  completed: number
  pending: number
} {
  let completed = 0
  let pending = 0
  
  attestations.forEach(attestation => {
    const status = normalizeAttestationStatus(attestation.status_at_export)
    if (status === 'completed') {
      completed++
    } else {
      pending++
    }
  })
  
  return {
    total: attestations.length,
    completed,
    pending,
  }
}

// ============================================================================
// FILTER CONTEXT
// ============================================================================

export function countActiveFilters(filters: Record<string, any>): number {
  return Object.entries(filters).filter(([_, value]) => {
    return value !== null && value !== undefined && value !== ''
  }).length
}

export function formatFilterContext(filters: Record<string, any>): string {
  const active = Object.entries(filters)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(', ')
  
  return active || 'No filters applied'
}
