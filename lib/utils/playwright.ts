import playwright from 'playwright-core'
import chromium from '@sparticuz/chromium'

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
}

export async function generatePdfFromUrl({ url, jobId, organizationId }: PdfOptions): Promise<Buffer> {
    const start = Date.now()
    console.log(`[PDF] START generating for Job:${jobId.substring(0, 8)} Org:${organizationId}`)

    let attempt = 1
    const maxAttempts = 2

    while (attempt <= maxAttempts) {
        let browser = null
        try {
            if (attempt > 1) console.log(`[PDF] Retry attempt ${attempt}/${maxAttempts}...`)

            const launchStart = Date.now()
            
            // Use @sparticuz/chromium for serverless-compatible browser
            browser = await playwright.chromium.launch({
                args: chromium.args,
                executablePath: await chromium.executablePath(),
                headless: true, // Always headless in serverless
            })
            console.log(`[PDF] Browser launched in ${Date.now() - launchStart}ms`)

            const context = await browser.newContext()
            const page = await context.newPage()

            // Set explicit viewport matching A4 ratio to avoid layout shifts
            await page.setViewportSize({ width: 794, height: 1123 }) // approx A4 @ 96dpi

            const gotoStart = Date.now()
            
            // Navigate to page with longer timeout for serverless
            const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
            console.log(`[PDF] Page navigation took ${Date.now() - gotoStart}ms, status: ${response?.status()}`)

            // Check if page loaded successfully
            if (response && response.status() >= 400) {
                throw new Error(`Page returned status ${response.status()}: ${url}`)
            }

            // Wait for stable state and verify we're on the actual report page (not an error page)
            try {
                // First, wait for the cover page selector - this confirms we're on the report page
                await page.waitForSelector('.cover-page', { timeout: 15000 })
                
                // Double-check we're not on an error page by checking for error indicators
                const hasError = await page.evaluate(() => {
                    const bodyText = document.body.textContent || ''
                    return bodyText.includes('Internal Server Error') || 
                           bodyText.includes('500') || 
                           bodyText.includes('Cannot coerce')
                })
                
                if (hasError) {
                    const pageContent = await page.content().catch(() => 'Could not get page content')
                    throw new Error('Page contains error content instead of report')
                }
                
                // Wait for fonts to be ready
                await page.evaluate(() => document.fonts.ready).catch(() => {
                    console.warn('[PDF] Font loading check failed, proceeding anyway')
                })
                
                console.log(`[PDF] Page stable (cover-page found) after ${Date.now() - gotoStart}ms`)
            } catch (waitError: any) {
                // Log page content for debugging
                const pageContent = await page.content().catch(() => 'Could not get page content')
                const pageTitle = await page.title().catch(() => 'Could not get title')
                console.error('[PDF] Page wait failed:', waitError.message)
                console.error('[PDF] Page title:', pageTitle)
                console.error('[PDF] Page HTML snippet:', pageContent.substring(0, 1000))
                throw new Error(`Page did not load correctly or contains error: ${waitError.message}`)
            }

            const pdfStart = Date.now()
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
            })
            console.log(`[PDF] PDF generated in ${Date.now() - pdfStart}ms. Size: ${(pdfBuffer.length / 1024).toFixed(2)}KB`)

            await browser.close()
            console.log(`[PDF] Total duration: ${Date.now() - start}ms`)

            return pdfBuffer

        } catch (error: any) {
            console.error(`[PDF] Attempt ${attempt} failed:`, error.message)
            if (browser) await browser.close().catch(() => { })

            if (attempt === maxAttempts) {
                throw new Error(`Failed to generate PDF after ${maxAttempts} attempts: ${error.message}`)
            }
            attempt++
        }
    }

    throw new Error('Unexpected PDF generation failure')
}
