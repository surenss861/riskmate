/**
 * Page 1 Renderer for Executive Brief PDF
 * 
 * Renders: Header band, KPIs, Gauge, Executive Summary, Top Drivers, Metrics Table/Data Coverage
 * 
 * NOTE: This extracts Page 1 rendering from route.ts while maintaining exact parity.
 * All helper functions are imported from route.ts during migration.
 */

import PDFKit from 'pdfkit'
import type { RiskPostureData } from '../types'

// Import helpers from route (will be moved to core later)
// For now, we need to import these from the route file
// TODO: Move these to @/lib/pdf/core/ once migration is complete

/**
 * Render Page 1 of Executive Brief
 * 
 * @param doc - PDFKit document
 * @param data - Risk posture data
 * @param organizationName - Organization name
 * @param generatedBy - Who generated the report
 * @param timeRange - Time range string ('7d', '30d', '90d', 'all')
 * @param timeWindow - Time window boundaries
 * @param hasPriorPeriodData - Whether prior period data exists (computed externally)
 * @param generatedAt - Generation timestamp
 * @param renderFunctions - Helper functions from route (temporary during migration)
 */
export function renderPage1(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  organizationName: string,
  generatedBy: string,
  timeRange: string,
  timeWindow: { start: Date; end: Date },
  hasPriorPeriodData: boolean,
  generatedAt: Date,
  renderFunctions: {
    sanitizeText: (text: string) => string
    formatTimeRange: (range: string) => string
    renderKPIStrip: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, y: number, timeRange: string, hasPriorPeriodData: boolean) => void
    renderRiskPostureGauge: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number, timeRange: string) => void
    markPageHasBody: (doc: PDFKit.PDFDocument) => void
    addSectionDivider: (doc: PDFKit.PDFDocument, pageWidth: number, margin: number) => void
    renderExecutiveSummary: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number, timeRange: string) => void
    hasSpace: (doc: PDFKit.PDFDocument, needed: number) => boolean
    renderMicroTopDrivers: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number, timeRange: string) => void
    buildMetricsRows: (data: RiskPostureData, hasPriorPeriodData: boolean) => Array<{ label: string; value: string; delta: string }>
    renderMetricsTable: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number, hasPriorPeriodData: boolean) => void
    renderDataCoverage: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number) => void
    renderTopItemsNeedingAttention: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number) => void
  },
  styles: {
    colors: {
      white: string
      accentLight: string
      accent: string
      primaryText: string
    }
    fonts: {
      header: string
      body: string
    }
    sizes: {
      h1: number
      h3: number
      body: number
      h2: number
    }
    spacing: {
      margin: number
      sectionGap: number
      tableRowHeight: number
    }
  }
): void {
  const pageWidth = doc.page.width
  const margin = styles.spacing.margin

  // ============================================
  // Region A: Premium Cover Header Band (full-width, branded, board-ready)
  // ============================================
  const headerBandHeight = doc.page.height * 0.14 // 14% of page height
  const headerBandY = 0 // Start at top of page
  
  // Draw header band background (full-width)
  doc
    .rect(0, headerBandY, doc.page.width, headerBandHeight)
    .fill(styles.colors.accentLight)
  
  // Content inside header band
  const headerContentY = headerBandY + 50
  const sanitizedTitle = renderFunctions.sanitizeText('RiskMate Executive Brief')
  const sanitizedOrgName = renderFunctions.sanitizeText(organizationName)
  const timeRangeText = renderFunctions.formatTimeRange(timeRange)
  
  // Title (large, white, left-aligned in band)
  doc
    .fillColor(styles.colors.white)
    .fontSize(styles.sizes.h1)
    .font(styles.fonts.header)
    .text(sanitizedTitle, margin, headerContentY, {
      width: doc.page.width - margin * 2,
      align: 'left',
    })

  doc.moveDown(0.25)

  // Org name (medium, white)
  doc
    .fillColor(styles.colors.white)
    .fontSize(styles.sizes.h3)
    .font(styles.fonts.body)
    .text(sanitizedOrgName, margin, doc.y, {
      width: doc.page.width - margin * 2,
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
  const metaText = `${renderFunctions.sanitizeText(timeRangeText)} • Generated ${renderFunctions.sanitizeText(generatedTimestamp)}`
  
  doc
    .fillColor(styles.colors.white)
    .fontSize(styles.sizes.body)
    .font(styles.fonts.body)
    .opacity(0.9)
    .text(metaText, margin, doc.y, {
      width: doc.page.width - margin * 2,
      align: 'left',
    })
    .opacity(1.0)

  // Subtle accent line under header band
  const accentLineY = headerBandHeight - 3
  doc
    .strokeColor(styles.colors.accent)
    .lineWidth(3)
    .moveTo(0, accentLineY)
    .lineTo(doc.page.width, accentLineY)
    .stroke()

  // Reset Y position after header band
  doc.y = headerBandHeight + styles.spacing.sectionGap

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
  renderFunctions.renderKPIStrip(doc, data, pageWidth, kpiCardsY, timeRange, hasPriorPeriodData)
  const afterKPIsY = doc.y

  // Region C: Risk Posture Gauge (fixed height ~100px)
  renderFunctions.renderRiskPostureGauge(doc, data, pageWidth, margin, timeRange)
  if (data.posture_score !== undefined) {
    renderFunctions.markPageHasBody(doc)
  }
  const afterGaugeY = doc.y

  // Section divider
  renderFunctions.addSectionDivider(doc, pageWidth, margin)

  // Region D: Executive Summary (compact, max 3 bullets)
  const summaryStartY = doc.y
  renderFunctions.renderExecutiveSummary(doc, data, pageWidth, margin, timeRange)
  const afterSummaryY = doc.y
  
  // Micro Top 3 Drivers on page 1 (compact, always show)
  if (renderFunctions.hasSpace(doc, 40)) {
    renderFunctions.renderMicroTopDrivers(doc, data, pageWidth, margin, timeRange)
  }

  // Calculate remaining space on Page 1
  const page1Bottom = doc.page.height - 80 // Footer space
  const remainingSpacePage1 = page1Bottom - doc.y

  // Region E: Metrics Table (only if it fits) OR move to Page 2
  // CRITICAL: hasPriorPeriodData is already computed above (before KPI cards)
  
  const metricsRows = renderFunctions.buildMetricsRows(data, hasPriorPeriodData)
  const sectionHeaderHeight = styles.sizes.h2 + 20
  const tableHeaderHeight = styles.spacing.tableRowHeight + 4
  const tableRowHeight = styles.spacing.tableRowHeight
  const totalTableHeight = sectionHeaderHeight + tableHeaderHeight + (tableRowHeight * metricsRows.length) + 40
  const dataCoverageHeight = 80 // Approx height for Data Coverage

  const metricsTableFitsOnPage1 = remainingSpacePage1 >= (totalTableHeight + dataCoverageHeight + 32) // 32 = spacing

  if (metricsTableFitsOnPage1) {
    // Render Metrics Table on Page 1
    renderFunctions.renderMetricsTable(doc, data, pageWidth, margin, hasPriorPeriodData)
    
    // Region F: Data Coverage (compact, always on Page 1 if table fits)
    renderFunctions.renderDataCoverage(doc, data, pageWidth, margin)
  } else {
    // Metrics Table doesn't fit - skip it on Page 1, will render on Page 2
    // Render compact Data Coverage on Page 1 only
    renderFunctions.renderDataCoverage(doc, data, pageWidth, margin)
    
    // Page 1 artifact: Top 3 items needing attention (fills whitespace, kills template vibe)
    if (renderFunctions.hasSpace(doc, 60)) {
      renderFunctions.renderTopItemsNeedingAttention(doc, data, pageWidth, margin)
    }
  }
}
