const express = require('express')
const cors = require('cors')
const { chromium } = require('playwright')
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 3000
const SECRET = process.env.PDF_SERVICE_SECRET

if (!SECRET) {
  console.error('ERROR: PDF_SERVICE_SECRET environment variable is required')
  process.exit(1)
}

app.use(cors())
app.use(express.json())

// HMAC authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.substring(7)
  const [timestamp, hmac] = token.split(':')

  if (!timestamp || !hmac) {
    return res.status(401).json({ error: 'Invalid token format' })
  }

  // Check timestamp (prevent replay attacks, allow 5 minute window)
  const tokenAge = Date.now() - parseInt(timestamp, 10)
  if (tokenAge > 5 * 60 * 1000 || tokenAge < 0) {
    return res.status(401).json({ error: 'Token expired or invalid timestamp' })
  }

  // Verify HMAC
  const requestId = req.body?.requestId || 'default'
  const message = `${requestId}:${timestamp}`
  const expectedHmac = crypto.createHmac('sha256', SECRET).update(message).digest('hex')

  if (hmac !== expectedHmac) {
    return res.status(401).json({ error: 'Invalid token signature' })
  }

  next()
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-service' })
})

// Generate PDF endpoint
app.post('/generate', authenticate, async (req, res) => {
  const { url, requestId } = req.body
  const logRequestId = requestId || `PDF-${Date.now()}`

  if (!url) {
    return res.status(400).json({ error: 'Missing required field: url' })
  }

  console.log(`[${logRequestId}][stage] START generating PDF for url=${url}`)

  let browser = null
  let currentStage = 'connect_browser'

  try {
    // STAGE: Launch browser
    currentStage = 'launch_browser'
    console.log(`[${logRequestId}][stage] launch_browser_start`)
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })
    console.log(`[${logRequestId}][stage] launch_browser_ok`)

    // STAGE: Create context
    currentStage = 'create_context'
    console.log(`[${logRequestId}][stage] create_context_start`)
    const context = await browser.newContext({
      viewport: { width: 794, height: 1123 }, // A4 @ 96dpi
    })
    console.log(`[${logRequestId}][stage] create_context_ok`)

    // STAGE: Create page
    currentStage = 'create_page'
    console.log(`[${logRequestId}][stage] create_page_start`)
    const page = await context.newPage()
    await page.emulateMedia({ media: 'print' })
    console.log(`[${logRequestId}][stage] create_page_ok`)

    // STAGE: Navigate and render
    currentStage = 'render_html'
    console.log(`[${logRequestId}][stage] render_html_start url=${url}`)
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })

    if (!response || !response.ok()) {
      throw new Error(`Page load failed: ${response?.status() || 'no response'}`)
    }

    const finalUrl = page.url()
    if (finalUrl.includes('/login') || finalUrl.includes('/auth')) {
      throw new Error(`Page redirected to login: ${finalUrl}`)
    }

    // Wait for ready marker (CRITICAL: ensures packet data is fully loaded before PDF generation)
    try {
      // Primary: wait for #pdf-ready with data-ready="1" attribute (most reliable)
      await Promise.race([
        page.waitForSelector('#pdf-ready[data-ready="1"]', { timeout: 30000 }),
        page.waitForSelector('[data-report-ready="true"]', { timeout: 30000 }),
        page.waitForSelector('#pdf-ready', { timeout: 30000 }),
        page.waitForSelector('.cover-page', { timeout: 30000 }),
      ])
      console.log(`[${logRequestId}][stage] render_html_ok: Page ready marker found`)
    } catch (selectorError) {
      // Check if any fallback markers exist
      const hasPdfReady = await page.evaluate(() => {
        const el = document.getElementById('pdf-ready')
        return el && el.getAttribute('data-ready') === '1'
      }).catch(() => false)
      const hasReportReady = await page.evaluate(() => !!document.querySelector('[data-report-ready="true"]')).catch(() => false)
      const hasCoverPage = await page.evaluate(() => !!document.querySelector('.cover-page')).catch(() => false)
      
      if (!hasPdfReady && !hasReportReady && !hasCoverPage) {
        const pageTitle = await page.title().catch(() => 'Could not get title')
        const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 500) || 'No body').catch(() => 'Could not get body')
        console.error(`[${logRequestId}][stage] render_html_failed no_ready_marker`)
        console.error(`[${logRequestId}] Page title: ${pageTitle}`)
        console.error(`[${logRequestId}] Body text snippet: ${bodyText}`)
        throw new Error(`[stage=render_html] No ready marker found (#pdf-ready[data-ready="1"], [data-report-ready], or .cover-page). Page may not have loaded correctly. Title: ${pageTitle}`)
      } else {
        console.warn(`[${logRequestId}] Ready marker check failed but fallback markers found - proceeding`)
      }
    }

    // Wait for fonts
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready
    }).catch(() => {})

    await page.waitForTimeout(500)

    // Extract metadata from page for header/footer
    const metadata = await page.evaluate(() => {
      const body = document.body
      return {
        organizationName: body.getAttribute('data-organization-name') || 'RiskMate',
        packetTitle: body.getAttribute('data-packet-title') || 'Report',
        jobId: body.getAttribute('data-job-id') || '',
        runId: body.getAttribute('data-run-id') || '',
        generated: body.getAttribute('data-generated') || '',
        hash: body.getAttribute('data-hash') || '',
        isDraft: body.getAttribute('data-draft') === 'true',
      }
    })

    // STAGE: Generate PDF
    currentStage = 'generate_pdf'
    console.log(`[${logRequestId}][stage] generate_pdf_start`)
    
    // Build header/footer HTML templates
    const headerTemplate = `
      <div style="font-size: 9pt; color: #ffffff; background: #000000; padding: 8px 16mm; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
        <span>${metadata.organizationName} • ${metadata.packetTitle}</span>
        <span>Job ID: ${metadata.jobId} • Run ID: ${metadata.runId}</span>
      </div>
    `
    
    const footerTemplate = `
      <div style="font-size: 8pt; color: #666666; padding: 8px 16mm; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; border-top: 1px solid #e0e0e0;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span> • Generated: ${metadata.generated} • Hash: ${metadata.hash}...</span>
        <span style="color: #999999;">CONFIDENTIAL</span>
      </div>
    `
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate,
      footerTemplate: footerTemplate,
      margin: {
        top: '72pt',
        right: '16mm',
        bottom: '60pt',
        left: '16mm',
      },
    })
    console.log(`[${logRequestId}][stage] generate_pdf_ok size=${pdfBuffer.length} bytes`)

    // Cleanup
    await context.close()
    await browser.close()

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', pdfBuffer.length)
    res.send(pdfBuffer)

  } catch (error) {
    const errorMessage = error?.message || 'Unknown error'
    console.error(`[${logRequestId}][stage] ${currentStage}_failed`, errorMessage)
    console.error(`[${logRequestId}] error_stack=`, error?.stack)

    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.warn(`[${logRequestId}] Browser close warning:`, closeError)
      }
    }

    res.status(500).json({
      error: 'PDF generation failed',
      message: errorMessage,
      stage: currentStage,
      requestId: logRequestId,
    })
  }
})

app.listen(PORT, () => {
  console.log(`PDF Service listening on port ${PORT}`)
})

