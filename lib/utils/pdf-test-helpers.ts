/**
 * PDF Test Helpers
 * 
 * Utilities for testing PDF generation and content.
 * Provides text extraction and page counting for PDF smoke tests.
 */

import { PDFDocument } from 'pdf-lib'

/**
 * Extract text content from a PDF buffer
 * 
 * NOTE: pdf-parse is required for text extraction but is not installed.
 * For now, this returns empty string (tests will need pdf-parse installed).
 * 
 * To enable text extraction:
 *   npm install --save-dev pdf-parse @types/pdf-parse
 * 
 * Then uncomment the pdf-parse implementation below.
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // TODO: Install pdf-parse and implement text extraction
  // For now, return empty string (tests will need pdf-parse)
  return ''
  
  /* Implementation with pdf-parse (uncomment after installing):
  try {
    const pdfParse = await import('pdf-parse')
    const parse = pdfParse.default || pdfParse
    const data = await parse(pdfBuffer)
    return data.text || ''
  } catch (err: any) {
    throw new Error(`Failed to extract text from PDF: ${err.message}`)
  }
  */
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
