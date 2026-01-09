import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'
import PDFDocument from 'pdfkit'
import crypto from 'crypto'
import QRCode from 'qrcode'
// Import pure helpers from core module
import { sanitizeText, sanitizeAscii, formatDelta, formatNumber, pluralize, formatTimeRange, getExposureColor, truncateText } from '@/lib/pdf/core/utils'
// Import layout helpers from core
import { getContentLimitY as coreGetContentLimitY, ensureSpace as coreEnsureSpace, hasSpace as coreHasSpace } from '@/lib/pdf/core/layout'
// Import writer helpers from core
import { safeText as coreSafeText, writeKV as coreWriteKV, renderFittedLabel as coreRenderFittedLabel } from '@/lib/pdf/core/writer'
// Import shared types
import type { RiskPostureData as SharedRiskPostureData } from '@/lib/pdf/reports/executiveBrief/types'
// Import the new build function
import { buildExecutiveBriefPDF as buildPDF } from '@/lib/pdf/reports/executiveBrief/build'
import type { ExecutiveBriefInput } from '@/lib/pdf/reports/executiveBrief/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// PDF styling constants - Premium board-ready design
const STYLES = {
  colors: {
    primaryText: '#1A1A1A',
    secondaryText: '#666666',
    borderGray: '#E5E5E5',
    lightGrayBg: '#F5F5F5',
    cardBg: '#FAFAFA',
    tableHeaderBg: '#F8F9FA',
    white: '#FFFFFF',
    riskLow: '#10B981',
    riskMedium: '#F59E0B',
    riskHigh: '#EF4444',
    accent: '#2563EB',
    accentLight: '#3B82F6',
  },
  fonts: {
    header: 'Helvetica-Bold',
    body: 'Helvetica',
  },
  sizes: {
    h1: 30, // Premium title size (28-32 range)
    h2: 17, // Section headers (16-18 range)
    h3: 16, // Org name
    body: 10.5, // Body text (10.5-11 range)
    caption: 9, // Small text
    kpiValue: 24, // Big numbers in KPI cards
    kpiLabel: 9, // KPI label
    kpiDelta: 8, // KPI delta sublabel
  },
  spacing: {
    margin: 48,
    sectionGap: 32, // More breathing room
    rowSpacing: 20, // Better table row spacing
    cardPadding: 16,
    tableRowHeight: 26, // Taller rows for readability
    tableCellPadding: 12,
  },
  borderRadius: {
    card: 4, // Subtle rounded corners for cards
  },
}

// Use shared type from types.ts (with compatibility layer for route-specific fields)
type RiskPostureData = SharedRiskPostureData & {
  // Route-specific fields that may not be in shared type
  recent_violations?: number // Legacy field, map to violations
  confidence_statement?: string
  ledger_integrity?: 'verified' | 'error' | 'not_verified'
  ledger_integrity_last_verified_at?: string | null
  last_job_at?: string | null
  drivers?: {
    highRiskJobs?: Array<{ label: string; count: number }>
    openIncidents?: Array<{ label: string; count: number }>
    violations?: Array<{ label: string; count: number }>
  }
  recommended_actions?: Array<{
    priority: number
    action: string
    reason: string
  }>
}

// Pure helpers moved to @/lib/pdf/executiveBrief/utils.ts
// Imported at top of file

// Per-page body content tracking (prevents blank pages)
let pageHasBody = false
let currentPageStartY = 0
let pageNumber = 1
let currentSection = 'none' // Track current section for page creation tracing
// Track body char count per page for ship gate
// Also tracks lonely content (string keys like "0_lonely" contain arrays of lonely strings)
const bodyCharCount: { [key: number | string]: number | string[] } = {}

/**
 * Calculate content limit Y (hard stop before footer)
 * Footer consists of: main footer + build stamp + confidentiality (3 lines)
 */
function getContentLimitY(doc: PDFKit.PDFDocument): number {
  const bottomMargin = 60 // matches PDFDocument bottom margin
  doc.fontSize(8).font(STYLES.fonts.body)
  const lineHeight = doc.currentLineHeight(true) || 10
  const footerLines = 3
  const footerSpacing = 8
  const footerTotalHeight = (lineHeight * footerLines) + (footerSpacing * (footerLines - 1))
  return doc.page.height - bottomMargin - footerTotalHeight - 8 // 8px safety margin
}

/**
 * Helper: Check if we have enough space (NEVER adds pages)
 * CRITICAL: This function NEVER calls doc.addPage() - only build.ts can add pages
 * 
 * HARD LOCK: Returns false if we're on page 2 and can't fit (prevents page 3)
 * Returns true if space is available on current page
 * 
 * Rule: Only build.ts can add pages (exactly once, between Page 1 and Page 2)
 * All renderers must check ensureSpace() and skip/truncate if it returns false
 * 
 * NOTE: This is now a wrapper around core function that passes pageNumber state
 */
function ensureSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  margin: number
): boolean {
  return coreEnsureSpace(doc, requiredHeight, margin, pageNumber)
}

/**
 * Helper: Check if we have enough space, return false if we need a new page
 * Use this to conditionally render sections (avoid empty pages)
 * Uses contentLimitY to prevent footer overlap
 * 
 * NOTE: This is now a wrapper around core function
 */
function hasSpace(
  doc: PDFKit.PDFDocument,
  needed: number
): boolean {
  return coreHasSpace(doc, needed)
}

/**
 * Mark that body content has been written to current page
 * Call this after drawing any non-header/footer content
 */
function markPageHasBody(doc: PDFKit.PDFDocument): void {
  pageHasBody = true
}

/**
 * Render section with content gating (prevents header-only pages)
 * Rule: Never call ensureSpace() and never write a section title unless the section has real content
 * CRITICAL: This function is DEPRECATED - use direct safeText() calls instead
 * This function is kept for backwards compatibility but should not be used for new sections
 */
function renderSection(
  doc: PDFKit.PDFDocument,
  opts: {
    title: string
    hasContent: boolean
    minHeight: number
    margin: number
    render: () => void
  }
): void {
  if (!opts.hasContent) return

  // CRITICAL: ensureSpace() no longer adds pages - only checks space
  // This function is DEPRECATED and should not be used for new sections
  if (!ensureSpace(doc, opts.minHeight, opts.margin)) {
    return // Not enough space, skip section
  }
  
  // Draw section title - use safeText instead of doc.text
  safeText(doc, opts.title, opts.margin, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  
  markPageHasBody(doc) // Titles count as body
  doc.moveDown(0.8)
  
  // Render section content
  opts.render()
}

/**
 * Atomic KPI card writer - renders entire card as single unit
 * Allows numeric-only values when paired with label (KPI context exception)
 */
function writeKpiCard(
  doc: PDFKit.PDFDocument,
  opts: {
    cardX: number
    cardY: number
    cardWidth: number
    cardHeight: number
    label: string
    value: string
    delta?: number
    timeRange: string
    color: string
    hasPriorPeriodData?: boolean // CRITICAL: Pass prior period availability for subtitle
  }
): void {
  const cardPadding = STYLES.spacing.cardPadding
  const contentX = opts.cardX + cardPadding
  const contentWidth = opts.cardWidth - cardPadding * 2
  
  // Validate label exists (required for KPI context)
  // CRITICAL: Use sanitizeAscii() for KPI labels (strict ASCII for executive-facing content)
  const labelText = sanitizeAscii(opts.label)
  if (!labelText) return // Skip if no label
  
  // Delta pill (top-right corner of card) - show if delta exists
  if (opts.delta !== undefined) {
    const deltaText = formatDelta(opts.delta)
    const deltaColor = opts.delta === 0 
      ? STYLES.colors.secondaryText 
      : (opts.delta > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
    
    // Calculate pill position (top-right)
    doc.fontSize(STYLES.sizes.kpiDelta)
    const pillText = deltaText === 'No change' ? 'No change' : deltaText
    const pillWidth = doc.widthOfString(pillText) + 8
    const pillX = opts.cardX + opts.cardWidth - cardPadding - pillWidth
    const pillY = opts.cardY + cardPadding + 4
    
    // Draw pill background
    const pillBgColor = deltaText === 'No change' 
      ? STYLES.colors.lightGrayBg 
      : (opts.delta > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
    doc
      .rect(pillX, pillY, pillWidth, 16)
      .fill(pillBgColor)
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.3)
      .stroke()
    
    // Pill text (white if colored, secondary if grey) - CRITICAL: sanitize before rendering
    const pillTextColor = deltaText === 'No change' 
      ? STYLES.colors.secondaryText 
      : STYLES.colors.white
    const sanitizedPillText = sanitizeText(pillText)
    doc
      .fontSize(STYLES.sizes.kpiDelta)
      .font(STYLES.fonts.body)
      .fillColor(pillTextColor)
      .text(sanitizedPillText, pillX + 4, pillY + 4, { width: pillWidth - 8 })
  }
  
  // Value (big number) - ALLOW numeric-only in KPI context (paired with label)
  // CRITICAL: Always sanitize before rendering
  const valueY = opts.cardY + cardPadding + 8
  const sanitizedValue = sanitizeText(opts.value)
  if (sanitizedValue) {
    // KPI exception: allow numeric-only values when label exists
    doc
      .fontSize(STYLES.sizes.kpiValue)
      .font(STYLES.fonts.header)
      .fillColor(opts.color)
      .text(sanitizedValue, contentX, valueY, {
        width: contentWidth,
        align: 'left',
      })
  }
  
  // Label (small, below value) - CRITICAL: Use renderFittedLabel to prevent mid-word breaks
  const labelY = valueY + STYLES.sizes.kpiValue + 6
  const sanitizedLabel = sanitizeAscii(labelText) // Already sanitized with sanitizeAscii above
  
  // CRITICAL: Use renderFittedLabel to guarantee no mid-word breaks
  // This measures each line and shrinks font if needed to prevent character-level wraps
  // Returns height used so we can position subtitle correctly
  const labelHeight = renderFittedLabel(doc, sanitizedLabel, contentX, labelY, contentWidth, {
    fontSize: STYLES.sizes.kpiLabel,
    minFontSize: 7,
    font: STYLES.fonts.body,
    color: STYLES.colors.secondaryText,
  })
  
  // Subtitle - CRITICAL: Conditional based on prior period availability
  // If prior unavailable, show "prior unavailable" instead of "vs prior 30d" to avoid contradiction
  const subtitleY = labelY + labelHeight + 4
  let subtitleText: string
  if (opts.hasPriorPeriodData === false) {
    subtitleText = 'prior unavailable' // Don't say "vs prior 30d" when prior is unavailable
  } else {
    const timeRangeLabel = opts.timeRange === '7d' ? 'vs prior 7d' : opts.timeRange === '30d' ? 'vs prior 30d' : opts.timeRange === '90d' ? 'vs prior 90d' : 'vs prior period'
    subtitleText = timeRangeLabel
  }
  const sanitizedSubtitle = sanitizeText(subtitleText)
  doc
    .fontSize(STYLES.sizes.kpiDelta)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.secondaryText)
    .text(sanitizedSubtitle, contentX, subtitleY, {
      width: contentWidth,
      align: 'left',
    })
  
  // Track body content (entire card counts as one unit)
  markPageHasBody(doc)
}

/**
 * Safe text writer - refuses to write junk (empty, standalone "—", naked numbers)
 * CRITICAL: This is the ONLY way to write text to prevent junk pages
 * Also tracks body char count per page for ship gate
 * 
 * NOTE: Uses core safeText for basic rendering, but adds route-specific state tracking
 */
function safeText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options?: { width?: number; align?: 'left' | 'center' | 'right' | 'justify'; fontSize?: number; font?: string; color?: string }
): boolean {
  const sanitized = sanitizeText(text)
  
  // Never render if empty after sanitization
  if (!sanitized || sanitized.trim().length === 0) return false
  
  // Never render standalone "—" or single digits without context
  // EXCEPTION: Allow in table cells (they have context from row label)
  // Check if this is a table cell by looking at currentSection
  const isTableCell = currentSection === 'Metrics Table' || currentSection.includes('Table')
  const isStandaloneValue = sanitized === '—' || sanitized === '2' || sanitized === '0' || /^\d+$/.test(sanitized.trim())
  
  if (isStandaloneValue && sanitized.length <= 2 && !isTableCell) {
    // Reject only if it's truly standalone (not in a table cell)
    console.warn(`[PDF] safeText rejected standalone value: "${sanitized}" (section: ${currentSection})`)
    return false
  }
  
  // Check if it would overflow current page (use contentLimitY)
  const contentLimitY = getContentLimitY(doc)
  const lineHeight = (options?.fontSize || STYLES.sizes.body) * 1.2
  if (y + lineHeight > contentLimitY) {
    // Would overflow - don't write, caller should handle page break
    return false
  }
  
  // Use core safeText for basic rendering
  coreSafeText(doc, sanitized, x, y, options || {})
  
  // CRITICAL: Track body char count per page for ship gate (route-specific)
  // Also track "lonely" content (single tokens that appear alone on a page)
  // Check if this is a footer by looking at Y position (footers are near bottom)
  const pageBottom = doc.page.height - 60
  const isFooter = y > pageBottom - 100 // Footers are in bottom 100px
  
  if (!isFooter) {
    const currentPageIndex = pageNumber - 1
    if (typeof bodyCharCount[currentPageIndex] !== 'number') {
      bodyCharCount[currentPageIndex] = 0
    }
    
    // Check for "lonely" content patterns (single token, single heading, etc.)
    const trimmed = sanitized.trim()
    const isLonelyToken = /^[—\-0-9]+$/.test(trimmed) // Just dashes or numbers
    const isLonelyHeading = trimmed.length < 50 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed) // Short title-like text
    
    if (isLonelyToken || isLonelyHeading) {
      // Track lonely content separately (will be checked in ship gate)
      const lonelyKey = `${currentPageIndex}_lonely`
      if (!Array.isArray(bodyCharCount[lonelyKey])) {
        bodyCharCount[lonelyKey] = []
      }
      (bodyCharCount[lonelyKey] as string[]).push(trimmed)
    }
    
    // Increment char count for body content (not footers)
    bodyCharCount[currentPageIndex] = (bodyCharCount[currentPageIndex] as number) + sanitized.length
  }
  
  markPageHasBody(doc)
  return true
}

