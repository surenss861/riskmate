import { chromium } from 'playwright-core'

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
    requestId?: string // Optional request ID for log correlation
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

    // Browserless CDP endpoint (WebSocket)
    const cdpUrl = `wss://chrome.browserless.io?token=${token}`
    console.log(`[${logRequestId}][stage] connect_browserless_start`)

    let browser = null
    try {
        // STAGE: Connect to Browserless
        browser = await chromium.connectOverCDP(cdpUrl, {
            timeout: 30000, // 30 second timeout for connection
        })
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
            waitUntil: 'networkidle', 
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
        
        console.log(`[${logRequestId}][stage] render_html_ok duration=${Date.now() - gotoStart}ms status=${response.status()} url=${finalUrl}`)

        // Wait for page ready marker (if present) or cover page
        try {
            await Promise.race([
                page.waitForSelector('#pdf-ready', { state: 'attached', timeout: 20000 }),
                page.waitForSelector('.cover-page', { timeout: 20000 }),
            ])
            console.log(`[${logRequestId}][stage] render_html_ok: Page ready marker or cover-page found`)
        } catch (selectorError: any) {
            // If both fail, check what's actually on the page
            const hasPdfReady = await page.evaluate(() => !!document.getElementById('pdf-ready')).catch(() => false)
            const hasCoverPage = await page.evaluate(() => !!document.querySelector('.cover-page')).catch(() => false)
            
            if (!hasPdfReady && !hasCoverPage) {
                console.warn(`[${logRequestId}][stage] render_html_warning: Neither #pdf-ready nor .cover-page found, proceeding anyway`)
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
        console.log(`[${logRequestId}][stage] pdf_ok duration=${Date.now() - pdfStart}ms size=${(pdfBuffer.length / 1024).toFixed(2)}KB`)

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

