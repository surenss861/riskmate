import PDFDocument from 'pdfkit'
import { STYLES } from './styles'
import { addWatermark } from './helpers'
import {
  drawHeader,
  drawFooter,
  drawSectionTitle,
  drawKpiRow,
  drawTable,
  drawEmptyState,
  formatHashShort,
  initPage,
  finalizePdf,
} from './proofPackTheme'

// Control row can be any object with these fields (from CSV parsing)
interface ControlRow {
  control_id?: string
  ledger_entry_id?: string
  ledger_event_type?: string
  work_record_id?: string
  site_id?: string
  org_id?: string
  status_at_export?: string
  severity?: string
  title?: string
  owner_user_id?: string
  owner_email?: string
  due_date?: string
  verification_method?: string
  created_at?: string
  updated_at?: string
  [key: string]: any // Allow additional fields from CSV
}

// Attestation row can be any object with these fields (from CSV parsing)
interface AttestationRow {
  attestation_id?: string
  ledger_entry_id?: string
  ledger_event_type?: string
  work_record_id?: string
  site_id?: string
  org_id?: string
  status_at_export?: string
  title?: string
  description?: string
  attested_by_user_id?: string
  attested_by_email?: string
  attested_at?: string
  created_at?: string
  [key: string]: any // Allow additional fields from CSV
}

interface ProofPackMeta {
  packId: string
  organizationName: string
  generatedBy: string
  generatedByRole: string
  generatedAt: string
  timeRange: string
}

/**
 * Generate Controls PDF from controls data
 */
export async function generateControlsPDF(
  controls: ControlRow[],
  meta: ProofPackMeta
): Promise<Buffer> {
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
      title: 'Controls Report',
      packId: meta.packId,
      organizationName: meta.organizationName,
      generatedBy: meta.generatedBy,
      generatedByRole: meta.generatedByRole,
      generatedAt: meta.generatedAt,
      timeRange: meta.timeRange,
    })

    // KPI row with enhanced metrics
    const completedCount = controls.filter(c => (c.status_at_export || '') === 'completed').length
    const pendingCount = controls.filter(c => (c.status_at_export || '') === 'pending').length
    const now = new Date()
    const overdueCount = controls.filter(c => {
      if ((c.status_at_export || '') === 'completed') return false
      if (!c.due_date) return false
      return new Date(c.due_date) < now
    }).length
    const highSeverityCount = controls.filter(c => {
      const severity = (c.severity || '').toLowerCase()
      return severity === 'high' || severity === 'critical'
    }).length
    
    drawKpiRow(doc, [
      { label: 'Total Controls', value: controls.length, highlight: true },
      { label: 'Completed', value: completedCount },
      { label: 'Pending', value: pendingCount },
      { label: 'Overdue', value: overdueCount },
      { label: 'High Severity', value: highSeverityCount },
    ])

    // Empty state or table
    if (controls.length === 0) {
      drawEmptyState(doc, {
        title: 'No Controls Found',
        message: 'No controls were found for this proof pack with the applied filters.',
        filters: {
          time_range: meta.timeRange,
          job_id: meta.packId.includes('JOB') ? 'filtered' : undefined,
          site_id: meta.packId.includes('SITE') ? 'filtered' : undefined,
        },
        actionHint: 'Try adjusting the time range or filters, or add controls to jobs in the system.',
      })
    } else {
      drawSectionTitle(doc, 'Controls Data')

      // Sort controls: overdue first, then high severity, then by due date ascending
      const sortedControls = [...controls].sort((a, b) => {
        const aStatus = a.status_at_export || ''
        const bStatus = b.status_at_export || ''
        const aDueDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const bDueDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
        const aSeverity = (a.severity || '').toLowerCase()
        const bSeverity = (b.severity || '').toLowerCase()
        const now = Date.now()
        
        // Overdue first (not completed + past due)
        const aOverdue = aStatus !== 'completed' && aDueDate < now ? 1 : 0
        const bOverdue = bStatus !== 'completed' && bDueDate < now ? 1 : 0
        if (aOverdue !== bOverdue) return bOverdue - aOverdue
        
        // High severity next
        const aHigh = (aSeverity === 'high' || aSeverity === 'critical') ? 1 : 0
        const bHigh = (bSeverity === 'high' || bSeverity === 'critical') ? 1 : 0
        if (aHigh !== bHigh) return bHigh - aHigh
        
        // Then by due date ascending
        return aDueDate - bDueDate
      })

      // Prepare table data
      const tableRows = sortedControls.map((control) => [
        (control.control_id || '').substring(0, 16),
        control.title || 'Untitled',
        control.status_at_export || 'unknown',
        control.severity || 'info',
        control.owner_email || 'Unassigned',
        control.due_date ? new Date(control.due_date).toLocaleDateString() : 'N/A',
        control.updated_at ? new Date(control.updated_at).toLocaleDateString() : 'N/A',
      ])

      drawTable(doc, {
        columns: [
          { header: 'Control ID', width: 70 },
          { header: 'Title', width: 110 },
          { header: 'Status', width: 60 },
          { header: 'Severity', width: 60 },
          { header: 'Owner', width: 90 },
          { header: 'Due Date', width: 80 },
          { header: 'Last Updated', width: 80 },
        ],
        rows: tableRows,
        zebraStriping: true,
        rowHeight: 18,
        fontSize: 8,
      })
    }

    // Finalize PDF (adds footers to all pages)
    finalizePdf(doc, { packId: meta.packId })

    doc.end()
  })
}

