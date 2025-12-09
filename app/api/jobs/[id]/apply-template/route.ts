import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { calculateRiskScore, generateMitigationItems } from '@/lib/utils/riskScoring'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organization_id } = await getOrganizationContext()
    const { id: jobId } = await params
    const body = await request.json()

    const { hazard_ids, template_id, template_type, replace_existing } = body

    if (!hazard_ids || !Array.isArray(hazard_ids) || hazard_ids.length === 0) {
      return NextResponse.json(
        { message: 'hazard_ids array is required' },
        { status: 400 }
      )
    }

    // Verify job ownership
    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get current job risk factors
    const { data: currentRiskScore } = await supabase
      .from('job_risk_scores')
      .select('factors')
      .eq('job_id', jobId)
      .maybeSingle()

    const currentFactorCodes = currentRiskScore?.factors
      ? (currentRiskScore.factors as any[]).map((f: any) => f.code)
      : []

    // Get risk factors from hazard IDs
    const { data: riskFactors } = await supabase
      .from('risk_factors')
      .select('id, code')
      .in('id', hazard_ids)
      .eq('is_active', true)

    if (!riskFactors || riskFactors.length === 0) {
      return NextResponse.json(
        { message: 'No valid risk factors found' },
        { status: 400 }
      )
    }

    const newFactorCodes = riskFactors.map((rf) => rf.code)

    // Determine final factor codes
    let finalFactorCodes: string[]
    if (replace_existing) {
      finalFactorCodes = newFactorCodes
    } else {
      // Append, avoiding duplicates
      finalFactorCodes = [...new Set([...currentFactorCodes, ...newFactorCodes])]
    }

    // Recalculate risk score
    const riskScoreResult = await calculateRiskScore(finalFactorCodes)

    // Update or create risk score
    const { data: existingRiskScore } = await supabase
      .from('job_risk_scores')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    if (existingRiskScore) {
      await supabase
        .from('job_risk_scores')
        .update({
          overall_score: riskScoreResult.overall_score,
          risk_level: riskScoreResult.risk_level,
          factors: riskScoreResult.factors,
        })
        .eq('id', existingRiskScore.id)
    } else {
      await supabase.from('job_risk_scores').insert({
        job_id: jobId,
        overall_score: riskScoreResult.overall_score,
        risk_level: riskScoreResult.risk_level,
        factors: riskScoreResult.factors,
      })
    }

    // Update job with new risk score and template tracking
    await supabase
      .from('jobs')
      .update({
        risk_score: riskScoreResult.overall_score,
        risk_level: riskScoreResult.risk_level,
        applied_template_id: template_id || null,
        applied_template_type: template_type || null,
      })
      .eq('id', jobId)

    // Generate new mitigation items if needed
    // Delete old ones if replacing
    if (replace_existing) {
      await supabase.from('mitigation_items').delete().eq('job_id', jobId)
    }

    // Generate mitigation items for new factors
    const newFactorsForMitigation = replace_existing
      ? finalFactorCodes
      : newFactorCodes.filter((code) => !currentFactorCodes.includes(code))

    if (newFactorsForMitigation.length > 0) {
      await generateMitigationItems(jobId, newFactorsForMitigation)
    }

    // Create audit log entry
    await supabase.from('audit_logs').insert({
      organization_id,
      user_id: user.id,
      actor_name: user.email || 'Unknown',
      event_name: 'template.applied',
      target_type: 'job',
      target_id: jobId,
      metadata: {
        template_id,
        template_type,
        hazard_count: hazard_ids.length,
        replace_existing,
      },
    })

    // Fetch updated job data
    const { data: updatedJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    const { data: updatedRiskScore } = await supabase
      .from('job_risk_scores')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    const { data: updatedMitigations } = await supabase
      .from('mitigation_items')
      .select('id, title, description, done, is_completed, completed_at, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      data: {
        ...updatedJob,
        risk_score_detail: updatedRiskScore || null,
        mitigation_items: updatedMitigations || [],
      },
    })
  } catch (error: any) {
    console.error('Apply template failed:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to apply template' },
      { status: 500 }
    )
  }
}

