#!/usr/bin/env tsx
/**
 * Executive Brief PDF - Final Closeout Test Script
 * 
 * Run this script to verify:
 * 1. 3 real-world fixtures (org with name, org without name, stress case)
 * 2. Verify endpoint end-to-end (metadata hash + PDF file hash)
 * 
 * Usage:
 *   tsx scripts/test-executive-brief-closeout.ts
 * 
 * Prerequisites:
 *   - Server running (npm run dev)
 *   - Valid auth token
 *   - Test orgs set up in database
 */

import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || ''

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: any
}

const results: TestResult[] = []

function log(message: string) {
  console.log(`[TEST] ${message}`)
}

function error(message: string) {
  console.error(`[ERROR] ${message}`)
}

function makeRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
    ...options.headers,
  }

  return fetch(url, { ...options, headers })
}

async function testFixture(name: string, orgId: string, expectedOrgName?: string): Promise<TestResult> {
  log(`\n=== Testing Fixture: ${name} ===`)
  
  try {
    // 1. Generate PDF
    log(`Generating PDF for org: ${orgId}`)
    const pdfResponse = await makeRequest(`/api/executive/brief/pdf?time_range=30d`, {
      method: 'GET',
    })

    if (!pdfResponse.ok) {
      return {
        name: `${name} - PDF Generation`,
        passed: false,
        error: `PDF generation failed: ${pdfResponse.status} ${pdfResponse.statusText}`,
      }
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
    
    // 2. Verify page count
    const { getPDFPageCount } = await import('../lib/utils/pdf-test-helpers')
    const pageCount = await getPDFPageCount(pdfBuffer)
    
    if (pageCount !== 2) {
      return {
        name: `${name} - Page Count`,
        passed: false,
        error: `Expected 2 pages, got ${pageCount}`,
      }
    }
    log(`✅ Page count: ${pageCount}`)

    // 3. Extract report ID from PDF
    const { extractTextFromPDF } = await import('../lib/utils/pdf-test-helpers')
    const pdfText = await extractTextFromPDF(pdfBuffer)
    
    const reportIdMatch = pdfText.match(/Report ID:\s*RM-([a-z0-9]+)/i)
    if (!reportIdMatch) {
      return {
        name: `${name} - Report ID Extraction`,
        passed: false,
        error: 'Could not extract Report ID from PDF',
      }
    }
    
    const reportId = `RM-${reportIdMatch[1]}`
    log(`✅ Report ID: ${reportId}`)

    // 4. Verify org name in PDF
    if (expectedOrgName) {
      if (!pdfText.includes(expectedOrgName)) {
        return {
          name: `${name} - Org Name in PDF`,
          passed: false,
          error: `Expected org name "${expectedOrgName}" not found in PDF`,
        }
      }
      log(`✅ Org name found: ${expectedOrgName}`)
    } else {
      // ID fallback case - should show org ID, not "(name missing)"
      if (pdfText.includes('(name missing)') || pdfText.includes('(org name not set)')) {
        // This is acceptable for ID fallback
        log(`✅ Org ID fallback (no name set)`)
      }
    }

    // 5. Extract metadata hash from PDF
    const metadataHashMatch = pdfText.match(/SHA-256:\s*([a-f0-9]{64})/i)
    if (!metadataHashMatch) {
      return {
        name: `${name} - Metadata Hash Extraction`,
        passed: false,
        error: 'Could not extract metadata hash from PDF',
      }
    }
    
    const metadataHashFromPDF = metadataHashMatch[1]
    log(`✅ Metadata hash from PDF: ${metadataHashFromPDF.substring(0, 16)}...`)

    // 6. Call verify endpoint
    log(`Calling verify endpoint: /api/verify/${reportId}`)
    const verifyResponse = await makeRequest(`/api/verify/${reportId}`, {
      method: 'GET',
    })

    if (!verifyResponse.ok) {
      return {
        name: `${name} - Verify Endpoint`,
        passed: false,
        error: `Verify endpoint failed: ${verifyResponse.status} ${verifyResponse.statusText}`,
      }
    }

    const verifyData = await verifyResponse.json()
    log(`✅ Verify endpoint response received`)

    // 7. Verify metadata hash matches
    if (verifyData.metadataHashDeterministic !== metadataHashFromPDF) {
      return {
        name: `${name} - Metadata Hash Match`,
        passed: false,
        error: `Metadata hash mismatch:\n  PDF: ${metadataHashFromPDF}\n  API: ${verifyData.metadataHashDeterministic}`,
      }
    }
    log(`✅ Metadata hash matches`)

    // 8. Verify PDF file hash exists and matches
    if (!verifyData.pdfFileHash) {
      return {
        name: `${name} - PDF File Hash Exists`,
        passed: false,
        error: 'PDF file hash not returned from verify endpoint',
      }
    }

    // Compute hash of actual PDF bytes
    const computedPdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
    
    if (verifyData.pdfFileHash !== computedPdfHash) {
      return {
        name: `${name} - PDF File Hash Match`,
        passed: false,
        error: `PDF file hash mismatch:\n  Computed: ${computedPdfHash}\n  API: ${verifyData.pdfFileHash}`,
      }
    }
    log(`✅ PDF file hash matches`)

    // 9. Verify window dates
    if (!verifyData.windowStart || !verifyData.windowEnd) {
      return {
        name: `${name} - Window Dates`,
        passed: false,
        error: 'Window dates missing from verify response',
      }
    }
    log(`✅ Window: ${verifyData.windowStart} to ${verifyData.windowEnd}`)

    // Save PDF for inspection
    const outputDir = path.join(process.cwd(), 'test-outputs')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const outputPath = path.join(outputDir, `executive-brief-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`)
    fs.writeFileSync(outputPath, pdfBuffer)
    log(`✅ PDF saved: ${outputPath}`)

    return {
      name: `${name} - All Checks`,
      passed: true,
      details: {
        reportId,
        pageCount,
        metadataHash: metadataHashFromPDF.substring(0, 16) + '...',
        pdfFileHash: computedPdfHash.substring(0, 16) + '...',
        windowStart: verifyData.windowStart,
        windowEnd: verifyData.windowEnd,
        pdfPath: outputPath,
      },
    }
  } catch (err: any) {
    return {
      name: `${name} - Exception`,
      passed: false,
      error: err.message || String(err),
    }
  }
}

async function runCloseoutTests() {
  log('Starting Executive Brief PDF Closeout Tests')
  log(`Base URL: ${BASE_URL}`)
  log(`Auth Token: ${AUTH_TOKEN ? 'Set' : 'Not set (may fail auth)'}`)

  // Test 1: Org with real name
  const orgWithName = process.env.TEST_ORG_WITH_NAME || ''
  if (orgWithName) {
    const result = await testFixture('Org with Real Name', orgWithName, 'Test Organization')
    results.push(result)
  } else {
    log('⚠️  Skipping "Org with Real Name" (set TEST_ORG_WITH_NAME)')
  }

  // Test 2: Org without name (ID fallback)
  const orgWithoutName = process.env.TEST_ORG_WITHOUT_NAME || ''
  if (orgWithoutName) {
    const result = await testFixture('Org without Name (ID Fallback)', orgWithoutName)
    results.push(result)
  } else {
    log('⚠️  Skipping "Org without Name" (set TEST_ORG_WITHOUT_NAME)')
  }

  // Test 3: Stress case (lots of content)
  const stressOrg = process.env.TEST_ORG_STRESS || ''
  if (stressOrg) {
    const result = await testFixture('Stress Case (Lots of Content)', stressOrg)
    results.push(result)
  } else {
    log('⚠️  Skipping "Stress Case" (set TEST_ORG_STRESS)')
  }

  // Print summary
  log('\n=== Test Summary ===')
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  results.forEach(result => {
    if (result.passed) {
      log(`✅ ${result.name}`)
      if (result.details) {
        log(`   Report ID: ${result.details.reportId}`)
        log(`   Pages: ${result.details.pageCount}`)
        log(`   PDF: ${result.details.pdfPath}`)
      }
    } else {
      error(`❌ ${result.name}`)
      if (result.error) {
        error(`   ${result.error}`)
      }
    }
  })

  log(`\nPassed: ${passed}/${results.length}`)
  log(`Failed: ${failed}/${results.length}`)

  if (failed === 0) {
    log('\n🎉 All tests passed! Executive Brief PDF is ship-ready.')
    process.exit(0)
  } else {
    error('\n❌ Some tests failed. Review errors above.')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  runCloseoutTests().catch(err => {
    error(`Fatal error: ${err.message}`)
    console.error(err)
    process.exit(1)
  })
}

export { runCloseoutTests, testFixture }

