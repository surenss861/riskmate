// Dynamic import to handle cases where Playwright isn't installed
let playwright: any = null

async function getPlaywright() {
    if (playwright) return playwright
    
    try {
        playwright = await import('playwright')
        return playwright
    } catch (error: any) {
        throw new Error(
            `Playwright is not installed. Please run: npx playwright install chromium\n` +
            `Original error: ${error?.message ?? String(error)}`
        )
    }
}

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
}

export async function generatePdfFromUrl({ url, jobId, organizationId }: PdfOptions): Promise<Buffer> {
    const start = Date.now()
    console.log(`[PDF] START generating for Job:${jobId.substring(0, 8)} Org:${organizationId}`)

    // Ensure Playwright is available
    const playwrightModule = await getPlaywright()
    const { chromium } = playwrightModule

    let attempt = 1
    const maxAttempts = 2

    while (attempt <= maxAttempts) {
        let browser = null
        try {
            if (attempt > 1) console.log(`[PDF] Retry attempt ${attempt}/${maxAttempts}...`)

            const launchStart = Date.now()
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--font-render-hinting=none',
                    // Disable GPU to save resources in serverless
                    '--disable-gpu',
                    // Disable shared memory to prevent crashes
                    '--disable-dev-shm-usage',
                ]
            })
            console.log(`[PDF] Browser launched in ${Date.now() - launchStart}ms`)

            const context = await browser.newContext()
            const page = await context.newPage()

            // Set explicit viewport matching A4 ratio to avoid layout shifts
            await page.setViewportSize({ width: 794, height: 1123 }) // approx A4 @ 96dpi

            const gotoStart = Date.now()
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
            console.log(`[PDF] Page navigation took ${Date.now() - gotoStart}ms`)

            // Wait for stable state
            await Promise.all([
                page.waitForSelector('.cover-page', { timeout: 10000 }),
                page.evaluate(() => document.fonts.ready),
            ])
            console.log(`[PDF] Page stable (selectors + fonts) after ${Date.now() - gotoStart}ms`)

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