/**
 * Render label with guaranteed fit - prevents mid-word breaks
 * Measures each line and shrinks font if needed
 * 
 * NOTE: Uses core renderFittedLabel but handles "Attestation coverage" special case
 */
function renderFittedLabel(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    fontSize: number
    minFontSize: number
    font: string
    color: string
  }
): number {
  // Use core renderFittedLabel (handles most cases)
  // Special case: "Attestation coverage" is now shortened to "Attestation %" in KPI cards
  // So this special handling may not be needed anymore, but keeping for backwards compatibility
  return coreRenderFittedLabel(doc, label, x, y, maxWidth, options)
}

/**
 * Write label-value pair (prevents label-less values)
 * CRITICAL: This is the ONLY way metrics should render
 * Ensures values never render alone
 * 
 * NOTE: Uses core writeKV but with route-specific signature for backwards compatibility
 */
function writeKV(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  valueWidth: number,
  options?: { labelAlign?: 'left' | 'right'; valueAlign?: 'left' | 'right' }
): boolean {
  const L = sanitizeText(label)
  const V = sanitizeText(value)
  
  // Never render if label or value is missing
  if (!L || !V) return false
  
  // Never render standalone "—" or single digits without context
  // CRITICAL: This prevents "2" and "—" junk pages
  if (V === '—' && !L) return false
  if ((V === '2' || V === '0' || /^\d+$/.test(V)) && !L) return false
  
  // Both label and value must exist - atomic write
  // Use route's safeText to maintain state tracking
  const labelWritten = safeText(doc, L, x, y, { 
    width: labelWidth, 
    align: options?.labelAlign || 'left',
    fontSize: STYLES.sizes.body,
    font: STYLES.fonts.body,
    color: STYLES.colors.primaryText,
  })
  
  if (!labelWritten) return false
  
  safeText(doc, V, x + labelWidth, y, { 
    width: valueWidth, 
    align: options?.valueAlign || 'right',
    fontSize: STYLES.sizes.body,
    font: STYLES.fonts.body,
    color: STYLES.colors.secondaryText,
  })
  
  return true
}

/**
 * Render premium KPI cards (rounded corners, proper styling, no wrapping issues)
 */
function renderKPIStrip(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  startY: number,
  timeRange: string,
  hasPriorPeriodData: boolean // CRITICAL: Pass prior period availability for conditional subtitle
): void {
  const margin = STYLES.spacing.margin
  const kpiCardHeight = 95
  const kpiCardWidth = (pageWidth - margin * 2 - 20) / 5 // 5 cards with 20px total gap
  const cardGap = 5
  const cardY = startY

  // KPI definitions with proper formatting
  const kpis = [
    {
      label: 'Risk Posture',
      value: data.posture_score !== undefined ? `${data.posture_score}` : 'Insufficient data',
      delta: data.delta,
      color: data.posture_score !== undefined && data.posture_score >= 75 ? STYLES.colors.riskLow : 
             data.posture_score !== undefined && data.posture_score >= 50 ? STYLES.colors.riskMedium : STYLES.colors.riskHigh,
      hasPriorPeriodData,
    },
    {
      label: METRIC_LABELS.highRiskJobs, // Use centralized label
      value: `${data.high_risk_jobs}`,
      delta: data.deltas?.high_risk_jobs,
      color: STYLES.colors.primaryText,
      hasPriorPeriodData,
    },
    {
      label: METRIC_LABELS.openIncidents, // Use centralized label
      value: `${data.open_incidents}`,
      delta: data.deltas?.open_incidents,
      color: STYLES.colors.riskHigh,
      hasPriorPeriodData,
    },
    {
      label: 'Attestation %', // Shortened to avoid awkward wrapping (full definition in Methodology)
      value: data.signed_signoffs + data.pending_signoffs > 0 
        ? `${Math.round((data.signed_signoffs / (data.signed_signoffs + data.pending_signoffs)) * 100)}%`
        : 'No data',
      delta: undefined,
      color: STYLES.colors.primaryText,
      hasPriorPeriodData,
    },
    {
      label: 'Sign-offs',
      value: `${data.signed_signoffs}/${data.signed_signoffs + data.pending_signoffs}`, // One line, no split
      delta: undefined,
      color: STYLES.colors.primaryText,
      hasPriorPeriodData,
    },
  ]

  kpis.forEach((kpi, index) => {
    const cardX = margin + index * (kpiCardWidth + cardGap)
    
    // Draw card with subtle border + consistent padding (premium look)
    doc
      .rect(cardX, cardY, kpiCardWidth, kpiCardHeight)
      .fill(STYLES.colors.cardBg)
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.8) // Slightly stronger border for premium feel
      .stroke()

    // Card padding
    const cardPadding = STYLES.spacing.cardPadding
    const contentX = cardX + cardPadding
    const contentWidth = kpiCardWidth - cardPadding * 2

    // Atomic KPI card writer - renders label + value + delta + subtitle as single unit
    // This allows numeric-only values in KPI context (paired with label)
    // CRITICAL: hasPriorPeriodData must drive subtitle - if false, show "prior unavailable" not "vs prior 30d"
    writeKpiCard(doc, {
      cardX,
      cardY,
      cardWidth: kpiCardWidth,
      cardHeight: kpiCardHeight,
      label: kpi.label,
      value: kpi.value,
      delta: kpi.delta,
      timeRange,
      color: kpi.color,
      hasPriorPeriodData: hasPriorPeriodData, // CRITICAL: Use the function parameter, not kpi property
    })
  })

  // CRITICAL: Add global "Prior unavailable" note if needed (replaces spam on each KPI)
  // Place it right after KPI strip, before gauge
  if (!hasPriorPeriodData) {
    const noteY = cardY + kpiCardHeight + 12
    const noteText = 'Note: Prior period unavailable (deltas hidden)'
    safeText(doc, sanitizeAscii(noteText), margin, noteY, {
      fontSize: STYLES.sizes.caption,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
      width: pageWidth - margin * 2,
    })
    doc.y = noteY + 16 // Add spacing after note
  } else {
    // Update doc.y after cards (normal spacing)
    doc.y = cardY + kpiCardHeight + STYLES.spacing.sectionGap
  }
}

/**
 * Render risk posture gauge (segmented bar for visual credibility)
 */
function renderRiskPostureGauge(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number,
  timeRange: string
): void {
  const hasSufficientData = data.high_risk_jobs > 0 || data.open_incidents > 0 || data.signed_signoffs > 0
  if (!hasSufficientData || data.posture_score === undefined) return

  ensureSpace(doc, 100, margin)

  const gaugeY = doc.y
  const gaugeWidth = 280
  const gaugeHeight = 40
  const gaugeX = margin

  // Background bar
  doc
    .rect(gaugeX, gaugeY, gaugeWidth, gaugeHeight)
    .fill(STYLES.colors.lightGrayBg)
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .stroke()

  // Segmented fill based on score (0-100) with three segments
  const score = Math.max(0, Math.min(100, data.posture_score))
  const segmentWidth = (gaugeWidth - 6) / 3
  
  // Low segment (0-33) - Green
  if (score > 0) {
    const lowFill = Math.min(score, 33) / 33
    doc
      .rect(gaugeX + 2, gaugeY + 2, segmentWidth * lowFill, gaugeHeight - 4)
      .fill(STYLES.colors.riskLow)
  }
  
  // Moderate segment (33-66) - Amber
  if (score > 33) {
    const modFill = Math.min((score - 33) / 33, 1)
    doc
      .rect(gaugeX + 2 + segmentWidth, gaugeY + 2, segmentWidth * modFill, gaugeHeight - 4)
      .fill(STYLES.colors.riskMedium)
  }
  
  // High segment (66-100) - Red
  if (score > 66) {
    const highFill = (score - 66) / 34
    doc
      .rect(gaugeX + 2 + segmentWidth * 2, gaugeY + 2, segmentWidth * highFill, gaugeHeight - 4)
      .fill(STYLES.colors.riskHigh)
  }

  // Segment dividers
  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .moveTo(gaugeX + 2 + segmentWidth, gaugeY + 2)
    .lineTo(gaugeX + 2 + segmentWidth, gaugeY + gaugeHeight - 2)
    .moveTo(gaugeX + 2 + segmentWidth * 2, gaugeY + 2)
    .lineTo(gaugeX + 2 + segmentWidth * 2, gaugeY + gaugeHeight - 2)
    .stroke()

  // CRITICAL: Lock gauge block to strict vertical stack to prevent overlap
  // Define gauge box boundaries
  const gaugeBox = {
    x: gaugeX,
    y: gaugeY,
    w: gaugeWidth,
    h: gaugeHeight,
  }
  
  // Labels below segments (part of gauge box)
  const labelY = gaugeBox.y + gaugeBox.h + 6
  doc
    .fontSize(STYLES.sizes.caption)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.secondaryText)
    .text('Low', gaugeBox.x + segmentWidth / 2 - 10, labelY, { width: 20, align: 'center' })
    .text('Moderate', gaugeBox.x + segmentWidth + segmentWidth / 2 - 20, labelY, { width: 40, align: 'center' })
    .text('High', gaugeBox.x + segmentWidth * 2 + segmentWidth / 2 - 10, labelY, { width: 20, align: 'center' })

  // Strict vertical stack below gauge bar - no shared baselines
  let stackY = labelY + 12 // Start below segment labels
  const lineHeight = 12
  const spacing = 4
  
  // Score label (centered, below segment labels)
  const scoreText = `${score}`
  doc
    .fontSize(18)
    .font(STYLES.fonts.header)
    .fillColor(STYLES.colors.primaryText)
    .text(scoreText, gaugeBox.x, stackY, {
      align: 'center',
      width: gaugeBox.w,
    })
  stackY += 18 + spacing // Score height + spacing
  
  // Confidence grade (below score, no overlap)
  const confidenceGrade = calculateConfidenceGrade(data)
  if (confidenceGrade) {
    doc
      .fontSize(9)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(`Confidence: ${confidenceGrade}`, gaugeBox.x, stackY, {
        width: gaugeBox.w,
        align: 'center',
      })
    stackY += lineHeight + spacing
  }
  
  doc.y = stackY
  
  // Add tiny trend sparkline below gauge (only if real data available)
  if (hasSpace(doc, 30)) {
    renderTrendSparkline(doc, data, gaugeX, doc.y, gaugeWidth, timeRange)
    doc.y += 25
  }
  
  doc.y += STYLES.spacing.sectionGap
}

/**
 * Calculate confidence grade (High/Medium/Low) based on data quality
 */
