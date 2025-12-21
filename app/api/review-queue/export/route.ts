import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * GET /api/review-queue/export
 * Exports review queue items as CSV or JSON
 * Filter-based (no selection required)
 */
export async function GET(request: NextRequest) {
  try {
    let organization_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
    } catch (authError: any) {
      console.error('[review-queue/export] Auth error:', authError)
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized: Please log in to export data',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }
    
    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json' // 'csv' | 'json'
    const time_range = searchParams.get('time_range') || '30d'
    const category = searchParams.get('category')
    const severity = searchParams.get('severity')
    const outcome = searchParams.get('outcome')

    const supabase = await createSupabaseServerClient()

    // Build query for review queue (blocked/flagged items)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('outcome', 'blocked') // Review queue = blocked actions
      .order('created_at', { ascending: false })

    // Apply filters
    if (category) query = query.eq('category', category)
    if (severity) query = query.eq('severity', severity)
    if (outcome) query = query.eq('outcome', outcome)

    // Time range filter
    if (time_range !== 'all') {
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

    const { data: events, error } = await query

    if (error) {
      console.error('[review-queue/export] Query error:', error)
      return NextResponse.json(
        { ok: false, message: 'Failed to fetch review queue items', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    // Handle empty results gracefully
    const eventList = events || []

    // Format response
    if (format === 'csv') {
      // Generate CSV - always include headers even for empty results
      const headers = ['ID', 'Event Name', 'Category', 'Severity', 'Created At', 'Actor', 'Target Type', 'Target ID', 'Summary']
      const rows = eventList.map((e: any) => [
        e.id,
        e.event_name || '',
        e.category || '',
        e.severity || '',
        e.created_at || '',
        e.actor_email || e.actor_name || '',
        e.target_type || '',
        e.target_id || '',
        e.summary || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="review-queue-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      ok: true,
      data: eventList,
      count: eventList.length,
      exported_at: new Date().toISOString(),
      filters: {
        time_range,
        category,
        severity,
        outcome,
      },
    })
  } catch (error: any) {
    console.error('[review-queue/export] Error:', {
      message: error.message,
      stack: error.stack,
      organization_id: error.organization_id,
    })
    
    // Return consistent error format
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to export review queue',
        code: error.code || 'EXPORT_ERROR',
      },
      { status: error.statusCode || 500 }
    )
  }
}

