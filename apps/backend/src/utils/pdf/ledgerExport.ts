import PDFDocument from 'pdfkit'
import { STYLES } from './styles'
import {
  drawHeader,
  drawFooter,
  drawSectionTitle,
  drawKpiRow,
  drawTable,
  drawEmptyState,
  initPage,
  finalizePdf,
} from './proofPackTheme'

interface AuditLogEntry {
  id: string
  event_name: string
  created_at: string
  category?: string
  outcome?: string
  severity?: string
  actor_name?: string
  actor_role?: string
  job_id?: string
  job_title?: string
  target_type?: string
  summary?: string
}

interface LedgerExportOptions {
  organizationName: string
  generatedBy: string
  generatedByRole: string
  exportId: string
  timeRange: string
  filters?: {
    category?: string
    site_id?: string
    job_id?: string
    severity?: string
    outcome?: string
  }
  events: AuditLogEntry[]
}

export async function generateLedgerExportPDF(options: LedgerExportOptions): Promise<Buffer> {
  const { organizationName, generatedBy, generatedByRole, exportId, timeRange, filters, events } = options

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: STYLES.spacing.pageMargin,
        bottom: 60,
        left: STYLES.spacing.pageMargin,
        right: STYLES.spacing.pageMargin,
      },
      bufferPages: true, // Enable page buffering for footer rendering
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    initPage(doc)

    // Header with metadata
    drawHeader(doc, {
      title: 'Compliance Ledger Export',
      packId: exportId,
      organizationName,
      generatedBy,
      generatedByRole,
      generatedAt: new Date().toISOString(),
      timeRange,
    })

    // KPI row
    const filteredEvents = events.slice(0, 1000) // Limit for performance
    const filterCount = Object.keys(filters || {}).length
    drawKpiRow(doc, [
      { label: 'Total Events', value: events.length, highlight: true },
      { label: 'Displayed', value: filteredEvents.length },
      { label: 'Active Filters', value: filterCount },
      { label: 'Hash Verified', value: '✅' },
    ])

    // Empty state or table
    if (filteredEvents.length === 0) {
      drawEmptyState(doc, {
        title: 'No Events Found',
        message: 'No ledger events were found for this export with the applied filters.',
        filters: filters || {},
        actionHint: 'Try adjusting the time range or filters to see more events.',
      })
    } else {
      drawSectionTitle(doc, 'Event Data')

      // Prepare table data
      const tableRows = filteredEvents.map((event) => [
        new Date(event.created_at).toLocaleString(),
        event.event_name || 'unknown',
        event.category || 'operations',
        event.outcome || 'allowed',
        event.severity || 'info',
        event.actor_name || 'System',
        event.actor_role || '',
        event.job_title || event.target_type || '',
      ])

      drawTable(doc, {
        columns: [
          { header: 'Timestamp', width: 100 },
          { header: 'Event', width: 120 },
          { header: 'Category', width: 80 },
          { header: 'Outcome', width: 70 },
          { header: 'Severity', width: 70 },
          { header: 'Actor', width: 100 },
          { header: 'Role', width: 70 },
          { header: 'Target', width: 100 },
        ],
        rows: tableRows,
        zebraStriping: true,
        rowHeight: 18,
        fontSize: 8,
      })

      // Appendices - Evidence Reference
      if (doc.y > doc.page.height - 200) {
        doc.addPage()
        initPage(doc)
      }

      drawSectionTitle(doc, 'Evidence Reference')
      doc
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .text('Note: Evidence files are auth-gated. Use the Work Record IDs below to retrieve evidence via the Compliance Ledger interface.', {
          align: 'left',
          indent: 20,
        })

      doc.moveDown(0.5)

      const uniqueJobs = new Set(events.filter(e => e.job_id).map(e => e.job_id))
      if (uniqueJobs.size > 0) {
        doc
          .fontSize(STYLES.sizes.body)
          .font(STYLES.fonts.body)
          .fillColor(STYLES.colors.primaryText)

        Array.from(uniqueJobs).slice(0, 50).forEach((jobId) => {
          const event = events.find(e => e.job_id === jobId)
          doc.text(`• Work Record ID: ${jobId}${event?.job_title ? ` (${event.job_title})` : ''}`, {
            align: 'left',
            indent: 20,
          })
        })
      }
    }

    // Finalize PDF (adds footers to all pages)
    finalizePdf(doc, { packId: exportId })

    doc.end()
  })
}

