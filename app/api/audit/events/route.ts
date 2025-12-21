import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * GET /api/audit/events
 * Returns filtered, enriched audit events with stats
 * Queries Supabase directly (no backend proxy needed)
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    let user_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
      user_id = context.user_id
    } catch (authError: any) {
      console.error('[audit/events] Auth error:', {
        message: authError.message,
        requestId,
      })
      const errorResponse = createErrorResponse(
        'Unauthorized: Please log in to view audit events',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      })
    }
    
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category')
    const site_id = searchParams.get('site_id')
    const job_id = searchParams.get('job_id')
    const actor_id = searchParams.get('actor_id')
    const severity = searchParams.get('severity')
    const outcome = searchParams.get('outcome')
    const time_range = searchParams.get('time_range') || '30d'
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const view = searchParams.get('view') // saved view preset
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const supabase = await createSupabaseServerClient()

    // Build base query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
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
      // Only apply category if no view is set
      query = query.eq('category', category)
    }

    // Apply other filters
    if (site_id) {
      query = query.eq('site_id', site_id)
    }
    if (job_id) {
      query = query.eq('work_record_id', job_id)
    }
    if (actor_id) {
      query = query.eq('actor_id', actor_id)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }
    if (outcome) {
      query = query.eq('outcome', outcome)
    }

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

    // Cursor pagination
    if (cursor) {
      query = query.lt('created_at', cursor)
    }
    query = query.limit(limit)

    const { data, error, count } = await query

    if (error) {
      console.error('[audit/events] Supabase query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        requestId,
        organization_id,
      })

      if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
        const errorResponse = createErrorResponse(
          'Database policy recursion detected. This indicates a configuration issue with row-level security policies.',
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
        'Failed to fetch audit events',
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

    // Enrich events server-side
    const enrichedEvents = await Promise.all(
      (data || []).map(async (event: any) => {
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

        // Enrich site info
        if (event.site_id) {
          const { data: siteData } = await supabase
            .from('sites')
            .select('name')
            .eq('id', event.site_id)
            .single()
          if (siteData) {
            enriched.site_name = siteData.name
          }
        }

        return enriched
      })
    )

    // Calculate stats from filtered dataset
    const stats = {
      total: count || 0,
      violations: enrichedEvents.filter(e => e.category === 'governance' && e.outcome === 'blocked').length,
      jobs_touched: new Set(enrichedEvents.filter(e => e.work_record_id || e.job_id).map(e => e.work_record_id || e.job_id)).size,
      proof_packs: enrichedEvents.filter(e => e.event_name?.includes('proof_pack')).length,
      signoffs: enrichedEvents.filter(e => e.event_name?.includes('signoff')).length,
      access_changes: enrichedEvents.filter(e => e.category === 'access').length,
    }

    // Get next cursor
    const nextCursor = enrichedEvents.length > 0 
      ? enrichedEvents[enrichedEvents.length - 1].created_at 
      : null

    const successResponse = createSuccessResponse({
      events: enrichedEvents,
      stats,
      pagination: {
        next_cursor: nextCursor,
        limit,
        has_more: enrichedEvents.length === limit,
      },
    }, { requestId })

    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[audit/events] Unhandled error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    
    const errorResponse = createErrorResponse(
      error.message || 'Failed to fetch audit events',
      'AUDIT_QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
      }
    )
    
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: { 'X-Request-ID': requestId }
    })
  }
}
