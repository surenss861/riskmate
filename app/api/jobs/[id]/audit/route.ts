import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { getOrgEntitlements, assertEntitled, EntitlementError } from '@/lib/entitlements'
import { logFeatureUsage } from '@/lib/featureLogging'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getRequestId } from '@/lib/featureEvents'

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

  // Get request ID from header or generate
  const requestId = request.headers.get('x-request-id') || getRequestId()

  try {
    await verifyJobOwnership(jobId, organization_id)

    // Get entitlements ONCE at request start (request-scoped snapshot)
    const entitlements = await getOrgEntitlements(organization_id)

    // Assert entitlement
    try {
      assertEntitled(entitlements, 'version_history')
    } catch (err) {
      if (err instanceof EntitlementError) {
        // Log denied attempt with standardized schema
        await logFeatureUsage({
          feature: 'version_history',
          action: 'denied',
          allowed: false,
          organizationId: organization_id,
          actorId: user_id,
          entitlements, // Pass snapshot (no re-fetch)
          source: 'api',
          requestId,
          resourceType: 'job',
          resourceId: jobId,
          reason: err.message,
          additionalMetadata: {
            job_id: jobId,
          },
          logUsage: false,
        })

        return NextResponse.json(
          {
            error: err.message,
            code: 'FEATURE_RESTRICTED',
            denial_code: entitlements.status === 'past_due' 
              ? 'SUBSCRIPTION_PAST_DUE'
              : entitlements.status === 'canceled' && entitlements.period_end && new Date(entitlements.period_end) < new Date()
              ? 'SUBSCRIPTION_CANCELED_PERIOD_ENDED'
              : 'PLAN_TIER_INSUFFICIENT',
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

    // Log successful access with standardized schema
    await logFeatureUsage({
      feature: 'version_history',
      action: 'accessed',
      allowed: true,
      organizationId: organization_id,
      actorId: user_id,
      entitlements, // Pass snapshot (no re-fetch)
      source: 'api',
      requestId,
      resourceType: 'job',
      resourceId: jobId,
      additionalMetadata: {
        job_id: jobId,
        entries_count: auditLogs?.length || 0,
      },
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