/**
 * Generate Attestations PDF from attestations data
 */
export async function generateAttestationsPDF(
  attestations: AttestationRow[],
  meta: ProofPackMeta
): Promise<Buffer> {
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
      title: 'Attestations Report',
      packId: meta.packId,
      organizationName: meta.organizationName,
      generatedBy: meta.generatedBy,
      generatedByRole: meta.generatedByRole,
      generatedAt: meta.generatedAt,
      timeRange: meta.timeRange,
    })

    // KPI row
    const completedCount = attestations.filter(a => {
      const status = (a.status_at_export || '').toLowerCase()
      return status === 'signed' || status === 'completed'
    }).length
    const pendingCount = attestations.length - completedCount
    
    drawKpiRow(doc, [
      { label: 'Total Attestations', value: attestations.length, highlight: true },
      { label: 'Completed', value: completedCount },
      { label: 'Pending', value: pendingCount },
    ])

    // Empty state or table
    if (attestations.length === 0) {
      drawEmptyState(doc, {
        title: 'No Attestations Found',
        message: 'No attestations were found for this proof pack with the applied filters.',
        filters: {
          time_range: meta.timeRange,
          job_id: meta.packId.includes('JOB') ? 'filtered' : undefined,
          site_id: meta.packId.includes('SITE') ? 'filtered' : undefined,
        },
        actionHint: 'Try adjusting the time range or filters, or generate attestations in the system.',
      })
    } else {
      drawSectionTitle(doc, 'Attestations Data')

      // Sort attestations: pending first, then most recent completed
      const sortedAttestations = [...attestations].sort((a, b) => {
        const aStatus = (a.status_at_export || '').toLowerCase()
        const bStatus = (b.status_at_export || '').toLowerCase()
        const aCompleted = aStatus === 'signed' || aStatus === 'completed'
        const bCompleted = bStatus === 'signed' || bStatus === 'completed'
        
        // Pending first
        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1
        }
        
        // Then by most recent first
        const aTime = a.attested_at ? new Date(a.attested_at).getTime() : 0
        const bTime = b.attested_at ? new Date(b.attested_at).getTime() : 0
        return bTime - aTime
      })

      // Prepare table data
      const tableRows = sortedAttestations.map((attestation) => [
        (attestation.attestation_id || '').substring(0, 16),
        attestation.title || 'Untitled',
        attestation.status_at_export || 'unknown',
        attestation.attested_by_email || 'Unknown',
        attestation.attested_at ? new Date(attestation.attested_at).toLocaleString() : 'N/A',
      ])

      drawTable(doc, {
        columns: [
          { header: 'Attestation ID', width: 80 },
          { header: 'Title', width: 140 },
          { header: 'Status', width: 70 },
          { header: 'Attested By', width: 120 },
          { header: 'Attested At', width: 120 },
        ],
        rows: tableRows,
        zebraStriping: true,
        rowHeight: 18,
        fontSize: 8,
      })
    }

    // Finalize PDF (adds footers to all pages)
    finalizePdf(doc, { packId: meta.packId })

    doc.end()
  })
}

/**
 * Generate Evidence Index PDF from manifest data
 */
