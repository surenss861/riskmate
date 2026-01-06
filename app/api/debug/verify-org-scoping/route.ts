/**
 * GET /api/debug/verify-org-scoping
 * Verification endpoint to test org isolation
 * Gated to admin/owner/executive roles only
 * 
 * This endpoint helps verify that:
 * 1. Org resolution is consistent
 * 2. Queries are properly scoped to organization_id
 * 3. RLS policies allow data access for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized', error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Resolve organization context
    const orgContext = await resolveOrgContext(user)

    if (!orgContext) {
      return NextResponse.json(
        { 
          message: 'Organization not found',
          userIdHash: hashId(user.id),
          hasOrg: false,
        },
        { status: 403 }
      )
    }

    // Verify admin/owner/executive role
    if (orgContext.role !== 'executive' && orgContext.role !== 'owner' && orgContext.role !== 'admin') {
      return NextResponse.json(
        { 
          message: 'Access denied',
          userIdHash: hashId(user.id),
          role: orgContext.role,
        },
        { status: 403 }
      )
    }

    // Test org-scoped queries on key tables
    const verificationResults: Record<string, any> = {}

    // 1. Jobs table
    const { data: jobs, count: jobsCount, error: jobsError } = await supabase
      .from('jobs')
      .select('id, risk_score, risk_level, organization_id', { count: 'exact' })
      .eq('organization_id', orgContext.orgId)
      .is('deleted_at', null)
      .limit(5)

    verificationResults.jobs = {
      count: jobsCount || 0,
      sampleCount: jobs?.length || 0,
      hasError: !!jobsError,
      error: jobsError?.message,
      allScopedCorrectly: jobs?.every(j => j.organization_id === orgContext.orgId) ?? true,
      // Check for any jobs with wrong org_id (should be 0)
      wrongOrgCount: jobs?.filter(j => j.organization_id !== orgContext.orgId).length || 0,
    }

    // 2. Incidents table
    const { data: incidents, count: incidentsCount, error: incidentsError } = await supabase
      .from('incidents')
      .select('id, organization_id', { count: 'exact' })
      .eq('organization_id', orgContext.orgId)
      .limit(5)

    verificationResults.incidents = {
      count: incidentsCount || 0,
      sampleCount: incidents?.length || 0,
      hasError: !!incidentsError,
      error: incidentsError?.message,
      allScopedCorrectly: incidents?.every(i => i.organization_id === orgContext.orgId) ?? true,
      wrongOrgCount: incidents?.filter(i => i.organization_id !== orgContext.orgId).length || 0,
    }

    // 3. Report runs table
    const { data: reportRuns, count: runsCount, error: runsError } = await supabase
      .from('report_runs')
      .select('id, organization_id', { count: 'exact' })
      .eq('organization_id', orgContext.orgId)
      .limit(5)

    verificationResults.reportRuns = {
      count: runsCount || 0,
      sampleCount: reportRuns?.length || 0,
      hasError: !!runsError,
      error: runsError?.message,
      allScopedCorrectly: reportRuns?.every(r => r.organization_id === orgContext.orgId) ?? true,
      wrongOrgCount: reportRuns?.filter(r => r.organization_id !== orgContext.orgId).length || 0,
    }

    // 4. Check if organization exists and has name
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgContext.orgId)
      .maybeSingle()

    verificationResults.organization = {
      exists: !!org,
      hasName: !!(org?.name && org.name.trim() !== ''),
      name: org?.name || null,
      nameIsValid: org?.name && org.name.trim() !== '' && !org.name.includes("'s Organization"), // Heuristic for email-based names
      error: orgError?.message,
    }

    // Summary
    const allQueriesWork = !verificationResults.jobs.hasError && 
                          !verificationResults.incidents.hasError && 
                          !verificationResults.reportRuns.hasError

    const allDataScopedCorrectly = verificationResults.jobs.allScopedCorrectly &&
                                   verificationResults.incidents.allScopedCorrectly &&
                                   verificationResults.reportRuns.allScopedCorrectly

    const hasDataLeakage = verificationResults.jobs.wrongOrgCount > 0 ||
                           verificationResults.incidents.wrongOrgCount > 0 ||
                           verificationResults.reportRuns.wrongOrgCount > 0

    return NextResponse.json({
      message: 'Verification complete',
      orgContext: {
        orgIdHash: hashId(orgContext.orgId),
        orgName: orgContext.orgName,
        role: orgContext.role,
        resolvedFrom: orgContext.resolvedFrom,
      },
      verification: verificationResults,
      summary: {
        allQueriesWork,
        allDataScopedCorrectly,
        hasDataLeakage,
        orgNameIsValid: verificationResults.organization.nameIsValid,
        recommendations: [
          ...(hasDataLeakage ? ['⚠️ Data leakage detected: Some rows have wrong organization_id'] : []),
          ...(!verificationResults.organization.nameIsValid ? ['⚠️ Org name appears to be email-based or invalid'] : []),
          ...(!allQueriesWork ? ['⚠️ Some queries failed - check RLS policies or table structure'] : []),
          ...(allQueriesWork && allDataScopedCorrectly && !hasDataLeakage ? ['✅ All checks passed'] : []),
        ],
      },
    })
  } catch (error: any) {
    console.error('[debug/verify-org-scoping] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

