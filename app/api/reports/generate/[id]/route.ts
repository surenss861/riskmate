import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generatePdfFromUrl } from '@/lib/utils/playwright'
import { buildJobReport } from '@/lib/utils/jobReport'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { signPrintToken } from '@/lib/utils/printToken'

export const runtime = 'nodejs'
// Set max duration to handle browser launch and navigation
export const maxDuration = 60

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
      .maybeSingle()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organization_id = userData.organization_id
    const { id: jobId } = await params

    // Verify job belongs to organization
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (!job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Build report payload (same data structure used for rendering)
    const reportPayload = await buildJobReport(organization_id, jobId)

    // Compute canonical data hash for audit integrity
    const dataHash = computeCanonicalHash(reportPayload)

    // Get status from request body (default to draft)
    const body = await request.json().catch(() => ({}))
    const status = body.status || 'draft'

    // Idempotency: Check for recent duplicate run (same hash + status within 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
    const { data: existingRun } = await supabase
      .from('report_runs')
      .select('*')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .eq('data_hash', dataHash)
      .eq('status', status)
      .eq('generated_by', user.id)
      .gte('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let reportRun
    if (existingRun) {
      // Reuse existing run (idempotency)
      reportRun = existingRun
      console.log(
        `[reports] Reusing existing report_run ${reportRun.id} for job ${jobId} (idempotency)`
      )
    } else {
      // Create new report_run (frozen snapshot)
      const { data: newRun, error: runError } = await supabase
        .from('report_runs')
        .insert({
          organization_id,
          job_id: jobId,
          status,
          generated_by: user.id,
          data_hash: dataHash,
        })
        .select()
        .single()

      if (runError || !newRun) {
        console.error('[reports] Failed to create report_run:', runError)
        return NextResponse.json(
          { message: 'Failed to create report run', detail: runError?.message },
          { status: 500 }
        )
      }

      reportRun = newRun
      console.log(
        `[reports] Created report_run ${reportRun.id} for job ${jobId} | hash: ${dataHash.substring(0, 12)} | status: ${status}`
      )
    }

    // Generate signed token for print route (bypasses auth requirement)
    const token = signPrintToken({
      jobId,
      organizationId: organization_id,
    })

    // Prepare URL for the print page with report_run_id and token
    // URL-encode the token since it's base64 and may contain special characters
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host')
    const origin = `${protocol}://${host}`
    const printUrl = `${origin}/reports/${jobId}/print?token=${encodeURIComponent(token)}&report_run_id=${reportRun.id}`

    console.log('[reports] Generating PDF from:', printUrl)

    // Generate PDF using Playwright utility
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generatePdfFromUrl({
        url: printUrl,
        jobId,
        organizationId: organization_id,
      })
    } catch (browserError: any) {
      console.error('[reports] Playwright failed:', browserError)
      throw new Error(`Browser generation failed: ${browserError.message}`)
    }

    // Calculate hash for deduplication/verification
    const pdfBase64 = pdfBuffer.toString('base64')

    // Create snapshot payload (re-fetch data to match schema if needed, 
    // or we can rely on what the print page fetched. 
    // For now, to keep legacy compatibility, we won't insert a "payload" snapshot 
    // here because we didn't fetch the raw data in this API route. 
    // We can fetch it if "report_snapshots" requires it, but for now 
    // let's focus on the PDF upload success.)

    // Ensure reports bucket exists
    try {
      const { data: bucket } = await supabase.storage.getBucket('reports')
      if (!bucket) {
        await supabase.storage.createBucket('reports', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
        })
      }
    } catch (bucketError) {
      console.warn('Bucket check/create failed:', bucketError)
    }

    // Upload PDF to storage
    const pdfHash = require('crypto').createHash('sha256').update(pdfBuffer).digest('hex')
    const storagePath = `${organization_id}/${jobId}/${reportRun.id}/${pdfHash}.pdf`
    let pdfUrl: string | null = null

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false, // Don't overwrite - each run is unique
        })

      if (!uploadError && uploadData) {
        // Create signed URL (1 year)
        const { data: signed } = await supabase.storage
          .from('reports')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year

        pdfUrl = signed?.signedUrl || null

        // Update report_run with PDF metadata
        await supabase
          .from('report_runs')
          .update({
            pdf_path: storagePath,
            pdf_signed_url: pdfUrl,
            pdf_generated_at: new Date().toISOString(),
          })
          .eq('id', reportRun.id)
      }
    } catch (uploadError) {
      console.warn('PDF upload failed:', uploadError)
    }

    // Return response with no-cache headers to prevent stale/error PDFs
    const response = NextResponse.json({
      data: {
        report_run_id: reportRun.id,
        pdf_url: pdfUrl,
        storage_path: storagePath,
        pdf_base64: pdfBase64,
        data_hash: dataHash,
        generated_at: reportRun.generated_at,
        status: reportRun.status,
      },
    })

    // Set cache control headers to prevent serving stale/error PDFs
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error: any) {
    console.error('[reports] generate failed:', error)
    return NextResponse.json(
      {
        message: 'Failed to generate PDF report',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    )
  }
}

