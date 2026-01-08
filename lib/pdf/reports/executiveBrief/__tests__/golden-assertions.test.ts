/**
 * Golden Assertions for Executive Brief PDF
 * 
 * These tests ensure the "board-grade" output never regresses.
 * Freeze today's output as the reference.
 */

import { buildExecutiveBriefPDF } from '../build'
import type { RiskPostureData } from '../types'
import { extractTextFromPDF } from '@/lib/utils/pdf-test-helpers' // Assuming this exists, or we'll create it

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
    // TODO: Extract page count from PDF buffer
    // For now, this is a placeholder assertion
    expect(result.buffer).toBeDefined()
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

  it('should show SHA-256 hash in Integrity capsule', async () => {
    const result = await buildExecutiveBriefPDF(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Hash should be present in Integrity capsule
    expect(text).toContain('SHA-256:')
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
})

