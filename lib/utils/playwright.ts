import playwright from 'playwright-core'
import chromium from '@sparticuz/chromium'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

interface PdfOptions {
    url: string
    jobId: string
    organizationId: string // for logging context
    requestId?: string // Optional request ID for log correlation
}

// Cache the shared Chromium path to avoid re-extracting on every call
let cachedSharedChromiumPath: string | null = null

async function getSharedChromiumPath(): Promise<string> {
    if (cachedSharedChromiumPath) {
        return cachedSharedChromiumPath
    }
    cachedSharedChromiumPath = await chromium.executablePath()
    return cachedSharedChromiumPath
}

/**
 * Get a unique Chromium executable path per run to prevent ETXTBSY errors
 * when multiple PDF generations run in parallel.
 * 
 * Creates a copy of the shared Chromium binary in /tmp with a unique name.
 * This ensures each request has its own executable that won't conflict with
 * concurrent writes/extractions.
 */
async function getPerRunChromiumPath(sharedPath: string, requestId: string): Promise<string> {
    const runId = requestId.substring(0, 8) || crypto.randomUUID().substring(0, 8)
    const uniquePath = path.join(os.tmpdir(), `chromium-${runId}-${Date.now()}`)
    
    try {
        // Copy the shared Chromium to a unique location
        await fs.promises.copyFile(sharedPath, uniquePath)
        
        // CRITICAL: Set executable permissions explicitly
        await fs.promises.chmod(uniquePath, 0o755)
        
        // Hard-check: verify file exists and is executable
        const stats = await fs.promises.stat(uniquePath)
        const mode = stats.mode
        const isExecutable = (mode & parseInt('111', 8)) !== 0
        
        if (!isExecutable) {
            // Try chmod again if permissions weren't set correctly
            await fs.promises.chmod(uniquePath, 0o755)
            throw new Error(`Chromium copy is not executable after chmod. Mode: ${mode.toString(8)}`)
        }
        
        return uniquePath
    } catch (error: any) {
        // Clean up on failure
        await fs.promises.unlink(uniquePath).catch(() => {})
        throw new Error(`Failed to create unique Chromium copy: ${error.message} (code: ${error.code})`)
    }
}

