import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/refresh-analytics
 *
 * Refreshes analytics materialized views (analytics_weekly_job_stats, etc.).
 * For use when pg_cron is unavailable (e.g. Vercel + Supabase without pg_cron).
 * In production with pg_cron enabled (see migration 20260230100034), the MV is
 * refreshed hourly by the database; this route is an alternative trigger.
 *
 * Configure in vercel.json crons, e.g. schedule: "0 * * * *" (hourly).
 * Protected by CRON_SECRET (same as /api/cron/reconcile-subscriptions).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim() === '') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.rpc('refresh_analytics_weekly_job_stats')
    if (error) {
      console.warn('Analytics MV refresh failed:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.warn('Analytics MV refresh failed (transport/runtime):', e)
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}
