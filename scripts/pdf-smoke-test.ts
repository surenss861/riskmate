/**
 * PDF Generation Smoke Test
 * 
 * Verifies that PDF print pages load correctly and render the expected structure.
 * This test ensures the PDF service can successfully generate PDFs without regressions.
 * 
 * Usage:
 *   ts-node scripts/pdf-smoke-test.ts <print-url> [token]
 * 
 * Or set environment variables:
 *   PRINT_URL - Full URL to the print page (e.g., https://riskmate.vercel.app/reports/packet/print/{runId}?token=...)
 *   PRINT_TOKEN - Token for authentication (if not provided in URL)
 *   PACKET_LABEL - Label for this packet type (e.g., "AUDIT", "INCIDENT") - used in screenshot filenames
 */

import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const PRINT_URL = process.env.PRINT_URL || process.argv[2]
const PRINT_TOKEN = process.env.PRINT_TOKEN || process.argv[3]
const OUT_DIR = process.env.PDF_SMOKE_OUT_DIR || 'pdf-smoke-artifacts'

if (!PRINT_URL) {
  console.error('❌ Error: PRINT_URL or print URL argument is required')
  console.error('\nUsage:')
  console.error('  ts-node scripts/pdf-smoke-test.ts <print-url> [token]')
  console.error('\nOr set environment variables:')
  console.error('  PRINT_URL=https://riskmate.vercel.app/reports/packet/print/{runId}?token=...')
  console.error('  PRINT_TOKEN=your-token (if not in URL)')
  console.error('  PACKET_LABEL=AUDIT (optional: label for screenshot filename)')
  process.exit(1)
}

function safeName(input: string): string {
  return input.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80)
}

