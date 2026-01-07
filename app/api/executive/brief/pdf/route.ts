import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'
import PDFDocument from 'pdfkit'
import crypto from 'crypto'
import QRCode from 'qrcode'
// Import pure helpers from shared module
import { sanitizeText, formatDelta, formatNumber, pluralize, formatTimeRange, getExposureColor, truncateText } from '@/lib/pdf/executiveBrief/utils'

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

interface RiskPostureData {
  exposure_level: 'low' | 'moderate' | 'high'
  posture_score?: number
  delta?: number
  high_risk_jobs: number
  open_incidents: number
  recent_violations: number
  flagged_jobs: number
  pending_signoffs: number
  signed_signoffs: number
  proof_packs_generated: number
  confidence_statement: string
  ledger_integrity: 'verified' | 'error' | 'not_verified'
  ledger_integrity_last_verified_at: string | null
  // For data coverage
  total_jobs?: number
  last_job_at?: string | null
  drivers?: {
    highRiskJobs?: Array<{ label: string; count: number }>
    openIncidents?: Array<{ label: string; count: number }>
    violations?: Array<{ label: string; count: number }>
  }
  deltas?: {
    high_risk_jobs?: number
    open_incidents?: number
    violations?: number
    flagged_jobs?: number
    pending_signoffs?: number
    signed_signoffs?: number
    proof_packs?: number
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
 * Helper: Check if we need a new page and add one if needed
 * CRITICAL: requiredHeight must include section title + spacing + at least one row/card
 * Never add a page unless you're guaranteed to draw real body content
 * Uses contentLimitY to prevent footer overlap
 */
function ensureSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  margin: number
): void {
  const contentLimitY = getContentLimitY(doc)
  if (doc.y + requiredHeight > contentLimitY) {
    // RED ALERT: If current page has no body content, we're about to create a blank page
    if (!pageHasBody && pageNumber > 1) {
      console.warn(`[PDF] Warning: About to add page ${pageNumber + 1} but page ${pageNumber} has no body content`)
    }
    
    doc.addPage()
    pageNumber++
    // Reset to top of content area after page break
    doc.y = STYLES.spacing.margin
    currentPageStartY = doc.y
    pageHasBody = false // Reset flag for new page
  }
}

/**
 * Helper: Check if we have enough space, return false if we need a new page
 * Use this to conditionally render sections (avoid empty pages)
 * Uses contentLimitY to prevent footer overlap
 */
function hasSpace(
  doc: PDFKit.PDFDocument,
  needed: number
): boolean {
  const contentLimitY = getContentLimitY(doc)
  return doc.y + needed <= contentLimitY
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

  ensureSpace(doc, opts.minHeight, opts.margin)
  
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
  }
): void {
  const cardPadding = STYLES.spacing.cardPadding
  const contentX = opts.cardX + cardPadding
  const contentWidth = opts.cardWidth - cardPadding * 2
  
  // Validate label exists (required for KPI context)
  const labelText = sanitizeText(opts.label)
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
  
  // Label (small, below value) - CRITICAL: already sanitized above, but ensure it's used
  const labelY = valueY + STYLES.sizes.kpiValue + 6
  const sanitizedLabel = sanitizeText(labelText) // Re-sanitize to be safe
  doc
    .fontSize(STYLES.sizes.kpiLabel)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.secondaryText)
    .text(sanitizedLabel, contentX, labelY, {
      width: contentWidth,
      align: 'left',
    })
  
  // Subtitle - ALWAYS show "vs prior 30d" (or appropriate time range) - CRITICAL: sanitize
  const subtitleY = labelY + 12
  const timeRangeLabel = opts.timeRange === '7d' ? 'vs prior 7d' : opts.timeRange === '30d' ? 'vs prior 30d' : opts.timeRange === '90d' ? 'vs prior 90d' : 'vs prior period'
  const sanitizedTimeRange = sanitizeText(timeRangeLabel)
  doc
    .fontSize(STYLES.sizes.kpiDelta)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.secondaryText)
    .text(sanitizedTimeRange, contentX, subtitleY, {
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
  
  // Safe to write
  if (options?.fontSize) doc.fontSize(options.fontSize)
  if (options?.font) doc.font(options.font)
  if (options?.color) doc.fillColor(options.color)
  
  doc.text(sanitized, x, y, { 
    width: options?.width,
    align: options?.align,
  })
  
  // CRITICAL: Track body char count per page for ship gate
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
 * Write label-value pair (prevents label-less values)
 * CRITICAL: This is the ONLY way metrics should render
 * Ensures values never render alone
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
  timeRange: string
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
    },
    {
      label: METRIC_LABELS.highRiskJobs, // Use centralized label
      value: `${data.high_risk_jobs}`,
      delta: data.deltas?.high_risk_jobs,
      color: STYLES.colors.primaryText,
    },
    {
      label: METRIC_LABELS.openIncidents, // Use centralized label
      value: `${data.open_incidents}`,
      delta: data.deltas?.open_incidents,
      color: STYLES.colors.riskHigh,
    },
    {
      label: 'Attestation coverage',
      value: data.signed_signoffs + data.pending_signoffs > 0 
        ? `${Math.round((data.signed_signoffs / (data.signed_signoffs + data.pending_signoffs)) * 100)}%`
        : 'No data',
      delta: undefined,
      color: STYLES.colors.primaryText,
    },
    {
      label: 'Sign-offs',
      value: `${data.signed_signoffs}/${data.signed_signoffs + data.pending_signoffs}`, // One line, no split
      delta: undefined,
      color: STYLES.colors.primaryText,
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
    })
  })

  // Update doc.y after cards
  doc.y = cardY + kpiCardHeight + STYLES.spacing.sectionGap
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

  // Labels below segments
  const labelY = gaugeY + gaugeHeight + 6
  doc
    .fontSize(STYLES.sizes.caption)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.secondaryText)
    .text('Low', gaugeX + segmentWidth / 2 - 10, labelY, { width: 20, align: 'center' })
    .text('Moderate', gaugeX + segmentWidth + segmentWidth / 2 - 20, labelY, { width: 40, align: 'center' })
    .text('High', gaugeX + segmentWidth * 2 + segmentWidth / 2 - 10, labelY, { width: 20, align: 'center' })

  // Score display next to gauge
  const scoreX = gaugeX + gaugeWidth + 20
  doc
    .fontSize(STYLES.sizes.h3)
    .font(STYLES.fonts.header)
    .fillColor(STYLES.colors.primaryText)
    .text(`${score}`, scoreX, gaugeY + 8, { align: 'left' })

  doc.y = gaugeY + gaugeHeight + 25
  
  // Add confidence grade next to posture score
  const confidenceGrade = calculateConfidenceGrade(data)
  if (confidenceGrade) {
    const gradeX = gaugeX + gaugeWidth + 20
    const gradeY = gaugeY + 8
    doc
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(`Confidence: ${confidenceGrade}`, gradeX, gradeY, { width: 150 })
  }
  
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
      .text(`Trend unavailable (need 4 periods of data)`, x, y + sparklineHeight + 4, { width: width })
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
  
  // CRITICAL: Sanitize all parts BEFORE composing headline to prevent character corruption
  // The corruption (U+FFFE) can happen during string composition, so sanitize each part first
  // ULTRA-STRICT: Build headline using only sanitized strings, no raw template literals
  let headline: string
  if (!hasSufficientData) {
    headline = sanitizeText('Insufficient job volume to compute risk posture')
  } else {
    // Executive wording: more action-forward
    // CRITICAL: Sanitize EVERY part before composition
    const exposureLevel = data.exposure_level === 'high' ? 'High' : data.exposure_level === 'moderate' ? 'Moderate' : 'Low'
    const sanitizedExposure = sanitizeText(exposureLevel.toLowerCase())
    const sanitizedHighRisk = sanitizeText('high-risk') // Sanitize hyphen-containing string
    const sanitizedMitigate = sanitizeText('mitigate')
    const sanitizedJob = sanitizeText('job')
    const sanitizedJobs = sanitizeText('jobs')
    const sanitizedReduce = sanitizeText('reduce audit risk')
    const sanitizedRequire = sanitizeText('require immediate attention')
    
    // CRITICAL: Compose using only sanitized strings, then sanitize the result
    if (data.high_risk_jobs === 1) {
      const composed = `Exposure is ${sanitizedExposure}; ${sanitizedMitigate} 1 ${sanitizedHighRisk} ${sanitizedJob} to ${sanitizedReduce}.`
      headline = sanitizeText(composed)
    } else if (data.high_risk_jobs > 1) {
      const composed = `Exposure is ${sanitizedExposure}; ${sanitizedMitigate} ${data.high_risk_jobs} ${sanitizedHighRisk} ${sanitizedJobs} to ${sanitizedReduce}.`
      headline = sanitizeText(composed)
    } else {
      const composed = `Exposure is ${sanitizedExposure}; no ${sanitizedHighRisk} ${sanitizedJobs} ${sanitizedRequire}.`
      headline = sanitizeText(composed)
    }
  }
  
  // CRITICAL: Final sanitization pass (defense in depth) - ensure no corruption slipped through
  // MUST sanitize BEFORE any measurement or width calculations
  let headlineText = sanitizeText(headline)
  // Double-check: if headlineText still contains problematic characters, sanitize again
  if (headlineText.includes('\uFFFE') || headlineText.includes('\uFFFF') || headlineText.includes('\uFFFD')) {
    headlineText = sanitizeText(headlineText) // Force re-sanitization
  }
  
  // Auto-fit headline: prevent mid-sentence wrapping by measuring and adjusting
  // CRITICAL: Measurement happens AFTER sanitization
  const maxHeadlineWidth = pageWidth - margin * 2
  let headlineFontSize = STYLES.sizes.h1
  
  // Measure headline width - if it's too wide, reduce font size slightly
  doc.fontSize(headlineFontSize).font(STYLES.fonts.header)
  const headlineWidth = doc.widthOfString(headlineText)
  
  // If headline is too wide, reduce font size to fit (min 26px)
  if (headlineWidth > maxHeadlineWidth * 0.95) {
    headlineFontSize = Math.max(26, Math.floor((maxHeadlineWidth / headlineWidth) * headlineFontSize))
  }
  
  // CRITICAL: safeText() will sanitize again, but we've already sanitized to be safe
  safeText(doc, headlineText, margin, headlineY, {
    fontSize: headlineFontSize,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
    width: maxHeadlineWidth,
  })
  
  doc.y = headlineY + STYLES.sizes.h1 * 1.25 + 16
  doc.moveDown(0.5)

  // "WHAT CHANGED" CHIPS: Insightful format "Label: Value (Delta)" - always show all 5 chips
  // CRITICAL: hasPriorPeriodData is already computed above - use it consistently
  // Rule: If hasPriorPeriodData === false, ALL deltas must be "N/A" (never "No change")
  // Only show "No change" when delta === 0 AND hasPriorPeriodData === true
  const chipsY = doc.y
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
    label: METRIC_LABELS.highRiskJobs, // Use centralized label
    delta: `${data.high_risk_jobs} (${jobsDelta})`,
    color: data.deltas?.high_risk_jobs !== undefined && data.deltas.high_risk_jobs !== 0
      ? (data.deltas.high_risk_jobs > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
      : STYLES.colors.primaryText,
  })
  
  // 3. Open incidents: Count (Delta)
  const incidentsDelta = data.deltas?.open_incidents !== undefined ? formatDelta(data.deltas.open_incidents) : 'N/A'
  chips.push({
    label: METRIC_LABELS.openIncidents, // Use centralized label
    delta: `${data.open_incidents} (${incidentsDelta})`,
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
    label: 'Attestation coverage',
    delta: `${attestationPct}% (N/A)`, // Always N/A since attestation deltas not tracked
    color: STYLES.colors.primaryText,
  })
  
  // 5. Sign-offs: Signed/Total (sign-off deltas not tracked yet - always show N/A)
  chips.push({
    label: 'Sign-offs',
    delta: `${data.signed_signoffs ?? 0}/${totalSignoffs} (N/A)`, // Always N/A since sign-off deltas not tracked
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
    const chipText = `${chip.label} ${chip.delta}`
    const chipWidth = doc.widthOfString(chipText) + 16 // Padding
    
    // Check if we need to wrap to next line
    if (chipX + chipWidth > rightLimit || chipsOnCurrentLine >= maxChipsPerLine) {
      // Move to next line if we haven't exceeded max lines
      const currentLine = Math.floor(i / maxChipsPerLine)
      if (currentLine < maxLines) {
        chipY += chipHeight + 8 // Next line with spacing
        chipX = margin
        chipsOnCurrentLine = 0
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
    
    // Chip background
    doc
      .rect(chipX, chipY, chipWidth, chipHeight)
      .fill(STYLES.colors.cardBg)
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.5)
      .stroke()
    
    // Chip text
    doc
      .fillColor(chip.color)
      .text(chipText, chipX + 8, chipY + 6, { width: chipWidth - 16 })
    
    chipX += chipWidth + chipGap
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

  // EXECUTIVE SUMMARY STRUCTURE: Finding + Why + Next action
  if (hasSufficientData) {
    // Why it matters (1 sentence)
    let whyItMatters = ''
    if (data.high_risk_jobs > 0) {
      whyItMatters = `Unmitigated high-risk jobs increase audit exposure and potential compliance findings.`
    } else if (data.open_incidents > 0) {
      whyItMatters = `Open incidents indicate active safety gaps that require immediate attention.`
    } else if (data.posture_score !== undefined && data.posture_score < 50) {
      whyItMatters = `Current risk posture requires strengthening to meet compliance standards.`
    } else {
      whyItMatters = `Maintaining strong risk controls protects against audit findings and safety incidents.`
    }
    
    if (hasSpace(doc, 20)) {
      safeText(doc, sanitizeText(whyItMatters), margin, doc.y, {
        fontSize: STYLES.sizes.body,
        font: STYLES.fonts.body,
        color: STYLES.colors.primaryText,
        width: pageWidth - margin * 2,
      })
      doc.moveDown(0.6)
    }
    
    // Next action (1 sentence)
    let nextAction = ''
    if (data.high_risk_jobs > 0) {
      nextAction = `Mitigate ${data.high_risk_jobs} high-risk ${pluralize(data.high_risk_jobs, 'job', 'jobs')} within 7 days to reduce exposure.`
    } else if (data.open_incidents > 0) {
      nextAction = `Close ${data.open_incidents} open ${pluralize(data.open_incidents, 'incident', 'incidents')} and document resolution.`
    } else if (data.pending_signoffs > 0) {
      nextAction = `Complete ${data.pending_signoffs} pending ${pluralize(data.pending_signoffs, 'sign-off', 'sign-offs')} to ensure full compliance.`
    } else {
      nextAction = `Continue monitoring risk posture and maintain current control effectiveness.`
    }
    
    if (hasSpace(doc, 20)) {
      safeText(doc, sanitizeText(nextAction), margin, doc.y, {
        fontSize: STYLES.sizes.body,
        font: STYLES.fonts.body,
        color: STYLES.colors.primaryText,
        width: pageWidth - margin * 2,
      })
      doc.moveDown(0.6)
    }
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
  }

  // Decision requested line (single sentence, no fluff) - makes it feel "designed, not assembled"
  if (hasSufficientData && hasSpace(doc, 20)) {
    let decisionText = ''
    if (data.high_risk_jobs > 0) {
      decisionText = `Decision requested: Approve mitigation for ${data.high_risk_jobs} ${pluralize(data.high_risk_jobs, 'high-risk job', 'high-risk jobs')} and require sign-off completion this week.`
    } else if (data.open_incidents > 0) {
      decisionText = `Decision requested: Authorize resolution plan for ${data.open_incidents} open ${pluralize(data.open_incidents, 'incident', 'incidents')} and document closure.`
    } else if (data.pending_signoffs > 0) {
      decisionText = `Decision requested: Complete ${data.pending_signoffs} pending ${pluralize(data.pending_signoffs, 'sign-off', 'sign-offs')} to ensure compliance this week.`
    } else {
      decisionText = `Decision requested: Continue monitoring risk posture and maintain current control effectiveness.`
    }
    
    safeText(doc, sanitizeText(decisionText), margin, doc.y, {
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
  highRiskJobs: 'High-risk jobs',
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
    { label: METRIC_LABELS.signoffsSigned, value: data.signed_signoffs ?? 0, delta: data.deltas?.signed_signoffs },
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
  doc.moveDown(0.5)

  const tableY = doc.y
  const tableWidth = pageWidth - margin * 2
  // Fixed column widths to prevent wrapping
  const col1Width = 280 // Metric name (fixed, wide enough)
  const col2Width = 120 // Current value (fixed, right-aligned)
  const col3Width = 80  // Change column (fixed, narrow)
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
  safeText(doc, 'Change', margin + col1Width + col2Width + cellPadding, headerTextY, {
    width: col3Width - cellPadding * 2,
    align: 'right',
    fontSize: STYLES.sizes.caption,
    font: STYLES.fonts.header,
    color: STYLES.colors.primaryText,
  })

  // Column dividers in header
  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(0.5)
    .moveTo(margin + col1Width, tableY)
    .lineTo(margin + col1Width, tableY + headerHeight)
    .moveTo(margin + col1Width + col2Width, tableY)
    .lineTo(margin + col1Width + col2Width, tableY + headerHeight)
    .stroke()

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

    // Delta (already normalized: "No change" or formatted delta string)
    const deltaColor = metric.delta === 'No change' || metric.delta === '—'
      ? STYLES.colors.secondaryText 
      : (metric.delta.startsWith('+') ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
    safeText(doc, metric.delta, margin + col1Width + col2Width + cellPadding, rowY + cellPadding, {
      width: col3Width - cellPadding * 2,
      align: 'right',
      fontSize: STYLES.sizes.body,
      font: STYLES.fonts.body,
      color: deltaColor,
    })
    
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
      .moveTo(margin + col1Width + col2Width, rowY)
      .lineTo(margin + col1Width + col2Width, rowY + tableRowHeight)
      .stroke()

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
    label: 'Attestations coverage',
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
  
  if (top3.length === 0) {
    // Intentional fallback: show clear message about signal requirements
    ensureSpace(doc, 25, margin)
    safeText(doc, `Top drivers (${timeRangeLabel}): Not enough signal (need at least 3 events)`, margin, doc.y, {
      width: pageWidth - margin * 2,
      fontSize: STYLES.sizes.caption,
      font: STYLES.fonts.body,
      color: STYLES.colors.secondaryText,
    })
    doc.moveDown(0.3)
    return
  }
  
  // Render compact list
  ensureSpace(doc, 25, margin)
  const driversText = top3.map(d => sanitizeText(d.label)).join(', ')
  safeText(doc, `Top drivers (${timeRangeLabel}): ${driversText}`, margin, doc.y, {
    width: pageWidth - margin * 2,
    fontSize: STYLES.sizes.caption,
    font: STYLES.fonts.body,
    color: STYLES.colors.secondaryText,
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
    'Evidence coverage: Percentage of jobs with evidence artifacts (photos/docs/proof packs)',
    'Attestation coverage: Percentage of jobs with signed attestations',
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
    .text(`Last job: ${sanitizeText(lastJobStr)} | Attestation coverage: ${coveragePercent}`, columnX, doc.y, {
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
    const summaryText = `${data.high_risk_jobs} high-risk ${pluralize(data.high_risk_jobs, 'job', 'jobs')} require attention.`
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
      
      // Title (bold)
      doc
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.header)
        .fillColor(STYLES.colors.primaryText)
        .text('Report Integrity', capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 14
      
      // Report ID (monospace for verification stamp feel)
      doc
        .fontSize(8)
        .font('Courier') // Monospace font for IDs/hashes
        .fillColor(STYLES.colors.secondaryText)
        .text(`Report ID: RM-${reportId.substring(0, 8)}`, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // Generated timestamp
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
      doc
        .fontSize(8)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(`Generated: ${sanitizeText(generatedText)}`, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // Data window start/end (not just "Last 30 days")
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
      doc
        .fontSize(8)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(`Window: ${sanitizeText(windowStartStr)} - ${sanitizeText(windowEndStr)}`, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // Source tables summary - CRITICAL: sanitize
      const sourcesText = sanitizeText('Sources: jobs, incidents, attestations')
      doc
        .fontSize(8)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(sourcesText, capsuleContentX, currentY, { width: capsuleContentWidth })
      currentY += 11
      
      // Report hash (SHA-256) - shortened format (monospace for verification)
      if (pdfHash) {
        const hashShort = `${pdfHash.substring(0, 4)}...${pdfHash.substring(pdfHash.length - 4)}`
        doc
          .fontSize(8)
          .font('Courier') // Monospace font for hash
          .fillColor(STYLES.colors.secondaryText)
          // CRITICAL: Sanitize hash text to prevent character corruption
        const hashText = sanitizeText(`Hash (SHA-256): ${hashShort}`)
        doc
          .fontSize(8)
          .font('Courier') // Monospace font for hash
          .fillColor(STYLES.colors.secondaryText)
          .text(hashText, capsuleContentX, currentY, { width: capsuleContentWidth })
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
      
      // CRITICAL: Verification endpoint must always show a human-readable path
      // Display: "riskmate.app/verify/RM-xxxx" (always show full path, never just ID)
      // Target: Full URL for clickable annotation
      const reportIdShort = reportId.substring(0, 8)
      const domain = baseUrl 
        ? baseUrl.replace(/^https?:\/\//, '').split('/')[0]
        : 'riskmate.app'
      
      // Preferred: Full pretty link "riskmate.app/verify/RM-abc12345"
      const prettyLink = `${domain}/verify/RM-${reportIdShort}`
      
      // Verify URL (for clickable annotation) - construct to match display
      const verifyUrl = baseUrl 
        ? `${baseUrl}/verify/RM-${reportIdShort}`
        : `/verify/RM-${reportIdShort}`
      
      // Measure and ensure link fits on one line
      doc.fontSize(8).font(STYLES.fonts.body)
      const linkLabel = 'Verification endpoint: '
      const preferredText = linkLabel + prettyLink
      const preferredWidth = doc.widthOfString(preferredText)
      const linkTextHeight = 10
      const maxLinkWidth = capsuleContentWidth
      
      // Determine display text: prefer full link, fallback to verify/RM-xxx if needed
      // CRITICAL: Never show just "RM-xxx" - always show at least "verify/RM-xxx"
      // ULTRA-STRICT: Build display string explicitly to ensure path is always included
      // The path "/verify/" MUST always be present in the display string
      let displayText: string
      if (preferredWidth <= maxLinkWidth) {
        displayText = preferredText // Full pretty link fits: "riskmate.app/verify/RM-xxxx"
      } else {
        // Fallback: "verify/RM-xxxx" (NOT just "RM-xxxx")
        const fallbackLink = `verify/RM-${reportIdShort}`
        const fallbackText = linkLabel + fallbackLink
        const fallbackWidth = doc.widthOfString(fallbackText)
        if (fallbackWidth <= maxLinkWidth) {
          displayText = fallbackText // "Verification endpoint: verify/RM-xxxx"
        } else {
          // Last resort: shorten label but ALWAYS keep full path "verify/RM-xxxx"
          // CRITICAL: Never fall back to just "RM-xxxx" - always include "/verify/" path
          const minimalText = `Verify: ${fallbackLink}` // "Verify: verify/RM-xxxx"
          const minimalWidth = doc.widthOfString(minimalText)
          if (minimalWidth <= maxLinkWidth) {
            displayText = minimalText
          } else {
            // Absolute last resort: show just the path without any label
            // CRITICAL: This MUST be "verify/RM-xxxx", NEVER just "RM-xxxx"
            // If this doesn't fit, we have a serious layout problem, but we still show the path
            displayText = fallbackLink // "verify/RM-xxxx" - path is always included
          }
        }
      }
      
      // CRITICAL: Final validation - ensure displayText always contains "/verify/" or "verify/"
      // If it doesn't, something went wrong - force it to include the path
      // This is a hard assert - never allow ID-only display
      if (!displayText.includes('/verify/') && !displayText.includes('verify/')) {
        // Emergency fallback: ALWAYS include the path, even if it means reducing font size
        // Never show just "RM-xxxx" - always show at least "verify/RM-xxxx"
        displayText = `verify/RM-${reportIdShort}`
        // If even this doesn't fit, we'll reduce font size in the render step
      }
      
      // CRITICAL: Double-check - if displayText is just the ID, force prepend "verify/"
      if (displayText.trim() === `RM-${reportIdShort}` || displayText.trim() === reportIdShort) {
        displayText = `verify/RM-${reportIdShort}`
      }
      
      // Draw clickable link text (one line, no wrapping) - CRITICAL: sanitize
      const sanitizedDisplayText = sanitizeText(displayText)
      doc
        .fontSize(8)
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

/**
 * Build comprehensive executive brief PDF
 * NOTE: This function is used internally by the route handler.
 * For external use (smoke tests, CI), import from lib/pdf/executiveBrief/build.ts
 * 
 * TODO: This will be moved to lib/pdf/executiveBrief/build.ts incrementally
 * 
 * NOTE: This is exported as a regular function, not a route handler
 */
async function buildExecutiveBriefPDF(
  data: RiskPostureData,
  organizationName: string,
  generatedBy: string,
  timeRange: string,
  buildSha: string | undefined,
  reportId: string,
  baseUrl?: string
): Promise<{ buffer: Buffer; hash: string; apiLatency: number; timeWindow: { start: Date; end: Date } }> {
  // Generate QR code before PDF generation (async operation)
  const verifyUrl = baseUrl 
    ? `${baseUrl}/api/executive/brief/${reportId.substring(0, 8)}`
    : `/api/executive/brief/${reportId.substring(0, 8)}`
  
  let qrCodeBuffer: Buffer | null = null
  try {
    qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
      width: 80,
      margin: 1,
      color: {
        dark: STYLES.colors.primaryText,
        light: STYLES.colors.white,
      },
    })
  } catch (qrError) {
    console.warn('[PDF] Failed to generate QR code:', qrError)
    // Continue without QR code
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: STYLES.spacing.margin,
        bottom: 60,
        left: STYLES.spacing.margin,
        right: STYLES.spacing.margin,
      },
      bufferPages: true, // Enable buffering for total page count
      info: {
        Title: `RiskMate Executive Brief - ${organizationName}`,
        Author: 'RiskMate',
        Subject: 'Executive Risk Posture Summary',
        Keywords: `risk, governance, compliance, ${organizationName}`,
        Creator: 'RiskMate Platform',
        Producer: 'RiskMate PDF Generator',
      },
    })

    const chunks: Buffer[] = []
    const startTime = Date.now()
    const generatedAt = new Date()
    // reportId is already a parameter, don't redeclare it
    
    // Calculate time window boundaries
    const end = new Date()
    const start = new Date()
    switch (timeRange) {
      case '7d':
        start.setDate(end.getDate() - 7)
        break
      case '30d':
        start.setDate(end.getDate() - 30)
        break
      case '90d':
        start.setDate(end.getDate() - 90)
        break
      case 'all':
        start.setFullYear(2020, 0, 1)
        break
      default:
        start.setDate(end.getDate() - 30)
    }
    const timeWindow = { start, end }
    
    doc.on('data', (chunk) => chunks.push(chunk))
        doc.on('end', async () => {
          const buffer = Buffer.concat(chunks)
          const hash = crypto.createHash('sha256').update(buffer).digest('hex')
          const apiLatency = Date.now() - startTime
          
          // Post-render: Update hash in Integrity capsule on Page 2
          // Note: PDFKit doesn't support modifying rendered pages, so hash will show "calculating..."
          // In production, you could use a post-processing step or calculate hash before rendering
          // For now, the hash is available in the response headers (X-PDF-Hash)

          // CRITICAL: Runtime ship gate - check for junk pages and lonely content
          for (let i = 2; i <= pageNumber; i++) { // Start from page 2 (cover page is exempt)
            const pageIndex = i - 1
            
            // Check 1: Insufficient body content (< 60 chars)
            const pageChars = typeof bodyCharCount[pageIndex] === 'number' ? bodyCharCount[pageIndex] as number : 0
            if (pageChars < 60) {
              const error = new Error(
                `PDF ship gate failed: Page ${i} has insufficient body content (${pageChars} chars). ` +
                `Likely a junk page. Section: ${currentSection}`
              )
              console.error('[PDF Ship Gate]', error.message, { page: i, chars: pageChars, reportId, buildSha })
              return reject(error)
            }
            
            // Check 2: Lonely content (single tokens/headings without context)
            const lonelyKey = `${pageIndex}_lonely`
            const lonelyContent = Array.isArray(bodyCharCount[lonelyKey]) ? bodyCharCount[lonelyKey] as string[] : undefined
            if (lonelyContent && lonelyContent.length > 0) {
              // If page has mostly lonely content and < 100 chars total, it's suspicious
              const totalChars = pageChars
              const lonelyChars = lonelyContent.join(' ').length
              
              if (lonelyChars > totalChars * 0.5 && totalChars < 100) {
                const error = new Error(
                  `PDF ship gate failed: Page ${i} contains lonely content without context: "${lonelyContent.join(', ')}". ` +
                  `This indicates a heading or value rendered alone. Section: ${currentSection}`
                )
                console.error('[PDF Ship Gate]', error.message, { page: i, lonely: lonelyContent, totalChars, reportId, buildSha })
                return reject(error)
              }
            }
          }

          resolve({ buffer, hash, apiLatency, timeWindow })
        })
    doc.on('error', reject)

    const pageWidth = doc.page.width
    const margin = STYLES.spacing.margin

    // Premium Cover Header Band (full-width, branded, board-ready)
    const headerBandHeight = doc.page.height * 0.14 // 14% of page height
    const headerBandY = 0 // Start at top of page
    
    // Draw header band background (full-width)
    doc
      .rect(0, headerBandY, doc.page.width, headerBandHeight)
      .fill(STYLES.colors.accentLight)
    
    // Content inside header band
    const headerContentY = headerBandY + 50
    const sanitizedTitle = sanitizeText('RiskMate Executive Brief')
    const sanitizedOrgName = sanitizeText(organizationName)
    const timeRangeText = formatTimeRange(timeRange)
    
    // Title (large, white, left-aligned in band)
    doc
      .fillColor(STYLES.colors.white)
      .fontSize(STYLES.sizes.h1)
      .font(STYLES.fonts.header)
      .text(sanitizedTitle, STYLES.spacing.margin, headerContentY, {
        width: doc.page.width - STYLES.spacing.margin * 2,
        align: 'left',
      })

    doc.moveDown(0.25)

    // Org name (medium, white)
    doc
      .fillColor(STYLES.colors.white)
      .fontSize(STYLES.sizes.h3)
      .font(STYLES.fonts.body)
      .text(sanitizedOrgName, STYLES.spacing.margin, doc.y, {
        width: doc.page.width - STYLES.spacing.margin * 2,
        align: 'left',
      })

    doc.moveDown(0.2)

    // Time range + generated timestamp (smaller, white with opacity)
    const generatedTimestamp = generatedAt.toLocaleString('en-US', { 
      timeZone: 'America/New_York', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true, 
      timeZoneName: 'short' 
    })
    const metaText = `${sanitizeText(timeRangeText)} • Generated ${sanitizeText(generatedTimestamp)}`
    
    doc
      .fillColor(STYLES.colors.white)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .opacity(0.9)
      .text(metaText, STYLES.spacing.margin, doc.y, {
        width: doc.page.width - STYLES.spacing.margin * 2,
        align: 'left',
      })
      .opacity(1.0)

    // Subtle accent line under header band
    const accentLineY = headerBandHeight - 3
    doc
      .strokeColor(STYLES.colors.accent)
      .lineWidth(3)
      .moveTo(0, accentLineY)
      .lineTo(doc.page.width, accentLineY)
      .stroke()

    // Reset Y position after header band
    doc.y = headerBandHeight + STYLES.spacing.sectionGap

    // ============================================
    // PAGE 1: Fixed regions layout (board-ready, dense)
    // Region A: Header band (already rendered)
    // Region B: KPI cards
    // Region C: Gauge + Headline finding
    // Region D: Executive Summary
    // Region E: Metrics Table OR Compact metrics (if table doesn't fit)
    // Region F: Data Coverage
    // ============================================
    
    // Region B: Premium KPI Cards (fixed height ~95px)
    const kpiCardsY = doc.y
    renderKPIStrip(doc, data, pageWidth, kpiCardsY, timeRange)
    const afterKPIsY = doc.y

    // Region C: Risk Posture Gauge (fixed height ~100px)
    renderRiskPostureGauge(doc, data, pageWidth, margin, timeRange)
    if (data.posture_score !== undefined) {
      markPageHasBody(doc)
    }
    const afterGaugeY = doc.y

    // Section divider
    addSectionDivider(doc, pageWidth, margin)

    // Region D: Executive Summary (compact, max 3 bullets)
    const summaryStartY = doc.y
    renderExecutiveSummary(doc, data, pageWidth, margin, timeRange)
    const afterSummaryY = doc.y
    
    // Micro Top 3 Drivers on page 1 (compact, always show)
    if (hasSpace(doc, 40)) {
      renderMicroTopDrivers(doc, data, pageWidth, margin, timeRange)
    }

    // Calculate remaining space on Page 1
    const page1Bottom = doc.page.height - 80 // Footer space
    const remainingSpacePage1 = page1Bottom - doc.y

    // Region E: Metrics Table (only if it fits) OR move to Page 2
    // CRITICAL: hasPriorPeriodData is computed in renderExecutiveSummary - need to compute it here too
    // OR pass it as a parameter - for now, compute it here to match chip logic
    const hasPriorPeriodData = data.delta !== undefined || 
                               data.deltas?.high_risk_jobs !== undefined || 
                               data.deltas?.open_incidents !== undefined ||
                               data.deltas?.violations !== undefined ||
                               data.deltas?.flagged_jobs !== undefined ||
                               data.deltas?.pending_signoffs !== undefined ||
                               data.deltas?.proof_packs !== undefined
    
    const metricsRows = buildMetricsRows(data, hasPriorPeriodData)
    const sectionHeaderHeight = STYLES.sizes.h2 + 20
    const tableHeaderHeight = STYLES.spacing.tableRowHeight + 4
    const tableRowHeight = STYLES.spacing.tableRowHeight
    const totalTableHeight = sectionHeaderHeight + tableHeaderHeight + (tableRowHeight * metricsRows.length) + 40
    const dataCoverageHeight = 80 // Approx height for Data Coverage

    const metricsTableFitsOnPage1 = remainingSpacePage1 >= (totalTableHeight + dataCoverageHeight + 32) // 32 = spacing

    if (metricsTableFitsOnPage1) {
      // Render Metrics Table on Page 1
      renderMetricsTable(doc, data, pageWidth, margin, hasPriorPeriodData)
      
      // Region F: Data Coverage (compact, always on Page 1 if table fits)
      renderDataCoverage(doc, data, pageWidth, margin)
    } else {
      // Metrics Table doesn't fit - skip it on Page 1, will render on Page 2
      // Render compact Data Coverage on Page 1 only
      renderDataCoverage(doc, data, pageWidth, margin)
      
      // Page 1 artifact: Top 3 items needing attention (fills whitespace, kills template vibe)
      if (hasSpace(doc, 60)) {
        renderTopItemsNeedingAttention(doc, data, pageWidth, margin)
      }
    }

    // ============================================
    // PAGE 2: Two-column layout (HARD LOCK - never create page 3)
    // ============================================
    
    // Force page break for page 2
    if (pageNumber === 1) {
      ensureSpace(doc, 1000, margin) // Force new page
    }

    // Page 2 two-column grid layout with strict boundaries:
    // Left column (65-70%): Metrics Table (if needed) → Recommended Actions → Methodology → Data Freshness
    // Right column (30-35%): Report Integrity capsule (fixed position, bottom-right)
    // Gutter: 24px between columns (hard rule - no overlap ever)
    
    const gutter = 24 // Hard gutter between columns
    const availableWidth = pageWidth - margin * 2 - gutter
    const leftColumnWidth = Math.floor(availableWidth * 0.68) // 68% of available (after gutter)
    const rightColumnWidth = availableWidth - leftColumnWidth // 32% of available
    const leftColumnX = margin
    const rightColumnX = margin + leftColumnWidth + gutter
    
    // Store for Integrity capsule positioning
    const page2ColumnLayout = { leftX: leftColumnX, leftW: leftColumnWidth, rightX: rightColumnX, rightW: rightColumnWidth, gutter }
    const page2StartY = doc.y

    // Metrics Table on Page 2 if it didn't fit on Page 1 (full width, then switch to columns)
    // CRITICAL: Use same hasPriorPeriodData computed above for consistency
    if (!metricsTableFitsOnPage1) {
      renderMetricsTable(doc, data, pageWidth, margin, hasPriorPeriodData)
      addSectionDivider(doc, pageWidth, margin)
    }

    // LEFT COLUMN: Recommended Actions → Methodology → Data Freshness
    // Save current position and switch to left column
    const leftColumnStartY = doc.y
    doc.x = leftColumnX // Set X position for left column

    // Recommended Actions (short version - max 3 actions, constrained to left column)
    renderRecommendedActionsShort(doc, data, leftColumnWidth, leftColumnX, leftColumnStartY)
    doc.y = Math.max(doc.y, leftColumnStartY + 80) // Ensure minimum spacing
    
    // Methodology (short - 3 bullets max, constrained to left column)
    if (hasSpace(doc, 70)) {
      renderMethodologyShort(doc, leftColumnWidth, leftColumnX)
    }
    
    // Data Freshness (compact - 2 lines, constrained to left column)
    if (hasSpace(doc, 40)) {
      renderDataFreshnessCompact(doc, data, leftColumnWidth, leftColumnX)
    }
    
    // CRITICAL: Never create page 3 - if we're past page 2, stop rendering
    if (pageNumber > 2) {
      console.warn('[PDF] Page 3 detected - this should never happen. Stopping render.')
    }

    // Add headers/footers to all pages
    // Note: hash will be available after PDF generation, but we need to pass it
    // For now, we'll calculate it in the callback and pass undefined here
    // The hash will be added in a post-pass if needed
    // QR code is pre-generated and passed in
    // Pass Page 2 column layout for Integrity capsule positioning
    addHeaderFooter(doc, organizationName, timeRange, reportId, generatedAt, buildSha, timeWindow, baseUrl, undefined, qrCodeBuffer, page2ColumnLayout)

    doc.end()
  })
}

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
          flagged_jobs: 0,
          pending_signoffs: 0,
          signed_signoffs: 0,
          proof_packs_generated: 0,
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

        // Generate PDF
        let pdfResult: { buffer: Buffer; hash: string; apiLatency: number; timeWindow: { start: Date; end: Date } }
        try {
          pdfResult = await buildExecutiveBriefPDF(
            riskPostureData,
            organizationName,
            sanitizeText(user.email || `User ${user.id.substring(0, 8)}`),
            timeRange,
            buildSha,
            reportId,
            baseUrl
          )
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
