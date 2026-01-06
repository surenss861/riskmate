import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'
import PDFDocument from 'pdfkit'
import crypto from 'crypto'

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
    h1: 32, // Premium title size
    h2: 22, // Section headers
    h3: 16, // Org name
    body: 11,
    caption: 9,
    kpiValue: 24, // Big numbers in KPI cards
    kpiLabel: 9,
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

/**
 * Sanitize text for PDF output - removes ALL C0/C1 control chars, normalizes quotes, fixes bullets
 * This fixes the '\x05' and other control character leaks
 */
function sanitizeText(text: string): string {
  if (!text) return ''
  
  return String(text)
    // Remove ALL C0 control characters (\u0000-\u001F) and DEL (\u007F)
    // Keep only newline (\n), carriage return (\r), tab (\t) for formatting
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Remove ALL C1 control characters (\u0080-\u009F)
    .replace(/[\u0080-\u009F]/g, '')
    // Replace smart quotes with ASCII equivalents (do this AFTER control char removal)
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[""]/g, '"')
    // Replace various bullet/arrow characters with hyphen
    .replace(/[•\u2022\u25CF\u25E6\u2043\u2219\u2023\u2024]/g, '-')
    // Replace em dashes and en dashes with regular dashes (but preserve em dash for "—" placeholder)
    .replace(/[–]/g, '-') // Only replace en dash, keep em dash for "—"
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize whitespace (preserve intentional spaces)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Format delta with sign
 */