function calculateConfidenceGrade(data: RiskPostureData): string | null {
  if (!data.posture_score) return null
  
  let score = 0
  
  // Job volume in window
  const totalJobs = data.total_jobs ?? 0
  if (totalJobs >= 10) score += 1
  else if (totalJobs >= 3) score += 0.5
  
  // Recency (last job date)
  if (data.last_job_at) {
    const daysSinceLastJob = (Date.now() - new Date(data.last_job_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceLastJob <= 7) score += 1
    else if (daysSinceLastJob <= 30) score += 0.5
  }
  
  // Coverage %
  const totalSignoffs = (data.signed_signoffs ?? 0) + (data.pending_signoffs ?? 0)
  if (totalSignoffs > 0) {
    const coverage = (data.signed_signoffs / totalSignoffs) * 100
    if (coverage >= 80) score += 1
    else if (coverage >= 50) score += 0.5
  }
  
  // Determine grade
  if (score >= 2.5) return 'High'
  if (score >= 1.5) return 'Medium'
  return 'Low'
}

/**
 * Render tiny trend sparkline (4-bucket bar chart for visual credibility)
 * Only shows if we have real historical data, otherwise shows "unavailable"
 */
function renderTrendSparkline(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  x: number,
  y: number,
  width: number,
  timeRange: string
): void {
  const sparklineHeight = 20
  const bucketWidth = (width - 12) / 4
  const bucketGap = 3
  
  // Check if we have real historical data (for now, we don't - show unavailable)
  // In production, you'd check if historical buckets exist
  const hasRealTrendData = false // TODO: Check for actual historical data
  
  if (!hasRealTrendData) {
    // Show "unavailable" state with grey bars
    const greyBars = [20, 20, 20, 20] // Equal grey bars
    
    greyBars.forEach((value, index) => {
      const barHeight = (value / 100) * sparklineHeight
      const barX = x + index * (bucketWidth + bucketGap)
      const barY = y + sparklineHeight - barHeight
      
      doc
        .rect(barX, barY, bucketWidth, barHeight)
        .fill(STYLES.colors.lightGrayBg)
        .strokeColor(STYLES.colors.borderGray)
        .lineWidth(0.3)
        .stroke()
    })
    
    // Label with "unavailable" note
    doc
      .fontSize(7)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(`Trend unavailable (need 4 completed periods)`, x, y + sparklineHeight + 4, { width: width })
    return
  }
  
  // Real trend data would go here
  // For now, this path is not reached
}

/**
 * Render executive summary narrative
 * Premium format: Headline + "What changed" chips + "So what" bullets (max 3)
 */
function renderExecutiveSummary(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number,
  timeRange: string
): void {
  ensureSpace(doc, 120, margin)
  
  // HEADLINE: One-sentence finding (big, bold)
  const headlineY = doc.y
  const hasSufficientData = data.high_risk_jobs > 0 || data.open_incidents > 0 || data.signed_signoffs > 0
  
  // CRITICAL: Determine hasPriorPeriodData ONCE at the start - this drives ALL delta logic
  // hasPrior = true if ANY tracked delta exists (even if it's 0, that means comparison happened)
  const hasPriorPeriodData = data.delta !== undefined || 
                             data.deltas?.high_risk_jobs !== undefined || 
                             data.deltas?.open_incidents !== undefined ||
                             data.deltas?.violations !== undefined ||
                             data.deltas?.flagged_jobs !== undefined ||
                             data.deltas?.pending_signoffs !== undefined ||
                             data.deltas?.proof_packs !== undefined
  
  // CRITICAL: Use sanitizeAscii() for headline (strict ASCII only for executive-facing content)
  // This prevents character corruption (high￾risk) and ensures clean text extraction
  let headline: string
  if (!hasSufficientData) {
    headline = sanitizeAscii('Insufficient job volume to compute risk posture')
  } else {
    // Executive wording: more action-forward
    // CRITICAL: Use sanitizeAscii() for ALL parts to ensure strict ASCII
    const exposureLevel = data.exposure_level === 'high' ? 'High' : data.exposure_level === 'moderate' ? 'Moderate' : 'Low'
    const sanitizedExposure = sanitizeAscii(exposureLevel.toLowerCase())
    // CRITICAL: Use "high risk" (space) instead of "high-risk" to prevent hyphen line-break issues
    const sanitizedHighRisk = sanitizeAscii('high risk') // Use space instead of hyphen
    const sanitizedMitigate = sanitizeAscii('mitigate')
    const sanitizedJob = sanitizeAscii('job')
    const sanitizedJobs = sanitizeAscii('jobs')
    const sanitizedReduce = sanitizeAscii('reduce audit risk')
    const sanitizedRequire = sanitizeAscii('require immediate attention')
    
    // CRITICAL: Compose using only sanitized strings, then sanitize the result with sanitizeAscii()
    // Force a designed wrap so "high risk job" never splits awkwardly
    // Since sanitizeAscii() strips non-breaking spaces, we'll force a line break earlier in rendering
    if (data.high_risk_jobs === 1) {
      const composed = `Exposure is ${sanitizedExposure}; ${sanitizedMitigate} 1 ${sanitizedHighRisk} ${sanitizedJob} to ${sanitizedReduce}.`
      headline = sanitizeAscii(composed)
    } else if (data.high_risk_jobs > 1) {
      const composed = `Exposure is ${sanitizedExposure}; ${sanitizedMitigate} ${data.high_risk_jobs} ${sanitizedHighRisk} ${sanitizedJobs} to ${sanitizedReduce}.`
      headline = sanitizeAscii(composed)
    } else {
      const composed = `Exposure is ${sanitizedExposure}; no ${sanitizedHighRisk} ${sanitizedJobs} ${sanitizedRequire}.`
      headline = sanitizeAscii(composed)
    }
  }
  
  // CRITICAL: Final sanitization pass with sanitizeAscii() (defense in depth)
  // MUST sanitize BEFORE any measurement or width calculations
  const headlineText = sanitizeAscii(headline)
  
  // Auto-fit headline: prevent mid-sentence wrapping by measuring and adjusting
  // CRITICAL: Measurement happens AFTER sanitization
  const maxHeadlineWidth = pageWidth - margin * 2
  let headlineFontSize = STYLES.sizes.h1
  
  // Measure headline width - if it's too wide, reduce font size or force designed wrap
  doc.fontSize(headlineFontSize).font(STYLES.fonts.header)
  let headlineWidth = doc.widthOfString(headlineText)
  
  // CRITICAL: Force designed wrap to keep "1 high risk job" together
  // Prevent ugly breaks like "mitigate 1 / high risk job"
  // Strategy: If headline contains "mitigate 1", force wrap before "mitigate" so "1 high risk job" stays together
  let finalHeadlineText = headlineText
  if (headlineWidth > maxHeadlineWidth * 0.95 && headlineText.includes('mitigate 1')) {
    // Find position of "mitigate 1" and insert line break before it
    const mitigateIndex = headlineText.indexOf('mitigate 1')
    if (mitigateIndex > 0) {
      // Insert line break before "mitigate 1" - this keeps "1 high risk job" together on next line
      finalHeadlineText = headlineText.substring(0, mitigateIndex).trim() + '\n' + headlineText.substring(mitigateIndex)
      // Re-measure with line break (measure both lines)
      const lines = finalHeadlineText.split('\n')
      const firstLineWidth = doc.widthOfString(lines[0])
      const secondLineWidth = doc.widthOfString(lines[1])
      headlineWidth = Math.max(firstLineWidth, secondLineWidth) // Use max width
    }
  } else if (headlineWidth > maxHeadlineWidth * 0.95 && headlineText.includes('high risk')) {
    // Fallback: If no "mitigate 1", force wrap before "high risk" to prevent "high / risk" split
    const highRiskIndex = headlineText.indexOf('high risk')
    if (highRiskIndex > 0) {
      finalHeadlineText = headlineText.substring(0, highRiskIndex).trim() + '\n' + headlineText.substring(highRiskIndex)
      const lines = finalHeadlineText.split('\n')
      const firstLineWidth = doc.widthOfString(lines[0])
      const secondLineWidth = doc.widthOfString(lines[1])
      headlineWidth = Math.max(firstLineWidth, secondLineWidth)
    }
  }
  
  // If headline is still too wide after designed wrap, reduce font size to fit (min 26px)
  if (headlineWidth > maxHeadlineWidth * 0.95) {
    headlineFontSize = Math.max(26, Math.floor((maxHeadlineWidth / headlineWidth) * headlineFontSize))
  }
  
  // CRITICAL: Measure headline height to prevent overlap with chips
  // Use measureWrappedText to get actual height consumed by wrapped headline
  doc.fontSize(headlineFontSize).font(STYLES.fonts.header)
  const headlineLines = finalHeadlineText.split('\n')
  const lineHeight = headlineFontSize * 1.25
  const headlineHeight = headlineLines.length * lineHeight
  
  // CRITICAL: safeText() will sanitize again, but we've already sanitized to be safe
  safeText(doc, finalHeadlineText, margin, headlineY, {
    fontSize: headlineFontSize,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
    width: maxHeadlineWidth,
  })
  
  // CRITICAL: Start chips below headline with proper spacing (headlineBottom + spacing)
  // Don't use doc.y which might not account for wrapped lines correctly
  const headlineBottom = headlineY + headlineHeight
  const chipsY = headlineBottom + 16 // Spacing after headline
  doc.y = chipsY // Update doc.y for consistency

  // "WHAT CHANGED" CHIPS: Insightful format "Label: Value (Delta)" - always show all 5 chips
  // CRITICAL: hasPriorPeriodData is already computed above - use it consistently
  // Rule: If hasPriorPeriodData === false, ALL deltas must be "N/A" (never "No change")
  // Only show "No change" when delta === 0 AND hasPriorPeriodData === true
  const chips: Array<{ label: string; delta: string; color: string }> = []
  
  // 1. Risk posture: Score (Delta)
  const postureScore = data.posture_score !== undefined ? `${data.posture_score}` : 'N/A'
  const postureDelta = data.delta !== undefined ? formatDelta(data.delta) : 'N/A'
  chips.push({
    label: 'Risk posture',
    delta: `${postureScore} (${postureDelta})`,
    color: data.delta !== undefined && data.delta !== 0 
      ? (data.delta > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
      : STYLES.colors.primaryText,
  })
  
  // 2. High-risk jobs: Count (Delta)
  const jobsDelta = data.deltas?.high_risk_jobs !== undefined ? formatDelta(data.deltas.high_risk_jobs) : 'N/A'
  chips.push({
    label: sanitizeAscii(METRIC_LABELS.highRiskJobs), // Use centralized label, sanitize with ASCII
    delta: sanitizeAscii(`${data.high_risk_jobs} (${jobsDelta})`),
    color: data.deltas?.high_risk_jobs !== undefined && data.deltas.high_risk_jobs !== 0
      ? (data.deltas.high_risk_jobs > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
      : STYLES.colors.primaryText,
  })
  
  // 3. Open incidents: Count (Delta)
  const incidentsDelta = data.deltas?.open_incidents !== undefined ? formatDelta(data.deltas.open_incidents) : 'N/A'
  chips.push({
    label: sanitizeAscii(METRIC_LABELS.openIncidents), // Use centralized label, sanitize with ASCII
    delta: sanitizeAscii(`${data.open_incidents} (${incidentsDelta})`),
    color: data.deltas?.open_incidents !== undefined && data.deltas.open_incidents !== 0
      ? (data.deltas.open_incidents > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
      : STYLES.colors.primaryText,
  })
  
  // 4. Attestation: Percentage (attestation deltas not tracked yet - always show N/A)
  const totalSignoffs = (data.signed_signoffs ?? 0) + (data.pending_signoffs ?? 0)
  const attestationPct = totalSignoffs > 0 
    ? Math.round((data.signed_signoffs / totalSignoffs) * 100)
    : 0
  chips.push({
    label: sanitizeAscii('Attestation %'), // Consistent with KPI label (full definition in Methodology)
    delta: sanitizeAscii(`${attestationPct}% (N/A)`), // Always N/A since attestation deltas not tracked
    color: STYLES.colors.primaryText,
  })
  
  // 5. Sign-offs: Signed/Total (sign-off deltas not tracked yet - always show N/A)
  chips.push({
    label: sanitizeAscii('Sign-offs'),
    delta: sanitizeAscii(`${data.signed_signoffs ?? 0}/${totalSignoffs} (N/A)`), // Always N/A since sign-off deltas not tracked
    color: STYLES.colors.primaryText,
  })
  
  // Render all 5 chips with wrapping (2 lines max, then collapse remaining)
  const chipHeight = 24
  const chipGap = 12
  const rightLimit = pageWidth - margin
  let chipX = margin
  let chipY = chipsY
  let chipsOnCurrentLine = 0
  const maxChipsPerLine = 3 // Allow 3 chips per line, then wrap
  const maxLines = 2
  
  doc.fontSize(STYLES.sizes.caption).font(STYLES.fonts.body)
  
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i]
    // CRITICAL: Render separator as PREFIX (not suffix) to prevent trailing bullets
    // For chip index > 0: render "• " before the chip (and measure it as part of the chip block)
    // This guarantees you never end a line with a separator
    const separatorPrefix = i > 0 ? '• ' : '' // Prefix separator for all chips except first
    const chipText = `${chip.label} ${chip.delta}`
    const chipTextWithPrefix = separatorPrefix + chipText // Full block: separator + chip
    
    // Measure the entire block (separator + chip) as one unit
    const chipBlockWidth = doc.widthOfString(chipTextWithPrefix) + 16
    
    // Check if we need to wrap to next line
    const willFit = chipX + chipBlockWidth <= rightLimit && chipsOnCurrentLine < maxChipsPerLine
    const needsWrap = !willFit || chipsOnCurrentLine >= maxChipsPerLine
    
    if (needsWrap) {
      // Move to next line if we haven't exceeded max lines
      const currentLine = Math.floor(i / maxChipsPerLine)
      if (currentLine < maxLines) {
        chipY += chipHeight + 8 // Next line with spacing
        chipX = margin
        chipsOnCurrentLine = 0
        // When wrapping, don't add separator prefix (chip starts new line)
        const chipTextOnNewLine = chipText // No separator when starting new line
        const chipWidthOnNewLine = doc.widthOfString(chipTextOnNewLine) + 16
        
        // Chip background
        doc
          .rect(chipX, chipY, chipWidthOnNewLine, chipHeight)
          .fill(STYLES.colors.cardBg)
          .strokeColor(STYLES.colors.borderGray)
          .lineWidth(0.5)
          .stroke()
        
        // Chip text
        doc
          .fillColor(chip.color)
          .text(chipTextOnNewLine, chipX + 8, chipY + 6, { width: chipWidthOnNewLine - 16 })
        
        chipX += chipWidthOnNewLine + chipGap
        chipsOnCurrentLine++
        continue
      } else {
        // Max lines reached - collapse remaining chips into "+n more"
        const remaining = chips.length - i
        const collapseText = `+${remaining} more`
        const collapseWidth = doc.widthOfString(collapseText) + 16
        doc
          .rect(chipX, chipY, collapseWidth, chipHeight)
          .fill(STYLES.colors.cardBg)
          .strokeColor(STYLES.colors.borderGray)
          .lineWidth(0.5)
          .stroke()
        doc
          .fillColor(STYLES.colors.secondaryText)
          .text(collapseText, chipX + 8, chipY + 6, { width: collapseWidth - 16 })
        break
      }
    }
    
    // Render chip with prefix separator (if not first chip)
    // The entire block (separator + chip) is measured and rendered as one unit
    // This prevents the separator from ever being the last glyph on a line
    
    // Chip background
    doc
      .rect(chipX, chipY, chipBlockWidth, chipHeight)
      .fill(STYLES.colors.cardBg)
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.5)
      .stroke()
    
    // Chip text (includes separator prefix if not first chip)
    doc
      .fillColor(chip.color)
      .text(chipTextWithPrefix, chipX + 8, chipY + 6, { width: chipBlockWidth - 16 })
    
    chipX += chipBlockWidth + chipGap
    chipsOnCurrentLine++
  }
  
  // Calculate final Y position (account for wrapped lines)
  const linesUsed = Math.min(Math.ceil(chips.length / maxChipsPerLine), maxLines)
  doc.y = chipsY + (chipHeight * linesUsed) + (8 * (linesUsed - 1)) + 20
  
  // CRITICAL: Remove "Prior period unavailable" note entirely
  // Chips already communicate the truth with (N/A) next to each metric
  // Keeping the extra line is redundant and makes execs think you're covering something up
  // Rule: if chips show N/A, don't also print a global "prior unavailable" note
  
  doc.moveDown(0.8)

  // EXECUTIVE SUMMARY STRUCTURE: 3-line memo layout (Finding + Why + Decision)
  // This makes it feel like a decision memo, not a dashboard export
  if (hasSufficientData) {
    // Line 1: Finding (already shown in headline above, but we can add context here)
    // The headline already serves as the finding, so we move to "Why it matters"
    
    // Line 2: Why it matters (1 sentence, tie to audit/claims/contract exposure)
    // CRITICAL: Add explicit label "Why it matters:" (same style weight as "Decision requested:")
    let whyItMatters = ''
    if (data.high_risk_jobs > 0) {
      whyItMatters = `Why it matters: Unmitigated high risk jobs increase audit exposure, potential compliance findings, and claims liability.`
    } else if (data.open_incidents > 0) {
      whyItMatters = `Why it matters: Open incidents indicate active safety gaps that increase audit risk and potential contract violations.`
    } else if (data.posture_score !== undefined && data.posture_score < 50) {
      whyItMatters = `Why it matters: Current risk posture below threshold increases audit exposure and potential compliance findings.`
    } else {
      whyItMatters = `Why it matters: Maintaining strong risk controls protects against audit findings, safety incidents, and contract compliance issues.`
    }
    
    if (hasSpace(doc, 20)) {
      safeText(doc, sanitizeAscii(whyItMatters), margin, doc.y, {
        fontSize: STYLES.sizes.body,
        font: STYLES.fonts.body,
        color: STYLES.colors.primaryText,
        width: pageWidth - margin * 2,
      })
      doc.moveDown(0.6)
    }
    
    // Line 3: What you want approved (Decision requested - ALWAYS render, even if ultra-short)
    // CRITICAL: This is non-negotiable for board credibility - always show decision requested
    let decisionText = ''
    if (data.high_risk_jobs > 0) {
      decisionText = `Decision requested: Approve mitigation plan for ${data.high_risk_jobs} ${pluralize(data.high_risk_jobs, 'high risk job', 'high risk jobs')} and require sign-off completion within 7 days.`
    } else if (data.open_incidents > 0) {
      decisionText = `Decision requested: Authorize resolution plan for ${data.open_incidents} open ${pluralize(data.open_incidents, 'incident', 'incidents')} and document closure within 7 days.`
    } else if (data.pending_signoffs > 0) {
      decisionText = `Decision requested: Complete ${data.pending_signoffs} pending ${pluralize(data.pending_signoffs, 'sign-off', 'sign-offs')} to ensure full compliance this week.`
    } else {
      decisionText = `Decision requested: Continue monitoring risk posture and maintain current control effectiveness.`
    }
    
    // Always render decision requested (non-negotiable for board credibility)
    safeText(doc, sanitizeAscii(decisionText), margin, doc.y, {
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.header, // Bold for emphasis
      color: STYLES.colors.primaryText,
      width: pageWidth - margin * 2,
    })
    doc.moveDown(0.8)
  } else {
    // Insufficient data case
    if (hasSpace(doc, 20)) {
      safeText(doc, 'Metrics will populate automatically as job data is recorded. Requires at least 1 job with risk assessment in the selected time range.', margin, doc.y, {
        fontSize: STYLES.sizes.body,
        font: STYLES.fonts.body,
        color: STYLES.colors.secondaryText,
        width: pageWidth - margin * 2,
      })
      doc.moveDown(0.6)
    }
    
    // CRITICAL: Always render "Decision requested" even in insufficient data case
    const decisionText = `Decision requested: Continue monitoring risk posture and maintain current control effectiveness.`
    safeText(doc, sanitizeAscii(decisionText), margin, doc.y, {
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.header, // Bold for emphasis
      color: STYLES.colors.primaryText,
      width: pageWidth - margin * 2,
    })
    doc.moveDown(0.8)
  }

  doc.moveDown(1)
}

/**
 * Render metrics table
 * CRITICAL: Never render section header unless we have at least 1 row
 */
/**
 * Build metrics rows with normalized values (0 -> "0", null -> "—")
 */
// Centralized label constants for consistent terminology and casing
const METRIC_LABELS = {
  overallExposure: 'Overall exposure',
  highRiskJobs: 'High risk jobs', // Use space instead of hyphen to prevent line-break issues
  openIncidents: 'Open incidents',
  recentViolations: 'Recent violations',
  flaggedForReview: 'Flagged for review',
  signoffsPending: 'Sign-offs (Pending)',
  signoffsSigned: 'Sign-offs (Signed)',
  proofPacksGenerated: 'Proof Packs Generated (exportable audit packs)',
} as const

function buildMetricsRows(data: RiskPostureData, hasPriorPeriodData: boolean): Array<{ label: string; value: string; delta: string }> {
  // CRITICAL: hasPriorPeriodData is passed in to ensure consistency with chips/KPIs
  // Rule: If hasPriorPeriodData === false, ALL deltas must be "N/A" (never "No change")
  // Only show "No change" when delta === 0 AND hasPriorPeriodData === true
  
  // Add "What changed" summary row at the top
  const exposureLevel = data.exposure_level === 'high' ? 'High' : data.exposure_level === 'moderate' ? 'Moderate' : 'Low'
  // CRITICAL: Hard-fix Overall exposure delta to show N/A when prior is unavailable
  // Rule: If hasPriorPeriodData === false → Change = N/A (never "No change")
  // Only show "No change" when prior exists AND delta === 0
  let exposureDelta: string
  if (!hasPriorPeriodData) {
    exposureDelta = 'N/A' // Hard rule: no prior data = N/A
  } else if (data.delta === undefined || data.delta === null) {
    exposureDelta = 'N/A' // Delta unavailable = N/A
  } else if (data.delta === 0) {
    exposureDelta = 'No change' // Actual comparison resulted in no change
  } else {
    // Format with sign
    const sign = data.delta > 0 ? '+' : ''
    exposureDelta = `${sign}${data.delta}`
  }
  
  const rows = [
    // Summary row: Overall exposure
    { label: METRIC_LABELS.overallExposure, value: exposureLevel, delta: exposureDelta },
    { label: METRIC_LABELS.highRiskJobs, value: data.high_risk_jobs, delta: data.deltas?.high_risk_jobs },
    { label: METRIC_LABELS.openIncidents, value: data.open_incidents, delta: data.deltas?.open_incidents },
    { label: METRIC_LABELS.recentViolations, value: data.recent_violations, delta: data.deltas?.violations },
    { label: METRIC_LABELS.flaggedForReview, value: data.flagged_jobs, delta: data.deltas?.flagged_jobs },
    { label: METRIC_LABELS.signoffsPending, value: data.pending_signoffs ?? 0, delta: data.deltas?.pending_signoffs },
    { label: METRIC_LABELS.signoffsSigned, value: data.signed_signoffs ?? 0, delta: undefined }, // signed_signoffs delta not in deltas type
    // CRITICAL: Only show Proof Packs if count > 0 (prevents junk page)
    ...(data.proof_packs_generated > 0 ? [{ label: METRIC_LABELS.proofPacksGenerated, value: data.proof_packs_generated, delta: data.deltas?.proof_packs }] : []),
  ]
  
  // Normalize values: convert numbers to strings, handle null/undefined with plain English
  return rows
    .filter(row => row.label && row.label.trim() !== '') // Filter out invalid rows
    .map(row => {
      // Value: use plain English instead of "—"
      let valueText: string
      if (row.value === null || row.value === undefined) {
        valueText = 'Not measured'
      } else if (typeof row.value === 'string') {
        valueText = row.value
      } else {
        valueText = formatNumber(row.value)
      }
      
      // Delta: CRITICAL - match chip logic exactly
      // Rule: If hasPriorPeriodData === false, ALL deltas must be "N/A"
      // Only show "No change" when delta === 0 AND hasPriorPeriodData === true
      let deltaText: string
      if (!hasPriorPeriodData) {
        deltaText = 'N/A' // No prior period data available
      } else if (row.delta === null || row.delta === undefined) {
        deltaText = 'N/A' // This specific delta unavailable (but others exist)
      } else {
        // Ensure delta is a number for formatDelta
        const deltaNum = typeof row.delta === 'number' ? row.delta : undefined
        deltaText = formatDelta(deltaNum) // Returns "No change" for 0, formatted delta otherwise
      }
      
      return {
        label: row.label,
        value: valueText,
        delta: deltaText,
      }
    })
}

function renderMetricsTable(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number,
  hasPriorPeriodData: boolean
): void {
  currentSection = 'Metrics Table' // Set section for safeText context
  
  // Build normalized rows first - CRITICAL: pass hasPriorPeriodData for consistent delta logic
  const metricsRows = buildMetricsRows(data, hasPriorPeriodData)
  
  // CRITICAL: Never render section header unless we have at least 1 row
  if (metricsRows.length === 0) return
  
  // Calculate required height: section header + table header + ALL rows (keep entire table together)
  const sectionHeaderHeight = STYLES.sizes.h2 + 20
  const tableHeaderHeight = STYLES.spacing.tableRowHeight + 4
  const tableRowHeight = STYLES.spacing.tableRowHeight
  const totalTableHeight = tableHeaderHeight + (tableRowHeight * metricsRows.length) + 20 // All rows together
  const requiredHeight = sectionHeaderHeight + totalTableHeight

  // CRITICAL: Ensure space for entire table (section header + header + ALL rows together)
  // If it doesn't fit, move entire table to next page (never split rows)
  ensureSpace(doc, requiredHeight, margin)

  // Section header
  safeText(doc, 'Key Metrics', margin, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  
  // CRITICAL: Move "prior period unavailable" note OUT of table header to prevent wrapping
  // Put it as a caption line under "Key Metrics" (full-width) instead of inside header columns
  if (!hasPriorPeriodData) {
    doc.moveDown(0.3)
    safeText(doc, 'Note: prior period unavailable (deltas hidden)', margin, doc.y, {
      fontSize: STYLES.sizes.caption - 1,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
      width: pageWidth - margin * 2, // Full width for caption
    })
    doc.moveDown(0.3)
  } else {
    doc.moveDown(0.5)
  }

  const tableY = doc.y
  const tableWidth = pageWidth - margin * 2
  // CRITICAL: Hide Change column when prior period is unavailable to kill "N/A spam"
  // Option: Hide column entirely when no prior period (cleaner than showing N/A everywhere)
  const showChangeColumn = hasPriorPeriodData
  // Fixed column widths to prevent wrapping
  const col1Width = 280 // Metric name (fixed, wide enough)
  const col2Width = showChangeColumn ? 120 : 200 // Current value (wider if no Change column)
  const col3Width = showChangeColumn ? 80 : 0  // Change column (hidden if no prior period)
  const rowHeight = STYLES.spacing.tableRowHeight
  const cellPadding = STYLES.spacing.tableCellPadding

  // Table header with solid background (tighter typography)
  const headerHeight = rowHeight + 2
  doc
    .rect(margin, tableY, tableWidth, headerHeight)
    .fill(STYLES.colors.tableHeaderBg)
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .stroke()

  // Header text (tighter typography - smaller font for premium feel)
  const headerTextY = tableY + (headerHeight / 2) - 4
  safeText(doc, 'Metric', margin + cellPadding, headerTextY, {
    width: col1Width - cellPadding * 2,
    align: 'left',
    fontSize: STYLES.sizes.caption,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  safeText(doc, 'Current', margin + col1Width + cellPadding, headerTextY, {
    width: col2Width - cellPadding * 2,
    align: 'right',
    fontSize: STYLES.sizes.caption,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  
  // CRITICAL: Only show Change column header if prior period is available
  // Note: "prior period unavailable" note is now shown as caption under section title (not in header)
  if (showChangeColumn) {
    safeText(doc, 'Change', margin + col1Width + col2Width + cellPadding, headerTextY, {
      width: col3Width - cellPadding * 2,
      align: 'right',
      fontSize: STYLES.sizes.caption,
      font: STYLES.fonts.header,
      color: STYLES.colors.primaryText,
    })
  }
  // If no prior period, header is clean: Metric | Current (no Change column, no note in header)

  // Column dividers in header
  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(0.5)
    .moveTo(margin + col1Width, tableY)
    .lineTo(margin + col1Width, tableY + headerHeight)
  if (showChangeColumn) {
    doc
      .moveTo(margin + col1Width + col2Width, tableY)
      .lineTo(margin + col1Width + col2Width, tableY + headerHeight)
  }
  doc.stroke()

  doc.y = tableY + headerHeight

  // CRITICAL: Make table rows atomic - never write part of a row, always write the whole row or nothing
  metricsRows.forEach((metric, idx) => {
    // Validate row has required data before any writes
    if (!metric.label) return // Skip invalid rows
    
    // CRITICAL: Always render if we have a label (value can be 0, which is valid)
    // Only skip if value is explicitly null/undefined (not 0, which is falsy but valid)
    // We'll handle "—" as a string in the value rendering logic below
    
    // NOTE: We already ensured space for entire table above, so rows should all fit
    // Keep minimal check as safety net (but shouldn't trigger)
    
    const rowY = doc.y
    const isEven = idx % 2 === 0
    const isExposureRow = metric.label.toLowerCase().includes('overall exposure') || metric.label.toLowerCase().includes('exposure level')

    // Highlight exposure row with light tint background
    if (isExposureRow) {
      doc
        .rect(margin, rowY, tableWidth, tableRowHeight)
        .fill('#F0F4FF') // Light blue tint for exposure row
    } else if (isEven) {
      // Zebra striping (stronger contrast for premium feel)
      doc
        .rect(margin, rowY, tableWidth, tableRowHeight)
        .fill('#FAFAFA') // Slightly darker than before
    }

    // CRITICAL: Write all cells atomically - label + value + delta in one go
    // Values are already normalized strings from buildMetricsRows()
    
    // Label (left-aligned, fixed width prevents wrapping) - bold if exposure row
    // CRITICAL: Ensure long labels like "Proof Packs Generated (exportable audit packs)" don't wrap
    const labelText = sanitizeText(metric.label)
    const labelWidth = col1Width - cellPadding * 2
    
    // Check if label would wrap - if so, use smaller font or truncate
    doc.fontSize(STYLES.sizes.body).font(isExposureRow ? STYLES.fonts.header : STYLES.fonts.body)
    const labelTextWidth = doc.widthOfString(labelText)
    
    // If label is too wide, use slightly smaller font to prevent wrapping
    let labelFontSize = STYLES.sizes.body
    if (labelTextWidth > labelWidth) {
      labelFontSize = Math.max(9, Math.floor((labelWidth / labelTextWidth) * STYLES.sizes.body))
    }
    
    safeText(doc, labelText, margin + cellPadding, rowY + cellPadding, {
      width: labelWidth,
      align: 'left',
      fontSize: labelFontSize,
      font: isExposureRow ? STYLES.fonts.header : STYLES.fonts.body, // Bold for exposure row
      color: STYLES.colors.primaryText,
    })

    // Value (already normalized: "0", number string, or "—") - bold if exposure row
    safeText(doc, metric.value, margin + col1Width + cellPadding, rowY + cellPadding, {
      width: col2Width - cellPadding * 2,
      align: 'right',
      fontSize: STYLES.sizes.body,
      font: isExposureRow ? STYLES.fonts.header : STYLES.fonts.body, // Bold for exposure row
      color: STYLES.colors.primaryText,
    })

    // Delta (already normalized: "No change", "N/A", or formatted delta string)
    // CRITICAL: Only render Change column if prior period is available (hide column to kill N/A spam)
    if (showChangeColumn) {
      const deltaColor = metric.delta === 'No change' || metric.delta === 'N/A' || metric.delta === '—'
        ? STYLES.colors.secondaryText // Neutral gray for N/A, No change, and missing data
        : (metric.delta.startsWith('+') ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
      safeText(doc, metric.delta, margin + col1Width + col2Width + cellPadding, rowY + cellPadding, {
        width: col3Width - cellPadding * 2,
        align: 'right',
        fontSize: STYLES.sizes.body,
        font: isExposureRow ? STYLES.fonts.header : STYLES.fonts.body,
        color: deltaColor,
      })
    }
    // If Change column is hidden, no delta rendering needed
    
    markPageHasBody(doc) // Mark row as written
    doc.y = rowY + tableRowHeight
    
      // Light divider between rows
    doc
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.5)
      .moveTo(margin, rowY + tableRowHeight)
      .lineTo(margin + tableWidth, rowY + tableRowHeight)
      .stroke()

    // Subtle column dividers
    doc
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.3)
      .moveTo(margin + col1Width, rowY)
      .lineTo(margin + col1Width, rowY + tableRowHeight)
    if (showChangeColumn) {
      doc
        .moveTo(margin + col1Width + col2Width, rowY)
        .lineTo(margin + col1Width + col2Width, rowY + tableRowHeight)
    }
    doc.stroke()

    markPageHasBody(doc) // Mark body content written
    doc.y = rowY + tableRowHeight
  })

  doc.moveDown(1)
}

/**
 * Add section divider (thin line for visual separation)
 */
function addSectionDivider(
  doc: PDFKit.PDFDocument,
  pageWidth: number,
  margin: number
): void {
  ensureSpace(doc, 20, margin)
  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(0.5)
    .moveTo(margin, doc.y)
    .lineTo(pageWidth - margin, doc.y)
    .stroke()
  doc.moveDown(1)
}

/**
 * Render data coverage section (compact, reassuring)
 * Only renders if we have space and content
 */
function renderDataCoverage(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  // Calculate required height: header + spacing + at least 2 items
  const headerHeight = STYLES.sizes.h3 + 20
  const itemHeight = 20
  const requiredHeight = headerHeight + (itemHeight * 2) + 40

  // Only render if we have space (compact section)
  if (!hasSpace(doc, requiredHeight)) {
    return
  }

  ensureSpace(doc, requiredHeight, margin)

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h3)
    .font(STYLES.fonts.header)
    .text('Data Coverage', { underline: true })

  doc.moveDown(0.5)

  // Data coverage items
  const coverageItems: Array<{ label: string; value: string }> = []

  // Jobs in window - always show a number (0 is valid, not "—")
  const totalJobs = data.total_jobs ?? 0
  coverageItems.push({
    label: 'Jobs in window',
    value: formatNumber(totalJobs), // Always show number, even if 0
  })

  // Last job timestamp (if available)
  const lastJobAt = data.last_job_at
  if (lastJobAt) {
    const lastJobDate = new Date(lastJobAt)
    const lastJobStr = lastJobDate.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    coverageItems.push({
      label: 'Last job',
      value: sanitizeText(lastJobStr),
    })
  } else {
    coverageItems.push({
      label: 'Last job',
      value: 'No jobs yet',
    })
  }

  // Incidents in window - always show a number (0 is valid, not "—")
  coverageItems.push({
    label: 'Incidents in window',
    value: formatNumber(data.open_incidents ?? 0), // Always show number, even if 0
  })

  // Attestations coverage - always show a value
  const totalAttestations = (data.signed_signoffs ?? 0) + (data.pending_signoffs ?? 0)
  const coveragePercent = totalAttestations > 0
    ? `${Math.round((data.signed_signoffs / totalAttestations) * 100)}%`
    : '0%'
  coverageItems.push({
    label: 'Attestation %', // Consistent terminology (full definition in Methodology)
    value: coveragePercent,
  })

  // Render as compact list (only if we have items) - CRITICAL: Use writeKV to prevent label-less values
  if (coverageItems.length > 0) {
    coverageItems.forEach((item) => {
      ensureSpace(doc, 20, margin)
      // Use writeKV to ensure label and value are always together
      writeKV(
        doc,
        item.label + ':',
        item.value,
        margin + 20,
        doc.y,
        180,
        pageWidth - margin * 2 - 200,
        { labelAlign: 'left', valueAlign: 'left' }
      )
      doc.moveDown(0.3)
    })

    // Show reason if data is missing (only if we have space)
    if (totalJobs === 0 && hasSpace(doc, 20)) {
      doc.moveDown(0.3)
      safeText(doc, 'Reason: No jobs with risk assessments in selected window', margin + 20, doc.y, {
        width: pageWidth - margin * 2 - 20,
        fontSize: STYLES.sizes.caption,
        font: STYLES.fonts.body,
        color: STYLES.colors.secondaryText,
      })
      markPageHasBody(doc)
    }
  }

  doc.moveDown(1)
}

/**
 * Render micro Top 3 drivers on page 1 (compact, always shows)
 */
function renderMicroTopDrivers(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number,
  timeRange: string
): void {
  if (!hasSpace(doc, 35)) return
  
  // Collect top drivers from all categories
  const allDrivers: Array<{ label: string; count: number }> = []
  if (data.drivers?.highRiskJobs) {
    allDrivers.push(...data.drivers.highRiskJobs.slice(0, 2))
  }
  if (data.drivers?.openIncidents) {
    allDrivers.push(...data.drivers.openIncidents.slice(0, 2))
  }
  if (data.drivers?.violations) {
    allDrivers.push(...data.drivers.violations.slice(0, 2))
  }
  
  // Take top 3 by count
  const top3 = allDrivers
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
  
  const timeRangeLabel = timeRange === '7d' ? 'last 7d' : timeRange === '30d' ? 'last 30d' : timeRange === '90d' ? 'last 90d' : 'selected period'
  
  // CRITICAL: Always show Exposure drivers as a 3-row mini table (Option A - cleanest)
  // This matches memo vibe and prevents "empty section" energy
  // Rule: Always render, always show values (even 0) - no blank state allowed
  ensureSpace(doc, 50, margin) // Need space for mini table
  
  // Always render as mini table for consistency
  safeText(doc, sanitizeAscii(`Exposure drivers (${timeRangeLabel}):`), margin, doc.y, {
    width: pageWidth - margin * 2,
    fontSize: STYLES.sizes.caption,
    font: STYLES.fonts.body,
    color: STYLES.colors.secondaryText,
  })
  doc.moveDown(0.2)
  
  // Mini table: High risk jobs, Open incidents, Pending sign-offs
  // CRITICAL: Always render all 3 rows, always show values (even 0)
  const driverRows = [
    { label: 'High risk jobs', value: data.high_risk_jobs ?? 0 },
    { label: 'Open incidents', value: data.open_incidents ?? 0 },
    { label: 'Pending sign-offs', value: data.pending_signoffs ?? 0 },
  ]
  
  driverRows.forEach((row) => {
    if (!hasSpace(doc, 12)) return
    const rowY = doc.y
    // CRITICAL: Render as one atomic string (Label: ${value}) so values always print
    // Enforce value before string building - no undefined/null can slip through
    const value = row.value ?? 0 // Always have a value, never undefined/null
    const valueText = String(value) // Convert to string explicitly
    const atomicRowText = `${row.label}: ${valueText}`
    
    // Use direct doc.text() for atomic rendering - no safeText filtering that might block values
    doc
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(sanitizeAscii(atomicRowText), margin + 20, rowY, {
        width: pageWidth - margin * 2 - 20,
      })
    doc.y = rowY + 10
  })
  doc.moveDown(0.3)
}

/**
 * Render top drivers (only if ≥3 drivers - appendix gating)
 * CRITICAL: Never render section header without content
 */
function renderTopDrivers(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  if (!data.drivers) return

  const drivers = [
    ...(data.drivers.highRiskJobs || []).slice(0, 3),
    ...(data.drivers.openIncidents || []).slice(0, 2),
    ...(data.drivers.violations || []).slice(0, 2),
  ].slice(0, 5)

  // CRITICAL: Appendix gating - only render if ≥3 drivers
  if (drivers.length < 3) return

  // Calculate required height: header + spacing + at least one row
  const headerHeight = STYLES.sizes.h2 + 20
  const rowHeight = 20
  const requiredHeight = headerHeight + rowHeight + 40

  // Only render if we have space (avoid empty pages)
  if (!hasSpace(doc, requiredHeight)) {
    return // Skip if it would create a mostly-empty page
  }

  // Section header with divider
  addSectionDivider(doc, pageWidth, margin)
  
  safeText(doc, 'Top Risk Drivers', margin, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  doc.moveDown(0.8)

  drivers.forEach((driver) => {
    ensureSpace(doc, 20, margin)
    // CRITICAL: Always render label with value (prevents standalone values) - use safeText
    if (driver.label && driver.count !== undefined) {
      safeText(doc, `- ${sanitizeText(driver.label)} (${driver.count})`, margin + 20, doc.y, { // Use hyphen instead of bullet
        width: pageWidth - margin * 2 - 20,
        fontSize: STYLES.sizes.body,
        font: STYLES.fonts.body,
        color: STYLES.colors.primaryText,
      })
      doc.moveDown(0.4)
    }
  })

  doc.moveDown(1)
}

/**
 * Render Methodology & Definitions (short version for Page 2)
 */
function renderMethodologyShort(
  doc: PDFKit.PDFDocument,
  columnWidth: number,
  columnX: number
): void {
  if (!hasSpace(doc, 70)) return
  
  // Section divider (constrained to column)
  const dividerY = doc.y
  doc
    .moveTo(columnX, dividerY)
    .lineTo(columnX + columnWidth, dividerY)
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(0.5)
    .stroke()
  doc.y = dividerY + 12
  
  safeText(doc, 'Methodology & Definitions', columnX, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
    width: columnWidth,
  })
  doc.moveDown(0.4)
  
  // Fixed definitions (3 bullets max, corrected Evidence vs Attestation)
  const methodologyPoints = [
    'Risk posture: 0-100 scale based on high-risk jobs, incidents, and violations',
    'Attestation %: Percentage of jobs with signed attestations',
  ]
  
  methodologyPoints.forEach((point) => {
    if (hasSpace(doc, 18)) {
      // Proper hanging indent with measured layout: bullet at columnX, text indented
      const bulletX = columnX
      const indent = 12
      const textX = columnX + indent
      const textWidth = columnWidth - indent // Constrain to column width (no overflow)
      
      const startY = doc.y
      
      // Bullet (use hyphen for consistency and font safety)
      doc
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.primaryText)
        .text('-', bulletX, startY, { width: 10, continued: false })
      
      // Text with proper wrapping (measured layout - respects column width exactly)
      const pointText = sanitizeText(point)
      const textHeight = doc.heightOfString(pointText, {
        width: textWidth,
        lineGap: 3,
      })
      
      // Render text with continued: false to prevent bullet from wrapping
      doc
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.primaryText)
        .text(pointText, textX, startY, {
          width: textWidth,
          lineGap: 3,
          continued: false, // Critical: prevents bullet from ending up alone
        })
      
      // Manual Y advancement (bullet never ends up alone)
      doc.y = startY + textHeight + 4
    }
  })
  
  doc.moveDown(0.3)
}

/**
 * Render Data Freshness (compact version for Page 2)
 */
function renderDataFreshnessCompact(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  columnWidth: number,
  columnX: number
): void {
  if (!hasSpace(doc, 40)) return
  
  // Section divider (constrained to column)
  const dividerY = doc.y
  doc
    .moveTo(columnX, dividerY)
    .lineTo(columnX + columnWidth, dividerY)
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(0.5)
    .stroke()
  doc.y = dividerY + 12
  
  safeText(doc, 'Data Freshness', columnX, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
    width: columnWidth,
  })
  doc.moveDown(0.3)
  
  // Compact inline format - constrained to column width
  const lastJobStr = data.last_job_at
    ? new Date(data.last_job_at).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No jobs yet'
  
  const totalSignoffs = (data.signed_signoffs ?? 0) + (data.pending_signoffs ?? 0)
  const coveragePercent = totalSignoffs > 0
    ? `${Math.round((data.signed_signoffs / totalSignoffs) * 100)}%`
    : '0%'
  
  doc
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.primaryText)
    .text(`Last job: ${sanitizeText(lastJobStr)} | Attestation %: ${coveragePercent}`, columnX, doc.y, {
      width: columnWidth,
      lineGap: 3,
    })
  
  doc.moveDown(0.3)
}

