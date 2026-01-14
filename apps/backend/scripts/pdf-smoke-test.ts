/**
 * PDF Smoke Test - End-to-End
 * Generates a ledger PDF, extracts text, and validates it's audit-grade clean
 * 
 * Run with: tsx apps/backend/scripts/pdf-smoke-test.ts
 */

import { generateLedgerPDF } from '../src/utils/pdf/ledgerExport'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

// Test configuration
const TEST_PACK_ID = `PACK-SMOKE-${Date.now()}`
const TEST_ORG_NAME = 'Test Organization'
const TEST_GENERATED_BY = 'Test User'
const TEST_GENERATED_BY_ROLE = 'Admin'

// Mock data
const mockEvents = [
  {
    id: 'event-1',
    event_name: 'job_created',
    created_at: new Date().toISOString(),
    category: 'security',
    outcome: 'success',
    severity: 'low',
    actor_name: 'Test User',
    actor_role: 'admin',
    job_id: 'job-123',
    job_title: 'Test Job',
    target_type: 'job',
    summary: 'Test event summary',
  },
]

const mockFilters = {
  time_range: '30d',
  job_id: 'job-123',
  category: 'security',
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Write to temp file
  const tempPath = join(process.cwd(), `temp-${TEST_PACK_ID}.pdf`)
  writeFileSync(tempPath, pdfBuffer)
  
  try {
    // Try pdftotext first (most reliable)
    try {
      const text = execSync(`pdftotext "${tempPath}" - 2>/dev/null`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      })
      return text
    } catch {
      // Fallback: try pdfjs-dist if available
      try {
        const pdfjs = require('pdfjs-dist/legacy/build/pdf.js')
        const data = new Uint8Array(pdfBuffer)
        const pdf = await pdfjs.getDocument({ data }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          fullText += textContent.items.map((item: any) => item.str).join(' ')
        }
        return fullText
      } catch {
        throw new Error('No PDF text extraction method available (install pdftotext or pdfjs-dist)')
      }
    }
  } finally {
    // Cleanup
    try {
      unlinkSync(tempPath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

function validatePdfText(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for Unicode Control, Format, Private-use categories
  if (/\p{Cc}|\p{Cf}|\p{Co}/u.test(text)) {
    errors.push('Contains Unicode Control/Format/Private-use category characters')
  }
  
  // Check for broken glyphs
  if (/[\uFFFD-\uFFFF]/.test(text)) {
    errors.push('Contains Unicode replacement/broken glyph characters (U+FFFD-U+FFFF)')
  }
  
  // Check for zero-width characters
  if (/[\u200B-\u200D\uFEFF]/.test(text)) {
    errors.push('Contains zero-width characters')
  }
  
  // Check for ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(text)) {
    const matches = text.match(/[\x00-\x1F\x7F]/g) || []
    const codes = matches.map(m => `\\u${m.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', ')
    errors.push(`Contains ASCII control characters: ${codes}`)
  }
  
  // CRITICAL: Check for "auth￾gated" broken glyph issue
  if (text.includes('auth') && !text.includes('auth-gated') && !text.includes('auth gated')) {
    const authMatch = text.match(/auth[^\s-]+gated/)
    if (authMatch && /[\uFFFD-\uFFFF]/.test(authMatch[0])) {
      errors.push(`Broken glyph in "auth...gated" pattern: "${authMatch[0]}"`)
    }
  }
  
  // Check that Evidence Reference note is clean
  if (text.includes('Evidence files are') && !text.includes('auth-gated') && !text.includes('auth gated')) {
    errors.push('Evidence Reference note does not contain clean "auth-gated" text')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateActiveFiltersCount(text: string, expectedCount: number): boolean {
  // Look for "Active Filters" line in the text
  const activeFiltersMatch = text.match(/Active Filters[:\s]+(\d+)/i)
  if (!activeFiltersMatch) {
    console.warn('Could not find "Active Filters" line in extracted text')
    return false
  }
  
  const extractedCount = parseInt(activeFiltersMatch[1], 10)
  if (extractedCount !== expectedCount) {
    console.error(`Active Filters count mismatch: expected ${expectedCount}, extracted ${extractedCount}`)
    return false
  }
  
  return true
}

async function runSmokeTest() {
  console.log('🧪 Running PDF Smoke Test (End-to-End)...\n')
  
  try {
    // Step 1: Generate ledger PDF
    console.log('📄 Generating Ledger PDF...')
    const pdfBuffer = await generateLedgerPDF({
      exportId: TEST_PACK_ID,
      organizationName: TEST_ORG_NAME,
      generatedBy: TEST_GENERATED_BY,
      generatedByRole: TEST_GENERATED_BY_ROLE,
      events: mockEvents,
      filters: mockFilters,
      timeRange: 'Last 30 days',
    })
    
    console.log(`   ✅ Generated PDF (${pdfBuffer.length} bytes)\n`)
    
    // Step 2: Extract text
    console.log('🔍 Extracting text from PDF...')
    const extractedText = await extractTextFromPdf(pdfBuffer)
    console.log(`   ✅ Extracted ${extractedText.length} characters\n`)
    
    // Step 3: Validate text is clean
    console.log('✅ Validating extracted text...')
    const validation = validatePdfText(extractedText)
    
    if (!validation.valid) {
      console.error('❌ Text validation failed:')
      validation.errors.forEach(error => console.error(`   - ${error}`))
      console.error('\n📄 Extracted text snippet (first 500 chars):')
      console.error(extractedText.substring(0, 500))
      process.exit(1)
    }
    
    console.log('   ✅ No forbidden characters detected\n')
    
    // Step 4: Validate Active Filters count
    console.log('🔢 Validating Active Filters count...')
    const { countActiveFilters } = require('../src/utils/pdf/normalize')
    const expectedFilterCount = countActiveFilters(mockFilters)
    const filtersValid = validateActiveFiltersCount(extractedText, expectedFilterCount)
    
    if (!filtersValid) {
      console.error('❌ Active Filters count validation failed')
      process.exit(1)
    }
    
    console.log(`   ✅ Active Filters count is correct (${expectedFilterCount})\n`)
    
    // Step 5: Validate Evidence Reference note
    console.log('📝 Validating Evidence Reference note...')
    if (!extractedText.includes('auth-gated') && !extractedText.includes('auth gated')) {
      console.error('❌ Evidence Reference note does not contain clean "auth-gated" text')
      console.error('   Extracted text around "Evidence":')
      const evidenceIndex = extractedText.indexOf('Evidence')
      if (evidenceIndex >= 0) {
        console.error(extractedText.substring(evidenceIndex, evidenceIndex + 200))
      }
      process.exit(1)
    }
    
    console.log('   ✅ Evidence Reference note is clean\n')
    
    console.log('✅ All smoke test checks passed!')
    console.log('\n📋 Summary:')
    console.log('   - PDF generated successfully')
    console.log('   - Text extraction successful')
    console.log('   - No forbidden characters')
    console.log('   - Active Filters count correct')
    console.log('   - Evidence Reference note clean')
    
  } catch (error: any) {
    console.error('❌ Smoke test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  runSmokeTest()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error)
      process.exit(1)
    })
}

export { runSmokeTest, validatePdfText, extractTextFromPdf }
