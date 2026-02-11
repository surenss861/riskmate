import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signPrintToken } from '@/lib/utils/printToken'
import { generatePdfFromService } from '@/lib/utils/playwright-pdf-service'
import { generatePdfRemote } from '@/lib/utils/playwright-remote'
import { isValidPacketType } from '@/lib/utils/packets/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/reports/runs/[id]/download
 * Fetches report run data, (optionally) generates PDF with signatures, returns PDF download.
 *
 * For complete/final runs: serves stored PDF if present; otherwise generates on-demand and stores it.
 * For draft runs: returns metadata and suggests calling generate first.
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

    // Get report run (include job_id, packet_type for on-demand generation)
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('organization_id, status, pdf_path, pdf_signed_url, job_id, packet_type')
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

    // For final/complete reports: serve stored PDF or generate on-demand
    if (reportRun.status === 'final' || reportRun.status === 'complete') {
      let pdfPath = reportRun.pdf_path
      let buffer: Buffer

      if (pdfPath) {
        // Download from storage
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('reports')
          .download(pdfPath)

        if (downloadError || !pdfData) {
          console.error('[reports/runs/download] Failed to download PDF:', downloadError)
          return NextResponse.json(
            { message: 'Failed to retrieve PDF', detail: downloadError?.message },
            { status: 500 }
          )
        }
        buffer = Buffer.from(await pdfData.arrayBuffer())
      } else {
        // On-demand PDF generation (fetch run + signatures, call PDF service, return PDF)
        const jobId = reportRun.job_id
        const organizationId = reportRun.organization_id
        const packetType = reportRun.packet_type && isValidPacketType(reportRun.packet_type)
          ? reportRun.packet_type
          : 'insurance'

        const token = signPrintToken({
          jobId,
          organizationId,
          reportRunId,
        })
        const protocol = request.headers.get('x-forwarded-proto') || 'http'
        const host = request.headers.get('host')
        const origin = `${protocol}://${host}`
        const printUrl = `${origin}/reports/packet/print/${reportRunId}?token=${encodeURIComponent(token)}`

        const pdfServiceUrl = process.env.PDF_SERVICE_URL
        const pdfServiceSecret = process.env.PDF_SERVICE_SECRET
        const browserlessToken = process.env.BROWSERLESS_TOKEN
        const requestId = `download-${reportRunId.substring(0, 8)}`

        if (pdfServiceUrl && pdfServiceSecret) {
          buffer = await generatePdfFromService({
            url: printUrl,
            jobId,
            organizationId,
            requestId,
          })
        } else if (browserlessToken) {
          buffer = await generatePdfRemote({
            url: printUrl,
            jobId,
            organizationId,
            requestId,
          })
        } else {
          return NextResponse.json(
            {
              message: 'PDF service not configured. Add PDF_SERVICE_URL + PDF_SERVICE_SECRET or BROWSERLESS_TOKEN.',
              error_code: 'MISSING_PDF_SERVICE_CONFIG',
            },
            { status: 500 }
          )
        }

        // Store PDF for future downloads
        const storagePath = `${organizationId}/${jobId}/${packetType}/${reportRunId}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

        if (!uploadError) {
          const { data: signedUrlData } = await supabase.storage
            .from('reports')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
          await supabase
            .from('report_runs')
            .update({
              pdf_path: storagePath,
              pdf_signed_url: signedUrlData?.signedUrl ?? null,
              pdf_generated_at: new Date().toISOString(),
            })
            .eq('id', reportRunId)
        }
      }

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="riskmate-report-${reportRunId.substring(0, 8)}.pdf"`,
          'X-Report-Run-ID': reportRunId,
          'X-Report-Status': reportRun.status,
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

