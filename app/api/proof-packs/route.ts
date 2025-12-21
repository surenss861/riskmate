import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { generateLedgerExportPDF } from '@/lib/utils/pdf/ledgerExport'
import { randomUUID } from 'crypto'
import archiver from 'archiver'

export const runtime = 'nodejs'

/**
 * POST /api/proof-packs
 * Generates a proof pack (ZIP with PDF, CSVs) for insurance/client delivery
 * Includes completed work records, controls, evidence, attestations
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    
    const body = await request.json()
    const {
      time_range = '30d',
      site_ids, // Optional array of site IDs
      include_evidence = true,
      include_signoffs = true,
      include_controls = true,
      format = ['pdf', 'zip'], // Array of formats to include
    } = body

    const supabase = await createSupabaseServerClient()

    // Get user and org info
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

    // Query completed work records (insurance-ready = completed)
    let jobsQuery = supabase
      .from('jobs')
      .select('id, client_name, status, risk_score, created_at, updated_at, site_id')
      .eq('organization_id', organization_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })

    // Site filter
    if (site_ids && Array.isArray(site_ids) && site_ids.length > 0) {
      jobsQuery = jobsQuery.in('site_id', site_ids)
    }

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
      console.error('[proof-packs] Jobs query error:', jobsError)
      return NextResponse.json(
        { ok: false, message: 'Failed to fetch work records', code: 'QUERY_ERROR' },
        { status: 500 }
      )
    }

    const packId = randomUUID()

    // If only JSON requested, return early
    if (format.includes('json') && !format.includes('zip') && !format.includes('pdf')) {
      // Return JSON data directly
      const enrichedData = await Promise.all(
        (jobs || []).map(async (job: any) => {
          const controls = include_controls ? await supabase
            .from('mitigation_items')
            .select('*')
            .eq('job_id', job.id) : { data: null }
          
          const attestations = include_signoffs ? await supabase
            .from('job_signoffs')
            .select('*')
            .eq('job_id', job.id) : { data: null }
          
          const evidence = include_evidence ? await supabase
            .from('job_documents')
            .select('id, file_name, file_type, uploaded_at')
            .eq('job_id', job.id) : { data: null }

          return {
            work_record: job,
            controls: controls.data || [],
            attestations: attestations.data || [],
            evidence: evidence.data || [],
          }
        })
      )

      return NextResponse.json({
        ok: true,
        pack_id: packId,
        data: enrichedData,
        count: enrichedData.length,
        generated_at: new Date().toISOString(),
      })
    }

    // Generate ZIP with PDF and CSVs
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('error', (err) => {
      console.error('[proof-packs] Archive error:', err)
      throw err
    })

    // Generate PDF summary
    if (format.includes('pdf') || format.includes('zip')) {
      try {
        // Get audit events for these jobs
        const jobIds = (jobs || []).map((j: any) => j.id)
        const { data: events } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('organization_id', organization_id)
          .in('work_record_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(1000)

        const enrichedEvents = (events || []).map((e: any) => ({
          id: e.id,
          event_name: e.event_name || e.event_type,
          created_at: e.created_at,
          category: e.category || 'operations',
          outcome: e.outcome || 'allowed',
          severity: e.severity || 'info',
          actor_name: e.actor_email || 'System',
          actor_role: e.actor_role || '',
          work_record_id: e.work_record_id,
          job_id: e.work_record_id,
          target_type: e.target_type,
          summary: e.summary,
        }))

        const pdfBuffer = await generateLedgerExportPDF({
          organizationName: orgData?.name || 'Unknown',
          generatedBy: userData?.full_name || userData?.email || 'Unknown',
          generatedByRole: userData?.role || 'Unknown',
          exportId: packId,
          timeRange: time_range || 'All',
          filters: { site_ids },
          events: enrichedEvents,
        })

        archive.append(pdfBuffer, { name: `proof-pack-summary-${packId.slice(0, 8)}.pdf` })
      } catch (err) {
        console.error('[proof-packs] PDF generation error:', err)
      }
    }

    // Generate controls CSV
    if (include_controls) {
      try {
        const jobIds = (jobs || []).map((j: any) => j.id)
        const { data: controls } = await supabase
          .from('mitigation_items')
          .select('id, job_id, title, description, done, is_completed, due_date, owner_id')
          .in('job_id', jobIds)

        const headers = ['ID', 'Work Record ID', 'Title', 'Status', 'Due Date', 'Owner ID']
        const rows = (controls || []).map((c: any) => [
          c.id,
          c.job_id,
          c.title,
          (c.done || c.is_completed) ? 'Completed' : 'Pending',
          c.due_date || '',
          c.owner_id || '',
        ])

        const csv = [
          headers.join(','),
          ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n')

        archive.append(Buffer.from(csv, 'utf-8'), { name: `controls-${packId.slice(0, 8)}.csv` })
      } catch (err) {
        console.error('[proof-packs] Controls CSV error:', err)
      }
    }

    // Generate attestations CSV
    if (include_signoffs) {
      try {
        const jobIds = (jobs || []).map((j: any) => j.id)
        const { data: signoffs } = await supabase
          .from('job_signoffs')
          .select('id, job_id, signoff_type, signed_at, user_id')
          .in('job_id', jobIds)

        const headers = ['ID', 'Work Record ID', 'Type', 'Signed At', 'User ID']
        const rows = (signoffs || []).map((s: any) => [
          s.id,
          s.job_id,
          s.signoff_type,
          s.signed_at || '',
          s.user_id || '',
        ])

        const csv = [
          headers.join(','),
          ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n')

        archive.append(Buffer.from(csv, 'utf-8'), { name: `attestations-${packId.slice(0, 8)}.csv` })
      } catch (err) {
        console.error('[proof-packs] Attestations CSV error:', err)
      }
    }

    // Create manifest
    const manifest = {
      pack_id: packId,
      generated_at: new Date().toISOString(),
      generated_by: {
        user_id: user_id,
        email: userData?.email || 'Unknown',
        role: userData?.role || 'Unknown',
      },
      filters: {
        time_range,
        site_ids: site_ids || null,
      },
      counts: {
        work_records: jobs?.length || 0,
      },
    }

    archive.append(JSON.stringify(manifest, null, 2), { name: `manifest-${packId.slice(0, 8)}.json` })

    // Finalize archive
    await archive.finalize()

    // Wait for archive to complete
    const zipBuffer = Buffer.concat(chunks)

    // Log pack generation
    await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'export.proof_pack.generated',
      targetType: 'system',
      targetId: packId,
      metadata: {
        pack_id: packId,
        time_range,
        site_ids: site_ids || null,
        include_evidence,
        include_signoffs,
        include_controls,
        work_record_count: jobs?.length || 0,
        generated_at: new Date().toISOString(),
        summary: `Proof pack generated (${jobs?.length || 0} work records)`,
      },
    })

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="proof-pack-${packId.slice(0, 8)}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('[proof-packs] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to generate proof pack',
        code: 'PROOF_PACK_ERROR',
      },
      { status: 500 }
    )
  }
}