export async function generatePdfFromUrl({ url, jobId, organizationId, requestId }: PdfOptions): Promise<Buffer> {
    const start = Date.now()
    const logRequestId = requestId || `PDF-${jobId.substring(0, 8)}-${organizationId.substring(0, 8)}`
    console.log(`[${logRequestId}][stage] START generating for Job:${jobId.substring(0, 8)} Org:${organizationId}`)

    let attempt = 1
    const maxAttempts = 2

    while (attempt <= maxAttempts) {
        let browser = null
        try {
            if (attempt > 1) console.log(`[PDF] Retry attempt ${attempt}/${maxAttempts}...`)

            const launchStart = Date.now()
            
            // STAGE: Prepare Chromium
            console.log(`[${logRequestId}][stage] prepare_chromium_start`)
            const sharedChromiumPath = await getSharedChromiumPath()
            const executablePath = await getPerRunChromiumPath(sharedChromiumPath, logRequestId)
            
            // Hard-check: verify file exists and is executable before launch
            if (!executablePath || typeof executablePath !== 'string') {
                throw new Error(`[stage=prepare_chromium] Chromium executable path is invalid: ${executablePath} (type: ${typeof executablePath})`)
            }
            
            if (!fs.existsSync(executablePath)) {
                throw new Error(`[stage=prepare_chromium] Chromium executable does not exist at path: ${executablePath}`)
            }
            
            // Final permission check (should already be set by getPerRunChromiumPath, but verify)
            const stats = fs.statSync(executablePath)
            const isExecutable = (stats.mode & parseInt('111', 8)) !== 0
            if (!isExecutable) {
                fs.chmodSync(executablePath, 0o755)
                // Verify again after chmod
                const newStats = fs.statSync(executablePath)
                const nowExecutable = (newStats.mode & parseInt('111', 8)) !== 0
                if (!nowExecutable) {
                    throw new Error(`[stage=prepare_chromium] Chromium is not executable after chmod. Path: ${executablePath}, mode: ${newStats.mode.toString(8)}`)
                }
            }
            
            console.log(`[${logRequestId}][stage] prepare_chromium_ok path=${executablePath} size=${stats.size} mode=${stats.mode.toString(8)}`)
            console.log(`[${logRequestId}] sharedChromiumPath=`, sharedChromiumPath)
            console.log(`[${logRequestId}] uniqueExecutablePath=`, executablePath)
            console.log(`[${logRequestId}] node=${process.version} vercel=${process.env.VERCEL || 'local'}`)
            
            // Use known-good Chromium args for Vercel/serverless
            // @sparticuz/chromium already provides good defaults, but we ensure critical ones are present
            const launchArgs = [
                ...chromium.args,
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-setuid-sandbox',
                    '--no-sandbox',
                '--single-process', // Critical for serverless (runs in single process)
            ]
            
            // Remove duplicates
            const uniqueArgs = Array.from(new Set(launchArgs))
            console.log(`[${logRequestId}] Launch args (${uniqueArgs.length}):`, uniqueArgs.slice(0, 10).join(' '), '...')
            
            // STAGE: Launch browser
            console.log(`[${logRequestId}][stage] launch_start executablePath=${executablePath}`)
            try {
                browser = await playwright.chromium.launch({
                    executablePath,
                    args: uniqueArgs,
                    headless: true,
                    timeout: 30000, // 30 second timeout for launch
                })
                console.log(`[${logRequestId}][stage] launch_ok duration=${Date.now() - launchStart}ms`)
            } catch (launchError: any) {
                console.error(`[${logRequestId}][stage] launch_failed error_code=${launchError?.code} error_name=${launchError?.name}`)
                // CRITICAL: Log full error details for debugging
                console.error(`[${logRequestId}] Browser launch failed:`)
                console.error(`[${logRequestId}] Error message:`, launchError?.message || 'No message')
                console.error(`[${logRequestId}] Error name:`, launchError?.name || 'Unknown')
                console.error(`[${logRequestId}] Error code:`, launchError?.code || 'No code')
                console.error(`[${logRequestId}] Error stack:`, launchError?.stack || 'No stack')
                
                // Try to extract stderr if available
                if (launchError.stderr) {
                    console.error(`[${logRequestId}] Error stderr:`, launchError.stderr.toString())
                }
                if (launchError.stdout) {
                    console.error(`[${logRequestId}] Error stdout:`, launchError.stdout.toString())
                }
                
                console.error(`[${logRequestId}] Full error object:`, JSON.stringify(launchError, Object.getOwnPropertyNames(launchError), 2))
                throw launchError
            }

            // STAGE: Create page
            console.log(`[${logRequestId}][stage] create_page_start`)
            const context = await browser.newContext()
            const page = await context.newPage()
            await page.setViewportSize({ width: 794, height: 1123 }) // approx A4 @ 96dpi
            await page.emulateMedia({ media: 'print' })
            console.log(`[${logRequestId}][stage] create_page_ok`)

            // STAGE: Render HTML
            console.log(`[${logRequestId}][stage] render_html_start url=${url}`)
            const gotoStart = Date.now()
            const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
            const finalUrl = page.url()
            console.log(`[${logRequestId}][stage] render_html_ok duration=${Date.now() - gotoStart}ms status=${response?.status()} url=${finalUrl}`)

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

            // STAGE: Generate PDF
            console.log(`[${logRequestId}][stage] pdf_start`)
            const pdfStart = Date.now()
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
            })
            console.log(`[${logRequestId}][stage] pdf_ok duration=${Date.now() - pdfStart}ms size=${(pdfBuffer.length / 1024).toFixed(2)}KB`)

            await browser.close()
            console.log(`[PDF] Total duration: ${Date.now() - start}ms`)

            // Clean up unique Chromium copy (best effort, don't fail if it doesn't work)
            try {
                await fs.promises.unlink(executablePath).catch(() => {
                    // Ignore cleanup errors - file might already be gone or in use
                })
            } catch (cleanupError) {
                // Silently ignore cleanup failures
            }

            return pdfBuffer

        } catch (error: any) {
            // CRITICAL: Log full error details with stage and error code
            const errorCode = error?.code || 'NO_CODE'
            const errorName = error?.name || 'Unknown'
            const errorMessage = error?.message || 'No message'
            const stage = errorMessage.match(/\[stage=(\w+)\]/)?.[1] || 'unknown'
            
            console.error(`[${logRequestId}][stage] ${stage}_failed attempt=${attempt}/${maxAttempts}`)
            console.error(`[${logRequestId}] error_code=${errorCode} error_name=${errorName}`)
            console.error(`[${logRequestId}] error_message=`, errorMessage)
            console.error(`[${logRequestId}] error_stack=`, error?.stack || 'No stack')
            
            // Try to extract stderr/stdout if available
            if (error.stderr) {
                console.error(`[${logRequestId}] error_stderr=`, error.stderr.toString().substring(0, 1000))
            }
            if (error.stdout) {
                console.error(`[${logRequestId}] error_stdout=`, error.stdout.toString().substring(0, 1000))
            }
            
            // Log full error object for debugging
            try {
                console.error(`[${logRequestId}] error_object=`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
            } catch (stringifyError) {
                console.error(`[${logRequestId}] error_object (stringify failed):`, error)
            }
            
            if (browser) await browser.close().catch(() => { })

            // Clean up unique Chromium copy on error (best effort)
            try {
                const sharedPath = await getSharedChromiumPath().catch(() => null)
                if (sharedPath) {
                    // Find and clean up any unique copies for this request
                    const tmpDir = os.tmpdir()
                    const files = await fs.promises.readdir(tmpDir).catch(() => [])
                    const uniqueFiles = files.filter(f => f.startsWith(`chromium-${logRequestId.substring(0, 8)}`))
                    for (const file of uniqueFiles) {
                        await fs.promises.unlink(path.join(tmpDir, file)).catch(() => {})
                    }
                }
            } catch (cleanupError) {
                // Silently ignore cleanup failures
            }

            // For ETXTBSY errors, add exponential backoff retry
            const errorMessage = String(error?.message || '')
            const isETXTBSY = errorMessage.includes('ETXTBSY') || errorMessage.includes('text file busy')
            
            if (attempt === maxAttempts) {
                // Throw error with full message (don't truncate)
                const fullErrorMessage = error?.message || error?.toString() || 'Unknown error'
                throw new Error(`Failed to generate PDF after ${maxAttempts} attempts: ${fullErrorMessage}`)
            }
            
            // Add exponential backoff for ETXTBSY errors
            if (isETXTBSY && attempt < maxAttempts) {
                const backoffMs = 150 + Math.random() * 250 + (attempt - 1) * 400
                console.log(`[${logRequestId}] ETXTBSY detected, waiting ${backoffMs.toFixed(0)}ms before retry...`)
                await new Promise(resolve => setTimeout(resolve, backoffMs))
            }
            
            attempt++
        }
    }

    throw new Error('Unexpected PDF generation failure')
}
