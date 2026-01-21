import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * POST /api/admin/billing-alerts/[id]/resolve
 * 
 * Marks a billing alert as resolved.
 * Requires authentication.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Use service role to update (bypasses RLS)
    const serviceSupabase = getServiceSupabase()
    const { error: updateError } = await serviceSupabase
      .from('billing_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', id)

    if (updateError) {
      console.error('[BillingAlerts] Failed to resolve alert:', updateError)
      return NextResponse.json(
        { error: 'Failed to resolve alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[BillingAlerts] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve alert' },
      { status: 500 }
    )
  }
}
