/**
 * Test Helpers for Report PDF Tests
 * 
 * Provides mock implementations of all helper functions needed by buildReportPDF
 * This allows tests to call buildReportPDF without passing helpers from route
 */

import PDFDocument from 'pdfkit'
import type { ReportInput, ReportOutput } from '../types'
import { buildReportPDF } from '../build'
import { ensureSpace } from '@/lib/pdf/core/layout'

// Mock state tracking (simplified for tests)
let mockPageNumber = 1

/**
 * Create test dependencies for buildReportPDF
 * 
 * These are minimal implementations that allow tests to run.
 * For full functionality, route.ts provides the real implementations.
 */
export function createTestDeps() {
  return {
    // Add your helper functions here
    // Example:
    // sanitizeText: (text: string) => text,
    // formatTimeRange: (range: string) => range,
    setPageNumber: (val: number) => { mockPageNumber = val },
  }
}

/**
 * Test wrapper for buildReportPDF
 * 
 * This allows tests to call buildReportPDF without manually passing deps
 */
export async function buildReportPDFForTests(
  input: ReportInput
): Promise<ReportOutput> {
  const deps = createTestDeps()
  
  // Wrap ensureSpace to use mock page number
  const wrappedDeps = {
    ...deps,
    // Add wrapped helpers that use mockPageNumber
    // Example:
    // ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => {
    //   return ensureSpace(doc, requiredHeight, margin, mockPageNumber)
    // },
  }
  
  return buildReportPDF(input, wrappedDeps)
}

