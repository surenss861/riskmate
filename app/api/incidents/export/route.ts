import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * GET /api/incidents/export
 * Exports incident timeline + actions + evidence links
 */
export async function GET(request: NextRequest) {
  try {
    const { organization_id } = await getOrganizationContext()
    
    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json'
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()

    // Query incident-related events
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('category', 'incident_review')
      .order('created_at', { ascending: false })

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
      console.error('[incidents/export] Query error:', error)
      return NextResponse.json(
        { ok: false, message: 'Failed to fetch incident events', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    if (format === 'csv') {
      const headers = ['ID', 'Event Name', 'Work Record ID', 'Created At', 'Actor', 'Severity', 'Summary']
      const rows = (events || []).map((e: any) => [
        e.id,
        e.event_name || '',
        e.work_record_id || e.job_id || '',
        e.created_at || '',
        e.actor_email || '',
        e.severity || '',
        e.summary || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="incidents-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      data: events || [],
      count: events?.length || 0,
      exported_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[incidents/export] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to export incidents',
        code: 'EXPORT_ERROR',
      },
      { status: 500 }
    )
  }
}

