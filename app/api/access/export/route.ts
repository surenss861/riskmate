import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * GET /api/access/export
 * Exports access change log (role changes, grants, revokes, logins)
 */
export async function GET(request: NextRequest) {
  try {
    let organization_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
    } catch (authError: any) {
      console.error('[access/export] Auth error:', authError)
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
    const format = searchParams.get('format') || 'json'
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()

    // Query access-related events
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('category', 'access_review')
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
      console.error('[access/export] Query error:', error)
      return NextResponse.json(
        { ok: false, message: 'Failed to fetch access events', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    if (format === 'csv') {
      const headers = ['ID', 'Event Name', 'Created At', 'Actor', 'Target User', 'Action', 'Summary']
      const rows = (events || []).map((e: any) => [
        e.id,
        e.event_name || '',
        e.created_at || '',
        e.actor_email || '',
        e.metadata?.target_user_name || '',
        e.metadata?.action || '',
        e.summary || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="access-export-${new Date().toISOString().split('T')[0]}.csv"`,
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
    console.error('[access/export] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to export access log',
        code: 'EXPORT_ERROR',
      },
      { status: 500 }
    )
  }
}

