/**
 * Test Helpers for Executive Brief PDF Tests
 * 
 * Provides mock implementations of all helper functions needed by buildExecutiveBriefPDF
 * This allows tests to call buildExecutiveBriefPDF without passing helpers from route
 */

import PDFKit from 'pdfkit'
import type { ExecutiveBriefDeps } from '../build'
import type { RiskPostureData } from '../types'
import { sanitizeText, formatTimeRange } from '@/lib/pdf/executiveBrief/utils'

// Mock state tracking (simplified for tests)
let mockPageNumber = 1
let mockPageHasBody = false

/**
 * Create test dependencies for buildExecutiveBriefPDF
 * 
 * These are minimal implementations that allow tests to run.
 * For full functionality, route.ts provides the real implementations.
 */
export function createTestDeps(): ExecutiveBriefDeps {
  // Minimal implementations - these won't render anything meaningful,
  // but they allow the build function to complete without errors
  return {
    sanitizeText,
    formatTimeRange,
    renderKPIStrip: () => {}, // No-op for tests
    renderRiskPostureGauge: () => {}, // No-op for tests
    markPageHasBody: () => { mockPageHasBody = true },
    addSectionDivider: () => {}, // No-op for tests
    renderExecutiveSummary: () => {}, // No-op for tests
    hasSpace: () => true, // Always return true for tests
    renderMicroTopDrivers: () => {}, // No-op for tests
    buildMetricsRows: () => [], // Return empty array for tests
    renderMetricsTable: () => {}, // No-op for tests
    renderDataCoverage: () => {}, // No-op for tests
    renderTopItemsNeedingAttention: () => {}, // No-op for tests
    ensureSpace: (doc: PDFKit.PDFDocument, requiredHeight: number, margin: number) => {
      // For tests, allow page 2 but prevent page 3
      if (mockPageNumber >= 2) {
        return false // Can't fit, and we're already on page 2
      }
      if (doc.page.number >= 2) {
        return false // Already on page 2, no page 3 allowed
      }
      // Allow adding page 2
      if (doc.page.number === 1) {
        doc.addPage()
        mockPageNumber = 2
        doc.y = 48 // Reset to top margin
      }
      return true
    },
    renderRecommendedActionsShort: () => {}, // No-op for tests
    renderMethodologyShort: () => {}, // No-op for tests
    renderDataFreshnessCompact: () => {}, // No-op for tests
    addHeaderFooter: () => {}, // No-op for tests
  }
}

/**
 * Test wrapper for buildExecutiveBriefPDF
 * 
 * This allows tests to call buildExecutiveBriefPDF without manually passing deps
 */
export async function buildExecutiveBriefPDFForTests(
  input: Parameters<typeof import('../build').buildExecutiveBriefPDF>[0]
): Promise<ReturnType<typeof import('../build').buildExecutiveBriefPDF>> {
  const { buildExecutiveBriefPDF } = await import('../build')
  return buildExecutiveBriefPDF(input, createTestDeps())
}

