import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generatePdfFromUrl } from '@/lib/utils/playwright'
import { generatePdfRemote } from '@/lib/utils/playwright-remote'
import { generatePdfFromService } from '@/lib/utils/playwright-pdf-service'
import { buildJobReport } from '@/lib/utils/jobReport'
import { buildJobPacket } from '@/lib/utils/packets/builder'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { signPrintToken } from '@/lib/utils/printToken'
import { isValidPacketType, type PacketType, PACKETS } from '@/lib/utils/packets/types'
import { checkRateLimitWithContext, RATE_LIMIT_CONFIGS } from '@/lib/utils/rateLimiter'
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
  // Log build SHA to verify deployment (critical for debugging stale builds)
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'no-sha'
  
  // Extract jobId early for logging (outside try block)
  const { id: jobId } = await params
  console.log(`[reports][${requestId}][stage] request_start build=${buildSha} jobId=${jobId}`)

  // Declare pdfMethod at function scope so it's accessible in both try and catch blocks
  type PdfMethod = 'self-hosted' | 'browserless' | 'none'
  let pdfMethod: PdfMethod = 'none'

  try {
    // STAGE: Authenticate
    console.log(`[reports][${requestId}][stage] auth_start`)
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log(`[reports][${requestId}][stage] auth_failed`)
      return NextResponse.json(
        { message: 'Unauthorized', requestId, stage: 'auth' },
        { status: 401 }
      )
    }
    console.log(`[reports][${requestId}][stage] auth_ok`)

    // STAGE: Get user organization
    console.log(`[reports][${requestId}][stage] fetch_user_start`)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData?.organization_id) {
      console.error(`[reports][${requestId}][stage] fetch_user_failed`, userError)
      return NextResponse.json(
        { 
          message: 'Failed to get organization ID', 
          requestId, 
          stage: 'fetch_user',
          error_code: userError?.code || 'NO_ORG_ID'
        },
        { status: 500 }
      )
    }
    const organization_id = userData.organization_id
    console.log(`[reports][${requestId}][stage] fetch_user_ok organization_id=${organization_id}`)

    // STAGE: Fetch job
    console.log(`[reports][${requestId}][stage] fetch_job_start jobId=${jobId}`)
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (!job) {
      console.log(`[reports][${requestId}][stage] fetch_job_failed job_not_found`)
      return NextResponse.json(
        { message: 'Job not found', requestId, stage: 'fetch_job', error_code: 'JOB_NOT_FOUND' },
        { status: 404 }
      )
    }
    console.log(`[reports][${requestId}][stage] fetch_job_ok`)

    // Rate limit: 20 PDF generations per hour per org
    const rateLimitResult = checkRateLimitWithContext(request, RATE_LIMIT_CONFIGS.pdf, {
      organization_id,
      user_id: user.id,
    })
    if (!rateLimitResult.allowed) {
      console.log(JSON.stringify({
        event: 'rate_limit_exceeded',
        organization_id,
        user_id: user.id,
        endpoint: request.nextUrl?.pathname,
        limit: rateLimitResult.limit,
        window_ms: rateLimitResult.windowMs,
        retry_after: rateLimitResult.retryAfter,
        request_id: requestId,
      }))
      return NextResponse.json(
        {
          message: 'Rate limit exceeded. Please try again later.',
          requestId,
          stage: 'rate_limit',
          error_code: 'RATE_LIMIT_EXCEEDED',
          retry_after_seconds: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-Request-ID': requestId,
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            'Retry-After': String(rateLimitResult.retryAfter),
          },
        }
      )
    }

    // Get packet type and status from request body
    const body = await request.json().catch(() => ({}))
    const rawPacketType = body.packetType
    const status = body.status || 'draft'
    const skipPdfGeneration = body.skipPdfGeneration === true // If true, only create report run, don't generate PDF

    // STAGE: Validate packet type
    console.log(`[reports][${requestId}][stage] validate_packet_type_start`)
    // CRITICAL: Validate packetType with allowlist (prevents injection/typos)
    let packetType: PacketType = 'insurance' // Default for backwards compatibility
    if (rawPacketType) {
      if (!isValidPacketType(rawPacketType)) {
        console.error(`[reports][${requestId}][stage] validate_packet_type_failed received=${rawPacketType}`)
        return NextResponse.json(
          { 
            message: 'Invalid packet type',
            detail: `packetType must be one of: ${Object.keys(PACKETS).join(', ')}`,
            received: rawPacketType,
            requestId,
            stage: 'validate_packet_type',
            error_code: 'INVALID_PACKET_TYPE'
          },
          { status: 400 }
        )
      }
      packetType = rawPacketType
    }
    console.log(`[reports][${requestId}][stage] validate_packet_type_ok packetType=${packetType}`)

    // STAGE: Build packet data
    console.log(`[reports][${requestId}][stage] build_packet_start packetType=${packetType}`)
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
    console.log(`[reports][${requestId}][stage] build_packet_ok hash=${dataHash.substring(0, 12)}`)

    // STAGE: Check for existing run (idempotency)
    console.log(`[reports][${requestId}][stage] check_existing_run_start`)
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
      console.log(`[reports][${requestId}][stage] check_existing_run_ok reused_runId=${reportRun.id}`)
    } else {
      // STAGE: Create new report_run (frozen snapshot)
      console.log(`[reports][${requestId}][stage] create_report_run_start`)
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
        console.error(`[reports][${requestId}][stage] create_report_run_failed`, runError)
        return NextResponse.json(
          { 
            message: 'Failed to create report run', 
            detail: runError?.message,
            requestId,
            stage: 'create_report_run',
            error_code: runError?.code || 'DB_ERROR'
          },
          { status: 500 }
        )
      }

      reportRun = newRun
      console.log(`[reports][${requestId}][stage] create_report_run_ok runId=${reportRun.id}`)
    }

    // When skipPdfGeneration is true, return run only (no PDF) for signature workflow
    if (skipPdfGeneration) {
      console.log(`[reports][${requestId}][stage] skip_pdf_returning_run`)
      return NextResponse.json(
        {
          ok: true,
          data: {
            report_run_id: reportRun.id,
            data_hash: reportRun.data_hash,
            generated_at: reportRun.generated_at,
            status: reportRun.status,
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Build-SHA': buildSha,
          },
        }
      )
    }

    // STAGE: Generate signed token
    console.log(`[reports][${requestId}][stage] sign_token_start`)
    // CRITICAL: Token must include both jobId AND runId for security
    const token = signPrintToken({
      jobId,
      organizationId: organization_id,
      reportRunId: reportRun.id, // Include runId in token for validation
    })
    console.log(`[reports][${requestId}][stage] sign_token_ok`)

    // STAGE: Build print URL
    console.log(`[reports][${requestId}][stage] build_url_start`)
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
    console.log(`[reports][${requestId}][stage] build_url_ok url=${printUrl}`)
    console.log(`[reports][${requestId}] PRINT_URL_FOR_DEBUGGING: ${printUrl}`)
    console.log(`[reports][${requestId}] To test manually, open this URL in browser: ${printUrl}`)

    // STAGE: Generate PDF
    console.log(`[reports][${requestId}][stage] generate_pdf_start`)

    // Check which PDF service to use (prefer self-hosted, fallback to Browserless)
    const pdfServiceUrl = process.env.PDF_SERVICE_URL
    const pdfServiceSecret = process.env.PDF_SERVICE_SECRET
    const browserlessToken = process.env.BROWSERLESS_TOKEN
    
    if (pdfServiceUrl && pdfServiceSecret) {
      pdfMethod = 'self-hosted'
    } else if (browserlessToken) {
      pdfMethod = 'browserless'
    }

    if (pdfMethod === 'none') {
      console.error(`[reports][${requestId}][stage] pdf_service_missing_config`)
      return NextResponse.json(
        {
          message: 'PDF service not configured. Add PDF_SERVICE_URL + PDF_SERVICE_SECRET (for self-hosted) or BROWSERLESS_TOKEN (for Browserless) to Vercel environment variables.',
          requestId,
          stage: 'pdf_service_missing_config',
          error_code: 'MISSING_PDF_SERVICE_CONFIG',
        },
        {
          status: 500,
          headers: {
            'X-PDF-Method': 'none',
            'X-Build-SHA': buildSha,
          },
        }
      )
    }

    console.log(`[reports][${requestId}] PDF generation method: ${pdfMethod}`)

    // Generate PDF using configured service
    let pdfBuffer: Buffer
    try {
      if (pdfMethod === 'self-hosted') {
        pdfBuffer = await generatePdfFromService({
          url: printUrl,
          jobId,
          organizationId: organization_id,
          requestId, // Pass requestId for better log correlation
        })
      } else {
        pdfBuffer = await generatePdfRemote({
          url: printUrl,
          jobId,
          organizationId: organization_id,
          requestId, // Pass requestId for better log correlation
        })
      }
      console.log(`[reports][${requestId}][stage] generate_pdf_ok size=${(pdfBuffer.length / 1024).toFixed(2)}KB`)
    } catch (browserError: any) {
      // Extract stage and error code from the error
      const errorMessage = browserError?.message || 'Unknown browser error'
      const stage = errorMessage.match(/\[stage=(\w+)\]/)?.[1] || 'generate_pdf'
      const errorCode = browserError?.is429 ? 'BROWSERLESS_RATE_LIMITED' : (browserError?.errorCode || browserError?.code || 'NO_CODE')
      
      console.error(`[reports][${requestId}][stage] ${stage}_failed error_code=${errorCode} is_429=${browserError?.is429 || false}`)
      console.error(`[reports][${requestId}] error_message=`, errorMessage)
      console.error(`[reports][${requestId}] error_stack=`, browserError?.stack || 'No stack')
      
      // For 429 rate limit errors, throw with specific properties so we can return 429 status
      if (browserError?.is429) {
        const rateLimitError = new Error(`[stage=browser_connect] Browserless rate limited: ${errorMessage}`) as any
        rateLimitError.is429 = true
        rateLimitError.errorCode = 'BROWSERLESS_RATE_LIMITED'
        throw rateLimitError
      }
      
      // Return structured error with stage and code for other errors
      throw new Error(`[stage=${stage}] Browser generation failed: ${errorMessage} (code: ${errorCode})`)
    }

    // Calculate hash for deduplication/verification
    const pdfBase64 = pdfBuffer.toString('base64')

    // STAGE: Ensure storage bucket exists
    console.log(`[reports][${requestId}][stage] check_bucket_start`)
    try {
      const { data: bucket } = await supabase.storage.getBucket('reports')
      if (!bucket) {
        await supabase.storage.createBucket('reports', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
        })
      }
      console.log(`[reports][${requestId}][stage] check_bucket_ok`)
    } catch (bucketError: any) {
      console.warn(`[reports][${requestId}][stage] check_bucket_warning`, bucketError)
      // Continue anyway - bucket might already exist
    }

    // STAGE: Prepare storage path
    console.log(`[reports][${requestId}][stage] prepare_storage_path_start`)
    const pdfHash = require('crypto').createHash('sha256').update(pdfBuffer).digest('hex')
    // CRITICAL: Storage path includes packet_type for organization: {orgId}/{jobId}/{packetType}/{runId}.pdf
    const storagePath = packetType && isValidPacketType(packetType)
      ? `${organization_id}/${jobId}/${packetType}/${reportRun.id}.pdf`
      : `${organization_id}/${jobId}/${reportRun.id}/${pdfHash}.pdf`
    console.log(`[reports][${requestId}][stage] prepare_storage_path_ok path=${storagePath}`)

    // STAGE: Upload PDF
    console.log(`[reports][${requestId}][stage] upload_start path=${storagePath}`)
    let pdfUrl: string | null = null
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false, // Don't overwrite - each run is unique
        })

      if (uploadError) {
        // StorageError from Supabase doesn't have errorCode, use message and status if available
        const errorCode = (uploadError as any).statusCode || (uploadError as any).status || 'UNKNOWN'
        console.error(`[reports][${requestId}][stage] upload_failed error_code=${errorCode}`, uploadError)
        throw new Error(`[stage=upload] Storage upload failed: ${uploadError.message} (code: ${errorCode})`)
      }

      if (!uploadData) {
        console.error(`[reports][${requestId}][stage] upload_failed no_data`)
        throw new Error(`[stage=upload] Storage upload returned no data`)
      }

      console.log(`[reports][${requestId}][stage] upload_ok path=${storagePath}`)

      // STAGE: Create signed URL
      console.log(`[reports][${requestId}][stage] create_signed_url_start`)
      const { data: signedUrlData } = await supabase.storage
        .from('reports')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      if (signedUrlData?.signedUrl) {
        pdfUrl = signedUrlData.signedUrl
        console.log(`[reports][${requestId}][stage] create_signed_url_ok`)
      } else {
        console.warn(`[reports][${requestId}][stage] create_signed_url_warning no_url`)
      }

      // STAGE: Update report_run with PDF metadata
      console.log(`[reports][${requestId}][stage] update_report_run_start`)
      await supabase
        .from('report_runs')
        .update({
          pdf_path: storagePath,
          pdf_signed_url: pdfUrl,
          pdf_generated_at: new Date().toISOString(),
        })
        .eq('id', reportRun.id)
      console.log(`[reports][${requestId}][stage] update_report_run_ok`)
    } catch (uploadError: any) {
      const errorMessage = uploadError?.message || 'Unknown upload error'
      const stage = errorMessage.match(/\[stage=(\w+)\]/)?.[1] || 'upload'
      // Try multiple ways to get error code (StorageError doesn't have a standard errorCode property)
      const errorCode = uploadError?.statusCode || uploadError?.status || uploadError?.code || 'NO_CODE'
      
      console.error(`[reports][${requestId}][stage] ${stage}_failed error_code=${errorCode}`)
      console.error(`[reports][${requestId}] error_message=`, errorMessage)
      throw new Error(`[stage=${stage}] ${errorMessage} (code: ${errorCode})`)
    }

    // STAGE: Request complete
    console.log(`[reports][${requestId}][stage] request_complete runId=${reportRun.id} pdfUrl=${pdfUrl ? 'yes' : 'no'}`)
    
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
          'X-Build-SHA': buildSha, // Include build SHA for deployment verification
          'X-PDF-Method': pdfMethod, // Indicate which PDF generation method was used
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      }
    )
  } catch (error: any) {
    // Extract stage and error code for better debugging
    const errorMessage = error?.message || 'Unknown error'
    const stage = errorMessage.match(/\[stage=(\w+)\]/)?.[1] || 'unknown'
    const errorCode = error?.is429 ? 'BROWSERLESS_RATE_LIMITED' : (error?.errorCode || error?.code || 'NO_CODE')
    const isRateLimited = error?.is429 || false
    const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'no-sha'
    
    console.error(`[reports][${requestId}][stage] ${stage}_failed error_code=${errorCode} is_429=${isRateLimited}`)
    console.error(`[reports][${requestId}] error_message=`, errorMessage)
    console.error(`[reports][${requestId}] error_stack=`, error?.stack || 'No stack')
    
    // Return 429 status for rate limit errors, 500 for everything else
    const statusCode = isRateLimited ? 429 : 500
    
    // Add Retry-After header for 429 errors
    const headers: Record<string, string> = {
      'X-Build-SHA': buildSha, // Include build SHA for deployment verification
      'X-PDF-Method': pdfMethod, // Indicate which PDF generation method was used (or attempted)
    }
    
    if (isRateLimited) {
      headers['Retry-After'] = '2' // Suggest retry after 2 seconds
    }
    
    return NextResponse.json(
      {
        message: errorMessage,
        requestId,
        stage,
        error_code: errorCode,
      },
      { 
        status: statusCode,
        headers,
      }
    )
  }
}
