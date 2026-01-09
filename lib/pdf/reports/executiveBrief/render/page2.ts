/**
 * Page 2 Renderer for Executive Brief PDF
 * 
 * Renders: Metrics Table (if needed), Recommended Actions, Methodology, Data Freshness, Integrity capsule
 * 
 * NOTE: This extracts Page 2 rendering from route.ts while maintaining exact parity.
 * All helper functions are imported from route.ts during migration.
 */

import PDFKit from 'pdfkit'
import type { RiskPostureData } from '../types'

/**
 * Render Page 2 of Executive Brief
 * 
 * @param doc - PDFKit document
 * @param data - Risk posture data
 * @param organizationName - Organization name
 * @param generatedBy - Who generated the report
 * @param timeRange - Time range string ('7d', '30d', '90d', 'all')
 * @param timeWindow - Time window boundaries
 * @param metadataHash - Deterministic metadata hash
 * @param pdfHash - Actual PDF hash (computed after generation)
 * @param reportId - Report ID
 * @param baseUrl - Base URL for verification links
 * @param qrCodeBuffer - Pre-generated QR code buffer
 * @param hasPriorPeriodData - Whether prior period data exists
 * @param metricsTableFitsOnPage1 - Whether metrics table was rendered on Page 1
 * @param buildSha - Build SHA for tracking
 * @param generatedAt - Generation timestamp
 * @param renderFunctions - Helper functions from route (temporary during migration)
 * @param styles - Style constants
 */
export function renderPage2(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  organizationName: string,
  generatedBy: string,
  timeRange: string,
  timeWindow: { start: Date; end: Date },
  metadataHash: string,
  pdfHash: string,
  reportId: string,
  baseUrl: string | undefined,
  qrCodeBuffer: Buffer | null,
  hasPriorPeriodData: boolean,
  metricsTableFitsOnPage1: boolean,
  buildSha: string | undefined,
  generatedAt: Date,
  renderFunctions: {
    ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => boolean
    renderMetricsTable: (doc: PDFKit.PDFDocument, data: RiskPostureData, pageWidth: number, margin: number, hasPriorPeriodData: boolean) => void
    addSectionDivider: (doc: PDFKit.PDFDocument, pageWidth: number, margin: number) => void
    renderRecommendedActionsShort: (doc: PDFKit.PDFDocument, data: RiskPostureData, columnWidth: number, columnX: number, startY: number) => void
    renderMethodologyShort: (doc: PDFKit.PDFDocument, columnWidth: number, columnX: number) => void
    renderDataFreshnessCompact: (doc: PDFKit.PDFDocument, data: RiskPostureData, columnWidth: number, columnX: number) => void
    hasSpace: (doc: PDFKit.PDFDocument, needed: number) => boolean
    addHeaderFooter: (
      doc: PDFKit.PDFDocument,
      organizationName: string,
      timeRange: string,
      reportId: string,
      generatedAt: Date,
      buildSha: string | undefined,
      timeWindow: { start: Date; end: Date },
      baseUrl: string | undefined,
      metadataHash: string,
      qrCodeBuffer: Buffer | null,
      page2ColumnLayout: { leftX: number; leftW: number; rightX: number; rightW: number; gutter: number },
      formatTimeRangeFromWindow?: (range: string, windowStart: Date, windowEnd: Date) => string
    ) => void
  },
  styles: {
    spacing: {
      margin: number
    }
  }
): void {
  const pageWidth = doc.page.width
  const margin = styles.spacing.margin

  // ============================================
  // PAGE 2: Two-column layout (HARD LOCK - never create page 3)
  // ============================================
  // NOTE: Page break is handled by build.ts - we're already on Page 2 here
  
  // Page 2 two-column grid layout with strict boundaries:
  // Left column (65-70%): Metrics Table (if needed) → Recommended Actions → Methodology → Data Freshness
  // Right column (30-35%): Report Integrity capsule (ABSOLUTE POSITIONED, bottom-right, drawn last)
  // Gutter: 24px between columns (hard rule - no overlap ever)
  
  const gutter = 24 // Hard gutter between columns
  const availableWidth = pageWidth - margin * 2 - gutter
  const leftColumnWidth = Math.floor(availableWidth * 0.68) // 68% of available (after gutter)
  const rightColumnWidth = availableWidth - leftColumnWidth // 32% of available
  const leftColumnX = margin
  const rightColumnX = margin + leftColumnWidth + gutter
  
  // Store for Integrity capsule positioning (absolute positioned, drawn last)
  const page2ColumnLayout = { leftX: leftColumnX, leftW: leftColumnWidth, rightX: rightColumnX, rightW: rightColumnWidth, gutter }
  const page2StartY = doc.y

  // Metrics Table on Page 2 if it didn't fit on Page 1 (full width, then switch to columns)
  // CRITICAL: Use same hasPriorPeriodData computed above for consistency
  if (!metricsTableFitsOnPage1) {
    // Check if we have space before rendering (no page 3 allowed)
    if (renderFunctions.ensureSpace(doc, 200, margin)) {
      renderFunctions.renderMetricsTable(doc, data, pageWidth, margin, hasPriorPeriodData)
      renderFunctions.addSectionDivider(doc, pageWidth, margin)
    }
  }

  // LEFT COLUMN: Recommended Actions → Methodology → Data Freshness
  // Save current position and switch to left column
  const leftColumnStartY = doc.y
  doc.x = leftColumnX // Set X position for left column

  // Recommended Actions (short version - max 3 actions, constrained to left column)
  // CRITICAL: Check if we can fit before rendering (no page 3 allowed)
  if (renderFunctions.ensureSpace(doc, 100, margin)) {
    renderFunctions.renderRecommendedActionsShort(doc, data, leftColumnWidth, leftColumnX, leftColumnStartY)
    doc.y = Math.max(doc.y, leftColumnStartY + 80) // Ensure minimum spacing
  }
  
  // Methodology (short - 3 bullets max, constrained to left column)
  // CRITICAL: Only render if we have space (no page 3 allowed)
  if (renderFunctions.ensureSpace(doc, 70, margin)) {
    renderFunctions.renderMethodologyShort(doc, leftColumnWidth, leftColumnX)
  }
  
  // Data Freshness (compact - 2 lines, constrained to left column)
  // CRITICAL: Only render if we have space (no page 3 allowed)
  if (renderFunctions.ensureSpace(doc, 40, margin)) {
    renderFunctions.renderDataFreshnessCompact(doc, data, leftColumnWidth, leftColumnX)
  }
  
  // CRITICAL: Integrity capsule is ABSOLUTE POSITIONED (not flow content)
  // It's drawn last, in the right column, bottom-right position
  // This prevents it from affecting layout or causing page breaks
  // Headers/footers are added, and Integrity is drawn as absolute positioned element
  renderFunctions.addHeaderFooter(
    doc,
    organizationName,
    timeRange,
    reportId,
    generatedAt,
    buildSha,
    timeWindow,
    baseUrl,
    metadataHash,
    qrCodeBuffer,
    page2ColumnLayout
  )
}
