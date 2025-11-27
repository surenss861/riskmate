import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { trackPlanView } from '@/lib/utils/trackPlan'

export const runtime = 'nodejs'

/**
 * POST /api/subscriptions/track-view
 * Tracks when a user views the plan change page
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { error: 'Failed to get organization ID' },
        { status: 500 }
      )
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

    // Track plan view
    await trackPlanView(userData.organization_id, user.id, currentPlan)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Plan view tracking error:', error)
    // Don't fail the request if tracking fails
    return NextResponse.json({ success: false })
  }
}

