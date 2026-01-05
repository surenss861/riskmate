import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/account/security/events
 * Returns recent security events for the current user (login attempts, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Try to get events from audit_events table (if it exists and has user_id)
    const { data: auditEvents, error: auditError } = await supabase
      .from('audit_events')
      .select('id, event_type, created_at, ip_address, user_agent')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    // If audit_events table exists and has data, return it
    if (!auditError && auditEvents && auditEvents.length > 0) {
      return NextResponse.json({
        events: auditEvents.map(event => ({
          id: event.id,
          type: event.event_type || 'unknown',
          ip: event.ip_address || null,
          user_agent: event.user_agent || null,
          created_at: event.created_at,
        })),
      })
    }

    // Fallback: return empty array (or mock data for development)
    // In production, you might want to pull from auth logs or a dedicated security_events table
    return NextResponse.json({
      events: [],
    })
  } catch (error: any) {
    console.error('[account/security/events] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

