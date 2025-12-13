import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { getOrgEntitlements, assertEntitled, EntitlementError } from '@/lib/entitlements'
import { logFeatureUsage } from '@/lib/featureLogging'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/jobs/[id]/audit
 * Get version history / audit log for a job
 * Business plan feature only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { organization_id, user_id } = await getOrganizationContext()
  const { id: jobId } = await params

  try {
    await verifyJobOwnership(jobId, organization_id)

    // Get entitlements
    const entitlements = await getOrgEntitlements(organization_id)

    // Assert entitlement
    try {
      assertEntitled(entitlements, 'version_history')
    } catch (err) {
      if (err instanceof EntitlementError) {
        // Log denied attempt
        await logFeatureUsage({
          feature: 'version_history',
          action: 'denied',
          allowed: false,
          organizationId: organization_id,
          actorId: user_id,
          metadata: {
            plan_tier: entitlements.tier,
            subscription_status: entitlements.status,
            period_end: entitlements.period_end,
            reason: `Feature requires Business plan (current: ${entitlements.tier}, status: ${entitlements.status})`,
            job_id: jobId,
          },
          targetType: 'job',
          targetId: jobId,
          logUsage: false,
        })

        return NextResponse.json(
          {
            error: err.message,
            code: 'FEATURE_RESTRICTED',
          },
          { status: 403 }
        )
      }
      throw err
    }

    // Fetch audit logs
    const supabase = await createSupabaseServerClient()
    const { data: auditLogs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .or(`target_id.eq.${jobId},metadata->>job_id.eq.${jobId}`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      throw error
    }

    // Log successful access
    await logFeatureUsage({
      feature: 'version_history',
      action: 'accessed',
      allowed: true,
      organizationId: organization_id,
      actorId: user_id,
      metadata: {
        plan_tier: entitlements.tier,
        subscription_status: entitlements.status,
        period_end: entitlements.period_end,
        job_id: jobId,
        entries_count: auditLogs?.length || 0,
      },
      targetType: 'job',
      targetId: jobId,
      logUsage: true,
    })

    return NextResponse.json({
      data: auditLogs || [],
    })
  } catch (error: any) {
    if (error instanceof EntitlementError) {
      throw error
    }

    console.error('Failed to fetch audit log:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch audit log',
        code: 'FETCH_FAILED',
      },
      { status: 500 }
    )
  }
}

