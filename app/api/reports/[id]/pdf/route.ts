import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signPrintToken } from '@/lib/utils/printToken'
import { generatePdfFromUrl } from '@/lib/utils/playwright'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/utils/rateLimiter'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { API_ERROR_CODES } from '@/lib/utils/apiErrors'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for PDF generation

const ROUTE = '/api/reports/[id]/pdf'

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
  const requestId = getRequestId(request)

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED.defaultMessage,
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, userData?.organization_id, response.message, {
        category: 'internal',
        severity: 'error',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
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
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.NOT_FOUND.defaultMessage,
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      logApiError(404, 'NOT_FOUND', errorId, requestId, userData.organization_id, response.message, {
        category: 'validation',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Rate limit: 20 PDF generations per hour per org
    const rateLimitResult = checkRateLimit(request, RATE_LIMIT_PRESETS.pdf, {
      organization_id: userData.organization_id,
      user_id: user.id,
    })
    if (!rateLimitResult.allowed) {
      console.log(JSON.stringify({
        event: 'rate_limit_exceeded',
        organization_id: userData.organization_id,
        user_id: user.id,
        endpoint: request.nextUrl?.pathname,
        limit: rateLimitResult.limit,
        window_ms: rateLimitResult.windowMs,
        retry_after: rateLimitResult.retryAfter,
        request_id: requestId,
      }))
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.RATE_LIMIT_EXCEEDED.defaultMessage,
        'RATE_LIMIT_EXCEEDED',
        {
          requestId,
          statusCode: 429,
          retry_after_seconds: rateLimitResult.retryAfter,
          details: {
            limit: rateLimitResult.limit,
            window: '1 hour',
            resetAt: rateLimitResult.resetAt,
          },
        }
      )
      logApiError(429, 'RATE_LIMIT_EXCEEDED', errorId, requestId, userData.organization_id, response.message, {
        category: 'internal',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 429,
        headers: {
          'X-Request-ID': requestId,
          'X-Error-ID': errorId,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      })
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
        'X-Request-ID': requestId,
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetAt),
      },
    })
  } catch (error: any) {
    console.error('[reports] PDF generation failed:', error)
    const requestId = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      API_ERROR_CODES.PDF_GENERATION_ERROR.defaultMessage,
      'PDF_GENERATION_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message ?? String(error) } : undefined,
      }
    )
    logApiError(500, 'PDF_GENERATION_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal',
      severity: 'error',
      route: ROUTE,
      details: { detail: error?.message ?? String(error) },
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