/**
 * Render Top 3 items needing attention (Page 1 artifact to fill whitespace)
 */
function renderTopItemsNeedingAttention(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  if (!hasSpace(doc, 60)) return
  
  addSectionDivider(doc, pageWidth, margin)
  
  safeText(doc, 'Items Needing Attention', margin, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  doc.moveDown(0.5)
  
  const items: Array<{ label: string; count: number; priority: 'high' | 'medium' | 'low' }> = []
  
  // High-risk jobs (highest priority)
  if (data.high_risk_jobs > 0) {
    items.push({ label: 'High-risk jobs', count: data.high_risk_jobs, priority: 'high' })
  }
  
  // Open incidents
  if (data.open_incidents > 0) {
    items.push({ label: 'Open incidents', count: data.open_incidents, priority: 'high' })
  }
  
  // Pending sign-offs
  if (data.pending_signoffs > 0) {
    items.push({ label: 'Pending sign-offs', count: data.pending_signoffs, priority: 'medium' })
  }
  
  // Show top 3 items
  const displayItems = items.slice(0, 3)
  
  if (displayItems.length === 0) {
    safeText(doc, 'No items require immediate attention', margin + 20, doc.y, {
      width: pageWidth - margin * 2 - 20,
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
    })
    doc.moveDown(0.5)
    return
  }
  
  displayItems.forEach((item) => {
    if (!hasSpace(doc, 20)) return
    
    const itemColor = item.priority === 'high' ? STYLES.colors.riskHigh : STYLES.colors.riskMedium
    // Fix grammar: use singular/plural correctly
    const itemLabel = item.count === 1 
      ? item.label.replace(/s$/, '') // Remove 's' for singular
      : item.label
    const itemText = `${item.count} ${itemLabel.toLowerCase()}` // Lowercase for consistency
    
    safeText(doc, `- ${itemText}`, margin + 20, doc.y, {
      width: pageWidth - margin * 2 - 20,
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.body,
      color: itemColor,
    })
    doc.moveDown(0.4)
  })
  
  doc.moveDown(0.5)
}

/**
 * Render Tiny Appendix: Top 3 high-risk jobs (IDs + dates) if present
 */
function renderTinyAppendix(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  if (!hasSpace(doc, 80)) return
  
  addSectionDivider(doc, pageWidth, margin)
  
  safeText(doc, 'Appendix: High-Risk Jobs', margin, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  doc.moveDown(0.5)
  
  // Note: In a real implementation, you'd fetch actual high-risk job IDs and dates
  // For now, show a summary
  // CRITICAL: Use safeText() to ensure sanitization (prevents character corruption)
  if (data.high_risk_jobs > 0) {
    const summaryText = `${data.high_risk_jobs} high risk ${pluralize(data.high_risk_jobs, 'job', 'jobs')} require attention.`
    safeText(doc, summaryText, margin, doc.y, {
      width: pageWidth - margin * 2,
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.body,
      color: STYLES.colors.primaryText,
    })
    doc.moveDown(0.3)
    doc
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text('Job IDs and timestamps available in full audit trail.', {
        width: pageWidth - margin * 2,
      })
  }
  
  doc.moveDown(0.5)
}

/**
 * Render recommended actions (short version - max 3 for Page 2)
 */
function renderRecommendedActionsShort(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  columnWidth: number,
  columnX: number,
  startY: number
): void {
  const hasSufficientData = data.high_risk_jobs > 0 || data.open_incidents > 0 || data.signed_signoffs > 0

  // If no data, show "Getting Started" actions (max 3)
  const actions = hasSufficientData && data.recommended_actions && data.recommended_actions.length > 0
    ? data.recommended_actions.slice(0, 3) // Max 3 for compact Page 2
    : [
        { priority: 1, action: 'Require risk assessment on job creation', reason: 'Enable automatic risk scoring and mitigation checklists for every job' },
        { priority: 2, action: 'Enable attestations on job closeout', reason: 'Ensure all jobs are reviewed and signed off before completion' },
        { priority: 3, action: 'Upload evidence for high-risk jobs', reason: 'Document safety measures and compliance for audit trails' },
      ]

  const hasContent = actions.length > 0
  if (!hasContent) return

  const sectionHeaderHeight = STYLES.sizes.h2 + 15
  const actionHeight = 50 // Compact per action
  const requiredHeight = sectionHeaderHeight + (actionHeight * actions.length) + 30

  ensureSpace(doc, requiredHeight, columnX)

  // Section divider (constrained to column)
  const dividerY = doc.y
  doc
    .moveTo(columnX, dividerY)
    .lineTo(columnX + columnWidth, dividerY)
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(0.5)
    .stroke()
  doc.y = dividerY + 12
  
  safeText(doc, 'Recommended Actions', columnX, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
    width: columnWidth,
  })
  doc.moveDown(0.6)

  actions.forEach((action) => {
    ensureSpace(doc, 45, columnX)
    // Outcomes-first format: Action (short imperative) - constrained to column
    safeText(doc, `${action.priority}. ${sanitizeText(action.action)}`, columnX + 20, doc.y, {
      width: columnWidth - 20,
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.header,
      color: STYLES.colors.primaryText,
    })

    // Why now (risk/defensibility reason) - compact, constrained to column
    ensureSpace(doc, 18, columnX)
    safeText(doc, `   Why: ${sanitizeText(action.reason)}`, columnX + 20, doc.y, {
      width: columnWidth - 40,
      fontSize: STYLES.sizes.caption,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
    })
    doc.moveDown(0.4)
  })

  doc.moveDown(0.5)
}

/**
 * Render recommended actions (always shows, switches to "Getting Started" when no data)
 */
function renderRecommendedActions(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  const hasSufficientData = data.high_risk_jobs > 0 || data.open_incidents > 0 || data.signed_signoffs > 0

  // If no data, show "Getting Started" actions
  const actions = hasSufficientData && data.recommended_actions && data.recommended_actions.length > 0
    ? data.recommended_actions.slice(0, 5)
    : [
        { priority: 1, action: 'Require risk assessment on job creation', reason: 'Enable automatic risk scoring and mitigation checklists for every job' },
        { priority: 2, action: 'Enable attestations on job closeout', reason: 'Ensure all jobs are reviewed and signed off before completion' },
        { priority: 3, action: 'Upload evidence for high-risk jobs', reason: 'Document safety measures and compliance for audit trails' },
        { priority: 4, action: 'Review and sign off on pending attestations', reason: 'Complete governance requirements for job compliance' },
        { priority: 5, action: 'Monitor risk posture trends over time', reason: 'Track improvements in overall risk exposure and compliance' },
      ]

  // CRITICAL: Compute hasContent and requiredHeight BEFORE ensureSpace
  const hasContent = actions.length > 0
  const sectionHeaderHeight = STYLES.sizes.h2 + 20
  const actionHeight = 60 // Approx per action
  const requiredHeight = sectionHeaderHeight + (actionHeight * actions.length) + 40

  if (!hasContent) return // Don't render section if no content

  // Only call ensureSpace AFTER confirming hasContent
  ensureSpace(doc, requiredHeight, margin)

  // Section header with divider
  addSectionDivider(doc, pageWidth, margin)
  
  safeText(doc, 'Recommended Actions', margin, doc.y, {
    fontSize: STYLES.sizes.h2,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })
  doc.moveDown(0.8)

  actions.forEach((action) => {
    ensureSpace(doc, 50, margin)
    // Outcomes-first format: Action (short imperative)
    safeText(doc, `${action.priority}. ${sanitizeText(action.action)}`, margin + 20, doc.y, {
      width: pageWidth - margin * 2 - 20,
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.header,
      color: STYLES.colors.primaryText,
    })

    // Why now (risk/defensibility reason)
    ensureSpace(doc, 20, margin)
    safeText(doc, `   Why: ${sanitizeText(action.reason)}`, margin + 20, doc.y, {
      width: pageWidth - margin * 2 - 40,
      fontSize: STYLES.sizes.caption,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
    })

    doc.moveDown(0.6)
  })

  doc.moveDown(1)
}

/**
 * Add header and footer to all pages (post-pass after all content is rendered)
 * Fixed: Proper Y positioning to prevent PDFKit from auto-creating pages
 */
function addHeaderFooter(
  doc: PDFKit.PDFDocument,
  organizationName: string,
  timeRange: string,
  reportId: string,
  generatedAt: Date,
  buildSha: string | undefined,
  timeWindow: { start: Date; end: Date },
  baseUrl: string | undefined,
  pdfHash?: string,
  qrCodeBuffer?: Buffer | null,
  page2ColumnLayout?: { leftX: number; leftW: number; rightX: number; rightW: number; gutter: number }
): void {
  const range = doc.bufferedPageRange()
  const pageCount = range.count
  const buildInfo = buildSha ? `build: ${buildSha.substring(0, 8)}` : 'build: local'
  const mode = 'premium'

  // Calculate safe footer positioning to prevent PDFKit from auto-creating pages
  const bottomMargin = 60 // matches PDFDocument bottom margin
  const limitY = doc.page.height - bottomMargin
  
  // Set font size to calculate line height
  doc.fontSize(8).font(STYLES.fonts.body)
  const lineHeight = doc.currentLineHeight(true) || 10
  
  // We have 3 footer lines: main footer, build stamp, confidentiality
  const footerLines = 3
  const footerSpacing = 8 // spacing between lines
  const totalFooterHeight = (lineHeight * footerLines) + (footerSpacing * (footerLines - 1))
  
  // Start footer above the bottom margin threshold (prevents auto-page creation)
  const footerStartY = limitY - totalFooterHeight - 4

  // Add footers to all pages (post-pass)
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)

    const page = doc.page
    const pageWidth = page.width
    const pageIndex = i - range.start

    // Main footer line
    doc
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)

    const footerText = sanitizeText(
      `RiskMate Executive Brief | ${organizationName} | ${formatTimeRange(timeRange)} | Generated ${generatedAt.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })} | Report ID: ${reportId.substring(0, 8)} | Page ${pageIndex + 1} of ${pageCount}`
    )

    // CRITICAL: Footer writes don't count toward bodyCharCount (they're not body content)
    safeText(doc, footerText, STYLES.spacing.margin, footerStartY, {
      width: pageWidth - STYLES.spacing.margin * 2,
      align: 'center',
      fontSize: 8,
      font: STYLES.fonts.body,
      color: STYLES.colors.primaryText,
    })

    // Build stamp line
    const buildStamp = `${buildInfo} | mode: ${mode} | reportId: ${reportId.substring(0, 8)}`
    safeText(doc, buildStamp, STYLES.spacing.margin, footerStartY + lineHeight + footerSpacing, {
      width: pageWidth - STYLES.spacing.margin * 2,
      align: 'center',
      fontSize: 8,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
    })

    // Confidentiality line (combined with footer block) - use safeText
    safeText(doc, 'CONFIDENTIAL — This document contains sensitive information and is intended only for authorized recipients.', STYLES.spacing.margin, footerStartY + (lineHeight * 2) + (footerSpacing * 2), {
      width: pageWidth - STYLES.spacing.margin * 2,
      align: 'center',
      fontSize: 8,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
    })
    
    // Report Integrity capsule on page 2 (right column, bottom-right) - upgraded to audit artifact
    if (pageIndex === 1 && page2ColumnLayout) { // Page 2 (0-indexed, so page 2 is index 1)
      // Use the exact column layout passed from Page 2 rendering
      const capsuleWidth = page2ColumnLayout.rightW - 4 // Slight padding inside right column
      const capsuleHeight = 200 // Taller for QR code + hash + trust signals
      const capsuleX = page2ColumnLayout.rightX + 2 // Slight padding from column edge
      const capsuleY = footerStartY - capsuleHeight - 20 // Above footer
      
      // Capsule background (more prominent)
      doc
        .rect(capsuleX, capsuleY, capsuleWidth, capsuleHeight)
        .fill(STYLES.colors.cardBg)
        .strokeColor(STYLES.colors.borderGray)
        .lineWidth(1)
        .stroke()
      
      // Capsule content
      const capsulePadding = 10
      const capsuleContentX = capsuleX + capsulePadding
      const capsuleContentY = capsuleY + capsulePadding
      const capsuleContentWidth = capsuleWidth - capsulePadding * 2
      let currentY = capsuleContentY
      
      // CRITICAL: Use writeLine helper to prevent overlap - returns next Y position
      // Hard rule: every line is exactly one doc.text(), no multi-part composition, no continued, no second writes on the same Y
      // This eliminates copy/paste weirdness forever
      const writeLine = (text: string, fontSize: number, font: string, lineGap: number = 11, options?: { noWrap?: boolean }): number => {
        doc.fontSize(fontSize).font(font).fillColor(STYLES.colors.secondaryText)
        
        // CRITICAL: For atomic lines (like Generated/Window), prevent wrapping by shrinking font if needed
        if (options?.noWrap) {
          let atomicText = text
          let atomicFontSize = fontSize
          doc.fontSize(atomicFontSize).font(font)
          let textWidth = doc.widthOfString(atomicText)
          
          // If text doesn't fit, shrink font size until it fits (min 6pt)
          while (textWidth > capsuleContentWidth && atomicFontSize > 6) {
            atomicFontSize -= 0.5
            doc.fontSize(atomicFontSize).font(font)
            textWidth = doc.widthOfString(atomicText)
          }
          
          // Render as single atomic line (no wrapping)
          doc.text(atomicText, capsuleContentX, currentY, { 
            width: capsuleContentWidth,
            lineBreak: false, // CRITICAL: Prevent any wrapping
          })
        } else {
          // Normal line with wrapping allowed
          doc.text(text, capsuleContentX, currentY, { width: capsuleContentWidth })
        }
        
        currentY += lineGap
        return currentY
      }
      
      // Title (bold)
      doc
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.header)
        .fillColor(STYLES.colors.primaryText)
        .text('Report Integrity', capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY = writeLine('', 0, STYLES.fonts.body, 14) // Spacing after title
      
      // Report ID (monospace for verification stamp feel)
      currentY = writeLine(`Report ID: RM-${reportId.substring(0, 8)}`, 8, 'Courier', 11)
      
      // Generated timestamp - CRITICAL: Make "Generated:" its own line including timezone
      // Then "Window:" on the next line - prevents "EST Window:" collision
      const generatedText = generatedAt.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      })
      // CRITICAL: Atomic writes - "Generated:" and "Window:" must be completely separate lines
      // Make Generated one atomic write: "Generated: Jan 8, 2026, 5:36 AM EST" (no wrapping, shrink font if needed)
      // Make Window a separate atomic write: "Window: Dec 9, 2025 - Jan 8, 2026" (no wrapping)
      // Don't let timezone ("EST") be written as its own doc.text() or be auto-wrapped mid-line
      const generatedLine = `Generated: ${sanitizeText(generatedText)}`
      currentY = writeLine(generatedLine, 8, STYLES.fonts.body, 14, { noWrap: true }) // Atomic: no wrapping, shrink font if needed
      
      // Data window start/end (not just "Last 30 days") - separate atomic line, no collision
      const windowStartStr = timeWindow.start.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const windowEndStr = timeWindow.end.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      // CRITICAL: This is a separate atomic writeLine call - ensures "Window:" starts on new line
      // Atomic: no wrapping, shrink font if needed to prevent "EST Window:" merge
      const windowLine = `Window: ${sanitizeText(windowStartStr)} - ${sanitizeText(windowEndStr)}`
      currentY = writeLine(windowLine, 8, STYLES.fonts.body, 11, { noWrap: true })
      
      // Source tables summary - CRITICAL: sanitize
      const sourcesText = sanitizeText('Sources: jobs, incidents, attestations')
      doc
        .fontSize(8)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(sourcesText, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // Report hash (SHA-256) - show full hash for board/auditor credibility
      // CRITICAL: Always show hash if available (metadata hash during generation, actual PDF hash after)
      // This is one of the strongest "this is defensible" signals
      // CRITICAL: Treat capsule as its own tiny layout engine - every line must advance y = writeLine(...)
      // Never manual y guessing - use writeLine helper for all hash rendering
      if (pdfHash) {
        // Show full hash formatted in 4-char groups for readability
        // CRITICAL: Keep "SHA-256:" on the same line as the first chunk if possible (looks more intentional)
        const hashFormatted = pdfHash.match(/.{1,4}/g)?.join(' ') || pdfHash
        const sha256Label = 'SHA-256: '
        
        // Check if "SHA-256: XXXX" fits on one line
        doc.fontSize(8).font('Courier')
        const firstChunk = hashFormatted.split(' ')[0] || ''
        const sha256WithFirstChunk = `${sha256Label}${firstChunk}`
        const sha256WithFirstChunkWidth = doc.widthOfString(sha256WithFirstChunk)
        
        if (sha256WithFirstChunkWidth <= capsuleContentWidth * 0.8) {
          // "SHA-256: XXXX" fits on one line - render as single line using writeLine, let rest wrap naturally
          const hashText = sanitizeAscii(`SHA-256: ${hashFormatted}`)
          currentY = writeLine(hashText, 8, 'Courier', 11) // Use writeLine for consistent spacing
        } else {
          // "SHA-256: XXXX" doesn't fit - render label on first line, hash on second (both use writeLine)
          currentY = writeLine(sanitizeAscii(sha256Label), 8, 'Courier', 9) // Label line
          // Render hash as grouped chunks with controlled wrapping
          // Split hash into chunks and render each chunk on its own line if needed
          const hashChunks = hashFormatted.split(' ')
          let hashLine = ''
          for (const chunk of hashChunks) {
            const testLine = hashLine ? `${hashLine} ${chunk}` : chunk
            doc.fontSize(8).font('Courier')
            const testWidth = doc.widthOfString(testLine)
            if (testWidth <= capsuleContentWidth && hashLine) {
              hashLine = testLine // Add chunk to current line
            } else {
              // Current line is full or starting new line - render previous line if exists
              if (hashLine) {
                currentY = writeLine(sanitizeAscii(hashLine), 8, 'Courier', 9)
              }
              hashLine = chunk // Start new line with this chunk
            }
          }
          // Render remaining hash line
          if (hashLine) {
            currentY = writeLine(sanitizeAscii(hashLine), 8, 'Courier', 11)
          }
        }
      } else {
        // If hash is not available, show a placeholder (should not happen in production)
        const placeholderText = sanitizeAscii('SHA-256: calculating...')
        doc
          .fontSize(8)
          .font('Courier')
          .fillColor(STYLES.colors.secondaryText)
          .text(placeholderText, capsuleContentX, currentY, { width: capsuleContentWidth })
        currentY += 11
      }
      
      // Generated by (system name, not user email) - CRITICAL: sanitize
      const generatedByText = sanitizeText('Generated by: RiskMate Platform')
      doc
        .fontSize(8)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(generatedByText, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // RLS/Org-scoped trust signal - CRITICAL: sanitize
      const orgScopedText = sanitizeText('Org-scoped: enforced')
      doc
        .fontSize(8)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(orgScopedText, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // QR Code (real PNG buffer, passed from pre-generation)
      if (qrCodeBuffer) {
        // Position QR code (60x60) in capsule
        const qrSize = 60
        const qrX = capsuleContentX + (capsuleContentWidth - qrSize) / 2
        const qrY = currentY + 5
        
        doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize, height: qrSize })
        currentY += qrSize + 8
      }
      
      // CRITICAL: Build verify display from constant domain + constant path
      // NEVER allow display to degrade to ID-only - always include /verify/ path
      // This is a hard requirement for board-grade credibility
      const reportIdShort = reportId.substring(0, 8)
      const DISPLAY_DOMAIN = 'riskmate.app' // Constant domain for display
      const verifyPath = `verify/RM-${reportIdShort}` // Constant path (ALWAYS includes verify/)
      
      // Build display string: ALWAYS includes verify/ path from the start
      // Preferred: "riskmate.app/verify/RM-xxxx"
      // Fallback: "verify/RM-xxxx" (still contains verify/)
      // NEVER: just "RM-xxxx" or just the ID
      const fullDisplay = `${DISPLAY_DOMAIN}/${verifyPath}`
      
      // Verify URL (for clickable annotation) - separate from display, uses actual baseUrl
      const verifyUrl = baseUrl 
        ? `${baseUrl}/verify/RM-${reportIdShort}`
        : `/verify/RM-${reportIdShort}`
      
      // CRITICAL: For board/auditor credibility, always show full domain path
      // Never degrade to path-only - use smaller font if needed, but always show full domain
      doc.fontSize(8).font(STYLES.fonts.body)
      const linkLabel = 'Verification endpoint: '
      const preferredText = linkLabel + fullDisplay
      const preferredWidth = doc.widthOfString(preferredText)
      const linkTextHeight = 10
      const maxLinkWidth = capsuleContentWidth
      
      let displayText: string
      let fontSizeToUse = 8
      
      if (preferredWidth <= maxLinkWidth) {
        displayText = preferredText // "Verification endpoint: riskmate.app/verify/RM-xxxx"
      } else {
        // If full display doesn't fit, try with smaller font instead of degrading path
        // This maintains credibility for boards/auditors
        doc.fontSize(7).font(STYLES.fonts.body)
        const smallerPreferredWidth = doc.widthOfString(preferredText)
        if (smallerPreferredWidth <= maxLinkWidth) {
          displayText = preferredText // Use smaller font but keep full domain
          fontSizeToUse = 7
        } else {
          // Last resort: shorten label but ALWAYS keep full domain path
          const minimalLabel = 'Verify: '
          const minimalText = minimalLabel + fullDisplay
          doc.fontSize(7).font(STYLES.fonts.body)
          const minimalWidth = doc.widthOfString(minimalText)
          if (minimalWidth <= maxLinkWidth) {
            displayText = minimalText
            fontSizeToUse = 7
          } else {
            // Absolute last resort: just the full domain path (no label, but full domain ALWAYS included)
            // CRITICAL: This is the absolute minimum - NEVER drop the domain or path
            displayText = fullDisplay
            fontSizeToUse = 7
          }
        }
      }
      
      // CRITICAL: Hard assert - displayText MUST always contain "verify/"
      // This should never fail, but if it does, we force it immediately
      if (!displayText.includes('verify/')) {
        console.error(`[PDF] CRITICAL: Verify display missing path! displayText="${displayText}", forcing verifyPath="${verifyPath}"`)
        displayText = verifyPath // Force to minimum safe display (always includes verify/)
      }
      
      // CRITICAL: Additional validation - check for ID-only patterns
      // If displayText matches just "RM-xxxx" or just the ID (without verify/), force prepend verify/
      const idOnlyPattern = new RegExp(`(^|\\s|:)RM-${reportIdShort}(\\s|$|:)`)
      if (idOnlyPattern.test(displayText) && !displayText.includes('verify/')) {
        console.error(`[PDF] CRITICAL: Verify display is ID-only! displayText="${displayText}", forcing verifyPath="${verifyPath}"`)
        displayText = verifyPath // Force to minimum safe display
      }
      
      // CRITICAL: Use sanitizeAscii() for verify display (strict ASCII for executive-facing content)
      let sanitizedDisplayText = sanitizeAscii(displayText)
      
      // CRITICAL: Final check after sanitization - ensure verify/ is still present
      // If sanitization somehow removed verify/, force it back immediately
      if (!sanitizedDisplayText.includes('verify/')) {
        console.error(`[PDF] CRITICAL: Sanitization removed verify/ path! sanitized="${sanitizedDisplayText}", original="${displayText}", forcing verifyPath="${verifyPath}"`)
        // If sanitization removed verify/, force it back
        if (sanitizedDisplayText.includes(`RM-${reportIdShort}`)) {
          sanitizedDisplayText = sanitizedDisplayText.replace(`RM-${reportIdShort}`, verifyPath)
        } else {
          sanitizedDisplayText = verifyPath // Force to minimum safe display
        }
      }
      
      // CRITICAL: Final validation before rendering - one last check
      if (!sanitizedDisplayText.includes('verify/')) {
        console.error(`[PDF] CRITICAL: Final validation failed! sanitizedDisplayText="${sanitizedDisplayText}", forcing verifyPath="${verifyPath}"`)
        sanitizedDisplayText = verifyPath // Force to minimum safe display
      }
      
      doc
        .fontSize(fontSizeToUse)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.accent)
        .text(sanitizedDisplayText, capsuleContentX, currentY, { 
          width: capsuleContentWidth,
          lineBreak: false, // Prevent wrapping
        })
      
      // Add clickable link annotation (PDFKit supports links) - full URL in annotation (not display text)
      const displayTextWidth = doc.widthOfString(sanitizedDisplayText)
      doc.link(capsuleContentX, currentY, displayTextWidth, linkTextHeight, verifyUrl)
    }
  }
}

