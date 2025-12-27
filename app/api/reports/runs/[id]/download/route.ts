import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/reports/runs/[id]/download
 * Downloads the stored PDF for a report_run (final PDFs only)
 * 
 * For final reports, this serves the frozen artifact instead of regenerating.
 * For draft reports, redirects to generation endpoint.
 */
export async function GET(
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

    const { id: reportRunId } = await params

    // Get report run
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('organization_id, status, pdf_path, pdf_signed_url')
      .eq('id', reportRunId)
      .single()

    if (runError || !reportRun) {
      return NextResponse.json(
        { message: 'Report run not found' },
        { status: 404 }
      )
    }

    // Verify user belongs to organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.organization_id !== reportRun.organization_id) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }

    // For final reports, serve the stored artifact only (frozen)
    if (reportRun.status === 'final') {
      if (!reportRun.pdf_path) {
        return NextResponse.json(
          { message: 'Final PDF not yet generated. Please contact support.' },
          { status: 404 }
        )
      }

      // Download from storage
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('reports')
        .download(reportRun.pdf_path)

      if (downloadError || !pdfData) {
        console.error('[reports/runs/download] Failed to download PDF:', downloadError)
        return NextResponse.json(
          { message: 'Failed to retrieve PDF', detail: downloadError?.message },
          { status: 500 }
        )
      }

      // Convert to buffer
      const arrayBuffer = await pdfData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="riskmate-report-${reportRunId.substring(0, 8)}.pdf"`,
          'X-Report-Run-ID': reportRunId,
          'X-Report-Status': 'final',
        },
      })
    }

    // For draft reports, return metadata (can regenerate if needed)
    return NextResponse.json({
      message: 'Draft reports can be regenerated. Use /api/reports/generate/[jobId]',
      report_run_id: reportRunId,
      status: reportRun.status,
      pdf_path: reportRun.pdf_path,
    })
  } catch (error: any) {
    console.error('[reports/runs/download] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

