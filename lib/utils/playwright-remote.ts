import { chromium } from 'playwright-core'

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
    requestId?: string // Optional request ID for log correlation
}

/**
 * Check if error is a 429 rate limit error from Browserless
 */
function is429(err: unknown): boolean {
    const msg = String((err as any)?.message ?? err ?? '')
    return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit')
}

/**
 * Connect to Browserless with exponential backoff retry on 429 errors
 */
async function connectWithBackoff(wsUrl: string, requestId: string, maxRetries = 5) {
    let delay = 500
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await chromium.connectOverCDP(wsUrl, {
                timeout: 30000, // 30 second timeout for connection
            })
        } catch (err: any) {
            const isRateLimited = is429(err)
            const isLastAttempt = i === maxRetries - 1
            
            if (!isRateLimited || isLastAttempt) {
                // Not a 429, or we've exhausted retries - throw immediately
                throw err
            }
            
            // 429 error - wait and retry with exponential backoff
            const backoffMs = delay + Math.floor(Math.random() * 250) // Add jitter
            console.warn(`[${requestId}][stage] connect_browserless_429_retry attempt=${i + 1}/${maxRetries} backoff=${backoffMs}ms`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            delay *= 2 // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
        }
    }
    throw new Error('Unreachable: connectWithBackoff exhausted retries')
}

/**
 * Generate PDF using remote Browserless instance via CDP.
 * This eliminates all serverless Chromium issues:
 * - No /tmp/chromium extraction/copy/chmod
 * - No ETXTBSY race conditions
 * - No sandbox/permission issues
 * - No cleanup races
 * - Stable, production-ready browser infrastructure
 */
