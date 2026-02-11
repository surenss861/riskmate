import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signPrintToken } from '@/lib/utils/printToken'
import { generatePdfFromService } from '@/lib/utils/playwright-pdf-service'
import { generatePdfRemote } from '@/lib/utils/playwright-remote'
import { isValidPacketType } from '@/lib/utils/packets/types'
import { ensureReportsBucketExists } from '@/lib/utils/ensureReportsBucket'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/reports/runs/[id]/download
 * Fetches report run (snapshot) and its signatures, passes them to the PDF generation flow,
 * and returns the generated PDF for all runs (draft, final, complete). Never returns JSON for drafts.
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

    // Fetch report run (full snapshot: job_id, packet_type, status, pdf_path for optional serve-from-storage)
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('id, organization_id, status, pdf_path, pdf_signed_url, job_id, packet_type, data_hash, generated_at')
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

    // Gather signatures for this run (report_signatures by run_id) — used by print page and for audit
    const { data: signatures } = await supabase
      .from('report_signatures')
      .select('id, signer_name, signer_title, signature_role, signature_svg, signed_at, signature_hash, attestation_text')
      .eq('report_run_id', reportRunId)
      .is('revoked_at', null)
      .order('signed_at', { ascending: true })

    const jobId = reportRun.job_id
    const organizationId = reportRun.organization_id
    const packetType = reportRun.packet_type && isValidPacketType(reportRun.packet_type)
      ? reportRun.packet_type
      : 'insurance'

    // If we have a stored PDF for final/complete, serve it
    const isFinalOrComplete = reportRun.status === 'final' || reportRun.status === 'complete'
    if (isFinalOrComplete && reportRun.pdf_path) {
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('reports')
        .download(reportRun.pdf_path)

      if (!downloadError && pdfData) {
        const buffer = Buffer.from(await pdfData.arrayBuffer())
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="riskmate-report-${reportRunId.substring(0, 8)}.pdf"`,
            'X-Report-Run-ID': reportRunId,
            'X-Report-Status': reportRun.status,
          },
        })
      }
      // Fall through to on-demand generation if storage read fails
    }

    // On-demand PDF generation: print URL loads run snapshot + signatures and renders PDF
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

    let buffer: Buffer
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

    // Store PDF for final/complete runs only (drafts get PDF streamed but not persisted)
    if (isFinalOrComplete) {
      try {
        await ensureReportsBucketExists(supabase)
      } catch (bucketErr: any) {
        console.error('[reports/runs/download] Reports bucket ensure failed:', bucketErr)
        return NextResponse.json(
          {
            message: 'Failed to ensure reports storage is available',
            detail: bucketErr?.message ?? 'Bucket check or creation failed',
            error_code: 'REPORTS_BUCKET_UNAVAILABLE',
          },
          { status: 500 }
        )
      }

      const storagePath = `${organizationId}/${jobId}/${packetType}/${reportRunId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

      if (uploadError) {
        console.error('[reports/runs/download] PDF upload failed:', uploadError)
        return NextResponse.json(
          {
            message: 'Failed to persist generated PDF to storage',
            detail: uploadError.message,
            error_code: 'PDF_PERSIST_FAILED',
          },
          { status: 500 }
        )
      }

      const { data: signedUrlData } = await supabase.storage
        .from('reports')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      const { error: updateError } = await supabase
        .from('report_runs')
        .update({
          pdf_path: storagePath,
          pdf_signed_url: signedUrlData?.signedUrl ?? null,
          pdf_generated_at: new Date().toISOString(),
        })
        .eq('id', reportRunId)

      if (updateError) {
        console.error('[reports/runs/download] Report run update after upload failed:', updateError)
        return NextResponse.json(
          {
            message: 'Failed to update report run with PDF metadata',
            detail: updateError.message,
            error_code: 'REPORT_RUN_UPDATE_FAILED',
          },
          { status: 500 }
        )
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="riskmate-report-${reportRunId.substring(0, 8)}.pdf"`,
        'X-Report-Run-ID': reportRunId,
        'X-Report-Status': reportRun.status,
      },
    })
  } catch (error: any) {
    console.error('[reports/runs/download] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

