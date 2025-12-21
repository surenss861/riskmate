import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { generateLedgerExportPDF } from '@/lib/utils/pdf/ledgerExport'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

/**
 * GET /api/enforcement-reports/export
 * Exports enforcement events (blocked writes, violations, role changes)
 * Supports CSV, JSON, and PDF formats
 */
export async function GET(request: NextRequest) {
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    
    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json' // 'csv' | 'json' | 'pdf'
    const time_range = searchParams.get('time_range') || '30d'
    const categories = searchParams.get('categories')?.split(',') || ['governance']

    const supabase = await createSupabaseServerClient()

    // Get user and org info for PDF
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

    // Query enforcement events (governance category = blocked actions, violations)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .in('category', categories)
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
      console.error('[enforcement-reports/export] Query error:', error)
      return NextResponse.json(
        { ok: false, message: 'Failed to fetch enforcement events', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    // Enrich events
    const enrichedEvents = await Promise.all(
      (events || []).map(async (event: any) => {
        const enriched: any = { ...event }

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

        return enriched
      })
    )

    // Format response
    if (format === 'pdf') {
      const exportId = randomUUID()
      const auditEntries = enrichedEvents.map((e: any) => ({
        id: e.id,
        event_name: e.event_name || e.event_type,
        created_at: e.created_at,
        category: e.category || 'governance',
        outcome: e.outcome || 'blocked',
        severity: e.severity || 'material',
        actor_name: e.actor_name || 'System',
        actor_role: e.actor_role || '',
        work_record_id: e.work_record_id,
        job_id: e.job_id || e.work_record_id,
        target_type: e.target_type,
        summary: e.summary,
      }))

      const pdfBuffer = await generateLedgerExportPDF({
        organizationName: orgData?.name || 'Unknown',
        generatedBy: userData?.full_name || userData?.email || 'Unknown',
        generatedByRole: userData?.role || 'Unknown',
        exportId,
        timeRange: time_range || 'All',
        filters: { category: categories.join(',') },
        events: auditEntries,
      })

      const filename = `enforcement-report-${exportId.slice(0, 8)}.pdf`
      const uint8Array = new Uint8Array(pdfBuffer)
      const blob = new Blob([uint8Array], { type: 'application/pdf' })

      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      })
    }

    if (format === 'csv') {
      const headers = ['ID', 'Event Name', 'Category', 'Outcome', 'Severity', 'Created At', 'Actor', 'Summary']
      const rows = enrichedEvents.map((e: any) => [
        e.id,
        e.event_name || '',
        e.category || '',
        e.outcome || '',
        e.severity || '',
        e.created_at || '',
        e.actor_name || e.actor_email || '',
        e.summary || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="enforcement-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      ok: true,
      data: enrichedEvents,
      count: enrichedEvents.length,
      exported_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[enforcement-reports/export] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to export enforcement report',
        code: 'EXPORT_ERROR',
      },
      { status: 500 }
    )
  }
}