export async function generatePdfRemote({ url, jobId, organizationId, requestId }: PdfOptions): Promise<Buffer> {
    const start = Date.now()
    const logRequestId = requestId || `PDF-${jobId.substring(0, 8)}-${organizationId.substring(0, 8)}`
    console.log(`[${logRequestId}][stage] START generating via Browserless for Job:${jobId.substring(0, 8)} Org:${organizationId}`)

    const token = process.env.BROWSERLESS_TOKEN
    if (!token) {
        throw new Error(`[${logRequestId}][stage] generate_pdf_failed missing BROWSERLESS_TOKEN - add it to Vercel environment variables`)
    }

    // Use region-specific Browserless endpoint (avoids 429s on shared chrome.browserless.io)
    // Default to production-sfo if not specified, but allow override via env var
    const baseUrl = process.env.BROWSERLESS_URL || 'wss://production-sfo.browserless.io'
    const cdpUrl = `${baseUrl}?token=${token}&timeout=300000` // 5 minute timeout
    console.log(`[${logRequestId}][stage] connect_browserless_start url=${baseUrl}`)

    let browser = null
    try {
        // STAGE: Connect to Browserless with retry on 429
        browser = await connectWithBackoff(cdpUrl, logRequestId)
        console.log(`[${logRequestId}][stage] connect_browserless_ok`)

        // STAGE: Create browser context
        console.log(`[${logRequestId}][stage] create_context_start`)
        const context = await browser.newContext({
            viewport: { width: 794, height: 1123 }, // approx A4 @ 96dpi
        })
        console.log(`[${logRequestId}][stage] create_context_ok`)

        // STAGE: Create page
        console.log(`[${logRequestId}][stage] create_page_start`)
        const page = await context.newPage()
        await page.emulateMedia({ media: 'print' })
        console.log(`[${logRequestId}][stage] create_page_ok`)

        // STAGE: Navigate and render HTML
        console.log(`[${logRequestId}][stage] render_html_start url=${url}`)
        const gotoStart = Date.now()
        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded', // Changed from networkidle to fail faster
            timeout: 45000 // 45 second timeout for page load
        })
        const finalUrl = page.url()
        
        if (!response) {
            throw new Error(`[stage=render_html] page.goto() returned null for URL: ${url}`)
        }
        
        if (!response.ok()) {
            const status = response.status()
            const statusText = response.statusText()
            console.error(`[${logRequestId}][stage] render_html_failed status=${status} statusText=${statusText} url=${finalUrl}`)
            throw new Error(`[stage=render_html] Page load failed: ${status} ${statusText} - ${url}`)
        }
        
        // CRITICAL: Check if we got redirected to login (remote browser has no cookies/session)
        if (finalUrl.includes('/login') || finalUrl.includes('/auth') || finalUrl.includes('/signin')) {
            console.error(`[${logRequestId}][stage] render_html_failed redirected_to_login url=${finalUrl}`)
            throw new Error(`[stage=render_html] Page redirected to login/auth page - render URL must accept signed token (query param) and render without cookies. Final URL: ${finalUrl}`)
        }
        
        console.log(`[${logRequestId}][stage] render_html_ok duration=${Date.now() - gotoStart}ms status=${response.status()} url=${finalUrl}`)

        // Wait for page ready marker (data-report-ready or fallback selectors)
        try {
            await Promise.race([
                page.waitForSelector('[data-report-ready="true"]', { state: 'attached', timeout: 30000 }),
                page.waitForSelector('#pdf-ready', { state: 'attached', timeout: 30000 }),
                page.waitForSelector('.cover-page', { timeout: 30000 }),
            ])
            console.log(`[${logRequestId}][stage] render_html_ok: Page ready marker found`)
        } catch (selectorError: any) {
            // If all fail, check what's actually on the page
            const hasReportReady = await page.evaluate(() => !!document.querySelector('[data-report-ready="true"]')).catch(() => false)
            const hasPdfReady = await page.evaluate(() => !!document.getElementById('pdf-ready')).catch(() => false)
            const hasCoverPage = await page.evaluate(() => !!document.querySelector('.cover-page')).catch(() => false)
            
            if (!hasReportReady && !hasPdfReady && !hasCoverPage) {
                // Log page content snippet for debugging
                const pageTitle = await page.title().catch(() => 'Could not get title')
                const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 500) || 'No body').catch(() => 'Could not get body')
                console.error(`[${logRequestId}][stage] render_html_failed no_ready_marker`)
                console.error(`[${logRequestId}] Page title: ${pageTitle}`)
                console.error(`[${logRequestId}] Body text snippet: ${bodyText}`)
                throw new Error(`[stage=render_html] No ready marker found ([data-report-ready], #pdf-ready, or .cover-page). Page may not have loaded correctly. Title: ${pageTitle}`)
            }
        }

        // Wait for fonts to be ready (critical for layout stability)
        await page.evaluate(async () => {
            if (document.fonts) {
                await document.fonts.ready
            }
        }).catch(() => {
            console.warn(`[${logRequestId}] Font loading check failed, proceeding anyway`)
        })

        // Small delay to ensure layout is stable after fonts load
        await page.waitForTimeout(500)

        // STAGE: Generate PDF
        console.log(`[${logRequestId}][stage] pdf_start`)
        const pdfStart = Date.now()
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
        })
        console.log(`[${logRequestId}][stage] pdf_generated bytes=${pdfBuffer.length} duration=${Date.now() - pdfStart}ms size=${(pdfBuffer.length / 1024).toFixed(2)}KB`)

        // STAGE: Cleanup
        console.log(`[${logRequestId}][stage] cleanup_start`)
        await context.close()
        await browser.close()
        console.log(`[${logRequestId}][stage] cleanup_ok`)
        console.log(`[${logRequestId}] Total duration: ${Date.now() - start}ms`)

        return pdfBuffer

    } catch (error: any) {
        const errorCode = error?.code || 'NO_CODE'
        const errorName = error?.name || 'Unknown'
        const errorMessage = error?.message || 'No message'
        const stage = errorMessage.match(/\[stage=(\w+)\]/)?.[1] || 'unknown'
        
        console.error(`[${logRequestId}][stage] ${stage}_failed error_code=${errorCode} error_name=${errorName}`)
        console.error(`[${logRequestId}] error_message=`, errorMessage)
        console.error(`[${logRequestId}] error_stack=`, error?.stack || 'No stack')
        
        // CRITICAL: Close browser connection on error
        if (browser) {
            try {
                await browser.close()
                console.log(`[${logRequestId}][stage] cleanup_ok (on error)`)
            } catch (closeError) {
                console.warn(`[${logRequestId}] Browser close warning:`, closeError)
            }
        }

        // Re-throw with stage context
        throw new Error(`[stage=${stage}] Browserless PDF generation failed: ${errorMessage} (code: ${errorCode})`)
    }
}

