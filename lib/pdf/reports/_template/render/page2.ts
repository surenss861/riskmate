/**
 * Page 2 Renderer
 * 
 * Renders the second page of the report
 * Must check ensureSpace() and skip/truncate if it returns false
 * 
 * CRITICAL: Never create page 3 - if ensureSpace() returns false, skip the section
 */

import PDFDocument from 'pdfkit'
import type PDFKit from 'pdfkit'
import type { ReportInput } from '../types'
import { safeText } from '@/lib/pdf/core/writer'
import { getContentLimitY } from '@/lib/pdf/core/layout'

export function renderPage2(
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

  // Example: Render content sections
  // CRITICAL: Check if we have space before rendering (no page 3 allowed)
  if (helpers.ensureSpace(doc, 100, margin)) {
    safeText(doc, 'Section Title', margin, doc.y, {
      fontSize: styles.sizes.h2,
      font: styles.fonts.header,
      color: styles.colors.primaryText,
    })
    doc.moveDown(0.8)
  }

  // ... render other Page 2 content ...
  
  // CRITICAL: If ensureSpace() returns false, skip the section
  // Never call doc.addPage() here - only build.ts can add pages
}

