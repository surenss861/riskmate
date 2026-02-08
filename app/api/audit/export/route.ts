import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { handleApiError, API_ERROR_CODES } from '@/lib/utils/apiErrors'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/utils/rateLimiter'
import { generateLedgerExportPDF } from '@/lib/utils/pdf/ledgerExport'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/audit/export
 * Export audit ledger as PDF
 * Queries Supabase directly and generates PDF using pdfkit
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    let user_id: string
    try {
      const context = await getOrganizationContext(request)
      organization_id = context.organization_id
      user_id = context.user_id
    } catch (authError: any) {
      console.error('[audit/export] Auth error:', {
        message: authError.message,
        requestId,
      })
      const errorResponse = createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED.defaultMessage,
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Rate limit: 10 exports per hour per org
    const rateLimitResult = checkRateLimit(request, RATE_LIMIT_PRESETS.export, {
      organization_id,
      user_id,
    })
    if (!rateLimitResult.allowed) {
      console.log(JSON.stringify({
        event: 'rate_limit_exceeded',
        organization_id,
        user_id,
        endpoint: request.nextUrl?.pathname,
        limit: rateLimitResult.limit,
        window_ms: rateLimitResult.windowMs,
        retry_after: rateLimitResult.retryAfter,
        request_id: requestId,
      }))
      const errorResponse = createErrorResponse(
        API_ERROR_CODES.RATE_LIMIT_EXCEEDED.defaultMessage,
        'RATE_LIMIT_EXCEEDED',
        {
          requestId,
          statusCode: 429,
          retryable: true,
          retry_after_seconds: rateLimitResult.retryAfter,
          details: {
            limit: rateLimitResult.limit,
            window: '1 hour',
            resetAt: rateLimitResult.resetAt,
          },
        }
      )
      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'X-Request-ID': requestId,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      })
    }

    const body = await request.json()
    
    const {
      category,
      site_id,
      job_id,
      actor_id,
      severity,
      outcome,
      time_range = '30d',
      start_date,
      end_date,
      view,
    } = body

    const supabase = await createSupabaseServerClient()

    // Get user and org info for PDF header
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email, role')
      .eq('id', user_id)
      .single()

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single()

    // Build query (same logic as events endpoint)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })

    // Apply saved view filters
    if (view) {
      if (view === 'review-queue') {
        query = query.eq('outcome', 'blocked')
      } else if (view === 'insurance-ready') {
        query = query
          .eq('category', 'operations')
          .in('event_name', ['job.completed', 'control.verified', 'evidence.uploaded', 'attestation.created'])
      } else if (view === 'governance-enforcement') {
        query = query.or('category.eq.governance,outcome.eq.blocked')
      } else if (view === 'incident-review') {
        query = query.eq('category', 'incident_review')
      } else if (view === 'access-review') {
        query = query.eq('category', 'access_review')
      }
    } else if (category) {
      query = query.eq('category', category)
    }

    // Apply other filters
    if (site_id) query = query.eq('site_id', site_id)
    if (job_id) query = query.eq('work_record_id', job_id)
    if (actor_id) query = query.eq('actor_id', actor_id)
    if (severity) query = query.eq('severity', severity)
    if (outcome) query = query.eq('outcome', outcome)

    // Time range filter
    if (time_range && time_range !== 'all') {
      if (time_range === 'custom' && start_date && end_date) {
        query = query.gte('created_at', start_date).lte('created_at', end_date)
      } else {
        const now = new Date()
        let cutoff = new Date()
        if (time_range === '24h') {
          cutoff.setHours(now.getHours() - 24)
        } else if (time_range === '7d') {
          cutoff.setDate(now.getDate() - 7)
        } else if (time_range === '30d') {
          cutoff.setDate(now.getDate() - 30)
        }
        query = query.gte('created_at', cutoff.toISOString())
      }
    }

    // Limit to reasonable number for PDF
    query = query.limit(500)

    const { data: events, error } = await query

    if (error) {
      console.error('[audit/export] Query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        requestId,
        organization_id,
      })

      if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
        const errorResponse = createErrorResponse(
          API_ERROR_CODES.RLS_RECURSION_ERROR.defaultMessage,
          'RLS_RECURSION_ERROR',
          {
            requestId,
            statusCode: 500,
            details: {
              databaseError: {
                code: error.code,
                message: error.message,
                hint: error.hint,
              },
            },
          }
        )
        return NextResponse.json(errorResponse, { 
          status: 500,
          headers: { 'X-Request-ID': requestId }
        })
      }

      const errorResponse = createErrorResponse(
        API_ERROR_CODES.QUERY_ERROR.defaultMessage,
        'QUERY_ERROR',
        {
          requestId,
          statusCode: 500,
          details: {
            databaseError: {
              code: error.code,
              message: error.message,
              hint: error.hint,
            },
          },
        }
      )
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Enrich events (same as events endpoint)
    const enrichedEvents = await Promise.all(
      (events || []).map(async (event: any) => {
        const enriched: any = { ...event }

        // Enrich actor info
        if (event.actor_id) {
          const { data: actorData } = await supabase
            .from('users')
            .select('full_name, role')
            .eq('id', event.actor_id)
            .single()
          if (actorData) {
            enriched.actor_name = actorData.full_name || 'Unknown'
            enriched.actor_role = actorData.role || 'member'
          }
        }

        // Enrich job info
        if (event.work_record_id || event.job_id) {
          const jobId = event.work_record_id || event.job_id
          const { data: jobData } = await supabase
            .from('jobs')
            .select('client_name, risk_score, review_flag')
            .eq('id', jobId)
            .single()
          if (jobData) {
            enriched.job_title = jobData.client_name
            enriched.job_risk_score = jobData.risk_score
            enriched.job_flagged = jobData.review_flag
          }
        }

        return enriched
      })
    )

    // Generate export ID
    const exportId = randomUUID()

    // Prepare events for PDF
    const auditEntries = enrichedEvents.map((e: any) => ({
      id: e.id,
      event_name: e.event_name || e.event_type,
      created_at: e.created_at,
      category: e.category || 'operations',
      outcome: e.outcome || 'allowed',
      severity: e.severity || 'info',
      actor_name: e.actor_name || 'System',
      actor_role: e.actor_role || '',
      work_record_id: e.work_record_id,
      job_id: e.job_id || e.work_record_id,
      job_title: e.job_title,
      target_type: e.target_type,
      summary: e.summary,
    }))

    // Generate PDF
    const pdfBuffer = await generateLedgerExportPDF({
      organizationName: orgData?.name || 'Unknown',
      generatedBy: userData?.full_name || userData?.email || 'Unknown',
      generatedByRole: userData?.role || 'Unknown',
      exportId,
      timeRange: time_range || 'All',
      filters: { category, site_id, job_id, severity, outcome },
      events: auditEntries,
    })

    // Return PDF as response (convert Buffer to Uint8Array, then to Blob for NextResponse)
    const filename = `compliance-ledger-export-${exportId.slice(0, 8)}.pdf`
    const uint8Array = new Uint8Array(pdfBuffer)
    const blob = new Blob([uint8Array], { type: 'application/pdf' })
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'X-Request-ID': requestId,
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetAt),
      },
    })
  } catch (error: unknown) {
    console.error('[audit/export] Unhandled error:', { requestId }, error)
    return handleApiError(error, requestId)
  }
}