export async function generateEvidenceIndexPDF(
  manifest: any,
  meta: ProofPackMeta
): Promise<Buffer> {
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
      title: 'Proof Pack Index',
      packId: meta.packId,
      organizationName: meta.organizationName,
      generatedBy: meta.generatedBy,
      generatedByRole: meta.generatedByRole,
      generatedAt: meta.generatedAt,
      timeRange: meta.timeRange,
    })

    // KPI row
    const payloadFileCount = manifest.files?.length || 0
    const totalFileCount = payloadFileCount + 1 // +1 for this index PDF
    drawKpiRow(doc, [
      { label: 'Ledger Events', value: manifest.counts?.ledger_events || 0 },
      { label: 'Controls', value: manifest.counts?.controls || 0 },
      { label: 'Attestations', value: manifest.counts?.attestations || 0 },
      { label: 'Total PDFs', value: totalFileCount, highlight: true },
    ])

    // Contents Summary
    drawSectionTitle(doc, 'Contents Summary')
    doc
      .fillColor(STYLES.colors.secondaryText)
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(`This proof pack contains ${totalFileCount} PDF file(s):`, { align: 'left' })
    doc.moveDown(0.3)
    doc
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(`• ${payloadFileCount} payload PDF(s) with integrity verification hashes`, { align: 'left', indent: 20 })
    doc
      .fontSize(STYLES.sizes.body)
      .font(STYLES.fonts.body)
      .text(`• 1 index PDF (this file)`, { align: 'left', indent: 20 })

    doc.moveDown(1)

    // Files in Pack (short hashes in table)
    drawSectionTitle(doc, 'Payload PDFs (Integrity Verified)')

    if (manifest.files && Array.isArray(manifest.files) && manifest.files.length > 0) {
      const tableRows = manifest.files.map((file: any) => [
        file.name || 'Unknown',
        file.bytes ? file.bytes.toLocaleString() : '0',
        file.sha256 ? formatHashShort(file.sha256, 16) : 'N/A',
      ])

      drawTable(doc, {
        columns: [
          { header: 'File Name', width: 200 },
          { header: 'Size (bytes)', width: 100, align: 'right' },
          { header: 'SHA-256 Hash (short)', width: 150 },
        ],
        rows: tableRows,
        zebraStriping: true,
        rowHeight: 18,
        fontSize: 8,
      })

      // Add index PDF entry (not self-hashed)
      doc.moveDown(0.5)
      doc
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .text('Index PDF:', { align: 'left' })
      doc
        .fontSize(STYLES.sizes.body)
        .font(STYLES.fonts.body)
        .text(`  • evidence_index_${meta.packId}.pdf (included, not self-hashed)`, { align: 'left', indent: 20 })

      // Full Hashes Appendix (on new page if needed)
      if (doc.y > doc.page.height - 200) {
        doc.addPage()
        initPage(doc)
      }

      drawSectionTitle(doc, 'Full SHA-256 Hashes (Payload Integrity Verification)')
      doc
        .fillColor(STYLES.colors.secondaryText)
        .fontSize(STYLES.sizes.caption)
        .font('Courier') // Monospace for hashes
        .text('Use these full hashes to verify payload PDF integrity:', { align: 'left' })
      doc.moveDown(0.3)
      doc
        .fontSize(STYLES.sizes.caption)
        .font(STYLES.fonts.body)
        .text('Note: The index PDF is included in the ZIP but not self-hashed (to avoid infinite loop).', { align: 'left' })

      doc.moveDown(0.5)

      manifest.files.forEach((file: any) => {
        if (file.sha256) {
          doc
            .fontSize(STYLES.sizes.caption)
            .font('Courier')
            .fillColor(STYLES.colors.primaryText)
            .text(`${file.name || 'Unknown'}:`, { align: 'left' })
          doc
            .fontSize(STYLES.sizes.caption)
            .font('Courier')
            .fillColor(STYLES.colors.secondaryText)
            .text(file.sha256, { align: 'left', indent: 20 })
          doc.moveDown(0.3)
        }
      })
    } else {
      drawEmptyState(doc, {
        title: 'No Payload Files in Pack',
        message: 'This proof pack contains no payload PDFs.',
      })
    }

    // Filters
    if (manifest.filters) {
      const activeFilters = Object.entries(manifest.filters)
        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})

      if (Object.keys(activeFilters).length > 0) {
        doc.moveDown(1)
        drawSectionTitle(doc, 'Applied Filters')
        doc
          .fillColor(STYLES.colors.secondaryText)
          .fontSize(STYLES.sizes.body)
          .font(STYLES.fonts.body)

        Object.entries(activeFilters).forEach(([key, value]) => {
          doc.text(`${key.replace(/_/g, ' ')}: ${value}`, { align: 'left' })
        })
      }
    }

    // Finalize PDF (adds footers to all pages)
    finalizePdf(doc, { packId: meta.packId })

    doc.end()
  })
}
