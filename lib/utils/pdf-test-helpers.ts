/**
 * PDF Test Helpers
 * 
 * Utilities for testing PDF generation and content.
 * Provides text extraction and page counting for PDF smoke tests.
 */

import { PDFDocument } from 'pdf-lib'

let pdfParse: any = null

/**
 * Lazy load pdf-parse to avoid requiring it as a dependency
 */
async function getPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = await import('pdf-parse')
      return pdfParse.default || pdfParse
    } catch (err) {
      throw new Error(
        'pdf-parse is required for text extraction. Install it with: npm install --save-dev pdf-parse'
      )
    }
  }
  return pdfParse.default || pdfParse
}

/**
 * Extract text content from a PDF buffer
 * 
 * Uses pdf-parse to extract text from all pages of a PDF.
 * Returns a single string with all text content.
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    const parse = await getPdfParse()
    const data = await parse(pdfBuffer)
    return data.text || ''
  } catch (err: any) {
    // If pdf-parse is not available or fails, throw clear error
    if (err.message?.includes('pdf-parse is required')) {
      throw err
    }
    throw new Error(`Failed to extract text from PDF: ${err.message}`)
  }
}

/**
 * Get page count from a PDF buffer
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    return pdfDoc.getPageCount()
  } catch (err) {
    throw new Error(`Failed to get PDF page count: ${err}`)
  }
}
