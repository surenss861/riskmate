import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { trackPlanView } from '@/lib/utils/trackPlan'

export const runtime = 'nodejs'

/**
 * POST /api/subscriptions/track-view
 * Tracks when a user views the plan change page
 * 
 * Auth is optional: if user is logged in, track with user/org context.
 * If anonymous, return 204 (no content) - tracking is best-effort only.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Optional auth: if no user, return 204 (success but no tracking)
    if (authError || !user) {
      // Anonymous view - don't track, but don't error either
      return new NextResponse(null, { status: 204 })
    }

    // User is authenticated - proceed with tracking
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      // User exists but can't get org - still return 204 (don't break the page)
      console.warn('Failed to get organization ID for plan view tracking:', userError)
      return new NextResponse(null, { status: 204 })
    }

    // Get current plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentPlan = subscription?.tier || null

    // Track plan view (best-effort - don't fail if tracking fails)
    try {
      await trackPlanView(userData.organization_id, user.id, currentPlan)
    } catch (trackError) {
      // Log but don't fail the request
      console.warn('Plan view tracking failed (non-blocking):', trackError)
    }

    // Return 204 No Content (success, no body needed)
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    // Catch-all: don't break the page if tracking fails
    console.error('Plan view tracking error (non-blocking):', error)
    return new NextResponse(null, { status: 204 })
  }
}
