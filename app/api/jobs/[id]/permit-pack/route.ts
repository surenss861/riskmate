import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { generatePermitPack } from '@/lib/utils/permitPack'

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
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    const { id: jobId } = await params

    await verifyJobOwnership(jobId, organization_id)

    // Check if user has Business plan
    const supabase = await createSupabaseServerClient()
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const tier = subscription?.tier || 'starter'

    if (tier !== 'business') {
      return NextResponse.json(
        {
          error: 'Permit Pack Generator is only available for Business plan subscribers',
          code: 'FEATURE_RESTRICTED',
        },
        { status: 403 }
      )
    }

    // Generate permit pack
    const result = await generatePermitPack({
      jobId,
      organizationId: organization_id,
      userId: user_id,
    })

    // Log usage
    await supabase.from('usage_logs').insert({
      organization_id,
      item: 'permit_pack_generated',
      count: 1,
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