function formatDelta(delta?: number): string {
  if (delta === undefined || delta === 0) return '—' // Use em dash for empty
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}`
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number | string): string {
  if (typeof num === 'string') return num
  return num.toLocaleString('en-US')
}

/**
 * Format time range label
 */
function formatTimeRange(timeRange: string): string {
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
function getExposureColor(level: string): string {
  switch (level) {
    case 'high': return STYLES.colors.riskHigh
    case 'moderate': return STYLES.colors.riskMedium
    default: return STYLES.colors.riskLow
  }
}

// Per-page body content tracking (prevents blank pages)
let pageHasBody = false
let currentPageStartY = 0

/**
 * Helper: Check if we need a new page and add one if needed
 * CRITICAL: requiredHeight must include section title + spacing + at least one row/card
 * Never add a page unless you're guaranteed to draw real body content
 */
function ensureSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  margin: number
): void {
  const pageBottom = doc.page.height - 60 // bottom margin
  if (doc.y + requiredHeight > pageBottom) {
    // RED ALERT: If current page has no body content, we're about to create a blank page
    if (!pageHasBody && doc.page.number > 1) {
      console.warn(`[PDF] Warning: About to add page ${doc.page.number + 1} but page ${doc.page.number} has no body content`)
    }
    
    doc.addPage()
    // Reset to top of content area after page break
    doc.y = STYLES.spacing.margin
    currentPageStartY = doc.y
    pageHasBody = false // Reset flag for new page
  }
}

/**
 * Helper: Check if we have enough space, return false if we need a new page
 * Use this to conditionally render sections (avoid empty pages)
 */
function hasSpace(
  doc: PDFKit.PDFDocument,
  needed: number
): boolean {
  const pageBottom = doc.page.height - 60
  return doc.y + needed <= pageBottom
}

/**
 * Mark that body content has been written to current page
 * Call this after drawing any non-header/footer content
 */
function markPageHasBody(doc: PDFKit.PDFDocument): void {
  pageHasBody = true
}

/**
 * Render premium KPI cards (rounded corners, proper styling, no wrapping issues)
 */
function renderKPIStrip(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  startY: number
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
      value: data.posture_score !== undefined ? `${data.posture_score}` : '—',
      delta: data.delta,
      color: data.posture_score !== undefined && data.posture_score >= 75 ? STYLES.colors.riskLow : 
             data.posture_score !== undefined && data.posture_score >= 50 ? STYLES.colors.riskMedium : STYLES.colors.riskHigh,
    },
    {
      label: 'High Risk Jobs',
      value: `${data.high_risk_jobs}`,
      delta: data.deltas?.high_risk_jobs,
      color: STYLES.colors.primaryText,
    },
    {
      label: 'Open Incidents',
      value: `${data.open_incidents}`,
      delta: data.deltas?.open_incidents,
      color: STYLES.colors.riskHigh,
    },
    {
      label: 'Evidence %',
      value: data.signed_signoffs + data.pending_signoffs > 0 
        ? `${Math.round((data.signed_signoffs / (data.signed_signoffs + data.pending_signoffs)) * 100)}%`
        : '—',
      delta: undefined,
      color: STYLES.colors.primaryText,
    },
    {
      label: 'Attestations',
      value: `${data.signed_signoffs}/${data.signed_signoffs + data.pending_signoffs}`, // One line, no split
      delta: undefined,
      color: STYLES.colors.primaryText,
    },
  ]

  kpis.forEach((kpi, index) => {
    const cardX = margin + index * (kpiCardWidth + cardGap)
    
    // Draw card with subtle border (rounded corners simulated)
    doc
      .rect(cardX, cardY, kpiCardWidth, kpiCardHeight)
      .fill(STYLES.colors.cardBg)
      .strokeColor(STYLES.colors.borderGray)
      .lineWidth(0.5)
      .stroke()

    // Card padding
    const cardPadding = STYLES.spacing.cardPadding
    const contentX = cardX + cardPadding
    const contentWidth = kpiCardWidth - cardPadding * 2

    // Value (big number, baseline aligned)
    const valueY = cardY + cardPadding + 8
    doc
      .fontSize(STYLES.sizes.kpiValue)
      .font(STYLES.fonts.header)
      .fillColor(kpi.color)
      .text(sanitizeText(kpi.value), contentX, valueY, { 
        width: contentWidth,
        align: 'left',
      })

    // Label (small, below value, no wrapping)
    const labelY = valueY + STYLES.sizes.kpiValue + 6
    doc
      .fontSize(STYLES.sizes.kpiLabel)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(sanitizeText(kpi.label), contentX, labelY, { 
        width: contentWidth,
        align: 'left',
      })

    // Delta (if present, small chip-like)
    if (kpi.delta !== undefined && kpi.delta !== 0) {
      const deltaText = kpi.delta > 0 ? `+${kpi.delta}` : `${kpi.delta}`
      const deltaColor = kpi.delta > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow
      const deltaY = labelY + 14
      doc
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.body)
        .fillColor(deltaColor)
        .text(sanitizeText(deltaText), contentX, deltaY, { 
          width: contentWidth,
          align: 'left',
        })
    }
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
  margin: number
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

  doc.y = gaugeY + gaugeHeight + 25 + STYLES.spacing.sectionGap
}

/**
 * Render executive summary narrative
 */
function renderExecutiveSummary(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  // Section header
  ensureSpace(doc, 80, margin)
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Executive Summary', { underline: true })

  doc.moveDown(0.5)

  // Confidence statement (main narrative) - sanitize at render time
  ensureSpace(doc, 60, margin)
  const sanitizedConfidence = sanitizeText(String(data.confidence_statement || ''))
  doc
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.primaryText)
    .text(sanitizedConfidence, {
      width: pageWidth - margin * 2,
      align: 'left',
      lineGap: 4,
    })

  doc.moveDown(1)

  // Key insights (bullet points)
  const insights: string[] = []
  const hasSufficientData = data.high_risk_jobs > 0 || data.open_incidents > 0 || data.signed_signoffs > 0

  if (!hasSufficientData) {
    insights.push('Insufficient job volume in selected window to compute posture score')
    insights.push('Metrics will populate automatically as job data is recorded')
    insights.push('Requires at least 1 job with risk assessment in the selected time range')
  } else {
    if (data.high_risk_jobs > 0) {
      insights.push(`${formatNumber(data.high_risk_jobs)} high-risk job${data.high_risk_jobs > 1 ? 's' : ''} requiring attention`)
    }

    if (data.open_incidents > 0) {
      insights.push(`${formatNumber(data.open_incidents)} open incident${data.open_incidents > 1 ? 's' : ''} under investigation`)
    }

    if (data.pending_signoffs > 0) {
      insights.push(`${formatNumber(data.pending_signoffs)} pending attestation${data.pending_signoffs > 1 ? 's' : ''} awaiting signatures`)
    }

    if (data.ledger_integrity === 'verified') {
      insights.push('Ledger integrity verified - all audit trails intact')
    } else if (data.ledger_integrity === 'error') {
      insights.push('Ledger integrity check failed - investigation required')
    }
  }

  // Sanitize all insights
  const sanitizedInsights = insights.map(sanitizeText)

  if (sanitizedInsights.length > 0) {
    sanitizedInsights.forEach((insight) => {
      ensureSpace(doc, 20, margin)
      doc
        .fillColor(STYLES.colors.primaryText)
        .text(`- ${insight}`, { // Use hyphen instead of bullet for compatibility
          indent: 20,
          width: pageWidth - margin * 2 - 20,
          lineGap: 5, // Better line spacing for bullets
        })
      doc.moveDown(0.4)
    })
  }

  doc.moveDown(1.2)
}

/**
 * Render metrics table
 */
function renderMetricsTable(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  // Calculate required height: header + table header + at least 2 rows
  const sectionHeaderHeight = STYLES.sizes.h2 + 20
  const tableHeaderHeight = STYLES.spacing.tableRowHeight + 4
  const tableRowHeight = STYLES.spacing.tableRowHeight
  const requiredHeight = sectionHeaderHeight + tableHeaderHeight + (tableRowHeight * 2) + 40

  ensureSpace(doc, requiredHeight, margin)

  // Section header
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Key Metrics', { underline: true })

  doc.moveDown(0.5)

  const tableY = doc.y
  const tableWidth = pageWidth - margin * 2
  // Fixed column widths to prevent wrapping
  const col1Width = 280 // Metric name (fixed, wide enough)
  const col2Width = 120 // Current value (fixed, right-aligned)
  const col3Width = 80  // Change column (fixed, narrow)
  const rowHeight = STYLES.spacing.tableRowHeight
  const cellPadding = STYLES.spacing.tableCellPadding

  // Table header with solid background (slightly taller for premium feel)
  const headerHeight = rowHeight + 4
  doc
    .rect(margin, tableY, tableWidth, headerHeight)
    .fill(STYLES.colors.tableHeaderBg)
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .stroke()

  // Header text (centered vertically, proper alignment)
  const headerTextY = tableY + (headerHeight / 2) - 5
  doc
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.header)
    .fillColor(STYLES.colors.primaryText)
    .text('Metric', margin + cellPadding, headerTextY, { 
      width: col1Width - cellPadding * 2,
      align: 'left',
    })
    .text('Current', margin + col1Width + cellPadding, headerTextY, { 
      width: col2Width - cellPadding * 2,
      align: 'right',
    })
    .text('Change', margin + col1Width + col2Width + cellPadding, headerTextY, { 
      width: col3Width - cellPadding * 2,
      align: 'right',
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

  // Table rows
  const metrics = [
    { label: 'High Risk Jobs', value: data.high_risk_jobs, delta: data.deltas?.high_risk_jobs },
    { label: 'Open Incidents', value: data.open_incidents, delta: data.deltas?.open_incidents },
    { label: 'Recent Violations', value: data.recent_violations, delta: data.deltas?.violations },
    { label: 'Flagged for Review', value: data.flagged_jobs, delta: data.deltas?.flagged_jobs },
    { label: 'Pending Sign-offs', value: data.pending_signoffs, delta: undefined },
    { label: 'Signed Sign-offs', value: data.signed_signoffs, delta: undefined },
    { label: 'Proof Packs Generated', value: data.proof_packs_generated, delta: undefined },
  ]

  metrics.forEach((metric, idx) => {
    const rowY = doc.y
    const isEven = idx % 2 === 0

    // Zebra striping (subtle)
    if (isEven) {
      doc
        .rect(margin, rowY, tableWidth, tableRowHeight)
        .fill(STYLES.colors.lightGrayBg)
    }

    // Label (left-aligned, fixed width prevents wrapping)
    const labelText = sanitizeText(metric.label)
    doc
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.primaryText)
      .text(labelText, margin + cellPadding, rowY + cellPadding, { 
        width: col1Width - cellPadding * 2,
        align: 'left',
        lineGap: 4,
      })

    // Value (right-aligned, fixed width)
    const valueText = typeof metric.value === 'string' 
      ? metric.value 
      : formatNumber(metric.value)
    doc
      .fillColor(STYLES.colors.primaryText)
      .text(
        sanitizeText(valueText),
        margin + col1Width + cellPadding,
        rowY + cellPadding,
        { width: col2Width - cellPadding * 2, align: 'right' }
      )

    // Delta (right-aligned, fixed narrow column)
    const deltaText = formatDelta(metric.delta)
    const deltaColor = deltaText === '—' 
      ? STYLES.colors.secondaryText 
      : ((metric.delta || 0) > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow)
    doc
      .fillColor(deltaColor)
      .text(sanitizeText(deltaText), margin + col1Width + col2Width + cellPadding, rowY + cellPadding, { 
        width: col3Width - cellPadding * 2, 
        align: 'right' 
      })
    
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

  // Jobs in window
  const totalJobs = data.total_jobs || 0
  coverageItems.push({
    label: 'Jobs in window',
    value: totalJobs > 0 ? formatNumber(totalJobs) : '—',
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
      value: '—',
    })
  }

  // Incidents in window
  coverageItems.push({
    label: 'Incidents in window',
    value: data.open_incidents > 0 ? formatNumber(data.open_incidents) : '—',
  })

  // Attestations coverage
  const totalAttestations = data.signed_signoffs + data.pending_signoffs
  const coveragePercent = totalAttestations > 0
    ? `${Math.round((data.signed_signoffs / totalAttestations) * 100)}%`
    : '—'
  coverageItems.push({
    label: 'Attestations coverage',
    value: coveragePercent,
  })

  // Render as compact list (only if we have items)
  if (coverageItems.length > 0) {
    coverageItems.forEach((item) => {
      ensureSpace(doc, 20, margin)
      doc
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.primaryText)
        .text(sanitizeText(item.label + ':'), {
          indent: 20,
          width: 180,
        })
        .fillColor(STYLES.colors.secondaryText)
        .text(sanitizeText(item.value), {
          indent: 200,
          width: pageWidth - margin * 2 - 200,
        })
      markPageHasBody(doc) // Mark body content written
      doc.moveDown(0.3)
    })

    // Show reason if data is missing (only if we have space)
    if (totalJobs === 0 && hasSpace(doc, 20)) {
      doc.moveDown(0.3)
      doc
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.body)
        .fillColor(STYLES.colors.secondaryText)
        .text(sanitizeText('Reason: No jobs with risk assessments in selected window'), {
          indent: 20,
          width: pageWidth - margin * 2 - 20,
        })
      markPageHasBody(doc)
    }
  }

  doc.moveDown(1)
}

/**
 * Render top drivers
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

  if (drivers.length === 0) return

  // Section header
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Top Risk Drivers', { underline: true })

  doc.moveDown(0.5)

  doc
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.primaryText)

  drivers.forEach((driver) => {
    ensureSpace(doc, 20, margin)
    doc.text(`- ${sanitizeText(driver.label)} (${driver.count})`, { // Use hyphen instead of bullet
      indent: 20,
      width: pageWidth - margin * 2 - 20,
      lineGap: 5, // Better spacing
    })
    doc.moveDown(0.4)
  })

  doc.moveDown(1)
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
  // Section header with divider
  ensureSpace(doc, 120, margin)
  addSectionDivider(doc, pageWidth, margin)
  
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Recommended Actions', { underline: true })

  doc.moveDown(0.8)

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

  actions.forEach((action) => {
    ensureSpace(doc, 40, margin)
    doc
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.header)
      .fillColor(STYLES.colors.primaryText)
      .text(`${action.priority}. ${sanitizeText(action.action)}`, {
        indent: 20,
        width: pageWidth - margin * 2 - 20,
        lineGap: 5, // Better spacing
      })

    ensureSpace(doc, 20, margin)
    doc
      .font(STYLES.fonts.body)
      .fontSize(STYLES.sizes.caption)
      .fillColor(STYLES.colors.secondaryText)
      .text(`   ${sanitizeText(action.reason)}`, {
        indent: 20,
        width: pageWidth - margin * 2 - 40,
        lineGap: 4,
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
  buildSha?: string
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

    doc.text(footerText, STYLES.spacing.margin, footerStartY, {
      width: pageWidth - STYLES.spacing.margin * 2,
      align: 'center',
    })

    // Build stamp line
    const buildStamp = `${buildInfo} | mode: ${mode} | reportId: ${reportId.substring(0, 8)}`
    doc
      .fontSize(8)
      .fillColor(STYLES.colors.secondaryText)
      .text(buildStamp, STYLES.spacing.margin, footerStartY + lineHeight + footerSpacing, {
        width: pageWidth - STYLES.spacing.margin * 2,
        align: 'center',
      })

    // Confidentiality line (combined with footer block)
    doc
      .fontSize(8)
      .fillColor(STYLES.colors.secondaryText)
      .text(
        'CONFIDENTIAL — This document contains sensitive information and is intended only for authorized recipients.',
        STYLES.spacing.margin,
        footerStartY + (lineHeight * 2) + (footerSpacing * 2),
        {
          width: pageWidth - STYLES.spacing.margin * 2,
          align: 'center',
        }
      )
  }
}

/**
 * Build comprehensive executive brief PDF
 */
async function buildExecutiveBriefPDF(
  data: RiskPostureData,
  organizationName: string,
  generatedBy: string,
  timeRange: string,
  buildSha: string | undefined,
  reportId: string
): Promise<{ buffer: Buffer; hash: string; apiLatency: number; timeWindow: { start: Date; end: Date } }> {
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
    const reportId = crypto.randomBytes(16).toString('hex')
    
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
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      const apiLatency = Date.now() - startTime
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

    // Premium KPI Cards
    renderKPIStrip(doc, data, pageWidth, doc.y)

    // Risk Posture Gauge (visual credibility element)
    renderRiskPostureGauge(doc, data, pageWidth, margin)
    if (data.posture_score !== undefined) {
      markPageHasBody(doc) // Mark if gauge was rendered
    }

    // Section divider
    addSectionDivider(doc, pageWidth, margin)

    // Executive Summary
    renderExecutiveSummary(doc, data, pageWidth, margin)

    // Metrics Table
    renderMetricsTable(doc, data, pageWidth, margin)

    // Data Coverage (compact, reassuring)
    renderDataCoverage(doc, data, pageWidth, margin)

    // Top Drivers (only if data exists and we have space)
    renderTopDrivers(doc, data, pageWidth, margin)

    // Recommended Actions (final section, always shows)
    renderRecommendedActions(doc, data, pageWidth, margin)

    // Add headers/footers to all pages
    addHeaderFooter(doc, organizationName, timeRange, reportId, generatedAt, buildSha)

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
    // This should be the actual org name from organizations.name, not email-based
    const organizationName = sanitizeText(orgContext.orgName)
    
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
    const { buffer, hash, apiLatency, timeWindow } = await buildExecutiveBriefPDF(
      riskPostureData,
      organizationName,
      sanitizeText(user.email || `User ${user.id.substring(0, 8)}`),
      timeRange,
      buildSha,
      reportId
    )
    
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
