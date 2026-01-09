/**
 * Report Builder
 * 
 * CRITICAL: This is the ONLY place allowed to call doc.addPage()
 * 
 * Structural Rules:
 * - Only build.ts may call doc.addPage() (max once, between Page 1 and Page 2)
 * - ensureSpace() never adds pages, only returns boolean
 * - Renderers must skip/truncate when ensureSpace() returns false
 */

import PDFKit from 'pdfkit'
import crypto from 'crypto'
import type { ReportInput, ReportOutput } from './types'
import { renderPage1 } from './render/page1'
import { renderPage2 } from './render/page2'
import { ensureSpace } from '@/lib/pdf/core/layout'
import { PDF_CORE_TOKENS as STYLES } from '@/lib/pdf/core/tokens'

/**
 * Build Report PDF
 * 
 * @param input - Report input data
 * @param deps - Helper functions (from route or test helpers)
 */
export async function buildReportPDF(
  input: ReportInput,
  deps: {
    // Define your helper functions here
    // Example:
    // sanitizeText: (text: string) => string
    // formatTimeRange: (range: string) => string
    // ... other helpers
    setPageNumber: (val: number) => void
  }
): Promise<ReportOutput> {
  // Track page number manually (PDFKit doesn't expose it directly)
  let currentPageNumber = 1
  let pageNumber = 1 // State variable for ensureSpace()
  
  return new Promise((resolve, reject) => {
    const doc = new PDFKit.PDFDocument({
      size: 'LETTER',
      margins: {
        top: STYLES.spacing.margin,
        bottom: 60,
        left: STYLES.spacing.margin,
        right: STYLES.spacing.margin,
      },
      bufferPages: true,
      info: {
        Title: `Report - ${input.organizationName || 'Unknown'}`,
        Author: 'RiskMate',
        Subject: 'Report',
        Creator: 'RiskMate Platform',
      },
    })

    const chunks: Buffer[] = []
    const startTime = Date.now()
    const generatedAt = new Date()
    
    // Track page number manually
    doc.on('pageAdded', () => {
      currentPageNumber++
    })
    
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const apiLatency = Date.now() - startTime
      
      // Calculate time window
      const end = new Date()
      const start = new Date()
      // ... calculate time window based on input ...
      const timeWindow = { start, end }
      
      // Compute PDF hash
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      
      resolve({
        buffer,
        hash,
        apiLatency,
        timeWindow,
      })
    })
    
    doc.on('error', (err: any) => {
      reject(err)
    })

    const pageWidth = doc.page.width
    const margin = STYLES.spacing.margin

    // ============================================
    // PAGE 1: Render using extracted renderer
    // ============================================
    renderPage1(
      doc,
      input,
      {
        // Pass helpers to renderer
        ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => {
          return ensureSpace(doc, requiredHeight, margin, pageNumber)
        },
        // ... other helpers
      },
      STYLES
    )

    // Force page break for page 2
    // CRITICAL: Only build.ts can add pages - this is the ONLY place doc.addPage() is called
    if (currentPageNumber === 1) {
      doc.addPage()
      currentPageNumber = 2
      pageNumber = 2
      deps.setPageNumber(2)
    }

    // ============================================
    // PAGE 2: Render using extracted renderer
    // ============================================
    renderPage2(
      doc,
      input,
      {
        ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => {
          return ensureSpace(doc, requiredHeight, margin, pageNumber)
        },
        // ... other helpers
      },
      STYLES
    )

    doc.end()
  })
}

