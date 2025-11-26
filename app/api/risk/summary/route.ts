import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

    // Get jobs from last 30 days for this organization
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id')
      .eq('organization_id', organization_id)
      .gte('created_at', thirtyDaysAgo.toISOString())

    if (jobsError) throw jobsError

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ hazards: [] })
    }

    const jobIds = jobs.map((j) => j.id)

    // Get risk scores for these jobs
    const { data: riskScores, error: riskError } = await supabase
      .from('job_risk_scores')
      .select('factors')
      .in('job_id', jobIds)

    if (riskError) throw riskError

    // Aggregate hazard counts from risk factors
    const hazardCounts: Record<string, { count: number; severity: string; code: string }> = {}

    riskScores?.forEach((score: any) => {
      if (score.factors && Array.isArray(score.factors)) {
        score.factors.forEach((factor: any) => {
          const code = factor.code || factor.factor_id
          const name = factor.name || code
          const severity = factor.severity || 'medium'

          if (!hazardCounts[code]) {
            hazardCounts[code] = {
              count: 0,
              severity,
              code,
            }
          }
          hazardCounts[code].count += 1
        })
      }
    })

    // Get risk factor details for names
    const codes = Object.keys(hazardCounts)
    if (codes.length > 0) {
      const { data: riskFactors } = await supabase
        .from('risk_factors')
        .select('code, name, severity')
        .in('code', codes)

      // Map to final format
      const hazards = riskFactors
        ?.map((factor) => {
          const countInfo = hazardCounts[factor.code]
          if (!countInfo) return null
          return {
            code: factor.code,
            name: factor.name,
            count: countInfo.count,
            severity: factor.severity,
          }
        })
        .filter((h) => h !== null)
        .sort((a, b) => b!.count - a!.count)
        .slice(0, 3) || []

      return NextResponse.json({ hazards })
    }

    return NextResponse.json({ hazards: [] })
  } catch (error: any) {
    console.error('Error fetching risk summary:', error)
    return NextResponse.json(
      { message: 'Failed to fetch hazard summary' },
      { status: 500 }
    )
  }
}

