import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { generatePermitPack } from '@/lib/utils/permitPack'
import { getOrgEntitlements, assertEntitled, EntitlementError } from '@/lib/entitlements'
import { logFeatureUsage } from '@/lib/featureLogging'
import { getRequestId } from '@/lib/featureEvents'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/[id]/permit-pack
 * Generate a comprehensive permit pack ZIP for a job
 * Business plan feature only
 */
export async function POST(
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
    // Never re-fetch mid-request to ensure consistency
    const entitlements = await getOrgEntitlements(organization_id)

    // Assert entitlement (throws EntitlementError if not allowed)
    try {
      assertEntitled(entitlements, 'permit_packs')
    } catch (err) {
      if (err instanceof EntitlementError) {
        // Log denied attempt with standardized schema
        await logFeatureUsage({
          feature: 'permit_packs',
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

    // Generate permit pack
    const result = await generatePermitPack({
      jobId,
      organizationId: organization_id,
      userId: user_id,
    })

    // Log successful usage with standardized schema
    await logFeatureUsage({
      feature: 'permit_packs',
      action: 'generated',
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
        file_size: result.size,
      },
      logUsage: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        filePath: result.filePath,
        size: result.size,
      },
    })
  } catch (error: any) {
    // Handle entitlement errors (already logged)
    if (error instanceof EntitlementError) {
      throw error
    }

    // Handle other errors
    console.error('Permit pack generation failed:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate permit pack',
        code: 'GENERATION_FAILED',
      },
      { status: 500 }
    )
  }
}

