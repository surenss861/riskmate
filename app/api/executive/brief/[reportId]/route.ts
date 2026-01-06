/**
 * GET /api/executive/brief/[reportId]
 * Verify report endpoint - returns report metadata and metrics snapshot
 * No PDF download, just verification data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Resolve organization context
    const orgContext = await resolveOrgContext(user)

    if (!orgContext) {
      return NextResponse.json(
        { message: 'Organization not found or access denied' },
        { status: 403 }
      )
    }

    // Verify executive role
    if (orgContext.role !== 'executive' && orgContext.role !== 'owner' && orgContext.role !== 'admin') {
      return NextResponse.json(
        { message: 'Executive access required' },
        { status: 403 }
      )
    }

    // Fetch report run (must belong to user's org)
    const { data: reportRun, error: reportError } = await supabase
      .from('report_runs')
      .select('*')
      .eq('id', reportId)
      .eq('organization_id', orgContext.orgId)
      .maybeSingle()

    if (reportError) {
      console.error('[executive/brief/:reportId] Error fetching report:', reportError)
      return NextResponse.json(
        { message: 'Failed to fetch report' },
        { status: 500 }
      )
    }

    if (!reportRun) {
      return NextResponse.json(
        { message: 'Report not found or access denied' },
        { status: 404 }
      )
    }

    // Return verification data (no PII, hashed IDs)
    return NextResponse.json({
      reportId: reportId.substring(0, 8), // Truncated for safety
      reportIdHash: hashId(reportId),
      organizationIdHash: hashId(orgContext.orgId),
      generatedByHash: hashId(reportRun.generated_by),
      generatedAt: reportRun.generated_at,
      completedAt: reportRun.completed_at,
      status: reportRun.status,
      timeRange: reportRun.time_range,
      buildSha: reportRun.build_sha,
      metricsSnapshot: reportRun.metrics_snapshot,
      metadata: reportRun.metadata,
      pdfHash: reportRun.completed_hash,
      // Verification flags
      verification: {
        orgMatches: reportRun.organization_id === orgContext.orgId,
        hasMetricsSnapshot: !!reportRun.metrics_snapshot,
        hasPdfHash: !!reportRun.completed_hash,
        isComplete: reportRun.status === 'ready_for_signatures' || reportRun.status === 'complete',
      },
    })
  } catch (error: any) {
    console.error('[executive/brief/:reportId] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

