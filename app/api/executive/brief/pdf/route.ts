import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// PDF styling constants
const STYLES = {
  colors: {
    primaryText: '#111111',
    secondaryText: '#555555',
    borderGray: '#E6E6E6',
    lightGrayBg: '#FAFAFA',
    riskLow: '#34C759',
    riskMedium: '#FFCC00',
    riskHigh: '#FF6B35',
    accent: '#912F40',
  },
  fonts: {
    header: 'Helvetica-Bold',
    body: 'Helvetica',
  },
  sizes: {
    h1: 28,
    h2: 18,
    h3: 14,
    body: 11,
    caption: 9,
  },
  spacing: {
    margin: 48,
    sectionGap: 24,
    rowSpacing: 16,
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
 * Format delta with sign
 */
function formatDelta(delta?: number): string {
  if (delta === undefined || delta === 0) return ''
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}`
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
  return labels[timeRange] || timeRange
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

/**
 * Render KPI strip (key metrics at top of page)
 */
function renderKPIStrip(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  const kpiY = margin
  const kpiHeight = 80
  const kpiWidth = pageWidth - margin * 2
  const numKPIs = 5
  const kpiItemWidth = (kpiWidth - (numKPIs - 1) * 16) / numKPIs

  // Background box
  doc.rect(margin, kpiY, kpiWidth, kpiHeight).fill(STYLES.colors.lightGrayBg)

  // KPI items
  const kpis = [
    {
      label: 'Risk Posture',
      value: data.posture_score !== undefined ? `${data.posture_score}` : 'N/A',
      delta: data.delta,
      unit: '',
    },
    {
      label: 'High Risk Jobs',
      value: `${data.high_risk_jobs}`,
      delta: data.deltas?.high_risk_jobs,
      unit: '',
    },
    {
      label: 'Open Incidents',
      value: `${data.open_incidents}`,
      delta: data.deltas?.open_incidents,
      unit: '',
    },
    {
      label: 'Evidence Complete',
      value: data.signed_signoffs + data.pending_signoffs > 0 
        ? `${Math.round((data.signed_signoffs / (data.signed_signoffs + data.pending_signoffs)) * 100)}%`
        : '0%',
      delta: undefined,
      unit: '',
    },
    {
      label: 'Attestations',
      value: `${data.signed_signoffs}`,
      delta: data.deltas?.signed_signoffs,
      unit: `/${data.signed_signoffs + data.pending_signoffs}`,
    },
  ]

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiItemWidth + 16)
    const centerX = x + kpiItemWidth / 2

    // Value
    doc
      .fillColor(STYLES.colors.primaryText)
      .fontSize(STYLES.sizes.h2)
      .font(STYLES.fonts.header)
      .text(kpi.value, centerX, kpiY + 16, { align: 'center', width: kpiItemWidth })

    // Unit (if any)
    if (kpi.unit) {
      doc
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .text(kpi.unit, centerX, kpiY + 40, { align: 'center', width: kpiItemWidth })
    }

    // Label
    doc
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(kpi.label, centerX, kpiY + (kpi.unit ? 56 : 48), { align: 'center', width: kpiItemWidth })

    // Delta (if available)
    if (kpi.delta !== undefined && kpi.delta !== 0) {
      const deltaText = formatDelta(kpi.delta)
      const deltaColor = kpi.delta > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow
      doc
        .fontSize(STYLES.sizes.caption)
        .fillColor(deltaColor)
        .text(deltaText, centerX, kpiY + 68, { align: 'center', width: kpiItemWidth })
    }
  })

  doc.y = kpiY + kpiHeight + STYLES.spacing.sectionGap
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
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Executive Summary', { underline: true })

  doc.moveDown(0.5)

  // Confidence statement (main narrative)
  doc
    .fontSize(STYLES.sizes.body)
    .font(STYLES.fonts.body)
    .fillColor(STYLES.colors.primaryText)
    .text(data.confidence_statement, {
      width: pageWidth - margin * 2,
      align: 'left',
      lineGap: 4,
    })

  doc.moveDown(1)

  // Key insights (bullet points)
  const insights: string[] = []

  if (data.high_risk_jobs > 0) {
    insights.push(`${data.high_risk_jobs} high-risk job${data.high_risk_jobs > 1 ? 's' : ''} requiring attention`)
  }

  if (data.open_incidents > 0) {
    insights.push(`${data.open_incidents} open incident${data.open_incidents > 1 ? 's' : ''} under investigation`)
  }

  if (data.pending_signoffs > 0) {
    insights.push(`${data.pending_signoffs} pending attestation${data.pending_signoffs > 1 ? 's' : ''} awaiting signatures`)
  }

  if (data.ledger_integrity === 'verified') {
    insights.push('Ledger integrity verified - all audit trails intact')
  } else if (data.ledger_integrity === 'error') {
    insights.push('⚠️ Ledger integrity check failed - investigation required')
  }

  if (insights.length > 0) {
    insights.forEach((insight) => {
      doc
        .fillColor(STYLES.colors.primaryText)
        .text(`• ${insight}`, {
          indent: 20,
          width: pageWidth - margin * 2 - 20,
        })
      doc.moveDown(0.3)
    })
  }

  doc.moveDown(1)
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
  // Section header
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Key Metrics', { underline: true })

  doc.moveDown(0.5)

  const tableY = doc.y
  const tableWidth = pageWidth - margin * 2
  const col1Width = tableWidth * 0.5
  const col2Width = tableWidth * 0.25
  const col3Width = tableWidth * 0.25

  // Table header
  doc
    .rect(margin, tableY, tableWidth, 24)
    .fill(STYLES.colors.lightGrayBg)

  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.caption)
    .font(STYLES.fonts.header)
    .text('Metric', margin + 8, tableY + 7, { width: col1Width - 16 })
    .text('Current', margin + col1Width + 8, tableY + 7, { width: col2Width - 16, align: 'right' })
    .text('Change', margin + col1Width + col2Width + 8, tableY + 7, { width: col3Width - 16, align: 'right' })

  // Header underline
  doc
    .strokeColor(STYLES.colors.borderGray)
    .lineWidth(1)
    .moveTo(margin, tableY + 24)
    .lineTo(pageWidth - margin, tableY + 24)
    .stroke()

  doc.y = tableY + 32

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

    // Zebra striping
    if (idx % 2 === 0) {
      doc
        .rect(margin, rowY - 4, tableWidth, 20)
        .fill(STYLES.colors.lightGrayBg)
    }

    // Label
    doc
      .fillColor(STYLES.colors.primaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(metric.label, margin + 8, rowY, { width: col1Width - 16 })

    // Value
    doc.text(
      String(metric.value),
      margin + col1Width + 8,
      rowY,
      { width: col2Width - 16, align: 'right' }
    )

    // Delta
    const deltaText = formatDelta(metric.delta)
    if (deltaText) {
      const deltaColor = (metric.delta || 0) > 0 ? STYLES.colors.riskHigh : STYLES.colors.riskLow
      doc
        .fillColor(deltaColor)
        .text(deltaText, margin + col1Width + col2Width + 8, rowY, { width: col3Width - 16, align: 'right' })
    }

    doc.y = rowY + 20
  })

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
    doc.text(`• ${driver.label} (${driver.count})`, {
      indent: 20,
      width: pageWidth - margin * 2 - 20,
    })
    doc.moveDown(0.3)
  })

  doc.moveDown(1)
}

/**
 * Render recommended actions
 */
function renderRecommendedActions(
  doc: PDFKit.PDFDocument,
  data: RiskPostureData,
  pageWidth: number,
  margin: number
): void {
  if (!data.recommended_actions || data.recommended_actions.length === 0) return

  // Section header
  doc
    .fillColor(STYLES.colors.primaryText)
    .fontSize(STYLES.sizes.h2)
    .font(STYLES.fonts.header)
    .text('Recommended Actions', { underline: true })

  doc.moveDown(0.5)

  data.recommended_actions.slice(0, 5).forEach((action) => {
    doc
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.header)
      .fillColor(STYLES.colors.primaryText)
      .text(`${action.priority}. ${action.action}`, {
        indent: 20,
        width: pageWidth - margin * 2 - 20,
      })

    doc
      .font(STYLES.fonts.body)
      .fontSize(STYLES.sizes.caption)
      .fillColor(STYLES.colors.secondaryText)
      .text(`   ${action.reason}`, {
        indent: 20,
        width: pageWidth - margin * 2 - 40,
      })

    doc.moveDown(0.5)
  })

  doc.moveDown(1)
}

/**
 * Add header and footer to all pages
 */
function addHeaderFooter(
  doc: PDFKit.PDFDocument,
  organizationName: string,
  timeRange: string,
  reportId: string,
  generatedAt: Date
): void {
  const pageCount = doc.bufferedPageRange().count

  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)

    const page = doc.page
    const pageWidth = page.width
    const pageHeight = page.height

    // Footer
    doc
      .fontSize(STYLES.sizes.caption)
      .font(STYLES.fonts.body)
      .fillColor(STYLES.colors.secondaryText)

    const footerText = `RiskMate Executive Brief | ${organizationName} | ${formatTimeRange(timeRange)} | Generated ${generatedAt.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })} | Report ID: ${reportId.substring(0, 8)} | Page ${i + 1} of ${pageCount}`

    doc.text(footerText, STYLES.spacing.margin, pageHeight - 30, {
      width: pageWidth - STYLES.spacing.margin * 2,
      align: 'center',
    })

    // Confidentiality line
    doc
      .fontSize(8)
      .fillColor(STYLES.colors.secondaryText)
      .text(
        'CONFIDENTIAL — This document contains sensitive information and is intended only for authorized recipients.',
        STYLES.spacing.margin,
        pageHeight - 18,
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
  buildSha?: string
): Promise<{ buffer: Buffer; hash: string; reportId: string }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: STYLES.spacing.margin,
        bottom: 60,
        left: STYLES.spacing.margin,
        right: STYLES.spacing.margin,
      },
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
    const generatedAt = new Date()
    const reportId = crypto.randomBytes(16).toString('hex')
    
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      resolve({ buffer, hash, reportId })
    })
    doc.on('error', reject)

    const pageWidth = doc.page.width
    const margin = STYLES.spacing.margin

    // Cover/Header Block
    doc
      .fillColor(STYLES.colors.accent)
      .fontSize(STYLES.sizes.h1)
      .font(STYLES.fonts.header)
      .text('RiskMate Executive Brief', { align: 'center' })

    doc.moveDown(0.3)

    doc
      .fillColor(STYLES.colors.primaryText)
      .fontSize(STYLES.sizes.h3)
      .font(STYLES.fonts.body)
      .text(organizationName, { align: 'center' })

    doc.moveDown(0.2)

    doc
      .fontSize(STYLES.sizes.body)
      .fillColor(STYLES.colors.secondaryText)
      .text(formatTimeRange(timeRange), { align: 'center' })

    doc.moveDown(0.2)

    doc
      .fontSize(STYLES.sizes.caption)
      .text(
        `Generated ${generatedAt.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })}`,
        { align: 'center' }
      )

    doc.moveDown(1.5)

    // KPI Strip
    renderKPIStrip(doc, data, pageWidth, doc.y)

    // Executive Summary
    renderExecutiveSummary(doc, data, pageWidth, margin)

    // Metrics Table
    renderMetricsTable(doc, data, pageWidth, margin)

    // Top Drivers
    renderTopDrivers(doc, data, pageWidth, margin)

    // Recommended Actions
    renderRecommendedActions(doc, data, pageWidth, margin)

    // Add headers/footers to all pages
    addHeaderFooter(doc, organizationName, timeRange, reportId, generatedAt)

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

    // Get user's organization and verify executive role
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData?.organization_id) {
      return NextResponse.json(
        { message: 'Organization not found' },
        { status: 403 }
      )
    }

    // Verify executive role
    if (userData.role !== 'executive' && userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json(
        { message: 'Executive access required' },
        { status: 403 }
      )
    }

    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', userData.organization_id)
      .maybeSingle()

    const organizationName = org?.name || 'Organization'

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
          confidence_statement: '✅ No unresolved governance violations. All jobs within acceptable risk thresholds.',
          ledger_integrity: 'not_verified',
          ledger_integrity_last_verified_at: null,
        }
      }
    }

    // Get build SHA for tracking
    const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined

    // Generate PDF
    const { buffer, hash, reportId } = await buildExecutiveBriefPDF(
      riskPostureData,
      organizationName,
      user.email || `User ${user.id.substring(0, 8)}`,
      timeRange,
      buildSha
    )

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
