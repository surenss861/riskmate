import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for PDF generation

/**
 * PDF Generation API Endpoint
 * 
 * Uses Playwright to render the print route and export as PDF.
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Verify job access
 * 3. Generate signed token for print route
 * 4. Launch headless browser
 * 5. Navigate to print route with token
 * 6. Export as PDF
 * 7. Return PDF buffer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const { id: jobId } = await params

    // Verify job belongs to organization
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (!job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Generate short-lived signed token for print route
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    // Store token temporarily (in production, use Redis or similar)
    // For now, we'll pass it in the URL and validate it in the print route
    // In a real implementation, you'd store this in a database or cache

    // Build print URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const printUrl = `${baseUrl}/reports/${jobId}/print?token=${token}`

    // Import Playwright dynamically (only when needed)
    // Note: Playwright must be installed: npm install playwright @playwright/test --save-dev
    // Then run: npx playwright install chromium
    let playwright: any
    try {
      // @ts-expect-error - Playwright is optional and handled at runtime
      playwright = await import('playwright')
    } catch (error) {
      console.error('[PDF] Playwright not installed. Install with: npm install playwright @playwright/test --save-dev')
      console.error('[PDF] Then install browser: npx playwright install chromium')
      return NextResponse.json(
        { 
          message: 'PDF generation service not available',
          detail: 'Playwright is required for HTML-to-PDF conversion. Please install it.',
          installCommand: 'npm install playwright @playwright/test --save-dev && npx playwright install chromium'
        },
        { status: 503 }
      )
    }

    // Launch browser
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for serverless
    })

    try {
      const page = await browser.newPage()

      // Set viewport for A4
      await page.setViewportSize({ width: 1200, height: 1600 })

      // Navigate to print route
      await page.goto(printUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '48pt',
          right: '48pt',
          bottom: '60pt',
          left: '48pt',
        },
        printBackground: true,
        preferCSSPageSize: true,
      })

      await browser.close()

      // Return PDF
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="riskmate-report-${jobId.substring(0, 8)}.pdf"`,
        },
      })
    } catch (browserError: any) {
      await browser.close()
      console.error('Browser PDF generation failed:', browserError)
      throw browserError
    }
  } catch (error: any) {
    console.error('[reports] PDF generation failed:', error)
    return NextResponse.json(
      {
        message: 'Failed to generate PDF report',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