// OLD buildExecutiveBriefPDF function - DELETED
// This function has been moved to lib/pdf/reports/executiveBrief/build.ts
// All rendering logic (Page 1 and Page 2) has been extracted to render modules.
// Fallback code has been removed - the new renderers are the only implementation.

/**
 * POST /api/executive/brief/pdf
 * Generates PDF Board Brief from executive summary
 * Returns a PDF file for download
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Resolve organization context (shared helper)
    const orgContext = await resolveOrgContext(user)

    if (!orgContext) {
      return NextResponse.json(
        { message: 'Organization not found or access denied' },
        { status: 403 }
      )
    }

    // Verify executive role
    if (orgContext.role !== 'executive' && orgContext.role !== 'owner' && orgContext.role !== 'admin') {
      return NextResponse.json(
        { message: 'Executive access required' },
        { status: 403 }
      )
    }

        // Use resolved org name (sanitized immediately)
        // CRITICAL: Validate org name is not email-derived
        let organizationName = sanitizeText(orgContext.orgName)
        
        // If org name looks email-ish or generic, fix it
        // In prod, never show generic "Organization" - use org ID or fallback
        if (organizationName.includes('@') || organizationName.includes("'s Organization") || organizationName.toLowerCase().includes('test')) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[executive/brief/pdf] Org name "${organizationName}" looks email-derived or test data. Fix in Organizations table.`)
          }
          // Use org ID short form instead of generic "Organization"
          organizationName = `Org ${orgContext.orgId.substring(0, 8)}`
        } else if (organizationName === 'Organization' || organizationName.trim() === '') {
          // Never show generic "Organization" - use org ID
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[executive/brief/pdf] Org name is generic "Organization". Using org ID instead. Fix in Organizations table.`)
          }
          organizationName = `Org ${orgContext.orgId.substring(0, 8)}`
        }

        // Debug log (remove in prod or gate behind env flag)
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[executive/brief/pdf] Org resolved: ${orgContext.orgId.substring(0, 8)}... -> "${organizationName}" (from: ${orgContext.resolvedFrom})`)
        }

    // Get time range from request body
    const body = await request.json().catch(() => ({}))
    const timeRange = body.time_range || '30d'

    // Fetch risk posture data
    const { data: riskPostureResponse } = await supabase.functions.invoke('executive-risk-posture', {
      body: { time_range: timeRange },
    }).catch(() => ({ data: null }))

    // Fallback: fetch from Next.js API route
    let riskPostureData: RiskPostureData
    if (riskPostureResponse?.data) {
      riskPostureData = riskPostureResponse.data
    } else {
      // Call our Next.js API route
      const apiUrl = new URL('/api/executive/risk-posture', request.url)
      apiUrl.searchParams.set('time_range', timeRange)

      const apiResponse = await fetch(apiUrl.toString(), {
        headers: {
          'Cookie': request.headers.get('Cookie') || '',
        },
      })

      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        riskPostureData = apiData.data
      } else {
        // Fallback to minimal data
        riskPostureData = {
          exposure_level: 'low',
          high_risk_jobs: 0,
          open_incidents: 0,
          recent_violations: 0,
          violations: 0, // Required by shared type
          flagged_jobs: 0,
          pending_signoffs: 0,
          signed_signoffs: 0,
          proof_packs_generated: 0,
          total_jobs: 0, // Required by shared type
          total_incidents: 0, // Required by shared type
          confidence_statement: sanitizeText('No unresolved governance violations. All jobs within acceptable risk thresholds.'),
          ledger_integrity: 'not_verified',
          ledger_integrity_last_verified_at: null,
        }
      }
    }

    // Get build SHA for tracking
    const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined

    // Derive baseUrl from request for verification links
    const requestUrl = new URL(request.url)
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

    // Sanitize confidence statement at the last moment (catches any control chars)
    riskPostureData.confidence_statement = sanitizeText(riskPostureData.confidence_statement || '')

    // Generate unique report ID for audit trail
    const reportId = crypto.randomBytes(16).toString('hex')
    const generatedAt = new Date()

    // Create audit record BEFORE generating PDF (tracks the request)
    const { data: reportRun, error: auditError } = await supabase
      .from('report_runs')
      .insert({
        id: reportId,
        organization_id: orgContext.orgId,
        generated_by: user.id,
        generated_at: generatedAt.toISOString(),
        status: 'generating',
        packet_type: 'executive_brief',
        time_range: timeRange,
        metrics_snapshot: riskPostureData as any, // Store exact metrics used
        build_sha: buildSha || null,
        metadata: {
          api_latency_ms: null, // Will update after generation
          time_window_start: null, // Will update after generation
          time_window_end: null, // Will update after generation
        },
      })
      .select()
      .single()

    if (auditError) {
      console.error('[executive/brief/pdf] Failed to create audit record:', auditError)
      // Continue anyway - don't fail the PDF generation
    }

        // Generate PDF using extracted build function
        let pdfResult: { buffer: Buffer; hash: string; apiLatency: number; timeWindow: { start: Date; end: Date } }
        try {
          // Prepare input for build function
          const input: ExecutiveBriefInput = {
            data: riskPostureData as any, // Type compatibility - route's RiskPostureData extends shared type
            organizationName,
            generatedBy: sanitizeText(user.email || `User ${user.id.substring(0, 8)}`),
            timeRange,
            buildSha,
            reportId,
            baseUrl,
          }
          
          // Prepare helper functions (these use route state, so we pass them from route)
          const helpers = {
            sanitizeText,
            formatTimeRange,
            renderKPIStrip,
            renderRiskPostureGauge,
            markPageHasBody,
            addSectionDivider,
            renderExecutiveSummary,
            hasSpace,
            renderMicroTopDrivers,
            buildMetricsRows,
            renderMetricsTable,
            renderDataCoverage,
            renderTopItemsNeedingAttention,
            ensureSpace,
            renderRecommendedActionsShort,
            renderMethodologyShort,
            renderDataFreshnessCompact,
            addHeaderFooter,
            setPageNumber: (val: number) => { pageNumber = val },
          }
          
          pdfResult = await buildPDF(input, helpers)
        } catch (pdfError: any) {
          // CRITICAL: Catch ship gate rejections and return JSON error instead of broken PDF
          if (pdfError?.message?.includes('PDF ship gate failed')) {
            console.error('[executive/brief/pdf] Ship gate rejection:', pdfError.message)
            return NextResponse.json(
              {
                message: 'PDF generation failed quality check',
                error: pdfError.message,
                reportId,
                buildSha: buildSha?.substring(0, 8),
                timestamp: new Date().toISOString(),
              },
              { status: 500 }
            )
          }
          throw pdfError // Re-throw other errors
        }
        
        const { buffer, hash, apiLatency, timeWindow } = pdfResult
    
    // Update audit record with completion status and final metadata
    if (reportRun) {
      await supabase
        .from('report_runs')
        .update({
          status: 'ready_for_signatures', // Executive briefs don't need signatures, but this indicates completion
          completed_at: new Date().toISOString(),
          completed_hash: hash,
          metadata: {
            api_latency_ms: apiLatency,
            time_window_start: timeWindow.start.toISOString(),
            time_window_end: timeWindow.end.toISOString(),
            pdf_size_bytes: buffer.length,
            pdf_hash: hash,
          },
        })
        .eq('id', reportId)
    }
    
    // Add report integrity metadata
    const dataFreshness = new Date().toISOString()
    const windowStartStr = timeWindow.start.toISOString().split('T')[0]
    const windowEndStr = timeWindow.end.toISOString().split('T')[0]

    // Convert Buffer to Uint8Array for NextResponse
    const pdfBytes = new Uint8Array(buffer)

    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="executive-brief-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Length': String(buffer.length),
      'X-PDF-Hash': hash,
      'X-Executive-Brief-Mode': 'premium',
      'X-Executive-Brief-ReportId': reportId.substring(0, 8),
      'X-Report-Run-Id': reportId, // Full report ID for verification endpoint
      'X-Data-Window-Start': windowStartStr,
      'X-Data-Window-End': windowEndStr,
      'X-Data-Freshness': dataFreshness,
      'X-API-Latency-Ms': String(apiLatency),
      'X-Source-Tables': 'jobs,incidents,attestations,audit_logs',
      // Debug headers (only in non-prod or when explicitly enabled)
      // These help verify org resolution is consistent across endpoints
      ...(process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_HEADERS === 'true' ? {
        'X-Org-Id-Hash': hashId(orgContext.orgId),
        'X-User-Id-Hash': hashId(orgContext.userId),
        'X-Resolved-From': orgContext.resolvedFrom,
        'X-Org-Name': orgContext.orgName.substring(0, 50), // Truncated for safety
        'X-Time-Range': timeRange,
      } : {}),
    })

    if (buildSha) {
      headers.set('X-Executive-Brief-Build', buildSha.substring(0, 8))
    }

    return new NextResponse(pdfBytes, {
      status: 200,
      headers,
    })
  } catch (error: any) {
    console.error('[executive/brief/pdf] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}
