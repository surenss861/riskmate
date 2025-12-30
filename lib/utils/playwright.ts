import playwright from 'playwright-core'
import chromium from '@sparticuz/chromium'

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
    requestId?: string // Optional request ID for log correlation
}

export async function generatePdfFromUrl({ url, jobId, organizationId, requestId }: PdfOptions): Promise<Buffer> {
    const start = Date.now()
    const logRequestId = requestId || `PDF-${jobId.substring(0, 8)}-${organizationId.substring(0, 8)}`
    console.log(`[${logRequestId}] START generating for Job:${jobId.substring(0, 8)} Org:${organizationId}`)

    let attempt = 1
    const maxAttempts = 2

    while (attempt <= maxAttempts) {
        let browser = null
        try {
            if (attempt > 1) console.log(`[PDF] Retry attempt ${attempt}/${maxAttempts}...`)

            const launchStart = Date.now()
            
            // Use @sparticuz/chromium for serverless-compatible browser
            // Follow the known-good pattern: don't override args, use chromium's defaults
            const executablePath = await chromium.executablePath()
            
            // Diagnostic logging before launch (critical for debugging serverless failures)
            console.log(`[${logRequestId}] chromiumPath=${executablePath || 'MISSING'}`)
            console.log(`[${logRequestId}] argsCount=${chromium.args?.length || 0}`)
            console.log(`[${logRequestId}] node=${process.version} vercel=${process.env.VERCEL || 'local'}`)
            
            if (!executablePath) {
                throw new Error('Chromium executable path is missing - @sparticuz/chromium not properly initialized')
            }
            
            // Minimal launch config - use chromium's defaults for args
            // Note: @sparticuz/chromium doesn't expose headless property, always use true for serverless
            browser = await playwright.chromium.launch({
                args: chromium.args,
                executablePath: executablePath,
                headless: true, // Always headless in serverless environment
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
                // First, quickly check if we're on an error page (don't wait for marker if we're erroring)
                const quickErrorCheck = await page.evaluate(() => {
                    if (!document.body) return { hasError: false, errorText: null, errorDetails: null }
                    const bodyText = document.body.textContent || ''
                    const h1Text = document.querySelector('h1')?.textContent || ''
                    const preText = document.querySelector('pre')?.textContent || ''
                    
                    const hasError = bodyText.includes('Internal Server Error') || 
                                    bodyText.includes('500 -') || 
                                    bodyText.includes('Cannot coerce') ||
                                    bodyText.includes('403 -') ||
                                    bodyText.includes('401 -') ||
                                    bodyText.includes('404 -') ||
                                    bodyText.includes('Job not found') ||
                                    h1Text.includes('Error') ||
                                    h1Text.includes('Unauthorized') ||
                                    h1Text.includes('Not Found')
                    
                    return { 
                        hasError, 
                        errorText: hasError ? bodyText.substring(0, 1000) : null,
                        errorTitle: h1Text || null,
                        errorDetails: preText || null
                    }
                }).catch(() => ({ hasError: false, errorText: null, errorDetails: null, errorTitle: null }))
                
                if (quickErrorCheck.hasError) {
                    const pageContent = await page.content().catch(() => 'Could not get page content')
                    const pageTitle = await page.title().catch(() => 'Could not get title')
                    console.error('[PDF] Page contains error content (early check)')
                    console.error('[PDF] Page title:', pageTitle)
                    console.error('[PDF] Page URL:', finalUrl)
                    console.error('[PDF] Error title:', quickErrorCheck.errorTitle)
                    console.error('[PDF] Error details:', quickErrorCheck.errorDetails)
                    console.error('[PDF] Error text:', quickErrorCheck.errorText)
                    console.error('[PDF] Page HTML snippet:', pageContent.substring(0, 5000))
                    
                    // Extract the actual error message for a clearer error
                    const errorMsg = quickErrorCheck.errorDetails || quickErrorCheck.errorTitle || 'Unknown error'
                    throw new Error(`Page contains error content: ${errorMsg}`)
                }
                
                // Wait for either the PDF ready marker OR the cover page (fallback)
                // Use Promise.race to wait for whichever appears first
                try {
                    await Promise.race([
                        page.waitForSelector('#pdf-ready', { state: 'attached', timeout: 20000 }),
                        page.waitForSelector('.cover-page', { timeout: 20000 }),
                    ])
                    console.log(`[PDF] Page ready marker or cover-page found after ${Date.now() - gotoStart}ms`)
                } catch (selectorError: any) {
                    // If both fail, check what's actually on the page
                    const hasPdfReady = await page.evaluate(() => !!document.getElementById('pdf-ready')).catch(() => false)
                    const hasCoverPage = await page.evaluate(() => !!document.querySelector('.cover-page')).catch(() => false)
                    const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 500) || 'No body').catch(() => 'Error getting body')
                    
                    console.error('[PDF] Neither #pdf-ready nor .cover-page found')
                    console.error('[PDF] #pdf-ready exists:', hasPdfReady)
                    console.error('[PDF] .cover-page exists:', hasCoverPage)
                    console.error('[PDF] Body text:', bodyText)
                    throw selectorError
                }
                
                // Wait for fonts to be ready (critical for layout stability)
                await page.evaluate(async () => {
                    if (document.fonts) {
                        await document.fonts.ready
                    }
                }).catch(() => {
                    console.warn('[PDF] Font loading check failed, proceeding anyway')
                })
                
                // Small delay to ensure layout is stable after fonts load
                await page.waitForTimeout(500)

                // Print sanity check: log computed styles for KPI value to catch layout issues
                const kpiDebug = await page.evaluate(() => {
                    // Try to find KPI value using data attribute first, then fallback to class
                    const el = document.querySelector('[data-pill-value="true"], .kpi-pill .kpi-value, .kpi-pill .value') as HTMLElement | null
                    if (!el) return null
                    const cs = window.getComputedStyle(el)
                    return {
                        fontSize: cs.fontSize,
                        lineHeight: cs.lineHeight,
                        whiteSpace: cs.whiteSpace,
                        fontWeight: cs.fontWeight,
                        selector: el.className || 'no-class',
                        hasDataAttr: el.hasAttribute('data-pill-value'),
                    }
                }).catch(() => null)
                console.log('[PDF] KPI debug (computed styles):', kpiDebug)
                
                // Also check if print CSS is active (check for print media query)
                const printMediaActive = await page.evaluate(() => {
                    return window.matchMedia && window.matchMedia('print').matches
                }).catch(() => false)
                console.log('[PDF] Print media query active:', printMediaActive)
                
                console.log(`[PDF] Page stable (fonts loaded, ready marker found) after ${Date.now() - gotoStart}ms`)
            } catch (waitError: any) {
                // Comprehensive debugging on failure
                const pageTitle = await page.title().catch(() => 'Could not get title')
                const pageContent = await page.content().catch(() => 'Could not get page content')
                const hasPdfReady = await page.evaluate(() => {
                    return !!document.getElementById('pdf-ready')
                }).catch(() => false)
                const bodyText = await page.evaluate(() => {
                    return document.body ? document.body.textContent?.substring(0, 500) : 'No body'
                }).catch(() => 'Could not get body text')
                const screenshot = await page.screenshot({ fullPage: false }).catch(() => null)
                
                console.error('[PDF] Page wait failed:', waitError.message)
                console.error('[PDF] Page title:', pageTitle)
                console.error('[PDF] Page URL:', finalUrl)
                console.error('[PDF] #pdf-ready exists in DOM:', hasPdfReady)
                console.error('[PDF] Body text snippet:', bodyText)
                console.error('[PDF] Page HTML snippet (first 3000 chars):', pageContent.substring(0, 3000))
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
