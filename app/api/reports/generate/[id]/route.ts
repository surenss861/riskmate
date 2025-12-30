import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generatePdfFromUrl } from '@/lib/utils/playwright'
import { buildJobReport } from '@/lib/utils/jobReport'
import { buildJobPacket } from '@/lib/utils/packets/builder'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { signPrintToken } from '@/lib/utils/printToken'
import { isValidPacketType, type PacketType, PACKETS } from '@/lib/utils/packets/types'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Set max duration to handle browser launch and navigation (if plan supports it)
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Generate request ID for observability/tracing (outside try block for error handler access)
  const requestId = crypto.randomUUID()
  console.log(`[reports][${requestId}] PDF generation request started`)

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

    // Get packet type and status from request body
    const body = await request.json().catch(() => ({}))
    const rawPacketType = body.packetType
    const status = body.status || 'draft'

    // CRITICAL: Validate packetType with allowlist (prevents injection/typos)
    let packetType: PacketType = 'insurance' // Default for backwards compatibility
    if (rawPacketType) {
      if (!isValidPacketType(rawPacketType)) {
        console.error(`[reports][${requestId}] Invalid packetType: ${rawPacketType}`)
        return NextResponse.json(
          { 
            message: 'Invalid packet type',
            detail: `packetType must be one of: ${Object.keys(PACKETS).join(', ')}`,
            received: rawPacketType
          },
          { status: 400 }
        )
      }
      packetType = rawPacketType
    }

    // Build packet payload (new packet-driven approach)
    // For backwards compatibility, if no packetType, use old buildJobReport
    let reportPayload: any
    let dataHash: string

    if (packetType && isValidPacketType(packetType)) {
      // Use new packet builder
      const packetData = await buildJobPacket({
        jobId,
        packetType,
        organizationId: organization_id,
      })
      // Compute hash from packet data structure
      dataHash = computeCanonicalHash(packetData)
      reportPayload = packetData
    } else {
      // Legacy: use old buildJobReport
      reportPayload = await buildJobReport(organization_id, jobId)
      dataHash = computeCanonicalHash(reportPayload)
    }

    // Idempotency: Check for recent duplicate run (same hash + status + packet_type within 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
    const { data: existingRun } = await supabase
      .from('report_runs')
      .select('*')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .eq('packet_type', packetType)
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
        `[reports][${requestId}] Reusing existing report_run ${reportRun.id} for job ${jobId} (idempotency)`
      )
    } else {
      // Create new report_run (frozen snapshot)
      const { data: newRun, error: runError } = await supabase
        .from('report_runs')
        .insert({
          organization_id,
          job_id: jobId,
          packet_type: packetType,
          status,
          generated_by: user.id,
          data_hash: dataHash,
        })
        .select()
        .single()

      if (runError || !newRun) {
        console.error(`[reports][${requestId}] Failed to create report_run:`, runError)
        return NextResponse.json(
          { message: 'Failed to create report run', detail: runError?.message },
          { status: 500 }
        )
      }

      reportRun = newRun
      console.log(
        `[reports][${requestId}] Created report_run ${reportRun.id} for job ${jobId} | packetType: ${packetType} | hash: ${dataHash.substring(0, 12)} | status: ${status}`
      )
    }

    // Generate signed token for print route (bypasses auth requirement)
    // CRITICAL: Token must include both jobId AND runId for security
    const token = signPrintToken({
      jobId,
      organizationId: organization_id,
      reportRunId: reportRun.id, // Include runId in token for validation
    })

    // Prepare URL for the print page
    // Use new packet print route if packetType is specified, otherwise use legacy route
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host')
    const origin = `${protocol}://${host}`
    
    let printUrl: string
    if (packetType && isValidPacketType(packetType)) {
      // New packet-driven route (runId-based for frozen snapshot rendering)
      printUrl = `${origin}/reports/packet/print/${reportRun.id}?token=${encodeURIComponent(token)}`
    } else {
      // Legacy route for backwards compatibility (jobId-based)
      printUrl = `${origin}/reports/${jobId}/print?token=${encodeURIComponent(token)}&report_run_id=${reportRun.id}`
    }

    console.log(`[reports][${requestId}] Generating PDF from: ${printUrl}`)

    // Generate PDF using Playwright utility
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generatePdfFromUrl({
        url: printUrl,
        jobId,
        organizationId: organization_id,
      })
    } catch (browserError: any) {
      console.error(`[reports][${requestId}] Playwright failed:`, browserError)
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
      console.warn(`[reports][${requestId}] Bucket check/create failed:`, bucketError)
    }

    // Upload PDF to storage (use packet_type in path for organization)
    const pdfHash = require('crypto').createHash('sha256').update(pdfBuffer).digest('hex')
    // CRITICAL: Storage path includes packet_type for organization: {orgId}/{jobId}/{packetType}/{runId}.pdf
    const storagePath = packetType && isValidPacketType(packetType)
      ? `${organization_id}/${jobId}/${packetType}/${reportRun.id}.pdf`
      : `${organization_id}/${jobId}/${reportRun.id}/${pdfHash}.pdf`
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
        const { data: signedUrlData } = await supabase.storage
          .from('reports')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

        if (signedUrlData?.signedUrl) {
          pdfUrl = signedUrlData.signedUrl
        }

        // Update report_run with PDF metadata
        await supabase
          .from('report_runs')
          .update({
            pdf_path: storagePath,
            pdf_signed_url: pdfUrl,
            pdf_generated_at: new Date().toISOString(),
          })
          .eq('id', reportRun.id)

        console.log(`[reports][${requestId}] PDF uploaded to: ${storagePath}`)
      } else {
        console.error(`[reports][${requestId}] Upload failed:`, uploadError)
      }
    } catch (uploadError: any) {
      console.error(`[reports][${requestId}] Upload exception:`, uploadError)
      // Don't fail the request if upload fails - PDF is still generated
    }

    return NextResponse.json(
      {
        data: {
          report_run_id: reportRun.id,
          pdf_url: pdfUrl,
          storage_path: storagePath,
          pdf_base64: pdfBase64,
          data_hash: dataHash,
          generated_at: reportRun.generated_at,
          status: reportRun.status,
          packet_type: packetType,
          requestId, // Include request ID for tracing
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error: any) {
    console.error(`[reports][${requestId}] PDF generation failed:`, error)
    return NextResponse.json(
      { 
        message: 'PDF generation failed', 
        detail: error?.message || String(error),
        requestId,
      },
      { status: 500 }
    )
  }
}
