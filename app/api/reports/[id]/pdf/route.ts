import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signPrintToken } from '@/lib/utils/printToken'
import { generatePdfFromUrl } from '@/lib/utils/playwright'

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
    const token = signPrintToken({
      jobId,
      organizationId: userData.organization_id
    })

    // Build print URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || `http://${request.headers.get('host')}`
    const printUrl = `${baseUrl}/reports/${jobId}/print?token=${token}`

    // Generate PDF using hardened utility
    const pdfBuffer = await generatePdfFromUrl({
      url: printUrl,
      jobId,
      organizationId: userData.organization_id
    })

    // Return PDF (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="riskmate-report-${jobId.substring(0, 8)}.pdf"`,
      },
    })
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

