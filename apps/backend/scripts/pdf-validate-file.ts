/**
 * PDF File Validator
 * Validates actual pack PDF files (ledger_export, evidence_index, controls, attestations)
 * 
 * Usage: tsx apps/backend/scripts/pdf-validate-file.ts <path-to-pdf> [<path-to-pdf> ...]
 * Example: tsx apps/backend/scripts/pdf-validate-file.ts ledger_export_PACK-*.pdf evidence_index_PACK-*.pdf
 */

import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

/**
 * Sanitize extracted PDF text by normalizing whitespace and removing common Unicode format characters
 */
function sanitizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u000c/g, '\n') // Form feed -> newline
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '') // Format characters
}

/**
 * Find bad ASCII control characters (excluding legitimate whitespace)
 */
function findBadAsciiControls(text: string): string[] {
  const bad: string[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    
    const allowed = code === 0x09 || code === 0x0a || code === 0x0d
    
    if (!allowed && (code < 0x20 || (code >= 0x7f && code <= 0x9f))) {
      bad.push(`\\u${code.toString(16).padStart(4, '0')}`)
    }
  }
  return [...new Set(bad)]
}

function extractTextFromPdf(pdfPath: string): string {
  try {
    const text = execSync(`pdftotext -nopgbrk -enc UTF-8 "${pdfPath}" - 2>/dev/null`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    })
    return text
  } catch (error: any) {
    throw new Error(`Failed to extract text from ${pdfPath}: ${error.message}`)
  }
}

