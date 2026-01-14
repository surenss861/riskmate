/**
 * PDF Smoke Test - End-to-End
 * Generates a ledger PDF, extracts text, and validates it's audit-grade clean
 * 
 * Run with: tsx apps/backend/scripts/pdf-smoke-test.ts
 */

import { generateLedgerExportPDF } from '../src/utils/pdf/ledgerExport'
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
    outcome: 'allowed',
    severity: 'info',
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
  site_id: null,
  category: 'security',
  actor_id: null,
  severity: null,
  outcome: null,
}

/**
 * Sanitize extracted PDF text by normalizing whitespace and removing common Unicode format characters
 * This handles the fact that PDF text extraction often includes form feeds, direction markers, etc.
 */
function sanitizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize Windows line endings
    .replace(/\r/g, '\n') // Normalize Mac line endings
    .replace(/\u000c/g, '\n') // Form feed (page break) -> newline
    .replace(/\u0000/g, '') // Remove null bytes
    // Common Unicode format characters that show up in extracted text (not actual content issues):
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '') // Left-to-right/right-to-left marks, etc.
}

/**
 * Find bad ASCII control characters (excluding legitimate whitespace)
 * Allows: \t (0x09), \n (0x0A), \r (0x0D)
 */
function findBadAsciiControls(text: string): string[] {
  const bad: string[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    
    const allowed =
      code === 0x09 || // \t (tab)
      code === 0x0a || // \n (newline)
      code === 0x0d    // \r (carriage return)
    
    if (!allowed && (code < 0x20 || (code >= 0x7f && code <= 0x9f))) {
      bad.push(`\\u${code.toString(16).padStart(4, '0')}`)
    }
  }
  return [...new Set(bad)]
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Write to temp file
  const tempPath = join(process.cwd(), `temp-${TEST_PACK_ID}.pdf`)
  writeFileSync(tempPath, pdfBuffer)
  
  try {
    // Try pdftotext first (most reliable)
    try {
      // Use -nopgbrk to prevent form feeds, -enc UTF-8 for proper encoding
      const text = execSync(`pdftotext -nopgbrk -enc UTF-8 "${tempPath}" - 2>/dev/null`, {
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
  
  // Step 1: Sanitize extracted text (normalize whitespace, remove format chars)
  const cleaned = sanitizeExtractedText(text)
  
  // Step 2: Check for bad ASCII control characters (excluding legitimate whitespace)
  const badControls = findBadAsciiControls(cleaned)
  if (badControls.length > 0) {
    errors.push(`Contains unexpected ASCII control characters: ${badControls.join(', ')}`)
  }
  
  // Step 3: Check for broken glyphs (replacement characters)
  if (/[\uFFFD-\uFFFF]/.test(cleaned)) {
    errors.push('Contains Unicode replacement/broken glyph characters (U+FFFD-U+FFFF)')
  }
  
  // Step 4: Check for zero-width characters (excluding already-stripped format chars)
  if (/[\u200B-\u200D]/.test(cleaned)) {
    errors.push('Contains zero-width characters (U+200B-U+200D)')
  }
  
  // Step 5: Check for private-use area characters
  if (/[\uE000-\uF8FF]/.test(cleaned)) {
    errors.push('Contains private-use area characters (U+E000-U+F8FF)')
  }
  
  // CRITICAL: Check for "auth￾gated" broken glyph issue
  if (cleaned.includes('auth') && !cleaned.includes('auth-gated') && !cleaned.includes('auth gated')) {
    const authMatch = cleaned.match(/auth[^\s-]+gated/)
    if (authMatch && /[\uFFFD-\uFFFF]/.test(authMatch[0])) {
      errors.push(`Broken glyph in "auth...gated" pattern: "${authMatch[0]}"`)
    }
  }
  
  // Check that Evidence Reference note is clean
  if (cleaned.includes('Evidence files are') && !cleaned.includes('auth-gated') && !cleaned.includes('auth gated')) {
    errors.push('Evidence Reference note does not contain clean "auth-gated" text')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateActiveFiltersCount(text: string, expectedCount: number): boolean {
  // In table layouts, labels and values are on separate rows:
  // Row 1: "Total Events\nDisplayed\nActive Filters\nHash Verified"
  // Row 2: "1\n1\n3\nYes"
  // So "Active Filters" is the 3rd label (index 2), and its value is the 3rd number after "Hash Verified"
  
  const hashIndex = text.toLowerCase().indexOf('hash verified')
  if (hashIndex === -1) {
    console.warn('Could not find "Hash Verified" in extracted text')
    return false
  }
  
  // Find all numbers after "Hash Verified" (these are the KPI values in order)
  const afterHash = text.substring(hashIndex + 'hash verified'.length)
  const numbersAfterHash = afterHash.match(/\d+/g)
  
  if (!numbersAfterHash || numbersAfterHash.length < 3) {
    console.warn(`Could not find enough numbers after "Hash Verified" (found ${numbersAfterHash?.length || 0}, need at least 3)`)
    return false
  }
  
  // KPI order: Total Events (index 0), Displayed (index 1), Active Filters (index 2)
  // So Active Filters is the 3rd number (index 2)
  const extractedCount = parseInt(numbersAfterHash[2], 10)
  
  if (extractedCount !== expectedCount) {
    console.error(`Active Filters count mismatch: expected ${expectedCount}, extracted ${extractedCount}`)
    console.warn(`Numbers after "Hash Verified": ${numbersAfterHash.join(', ')}`)
    return false
  }
  
  return true
}

async function runSmokeTest() {
  console.log('🧪 Running PDF Smoke Test (End-to-End)...\n')
  
  try {
    // Step 1: Generate ledger PDF
    console.log('📄 Generating Ledger PDF...')
    const pdfBuffer = await generateLedgerExportPDF({
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
    const rawExtractedText = await extractTextFromPdf(pdfBuffer)
    console.log(`   ✅ Extracted ${rawExtractedText.length} characters (raw)\n`)
    
    // Step 3: Validate text is clean (validation includes sanitization)
    console.log('✅ Validating extracted text...')
    const validation = validatePdfText(rawExtractedText)
    
    if (!validation.valid) {
      console.error('❌ Text validation failed:')
      validation.errors.forEach(error => console.error(`   - ${error}`))
      console.error('\n📄 Extracted text snippet (first 500 chars):')
      console.error(rawExtractedText.substring(0, 500))
      process.exit(1)
    }
    
    console.log('   ✅ No forbidden characters detected\n')
    
    // Step 4: Validate Active Filters count (use sanitized text)
    console.log('🔢 Validating Active Filters count...')
    const { countActiveFilters } = require('../src/utils/pdf/normalize')
    const expectedFilterCount = countActiveFilters(mockFilters)
    const sanitizedText = sanitizeExtractedText(rawExtractedText)
    const filtersValid = validateActiveFiltersCount(sanitizedText, expectedFilterCount)
    
    if (!filtersValid) {
      console.error('❌ Active Filters count validation failed')
      process.exit(1)
    }
    
    console.log(`   ✅ Active Filters count is correct (${expectedFilterCount})\n`)
    
    // Step 5: Validate Evidence Reference note (use sanitized text)
    console.log('📝 Validating Evidence Reference note...')
    if (!sanitizedText.includes('auth-gated') && !sanitizedText.includes('auth gated')) {
      console.error('❌ Evidence Reference note does not contain clean "auth-gated" text')
      console.error('   Extracted text around "Evidence":')
      const evidenceIndex = sanitizedText.indexOf('Evidence')
      if (evidenceIndex >= 0) {
        console.error(sanitizedText.substring(evidenceIndex, evidenceIndex + 200))
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
