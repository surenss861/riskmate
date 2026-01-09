/**
 * Golden Assertions for Executive Brief PDF
 * 
 * These tests ensure the "board-grade" output never regresses.
 * Freeze today's output as the reference.
 * 
 * Based on stable output: executive-brief-30d-2026-01-09
 */

import { buildExecutiveBriefPDFForTests } from './test-helpers'
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

  it('should generate exactly 2 pages (hard lock - structural, not best effort)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const pageCount = await getPDFPageCount(result.buffer)
    // CRITICAL: This is a structural requirement - PDF must be exactly 2 pages
    // If this fails, the 2-page lock is broken and content is spilling to page 3
    expect(pageCount).toBe(2)
    
    // Additional assertion: verify the buffer we test is the same one we'd deploy
    expect(result.buffer).toBeDefined()
    expect(result.buffer.length).toBeGreaterThan(0)
    
    // CRITICAL: Guard against lonely "Verify:" on its own page (regression prevention)
    // Extract text from each page and check that no page contains only "Verify:" with minimal content
    const text = await extractTextFromPDF(result.buffer)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    
    // Check for lonely Verify line pattern (Verify: on a line with almost no other content nearby)
    // This would indicate Page 3 with just the Verify line
    const verifyLineIndex = lines.findIndex(l => l.includes('Verify:') || l.includes('Verification endpoint:'))
    if (verifyLineIndex !== -1) {
      // Check surrounding lines - if Verify is isolated with very little content, it's likely Page 3
      const contextStart = Math.max(0, verifyLineIndex - 3)
      const contextEnd = Math.min(lines.length, verifyLineIndex + 3)
      const context = lines.slice(contextStart, contextEnd)
      const contextText = context.join(' ')
      
      // If Verify line appears with very little other content, it's likely on its own page
      // (This is a heuristic - the page count check above is the hard guard)
      if (context.length < 5 && contextText.length < 100) {
        throw new Error(`Found lonely Verify line with minimal context - likely on Page 3. Context: "${contextText}"`)
      }
    }
  })
  
  it('should have "RiskMate Executive Brief" header', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    expect(text).toContain('RiskMate Executive Brief')
  })

  it('should always include "Decision requested:" on Page 1 (non-negotiable for board credibility)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    // CRITICAL: Decision requested must always appear - this is non-negotiable
    expect(text).toContain('Decision requested:')
  })
  
  it('should have "Trend unavailable (need 4 completed periods)" when no historical data', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    // Should show intentional "unavailable" message, not placeholder
    expect(text).toMatch(/Trend unavailable.*need 4 completed periods/i)
  })

  it('should show "prior unavailable" in KPI subtitles when prior period is unavailable', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // When delta is undefined, KPI subtitles should say "prior unavailable", not "vs prior 30d"
    expect(text).toContain('prior unavailable')
    expect(text).not.toContain('vs prior 30d') // Should not appear when prior is unavailable
  })

  it('should show verify path with /verify/ in Integrity capsule', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Verify display must always include /verify/ path
    expect(text).toMatch(/verify\/RM-/)
    // Should never show just the ID without verify path
    expect(text).not.toMatch(/Verification endpoint: RM-[a-z0-9]+$/)
  })

  it('should NOT show "Prior period unavailable" line when chips show N/A', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // The global "Prior period unavailable" note should never appear
    // Individual chips/KPIs show N/A, but no global note
    expect(text).not.toContain('Prior period unavailable')
  })

  it('should have complete Integrity block (Report ID, Window, Sources, SHA-256, Verify)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
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
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Verify display must always include /verify/ path
    expect(text).toMatch(/verify\/RM-/i)
    // Should never show just the ID without verify path
    expect(text).not.toMatch(/Verification endpoint: RM-[a-z0-9]+$/i)
  })

  it('should have "Generated:" and "Window:" on separate lines (no "EST Window:" merge)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should never see "EST Window:" merged together
    expect(text).not.toContain('EST Window:')
    // Should see them separately
    expect(text).toMatch(/Generated:.*\n.*Window:/)
  })

  it('should have "Why it matters:" label (not just sentence)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should have explicit label
    expect(text).toContain('Why it matters:')
  })

  it('should have "Decision requested:" label', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should have explicit label
    expect(text).toContain('Decision requested:')
  })
  
  it('should NOT contain junk tokens (single "—", lone numbers, etc.)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
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
    const result = await buildExecutiveBriefPDFForTests(input)
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
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // When prior period is unavailable, should show explicit note
    // This appears in the Metrics Table section (Page 1 or Page 2)
    expect(text).toContain('Note: prior period unavailable (deltas hidden)')
  })
  
  it('should have Generated and Window on separate lines in Integrity block (no "EST Window:" merge)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Should never see "EST Window:" merged together
    expect(text).not.toContain('EST Window:')
    // Should see them separately (Generated: ... Window: ...)
    expect(text).toMatch(/Generated:.*\n.*Window:/)
  })
  
  it('should NOT have trailing separators (•) at end of lines in chips', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Extract lines and check for trailing separators
    const lines = text.split('\n').map(l => l.trim())
    
    for (const line of lines) {
      // Should not end with just a separator (like "Open incidents 0 •")
      // Separators should always be between items, not at the end
      expect(line).not.toMatch(/•\s*$/) // No trailing bullet
      expect(line).not.toMatch(/[•|]\s*$/) // No trailing separator of any kind
    }
  })
  
  it('should render "Moderate" as single word (no mid-word wrapping)', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // CRITICAL: "Moderate" must appear as complete word (exposure level for moderate risk posture)
    // This prevents the "Mode / rate" artifact where PDFKit was character-wrapping mid-word
    expect(text).toContain('Moderate')
    
    // CRITICAL: Must NOT see "Mode" followed by "rate" on next line (regression prevention)
    // Stricter check: assert it does NOT contain "Mode" + newline + "rate"
    const lines = text.split('\n').map(l => l.trim())
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i]
      const nextLine = lines[i + 1]
      
      // Should never see "Mode" on one line followed by "rate" on the next
      // This is the exact artifact we're fixing - "Moderate" being split mid-word
      if (currentLine.endsWith('Mode') && nextLine.startsWith('rate')) {
        throw new Error(`Found "Mode / rate" artifact: "${currentLine}" followed by "${nextLine}"`)
      }
      // Also check if "Mode" appears standalone and "rate" appears on next line (even if not adjacent)
      if (currentLine === 'Mode' || (currentLine.endsWith(' Mode') && !currentLine.includes('Moderate'))) {
        if (nextLine.startsWith('rate') || nextLine === 'rate') {
          throw new Error(`Found "Mode / rate" artifact: "${currentLine}" followed by "${nextLine}"`)
        }
      }
    }
    
    // Additional strict check: assert text does NOT contain "Mode\nrate" pattern
    // (newline between Mode and rate indicates mid-word wrapping)
    const modeRatePattern = /Mode\s*\n\s*rate/i
    expect(text).not.toMatch(modeRatePattern)
    
    // Assert it DOES contain "Moderate" as a complete word
    expect(text).toMatch(/\bModerate\b/)
  })
  
  it('should render headline as exactly 2 lines when semicolon is present', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // CRITICAL: Headline should be intentionally 2-line at semicolon
    // Check for semicolon line break pattern: "Exposure is moderate;" followed by newline then action
    // This ensures the headline is split at the semicolon (not mid-phrase)
    const headlinePattern = /Exposure is (low|moderate|high);\s*\n\s*mitigate/i
    expect(text).toMatch(headlinePattern)
    
    // Additional check: Ensure semicolon is on first line, action on second line
    const lines = text.split('\n').map(l => l.trim())
    const semicolonLineIndex = lines.findIndex(l => l.includes('Exposure is') && l.includes(';'))
    const actionLineIndex = lines.findIndex(l => l.includes('mitigate') || l.includes('no high risk'))
    
    // Semicolon line and action line should be consecutive (or very close)
    if (semicolonLineIndex !== -1 && actionLineIndex !== -1) {
      const lineGap = Math.abs(actionLineIndex - semicolonLineIndex)
      // Should be on consecutive lines (gap of 0 or 1)
      expect(lineGap).toBeLessThanOrEqual(1)
    }
  })
  
  it('should align Decision requested deadline with Priority 1 action deadline', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // CRITICAL: Decision requested deadline must match Priority 1 action deadline
    // This prevents credibility leaks like "within 7 days" when Priority 1 is "by Jan 11" (48h)
    
    // Extract Priority 1 deadline from actions section
    const priority1DeadlineMatch = text.match(/1\.\s+.*?Deadline:\s+(by\s+\w+\s+\d+)/i)
    const decisionDeadlineMatch = text.match(/Decision requested:.*?(by\s+\w+\s+\d+|within\s+\d+\s+days)/i)
    
    if (priority1DeadlineMatch && decisionDeadlineMatch) {
      const priority1Deadline = priority1DeadlineMatch[1].toLowerCase()
      const decisionDeadline = decisionDeadlineMatch[1].toLowerCase()
      
      // If Priority 1 has a specific date (e.g., "by Jan 11"), Decision requested should match it
      if (priority1Deadline.startsWith('by ')) {
        expect(decisionDeadline).toContain(priority1Deadline.replace('by ', ''))
      }
    }
    
    // Additional check: If Priority 1 exists, Decision requested should not say "within 7 days"
    // when Priority 1 is "by [date]" (48h deadline)
    if (priority1DeadlineMatch && priority1DeadlineMatch[1].startsWith('by ')) {
      expect(text).not.toMatch(/Decision requested:.*within 7 days/i)
    }
  })
})

