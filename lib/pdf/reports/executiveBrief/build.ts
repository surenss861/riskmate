/**
 * Executive Brief PDF Builder
 * 
 * Pure function: input → PDF bytes
 * No side effects, no database, no auth
 * 
 * This is the main entry point for generating Executive Brief PDFs.
 * It orchestrates Page 1 and Page 2 renderers to create the complete document.
 */

import PDFDocument from 'pdfkit'
import crypto from 'crypto'
import QRCode from 'qrcode'
import type { ExecutiveBriefInput, ExecutiveBriefOutput, RiskPostureData } from './types'
import { renderPage1 } from './render/page1'
import { renderPage2 } from './render/page2'
import { sanitizeText, formatTimeRange } from '@/lib/pdf/executiveBrief/utils'

// STYLES - matches route.ts for consistency
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
    h1: 30,
    h2: 17,
    h3: 16,
    body: 10.5,
    caption: 9,
    kpiValue: 24,
    kpiLabel: 9,
    kpiDelta: 8,
  },
  spacing: {
    margin: 48,
    sectionGap: 32,
    rowSpacing: 20,
    cardPadding: 16,
    tableRowHeight: 26,
    tableCellPadding: 12,
  },
  borderRadius: {
    card: 4,
  },
}

/**
 * PDF Generation Context
 * Tracks state during PDF generation (page numbers, body content, etc.)
 */
interface PDFContext {
  pageNumber: number
  pageHasBody: boolean
  currentPageStartY: number
  currentSection: string
  bodyCharCount: { [key: number | string]: number | string[] }
}

/**
 * Helper Functions Type
 * All helper functions needed by renderers
 */
export interface ExecutiveBriefDeps {
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
  ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => boolean // Returns false if can't fit (no page 3 allowed)
  renderRecommendedActionsShort: (doc: PDFKit.PDFDocument, data: RiskPostureData, columnWidth: number, columnX: number, startY: number) => void
  renderMethodologyShort: (doc: PDFKit.PDFDocument, columnWidth: number, columnX: number) => void
  renderDataFreshnessCompact: (doc: PDFKit.PDFDocument, data: RiskPostureData, columnWidth: number, columnX: number) => void
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
    page2ColumnLayout: { leftX: number; leftW: number; rightX: number; rightW: number; gutter: number }
  ) => void
}

// Default dependencies - will be populated from route helpers
// For now, this is a placeholder that will throw if called without deps
// TODO: Move helpers to /lib/pdf/core/ and import them here
const defaultDeps: ExecutiveBriefDeps | null = null

/**
 * Build Executive Brief PDF
 * 
 * Pure function that takes input data and returns PDF buffer + metadata
 * 
 * This orchestrates the Page 1 and Page 2 renderers to create the complete PDF.
 * All rendering logic is now in the extracted render modules.
 * 
 * @param input - Executive Brief input data
 * @param deps - Helper functions (defaults to null, must be provided by route or test helper)
 */
