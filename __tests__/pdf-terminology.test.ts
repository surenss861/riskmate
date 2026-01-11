/**
 * PDF Content Smoke Test
 * 
 * Verifies that rendered Executive Brief PDFs do not contain banned terminology.
 * This catches cases where source strings pass the banned phrases test but 
 * rendered PDFs still contain old terminology (template strings, fallback copy, etc.).
 * 
 * Last Updated: January 11, 2026
 */

import { buildExecutiveBriefPDFForTests } from '@/lib/pdf/reports/executiveBrief/__tests__/test-helpers'
import type { RiskPostureData } from '@/lib/pdf/reports/executiveBrief/types'
import { extractTextFromPDF } from '@/lib/utils/pdf-test-helpers'

describe('Executive Brief PDF - Terminology Smoke Test', () => {
  const mockData: RiskPostureData = {
    posture_score: 50,
    exposure_level: 'moderate',
    delta: undefined,
    deltas: undefined,
    high_risk_jobs: 1,
    open_incidents: 0,
    violations: 0,
    flagged_jobs: 0,
    signed_signoffs: 2,
    pending_signoffs: 1, // Include pending to trigger all text paths
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

  it('should not contain "Sign-off" or "Sign-offs" terminology in rendered PDF', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Case-insensitive search for banned phrases
    const bannedPhrases = [
      'Sign-off',
      'Sign-offs',
      'sign-off',
      'sign-offs',
      'signoff',
      'signoffs',
      'signed off',
      'sign off',
    ]
    
    const violations: string[] = []
    for (const phrase of bannedPhrases) {
      // Use word boundaries to avoid false positives (e.g., "signoffsPending" variable name in code comments)
      // But allow phrase matching for user-facing text
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      if (regex.test(text)) {
        // Get context around the match
        const matchIndex = text.toLowerCase().indexOf(phrase.toLowerCase())
        const contextStart = Math.max(0, matchIndex - 50)
        const contextEnd = Math.min(text.length, matchIndex + phrase.length + 50)
        const context = text.substring(contextStart, contextEnd)
        violations.push(`Found "${phrase}" in PDF text:\n  ...${context}...`)
      }
    }
    
    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} banned phrase violation(s) in rendered PDF:\n\n` +
        violations.join('\n\n') +
        '\n\nPlease update the PDF generator to use defensibility terminology (Sealed Records / Attestations).'
      )
    }
    
    // Test passes if no violations found
    expect(violations.length).toBe(0)
  })
  
  it('should contain "Sealed Records" terminology in rendered PDF', async () => {
    const result = await buildExecutiveBriefPDFForTests(input)
    const text = await extractTextFromPDF(result.buffer)
    
    // Verify correct terminology appears
    // We should see "Sealed Records" in KPI labels and metrics
    expect(text).toMatch(/Sealed Records/i)
  })
})

