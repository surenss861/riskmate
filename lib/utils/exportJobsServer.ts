/**
 * Server-side export: build CSV string and PDF buffer from job rows.
 * Used by /api/jobs/bulk/export to generate files for all requested job IDs.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'

export interface JobRowForExport {
  id: string
  client_name: string
  job_type?: string | null
  location?: string | null
  status?: string | null
  risk_score?: number | null
  risk_level?: string | null
  owner_name?: string | null
  created_at?: string | null
  updated_at?: string | null
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

export function buildCsvString(jobs: JobRowForExport[]): string {
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
  return [headerRow, ...rows].join('\r\n')
}

export async function buildPdfBuffer(jobs: JobRowForExport[]): Promise<Uint8Array> {
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
    let x = margin
    CSV_HEADERS.forEach((h, i) => {
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
  for (const job of jobs) {
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
  }

  return doc.save()
}