export async function buildExecutiveBriefPDF(
  input: ExecutiveBriefInput,
  deps?: ExecutiveBriefDeps
): Promise<ExecutiveBriefOutput> {
  // For now, deps must be provided (route passes them, tests need to provide them)
  // TODO: Once helpers are moved to /lib/pdf/core/, we can import them here as defaults
  if (!deps) {
    throw new Error(
      'buildExecutiveBriefPDF requires dependencies. ' +
      'In production, route passes deps. ' +
      'For tests, use buildExecutiveBriefPDFFromRoute() or provide test deps.'
    )
  }
  
  const helpers = deps
  const { data, organizationName, generatedBy, timeRange, buildSha, reportId, baseUrl } = input
  
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
      bufferPages: true,
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
    
    // Track page number manually (PDFKit doesn't expose it directly)
    let currentPageNumber = 1
    doc.on('pageAdded', () => {
      currentPageNumber++
    })
    
    // CRITICAL: Compute deterministic hash from report metadata for Integrity capsule
    const metadataHashInput = `${reportId}-${generatedAt.toISOString()}-${organizationName}-${timeRange}`
    const metadataHash = crypto.createHash('sha256').update(metadataHashInput).digest('hex')
    
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

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const apiLatency = Date.now() - startTime
      
      // Compute actual PDF hash (SHA-256) for Integrity capsule
      const pdfHash = crypto.createHash('sha256').update(buffer).digest('hex')
      
      resolve({
        buffer,
        hash: pdfHash,
        apiLatency,
        timeWindow,
      })
    })
    
    doc.on('error', (err: any) => {
      reject(err)
    })

    const pageWidth = doc.page.width
    const margin = STYLES.spacing.margin

    // CRITICAL: Compute hasPriorPeriodData early (needed for KPI subtitles and table Change column)
    const hasPriorPeriodData = data.delta !== undefined || 
                               data.deltas?.high_risk_jobs !== undefined || 
                               data.deltas?.open_incidents !== undefined ||
                               data.deltas?.violations !== undefined ||
                               data.deltas?.flagged_jobs !== undefined ||
                               data.deltas?.pending_signoffs !== undefined ||
                               false

    // Calculate metricsTableFitsOnPage1 (needed for both renderPage1 and Page 2 logic)
    const metricsRows = helpers.buildMetricsRows(data, hasPriorPeriodData)
    const sectionHeaderHeight = STYLES.sizes.h2 + 20
    const tableHeaderHeight = STYLES.spacing.tableRowHeight + 4
    const tableRowHeight = STYLES.spacing.tableRowHeight
    const totalTableHeight = sectionHeaderHeight + tableHeaderHeight + (tableRowHeight * metricsRows.length) + 40
    const dataCoverageHeight = 80
    // Estimate remaining space on Page 1
    const headerBandHeight = doc.page.height * 0.14
    const estimatedPage1StartY = headerBandHeight + STYLES.spacing.sectionGap
    const estimatedKPIsHeight = 95
    const estimatedGaugeHeight = 100
    const estimatedSummaryHeight = 120
    const estimatedDriversHeight = 40
    const estimatedPage1Used = estimatedPage1StartY + estimatedKPIsHeight + estimatedGaugeHeight + estimatedSummaryHeight + estimatedDriversHeight
    const page1Bottom = doc.page.height - 80
    const estimatedRemainingSpacePage1 = page1Bottom - estimatedPage1Used
    let metricsTableFitsOnPage1 = estimatedRemainingSpacePage1 >= (totalTableHeight + dataCoverageHeight + 32)

    // Map data to shared type (recent_violations -> violations, ensure total_incidents exists)
    const mappedData: RiskPostureData = {
      ...data,
      violations: (data as any).recent_violations ?? data.violations ?? 0,
      total_incidents: data.total_incidents ?? (data as any).open_incidents ?? 0,
    }

    // ============================================
    // PAGE 1: Render using extracted renderer
    // ============================================
    renderPage1(
      doc,
      mappedData,
      organizationName,
      generatedBy,
      timeRange,
      timeWindow,
      hasPriorPeriodData,
      generatedAt,
      {
        sanitizeText: helpers.sanitizeText,
        formatTimeRange: helpers.formatTimeRange,
        renderKPIStrip: helpers.renderKPIStrip,
        renderRiskPostureGauge: helpers.renderRiskPostureGauge,
        markPageHasBody: helpers.markPageHasBody,
        addSectionDivider: helpers.addSectionDivider,
        renderExecutiveSummary: helpers.renderExecutiveSummary,
        hasSpace: helpers.hasSpace,
        renderMicroTopDrivers: helpers.renderMicroTopDrivers,
        buildMetricsRows: helpers.buildMetricsRows,
        renderMetricsTable: helpers.renderMetricsTable,
        renderDataCoverage: helpers.renderDataCoverage,
        renderTopItemsNeedingAttention: helpers.renderTopItemsNeedingAttention,
      },
      STYLES
    )

    // Force page break for page 2
    // We need to explicitly add page 2 - ensureSpace won't do it if we're already on page 2
    // Track page number manually since PDFKit doesn't expose it directly
    let currentPageNumber = 1
    doc.on('pageAdded', () => {
      currentPageNumber++
    })
    
    // Force page 2 if we're still on page 1
    if (currentPageNumber === 1) {
      doc.addPage()
      currentPageNumber = 2
    }

    // ============================================
    // PAGE 2: Render using extracted renderer
    // ============================================
    // Note: pdfHash will be computed after generation, but we need it for Integrity capsule
    // For now, pass empty string and it will be updated in addHeaderFooter if needed
    renderPage2(
      doc,
      mappedData,
      organizationName,
      generatedBy,
      timeRange,
      timeWindow,
      metadataHash,
      '', // pdfHash will be computed after generation
      reportId,
      baseUrl,
      qrCodeBuffer,
      hasPriorPeriodData,
      metricsTableFitsOnPage1,
      buildSha,
      generatedAt,
      {
        ensureSpace: helpers.ensureSpace,
        renderMetricsTable: helpers.renderMetricsTable,
        addSectionDivider: helpers.addSectionDivider,
        renderRecommendedActionsShort: helpers.renderRecommendedActionsShort,
        renderMethodologyShort: helpers.renderMethodologyShort,
        renderDataFreshnessCompact: helpers.renderDataFreshnessCompact,
        hasSpace: helpers.hasSpace,
        addHeaderFooter: helpers.addHeaderFooter,
      },
      STYLES
    )

    // Finalize PDF
    doc.end()
  })
}