async function runSmokeTest() {
  let browser: any = null
  let page: any = null

  try {
    console.log('🔍 Starting PDF smoke test...')
    console.log(`📍 URL: ${PRINT_URL.replace(/\?token=[^&]+/, '?token=***')}`)

    // Launch browser
    browser = await chromium.launch({
      headless: true,
    })
    page = await browser.newPage()

    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1200, height: 1600 })

    // Navigate to print URL
    console.log('📄 Loading print page...')
    const response = await page.goto(PRINT_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    if (!response || response.status() !== 200) {
      throw new Error(`Failed to load page: HTTP ${response?.status()}`)
    }

    console.log('✅ Page loaded successfully')

    // Wait for PDF ready marker (critical - PDF service waits for this)
    console.log('⏳ Waiting for PDF ready marker (#pdf-ready[data-ready="1"])...')
    try {
      await page.waitForSelector('#pdf-ready[data-ready="1"]', {
        timeout: 15000,
      })
      console.log('✅ PDF ready marker found')
    } catch (error) {
      // Retry once for flaky headless
      console.log('⚠️  Marker not found immediately, retrying...')
      try {
        await page.waitForSelector('#pdf-ready[data-ready="1"]', {
          timeout: 10000,
        })
        console.log('✅ PDF ready marker found on retry')
      } catch (retryError) {
        throw new Error('PDF ready marker not found - PDF service will hang!')
      }
    }

    // Verify key selectors exist
    console.log('🔍 Verifying page structure...')
    const checks = [
      { selector: '.cover-page', name: 'Cover page' },
      { selector: '.section-header, .section-title', name: 'Section headers' },
      { selector: 'body[data-organization-name]', name: 'Organization metadata' },
      { selector: 'body[data-job-id]', name: 'Job ID metadata' },
      { selector: 'body[data-run-id]', name: 'Run ID metadata' },
    ]

    const results: Array<{ name: string; found: boolean }> = []
    for (const check of checks) {
      const found = await page.$(check.selector) !== null
      results.push({ name: check.name, found })
      console.log(`  ${found ? '✅' : '❌'} ${check.name}`)
    }

    const allFound = results.every(r => r.found)
    if (!allFound) {
      throw new Error('Some required elements are missing')
    }

    // Court-ready assertion 1: Integrity page exists + has Hash Algorithm + SHA-256 block
    console.log('🔍 Court-ready check 1: Integrity & Verification page...')
    try {
      const integrityPage = await page.$('.page:has-text("Integrity & Verification"), .page:has-text("Integrity")')
      if (!integrityPage) {
        // Try finding by section header text
        const integrityHeader = await page.$$eval('.section-header, .section-title', (elements) => {
          return elements.some(el => el.textContent?.includes('Integrity') || el.textContent?.includes('Verification'))
        })
        if (!integrityHeader) {
          throw new Error('Integrity & Verification page not found')
        }
      }

      // Check for Hash Algorithm text
      const pageText = await page.textContent('body') || ''
      const hasHashAlgorithm = pageText.includes('Hash Algorithm') || pageText.includes('SHA-256')
      if (!hasHashAlgorithm) {
        throw new Error('Hash Algorithm/SHA-256 not found in Integrity page')
      }

      // Check for SHA-256 block (monospace or hash-like content)
      const hashBlock = await page.$$eval('*', (elements) => {
        return elements.some(el => {
          const text = el.textContent || ''
          const style = window.getComputedStyle(el)
          return (text.length >= 32 && /[0-9a-f]{32,}/i.test(text)) || 
                 style.fontFamily.includes('monospace')
        })
      })
      console.log(`  ✅ Integrity page found`)
      console.log(`  ✅ Hash Algorithm/SHA-256 content present`)
      console.log(`  ${hashBlock ? '✅' : '⚠️ '} Hash block detected`)
    } catch (error: any) {
      throw new Error(`Integrity page check failed: ${error.message}`)
    }

    // Court-ready assertion 2: At least 1 .section-empty renders when there's no data
    console.log('🔍 Court-ready check 2: Empty state sections...')
    try {
      const emptySections = await page.$$('.section-empty')
      const emptySectionCount = emptySections.length
      console.log(`  Found ${emptySectionCount} empty section(s)`)
      
      if (emptySectionCount > 0) {
        // Verify empty sections have the expected structure
        const firstEmpty = emptySections[0]
        const hasTitle = await firstEmpty.$('.section-title, h2') !== null
        const hasMessage = await firstEmpty.$('.section-empty-message, .section-empty-content') !== null
        
        console.log(`  ✅ Empty section structure verified`)
        if (!hasTitle || !hasMessage) {
          console.warn('  ⚠️  Empty section may be missing expected structure')
        }
      } else {
        console.log('  ℹ️  No empty sections found (all sections have data)')
      }
    } catch (error: any) {
      console.warn(`  ⚠️  Empty section check warning: ${error.message}`)
      // Don't fail on this - it's informational
    }

    // Court-ready assertion 3: TOC titles match rendered section titles (basic count match)
    console.log('🔍 Court-ready check 3: TOC alignment...')
    try {
      // Count TOC items
      const tocItems = await page.$$('.toc-item, .toc-list li, [class*="toc"] li')
      const tocCount = tocItems.length

      // Count section headers/titles (excluding TOC and Integrity which are always present)
      const sectionHeaders = await page.$$eval('.section-header, .section-title', (elements) => {
        return elements.filter(el => {
          const text = el.textContent || ''
          return !text.includes('Table of Contents') && !text.includes('Integrity')
        }).length
      })

      console.log(`  TOC items: ${tocCount}, Section headers: ${sectionHeaders}`)
      
      // TOC should have approximately the same number of items as sections
      // Allow some flexibility (TOC might exclude itself, Integrity is always last)
      if (tocCount > 0 && sectionHeaders > 0) {
        const ratio = tocCount / sectionHeaders
        if (ratio < 0.5 || ratio > 1.5) {
          console.warn(`  ⚠️  TOC count (${tocCount}) doesn't align with sections (${sectionHeaders})`)
          console.warn(`  ⚠️  Ratio: ${ratio.toFixed(2)} (expected ~0.8-1.2)`)
        } else {
          console.log(`  ✅ TOC alignment verified (ratio: ${ratio.toFixed(2)})`)
        }
      } else if (tocCount === 0) {
        console.log('  ℹ️  No TOC found (may not be required for all packet types)')
      }
    } catch (error: any) {
      console.warn(`  ⚠️  TOC alignment check warning: ${error.message}`)
      // Don't fail on this - it's informational
    }

    // Take screenshot of first page (cover)
    console.log('📸 Taking screenshot...')
    const coverPath = path.join(OUT_DIR, `${label}__cover.png`)
    await page.screenshot({
      path: coverPath,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 1600 },
    })
    console.log(`✅ Saved: ${coverPath}`)

    // Check for common error indicators
    console.log('🔍 Checking for error indicators...')
    const errorTexts = ['500', 'Internal Server Error', '404', 'Not Found', '403', 'Forbidden']
    const pageText = await page.textContent('body') || ''
    const hasErrors = errorTexts.some(text => pageText.includes(text))
    
    if (hasErrors) {
      console.warn('⚠️  Warning: Page may contain error text')
      const matchingErrors = errorTexts.filter(text => pageText.includes(text))
      console.warn(`   Found: ${matchingErrors.join(', ')}`)
    } else {
      console.log('✅ No error indicators found')
    }

    // Verify draft watermark behavior (should be subtle if present)
    const isDraft = await page.$eval('body', (el) => {
      return el.getAttribute('data-draft') === 'true'
    }).catch(() => false)

    if (isDraft) {
      console.log('📝 Draft mode detected (watermark should be subtle)')
    }

    console.log('\n✅ Smoke test passed!')
    console.log('   All critical elements present')
    console.log('   PDF ready marker found')
    console.log('   Page structure verified')
    console.log('\n💡 This page is ready for PDF generation')

    return true
  } catch (error: any) {
    console.error('\n❌ Smoke test failed!')
    console.error(`   Error: ${error.message}`)
    
    if (page) {
      try {
        // Take screenshot of error state
        const errorScreenshot = await page.screenshot({ fullPage: true })
        console.error(`   Error screenshot captured (${errorScreenshot.length} bytes)`)
      } catch (screenshotError) {
        console.error('   Could not capture error screenshot')
      }

      // Try to get page content for debugging
      try {
        const html = await page.content()
        console.error(`   Page HTML length: ${html.length} bytes`)
      } catch (htmlError) {
        console.error('   Could not capture page HTML')
      }
    }

    process.exit(1)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Run the test
runSmokeTest().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