function validatePdfText(text: string, pdfName: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const cleaned = sanitizeExtractedText(text)
  
  // Check for bad ASCII control characters
  const badControls = findBadAsciiControls(cleaned)
  if (badControls.length > 0) {
    errors.push(`Contains unexpected ASCII control characters: ${badControls.join(', ')}`)
  }
  
  // Check for broken glyphs
  if (/[\uFFFD-\uFFFF]/.test(cleaned)) {
    errors.push('Contains Unicode replacement/broken glyph characters (U+FFFD-U+FFFF)')
  }
  
  // Check for zero-width characters
  if (/[\u200B-\u200D]/.test(cleaned)) {
    errors.push('Contains zero-width characters (U+200B-U+200D)')
  }
  
  // Check for private-use area characters
  if (/[\uE000-\uF8FF]/.test(cleaned)) {
    errors.push('Contains private-use area characters (U+E000-U+F8FF)')
  }
  
  // CRITICAL: Check for "auth￾gated" broken glyph issue (deterministic check)
  // Pass only if it matches: "auth-gated" or "auth gated"
  // Fail if we see "auth" followed by weird non-space/non-hyphen chars before "gated"
  const okPattern = /auth[- ]gated/i
  const suspiciousPattern = /auth[^\w\s-]+gated/i // auth followed by non-word/non-space/non-hyphen before gated
  const hasAuthGated = cleaned.toLowerCase().includes('auth') && cleaned.toLowerCase().includes('gated')
  
  if (hasAuthGated) {
    const isOk = okPattern.test(cleaned)
    const isSuspicious = suspiciousPattern.test(cleaned)
    
    if (isSuspicious && !isOk) {
      const match = cleaned.match(/auth[^\w\s-]+gated/i)
      errors.push(`Broken glyph in "auth...gated" pattern: "${match?.[0] || 'unknown'}"`)
    } else if (!isOk) {
      // Has "auth" and "gated" but not in the correct format
      const match = cleaned.match(/auth.{0,10}gated/i)
      if (match) {
        errors.push(`"auth-gated" text is malformed: "${match[0]}" (expected "auth-gated" or "auth gated")`)
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateActiveFiltersCount(text: string, pdfName: string): { valid: boolean; count: number | null; error?: string } {
  // Only validate for ledger export PDFs
  if (!pdfName.includes('ledger_export')) {
    return { valid: true, count: null }
  }
  
  const hashIndex = text.toLowerCase().indexOf('hash verified')
  if (hashIndex === -1) {
    return { valid: false, count: null, error: 'Could not find "Hash Verified" in extracted text' }
  }
  
  const afterHash = text.substring(hashIndex + 'hash verified'.length)
  const numbersAfterHash = afterHash.match(/\d+/g)
  
  if (!numbersAfterHash || numbersAfterHash.length < 3) {
    return { valid: false, count: null, error: `Could not find enough numbers after "Hash Verified" (found ${numbersAfterHash?.length || 0}, need at least 3)` }
  }
  
  // Active Filters is the 3rd number (index 2)
  const count = parseInt(numbersAfterHash[2], 10)
  
  return { valid: true, count }
}

function validateEvidenceIndexFilters(text: string, pdfName: string): { valid: boolean; error?: string } {
  // Only validate for evidence index PDFs
  if (!pdfName.includes('evidence_index')) {
    return { valid: true }
  }
  
  // Check that "Applied Filters" section exists and contains filter information
  if (!text.toLowerCase().includes('applied filters')) {
    return { valid: false, error: 'Could not find "Applied Filters" section in Evidence Index' }
  }
  
  // Check that it's not just showing time_range (should show all active filters)
  const appliedFiltersIndex = text.toLowerCase().indexOf('applied filters')
  const afterFilters = text.substring(appliedFiltersIndex + 'applied filters'.length, appliedFiltersIndex + 500)
  
  // Should contain multiple filter types, not just time_range
  const filterKeywords = ['time_range', 'job_id', 'site_id', 'category', 'actor_id', 'severity', 'outcome']
  const foundFilters = filterKeywords.filter(keyword => afterFilters.toLowerCase().includes(keyword))
  
  if (foundFilters.length === 0) {
    return { valid: false, error: 'Applied Filters section found but no filter keywords detected' }
  }
  
  return { valid: true }
}

async function validatePdfFile(pdfPath: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = []
  const warnings: string[] = []
  const pdfName = pdfPath.split('/').pop() || pdfPath
  
  console.log(`\n📄 Validating ${pdfName}...`)
  
  try {
    // Extract text
    const rawText = extractTextFromPdf(pdfPath)
    const sanitizedText = sanitizeExtractedText(rawText)
    
    // Validate text cleanliness
    const textValidation = validatePdfText(rawText, pdfName)
    if (!textValidation.valid) {
      errors.push(...textValidation.errors)
    }
    
    // Validate Active Filters count (for ledger exports)
    const filtersValidation = validateActiveFiltersCount(sanitizedText, pdfName)
    if (!filtersValidation.valid) {
      warnings.push(`Active Filters count validation: ${filtersValidation.error}`)
    } else if (filtersValidation.count !== null) {
      console.log(`   Active Filters count: ${filtersValidation.count}`)
    }
    
    // Validate Evidence Index filters (for evidence index PDFs)
    const indexValidation = validateEvidenceIndexFilters(sanitizedText, pdfName)
    if (!indexValidation.valid) {
      warnings.push(`Evidence Index filters validation: ${indexValidation.error}`)
    }
    
    // Check for suspicious line breaks (warnings, not errors)
    if (sanitizedText.match(/RiskM\s+ate/i) || sanitizedText.match(/Evid\s+ence/i)) {
      warnings.push('Suspicious line breaks detected (e.g., "RiskM / ate", "Evid / ence") - consider improving PDF rendering')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  } catch (error: any) {
    return {
      valid: false,
      errors: [`Failed to validate PDF: ${error.message}`],
      warnings: [],
    }
  }
}

async function main() {
  const pdfPaths = process.argv.slice(2)
  
  if (pdfPaths.length === 0) {
    console.error('Usage: tsx apps/backend/scripts/pdf-validate-file.ts <path-to-pdf> [<path-to-pdf> ...]')
    console.error('Example: tsx apps/backend/scripts/pdf-validate-file.ts ledger_export_PACK-*.pdf evidence_index_PACK-*.pdf')
    process.exit(1)
  }
  
  console.log('🔍 Validating PDF Files...\n')
  
  let allValid = true
  const allErrors: string[] = []
  const allWarnings: string[] = []
  
  for (const pdfPath of pdfPaths) {
    const result = await validatePdfFile(pdfPath)
    
    if (result.errors.length > 0) {
      allValid = false
      console.error(`   ❌ Errors:`)
      result.errors.forEach(error => {
        console.error(`      - ${error}`)
        allErrors.push(`${pdfPath}: ${error}`)
      })
    }
    
    if (result.warnings.length > 0) {
      console.warn(`   ⚠️  Warnings:`)
      result.warnings.forEach(warning => {
        console.warn(`      - ${warning}`)
        allWarnings.push(`${pdfPath}: ${warning}`)
      })
    }
    
    if (result.valid && result.warnings.length === 0) {
      console.log(`   ✅ Valid`)
    }
  }
  
  console.log('\n📋 Summary:')
  if (allValid) {
    console.log('   ✅ All PDFs passed validation')
    if (allWarnings.length > 0) {
      console.log(`   ⚠️  ${allWarnings.length} warning(s) (see above)`)
    }
    process.exit(0)
  } else {
    console.error(`   ❌ ${allErrors.length} error(s) found`)
    if (allWarnings.length > 0) {
      console.warn(`   ⚠️  ${allWarnings.length} warning(s)`)
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Validation failed:', error)
    process.exit(1)
  })
}

export { validatePdfFile, validatePdfText, extractTextFromPdf }
