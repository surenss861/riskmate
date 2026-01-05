import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/executive/risk-posture
 * Returns risk posture metrics for executive dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData?.organization_id) {
      return NextResponse.json(
        { message: 'Organization not found' },
        { status: 403 }
      )
    }

    // Calculate date range
    const rangeDays = time_range === '90d' ? 90 : time_range === 'all' ? 365 : 30
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - rangeDays)
    sinceDate.setHours(0, 0, 0, 0)

    // Get jobs with risk scores
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, risk_score, created_at')
      .eq('organization_id', userData.organization_id)
      .gte('created_at', sinceDate.toISOString())
      .not('risk_score', 'is', null)

    if (jobsError) {
      console.error('[executive/risk-posture] Error fetching jobs:', jobsError)
      return NextResponse.json(
        { message: 'Failed to fetch risk data', error: jobsError.message },
        { status: 500 }
      )
    }

    const jobsWithScores = jobs || []
    const totalJobs = jobsWithScores.length

    // Calculate posture score (average of risk scores, inverted: higher score = better posture)
    const avgRiskScore = totalJobs > 0
      ? jobsWithScores.reduce((sum, job) => sum + (job.risk_score || 0), 0) / totalJobs
      : 0
    
    // Invert: 100 - avgRiskScore = posture score (lower risk = higher posture)
    const posture_score = Math.round(100 - avgRiskScore)

    // Categorize by risk level
    const buckets = {
      high: jobsWithScores.filter(j => (j.risk_score || 0) >= 70).length,
      medium: jobsWithScores.filter(j => (j.risk_score || 0) >= 40 && (j.risk_score || 0) < 70).length,
      low: jobsWithScores.filter(j => (j.risk_score || 0) < 40).length,
    }

    // Generate time series (group by day, calculate average posture for each day)
    const seriesMap = new Map<string, number[]>()
    jobsWithScores.forEach(job => {
      const dateKey = new Date(job.created_at).toISOString().split('T')[0]
      if (!seriesMap.has(dateKey)) {
        seriesMap.set(dateKey, [])
      }
      seriesMap.get(dateKey)!.push(job.risk_score || 0)
    })

    const series = Array.from(seriesMap.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round(100 - (scores.reduce((sum, s) => sum + s, 0) / scores.length)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate delta (compare first half vs second half of period)
    const midpoint = Math.floor(series.length / 2)
    const firstHalfAvg = midpoint > 0
      ? series.slice(0, midpoint).reduce((sum, s) => sum + s.score, 0) / midpoint
      : posture_score
    const secondHalfAvg = series.length > midpoint
      ? series.slice(midpoint).reduce((sum, s) => sum + s.score, 0) / (series.length - midpoint)
      : posture_score
    const delta = Math.round(secondHalfAvg - firstHalfAvg)

    return NextResponse.json({
      time_range,
      posture_score,
      delta,
      buckets: [
        { label: 'High', count: buckets.high },
        { label: 'Medium', count: buckets.medium },
        { label: 'Low', count: buckets.low },
      ],
      series: series.length > 0 ? series : [
        { date: new Date().toISOString().split('T')[0], score: posture_score },
      ],
    })
  } catch (error: any) {
    console.error('[executive/risk-posture] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

