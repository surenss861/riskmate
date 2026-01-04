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
 */

import { chromium } from 'playwright-core'

const PRINT_URL = process.env.PRINT_URL || process.argv[2]
const PRINT_TOKEN = process.env.PRINT_TOKEN || process.argv[3]

if (!PRINT_URL) {
  console.error('❌ Error: PRINT_URL or print URL argument is required')
  console.error('\nUsage:')
  console.error('  ts-node scripts/pdf-smoke-test.ts <print-url> [token]')
  console.error('\nOr set environment variables:')
  console.error('  PRINT_URL=https://riskmate.vercel.app/reports/packet/print/{runId}?token=...')
  console.error('  PRINT_TOKEN=your-token (if not in URL)')
  process.exit(1)
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
        timeout: 10000,
      })
      console.log('✅ PDF ready marker found')
    } catch (error) {
      throw new Error('PDF ready marker not found - PDF service will hang!')
    }

    // Verify key selectors exist
    console.log('🔍 Verifying page structure...')
    const checks = [
      { selector: '.cover-page', name: 'Cover page' },
      { selector: '.section-header', name: 'Section headers' },
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

    // Take screenshot of first page (cover)
    console.log('📸 Taking screenshot...')
    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 1600 },
    })
    console.log(`✅ Screenshot captured (${screenshotBuffer.length} bytes)`)

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

