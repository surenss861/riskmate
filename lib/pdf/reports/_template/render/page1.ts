/**
 * Page 1 Renderer
 * 
 * Renders the first page of the report
 * Must check ensureSpace() and skip/truncate if it returns false
 */

import PDFKit from 'pdfkit'
import type { ReportInput } from '../types'
import { safeText } from '@/lib/pdf/core/writer'
import { getContentLimitY } from '@/lib/pdf/core/layout'

export function renderPage1(
  doc: PDFKit.PDFDocument,
  input: ReportInput,
  helpers: {
    ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => boolean
    // ... other helpers
  },
  styles: typeof import('@/lib/pdf/core/tokens').PDF_CORE_TOKENS
): void {
  const margin = styles.spacing.margin
  const pageWidth = doc.page.width

  // Example: Render header
  // CRITICAL: Check if we have space before rendering
  if (helpers.ensureSpace(doc, 100, margin)) {
    safeText(doc, 'Report Title', margin, doc.y, {
      fontSize: styles.sizes.h1,
      font: styles.fonts.header,
      color: styles.colors.primaryText,
    })
    doc.moveDown(1)
  }

  // ... render other Page 1 content ...
}

