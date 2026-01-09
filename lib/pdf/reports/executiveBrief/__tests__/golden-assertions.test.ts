/**
 * Golden Assertions for Executive Brief PDF
 * 
 * These tests ensure the "board-grade" output never regresses.
 * Freeze today's output as the reference.
 * 
 * Based on stable output: executive-brief-30d-2026-01-09
 */

import { buildExecutiveBriefPDF } from '../build'
import type { RiskPostureData } from '../types'
import { extractTextFromPDF, getPDFPageCount } from '@/lib/utils/pdf-test-helpers'

describe('Executive Brief PDF - Golden Assertions', () => {
  const mockData: RiskPostureData = {
    posture_score: 50,
    exposure_level: 'moderate',
    delta: undefined, // No prior period
    deltas: undefined,
    high_risk_jobs: 1,
    open_incidents: 0,
    violations: 0,
    flagged_jobs: 0,
    signed_signoffs: 2,
    pending_signoffs: 0,
    proof_packs_generated: 2,
    total_jobs: 2,
    total_incidents: 0,
  }

  const input = {
    data: mockData,
    organizationName: 'Test Organization',
    generatedBy: 'system',
    timeRange: '30d',
    buildSha: undefined,
    reportId: 'test-report-id-12345678',
    baseUrl: 'https://riskmate.app',
  }

  it('should generate exactly 2 pages (hard lock)', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const pageCount = await getPDFPageCount(result.buffer)
    expect(pageCount).toBe(2)
  })
  
  it('should have "RiskMate Executive Brief" header', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    expect(text).toContain('RiskMate Executive Brief')
  })
  
  it('should have "Trend unavailable (need 4 completed periods)" when no historical data', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    // Should show intentional "unavailable" message, not placeholder
    expect(text).toMatch(/Trend unavailable.*need 4 completed periods/i)
  })

  it('should show "prior unavailable" in KPI subtitles when prior period is unavailable', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // When delta is undefined, KPI subtitles should say "prior unavailable", not "vs prior 30d"
    expect(text).toContain('prior unavailable')
    expect(text).not.toContain('vs prior 30d') // Should not appear when prior is unavailable
  })

  it('should show verify path with /verify/ in Integrity capsule', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Verify display must always include /verify/ path
    expect(text).toMatch(/verify\/RM-/)
    // Should never show just the ID without verify path
    expect(text).not.toMatch(/Verification endpoint: RM-[a-z0-9]+$/)
  })

  it('should NOT show "Prior period unavailable" line when chips show N/A', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // The global "Prior period unavailable" note should never appear
    // Individual chips/KPIs show N/A, but no global note
    expect(text).not.toContain('Prior period unavailable')
  })

  it('should have complete Integrity block (Report ID, Window, Sources, SHA-256, Verify)', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Integrity capsule must include all required elements
    expect(text).toContain('Report Integrity')
    expect(text).toMatch(/Report ID:.*RM-/i)
    expect(text).toMatch(/Window:.*-.*/i) // Date range format
    expect(text).toMatch(/Sources:.*jobs.*incidents.*attestations/i)
    expect(text).toContain('SHA-256:')
    expect(text).toMatch(/verify\/RM-/i) // Verify path must include /verify/
  })
  
  it('should show verify path as "riskmate.app/verify/RM-xxxx" or "verify/RM-xxxx"', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Verify display must always include /verify/ path
    expect(text).toMatch(/verify\/RM-/i)
    // Should never show just the ID without verify path
    expect(text).not.toMatch(/Verification endpoint: RM-[a-z0-9]+$/i)
  })

  it('should have "Generated:" and "Window:" on separate lines (no "EST Window:" merge)', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should never see "EST Window:" merged together
    expect(text).not.toContain('EST Window:')
    // Should see them separately
    expect(text).toMatch(/Generated:.*\n.*Window:/)
  })

  it('should have "Why it matters:" label (not just sentence)', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should have explicit label
    expect(text).toContain('Why it matters:')
  })

  it('should have "Decision requested:" label', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should have explicit label
    expect(text).toContain('Decision requested:')
  })
  
  it('should NOT contain junk tokens (single "—", lone numbers, etc.)', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should not have standalone dashes or single numbers without context
    // (This is already enforced by safeText, but verify in output)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    
    for (const line of lines) {
      // Should not be just a dash or number
      expect(line).not.toBe('—')
      expect(line).not.toMatch(/^\d+$/) // Not just a number
    }
  })
  
  // ============================================
  // PAGE 2 SPECIFIC GOLDEN ASSERTIONS
  // ============================================
  
  it('should have Integrity block with all required elements on Page 2', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Integrity capsule must include all required elements (already tested above, but verify Page 2 specific)
    expect(text).toContain('Report Integrity')
    expect(text).toMatch(/Report ID:.*RM-/i)
    expect(text).toMatch(/Window:.*-.*/i) // Date range format
    expect(text).toMatch(/Sources:.*jobs.*incidents.*attestations/i)
    expect(text).toContain('SHA-256:')
    expect(text).toMatch(/verify\/RM-/i) // Verify path must include /verify/
  })
  
  it('should show "Note: prior period unavailable (deltas hidden)" when prior is unavailable', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // When prior period is unavailable, should show explicit note
    // This appears in the Metrics Table section (Page 1 or Page 2)
    expect(text).toContain('Note: prior period unavailable (deltas hidden)')
  })
  
  it('should have Generated and Window on separate lines in Integrity block (no "EST Window:" merge)', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should never see "EST Window:" merged together
    expect(text).not.toContain('EST Window:')
    // Should see them separately (Generated: ... Window: ...)
    expect(text).toMatch(/Generated:.*\n.*Window:/)
  })
})

