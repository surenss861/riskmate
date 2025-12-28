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
            
            // Emulate print media for proper CSS print rules
            await page.emulateMedia({ media: 'print' })

            const gotoStart = Date.now()
            
            // Navigate to page with longer timeout for serverless
            const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
            const finalUrl = page.url()
            console.log(`[PDF] Page navigation took ${Date.now() - gotoStart}ms, status: ${response?.status()}, final URL: ${finalUrl}`)

            // Check if page loaded successfully
            if (response && response.status() >= 400) {
                const pageTitle = await page.title().catch(() => 'Could not get title')
                const pageContent = await page.content().catch(() => 'Could not get page content')
                console.error('[PDF] Page returned error status:', response.status())
                console.error('[PDF] Page title:', pageTitle)
                console.error('[PDF] Page URL:', finalUrl)
                console.error('[PDF] Page HTML snippet:', pageContent.substring(0, 2000))
                throw new Error(`Page returned status ${response.status()}: ${url}`)
            }

            // Wait for stable state and verify we're on the actual report page (not an error page)
            try {
                // Wait for the PDF ready marker - this confirms data is loaded and page is rendered
                await page.waitForSelector('#pdf-ready', { timeout: 20000 })
                console.log(`[PDF] PDF ready marker found after ${Date.now() - gotoStart}ms`)
                
                // Double-check we're not on an error page by checking for error indicators
                const hasError = await page.evaluate(() => {
                    const bodyText = document.body.textContent || ''
                    return bodyText.includes('Internal Server Error') || 
                           bodyText.includes('500 - Internal Server Error') || 
                           bodyText.includes('Cannot coerce') ||
                           bodyText.includes('403 -') ||
                           bodyText.includes('401 -') ||
                           bodyText.includes('404 -')
                })
                
                if (hasError) {
                    const pageContent = await page.content().catch(() => 'Could not get page content')
                    const pageTitle = await page.title().catch(() => 'Could not get title')
                    console.error('[PDF] Page contains error content')
                    console.error('[PDF] Page title:', pageTitle)
                    console.error('[PDF] Page URL:', finalUrl)
                    console.error('[PDF] Page HTML snippet:', pageContent.substring(0, 2000))
                    throw new Error('Page contains error content instead of report')
                }
                
                // Wait for fonts to be ready (critical for layout stability)
                await page.evaluate(() => {
                    return document.fonts ? document.fonts.ready : Promise.resolve()
                }).catch(() => {
                    console.warn('[PDF] Font loading check failed, proceeding anyway')
                })
                
                // Small delay to ensure layout is stable after fonts load
                await page.waitForTimeout(500)
                
                console.log(`[PDF] Page stable (fonts loaded, ready marker found) after ${Date.now() - gotoStart}ms`)
            } catch (waitError: any) {
                // Comprehensive debugging on failure
                const pageTitle = await page.title().catch(() => 'Could not get title')
                const pageContent = await page.content().catch(() => 'Could not get page content')
                const screenshot = await page.screenshot({ fullPage: false }).catch(() => null)
                
                console.error('[PDF] Page wait failed:', waitError.message)
                console.error('[PDF] Page title:', pageTitle)
                console.error('[PDF] Page URL:', finalUrl)
                console.error('[PDF] Page HTML snippet (first 2000 chars):', pageContent.substring(0, 2000))
                if (screenshot) {
                    console.error('[PDF] Screenshot captured (base64 length):', screenshot.length)
                }
                
                throw new Error(`Page did not load correctly: ${waitError.message}`)
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
