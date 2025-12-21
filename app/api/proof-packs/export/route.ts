import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * GET /api/proof-packs/export
 * Exports insurance-ready dataset (completed work records + controls + evidence metadata)
 */
export async function GET(request: NextRequest) {
  try {
    let organization_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
    } catch (authError: any) {
      console.error('[proof-packs/export] Auth error:', authError)
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

    // Query completed work records with controls and attestations
    // Insurance-ready = completed jobs with verified controls
    let jobsQuery = supabase
      .from('jobs')
      .select('id, client_name, status, risk_score, created_at, updated_at')
      .eq('organization_id', organization_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })

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
      jobsQuery = jobsQuery.gte('updated_at', cutoff.toISOString())
    }

    const { data: jobs, error: jobsError } = await jobsQuery.limit(500)

    if (jobsError) {
      console.error('[proof-packs/export] Jobs query error:', jobsError)
      return NextResponse.json(
        { ok: false, message: 'Failed to fetch work records', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    // For each job, get controls and attestations
    const enrichedData = await Promise.all(
      (jobs || []).map(async (job: any) => {
        // Get controls
        const { data: controls } = await supabase
          .from('mitigation_items')
          .select('id, title, done, is_completed, due_date')
          .eq('job_id', job.id)

        // Get attestations
        const { data: attestations } = await supabase
          .from('job_signoffs')
          .select('id, signoff_type, signed_at, user_id')
          .eq('job_id', job.id)

        // Get evidence count
        const { count: evidenceCount } = await supabase
          .from('job_documents')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', job.id)

        return {
          work_record: {
            id: job.id,
            client_name: job.client_name,
            status: job.status,
            risk_score: job.risk_score,
            completed_at: job.updated_at,
          },
          controls: {
            total: controls?.length || 0,
            completed: controls?.filter((c: any) => c.done || c.is_completed).length || 0,
            items: controls || [],
          },
          attestations: {
            total: attestations?.length || 0,
            items: attestations || [],
          },
          evidence: {
            count: evidenceCount || 0,
          },
        }
      })
    )

    if (format === 'csv') {
      const headers = ['Work Record ID', 'Client Name', 'Completed At', 'Risk Score', 'Controls Total', 'Controls Completed', 'Attestations', 'Evidence Count']
      const rows = enrichedData.map((item: any) => [
        item.work_record.id,
        item.work_record.client_name,
        item.work_record.completed_at,
        item.work_record.risk_score || '',
        item.controls.total,
        item.controls.completed,
        item.attestations.total,
        item.evidence.count,
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="proof-pack-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      ok: true,
      data: enrichedData,
      count: enrichedData.length,
      exported_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[proof-packs/export] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to export proof pack',
        code: 'EXPORT_ERROR',
      },
      { status: 500 }
    )
  }
}

