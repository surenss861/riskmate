import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { calculateRiskScore, generateMitigationItems } from '@/lib/utils/riskScoring'
import { getOrgEntitlements } from '@/lib/entitlements'
import { logFeatureUsage } from '@/lib/featureLogging'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organization_id = userData.organization_id
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status')
    const risk_level = searchParams.get('risk_level')

    const offset = (page - 1) * limit

    let query = supabase
      .from('jobs')
      .select('id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (risk_level) {
      query = query.eq('risk_level', risk_level)
    }

    const { data: jobs, error } = await query

    if (error) throw error

    // Get total count for pagination
    let countQuery = supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    if (risk_level) {
      countQuery = countQuery.eq('risk_level', risk_level)
    }

    const { count, error: countError } = await countQuery

    if (countError) throw countError

    return NextResponse.json({
      data: jobs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Jobs fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organization_id = userData.organization_id
    const userId = user.id
    const body = await request.json()

    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      risk_factor_codes = [],
      has_subcontractors = false,
      subcontractor_count = 0,
      insurance_status = 'pending',
      applied_template_id,
      applied_template_type,
    } = body

    // Validate required fields
    if (!client_name || !client_type || !job_type || !location) {
      return NextResponse.json(
        { message: 'Missing required fields: client_name, client_type, job_type, location' },
        { status: 400 }
      )
    }

    // Check subscription limits using entitlements system
    const entitlements = await getOrgEntitlements(organization_id)

    // Check job creation limit
    if (entitlements.jobs_monthly_limit !== null) {
      // Get period start from subscription or default to current month
      const periodStart = entitlements.period_end
        ? new Date(new Date(entitlements.period_end).getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days before period end
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
        .gte('created_at', periodStart.toISOString())

      if ((count || 0) >= entitlements.jobs_monthly_limit) {
        // Log denied attempt
        await logFeatureUsage({
          feature: 'job_creation',
          action: 'denied',
          allowed: false,
          organizationId: organization_id,
          actorId: userId,
          metadata: {
            plan_tier: entitlements.tier,
            subscription_status: entitlements.status,
            period_end: entitlements.period_end,
            reason: `Job limit reached (${entitlements.jobs_monthly_limit} jobs/month on ${entitlements.tier} plan)`,
            current_count: count || 0,
            limit: entitlements.jobs_monthly_limit,
          },
          logUsage: false,
        })

        return NextResponse.json(
          {
            code: 'JOB_LIMIT',
            message: `${entitlements.tier === 'starter' ? 'Starter' : 'Plan'} limit reached (${entitlements.jobs_monthly_limit} jobs/month). Upgrade to Pro for unlimited jobs.`,
          },
          { status: 403 }
        )
      }
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        organization_id,
        created_by: userId,
        client_name,
        client_type,
        job_type,
        location,
        description,
        start_date: start_date || null,
        end_date: end_date || null,
        status: 'draft',
        has_subcontractors,
        subcontractor_count,
        insurance_status,
        applied_template_id: applied_template_id || null,
        applied_template_type: applied_template_type || null,
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job creation failed:', jobError)
      return NextResponse.json(
        { message: 'Failed to create job' },
        { status: 500 }
      )
    }

    // Calculate risk score if risk factors provided
    let riskScoreResult = null
    if (risk_factor_codes && risk_factor_codes.length > 0) {
      try {
        riskScoreResult = await calculateRiskScore(risk_factor_codes)

        // Save risk score
        await supabase.from('job_risk_scores').insert({
          job_id: job.id,
          overall_score: riskScoreResult.overall_score,
          risk_level: riskScoreResult.risk_level,
          factors: riskScoreResult.factors,
        })

        // Update job with risk score
        await supabase
          .from('jobs')
          .update({
            risk_score: riskScoreResult.overall_score,
            risk_level: riskScoreResult.risk_level,
          })
          .eq('id', job.id)

        // Generate mitigation items
        await generateMitigationItems(job.id, risk_factor_codes)
      } catch (riskError: any) {
        console.error('Risk scoring failed:', riskError)
        // Continue without risk score - job is still created
      }
    }

    // Fetch complete job with risk details
    const { data: completeJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job.id)
      .single()

    const { data: mitigationItems } = await supabase
      .from('mitigation_items')
      .select('id, title, description, done, is_completed')
      .eq('job_id', job.id)

    return NextResponse.json(
      {
        data: {
          ...completeJob,
          risk_score_detail: riskScoreResult,
          mitigation_items: mitigationItems || [],
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create job' },
      { status: 500 }
    )
  }
}

