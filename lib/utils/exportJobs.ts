/**
 * Client-side export of job list to CSV and PDF.
 * Used by the bulk export action on the jobs page.
 */

export interface JobForExport {
  id: string
  client_name: string
  job_type?: string
  location?: string
  status?: string
  risk_score?: number | null
  risk_level?: string | null
  owner_name?: string | null
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

const CSV_HEADERS = [
  'Client',
  'Job Type',
  'Location',
  'Status',
  'Risk Score',
  'Risk Level',
  'Owner',
  'Created (UTC)',
  'Updated (UTC)',
]

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Build CSV string from jobs and trigger download.
 */
export function exportJobsToCsv(jobs: JobForExport[], filename?: string): void {
  const headerRow = CSV_HEADERS.join(',')
  const rows = jobs.map((job) =>
    [
      escapeCsvCell(job.client_name),
      escapeCsvCell(job.job_type),
      escapeCsvCell(job.location),
      escapeCsvCell(job.status),
      escapeCsvCell(job.risk_score),
      escapeCsvCell(job.risk_level),
      escapeCsvCell(job.owner_name),
      escapeCsvCell(job.created_at),
      escapeCsvCell(job.updated_at),
    ].join(',')
  )
  const csv = [headerRow, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `work-records-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Build a simple PDF table of jobs and trigger download.
 * Uses pdf-lib (client-side); runs in a microtask to avoid blocking.
 */
export async function exportJobsToPdf(jobs: JobForExport[], filename?: string): Promise<void> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = 9
  const lineHeight = fontSize * 1.4
  const margin = 50
  const pageWidth = 595
  const pageHeight = 842
  const colWidths = [100, 60, 70, 55, 45, 50, 70, 65, 65]

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addHeader = () => {
    const headers = CSV_HEADERS
    let x = margin
    headers.forEach((h, i) => {
      page.drawText(h, { x, y, size: fontSize, font: boldFont })
      x += colWidths[i] ?? 60
    })
    y -= lineHeight
  }

  const addRow = (row: string[]) => {
    if (y < margin + lineHeight * 2) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      addHeader()
    }
    let x = margin
    row.forEach((cell, i) => {
      const w = colWidths[i] ?? 60
      const text = String(cell ?? '').slice(0, 20)
      page.drawText(text, { x, y, size: fontSize, font })
      x += w
    })
    y -= lineHeight
  }

  addHeader()
  jobs.forEach((job) => {
    addRow([
      String(job.client_name ?? ''),
      String(job.job_type ?? ''),
      String(job.location ?? ''),
      String(job.status ?? ''),
      String(job.risk_score ?? ''),
      String(job.risk_level ?? ''),
      String(job.owner_name ?? ''),
      String(job.created_at ?? ''),
      String(job.updated_at ?? ''),
    ])
  })

  const bytes = await doc.save()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `work-records-export-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export type ExportFormat = 'csv' | 'pdf'

/**
 * Export selected jobs in the given format(s). Triggers download(s).
 * Returns when done; throws on failure.
 */
export async function exportJobs(
  jobs: JobForExport[],
  format: ExportFormat | ExportFormat[] = 'csv'
): Promise<void> {
  const formats = Array.isArray(format) ? format : [format]
  const baseName = `work-records-export-${new Date().toISOString().slice(0, 10)}`
  for (const f of formats) {
    if (f === 'csv') {
      exportJobsToCsv(jobs, `${baseName}.csv`)
    } else if (f === 'pdf') {
      await exportJobsToPdf(jobs, `${baseName}.pdf`)
    }
  }
}
