/**
 * Funnel Event Tracking
 * 
 * Structured event tracking for checkout funnel.
 * Stores events in Supabase funnel_events table for SQL-based debugging.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type FunnelEvent =
  | 'pricing_view'
  | 'plan_selected'
  | 'checkout_clicked'
  | 'checkout_session_created'
  | 'checkout_redirected'
  | 'checkout_return_success'
  | 'checkout_return_cancel'
  | 'subscription_activated'
  | 'checkout_error'

export interface FunnelEventMetadata {
  plan?: 'starter' | 'pro' | 'business'
  session_id?: string
  session_url?: string
  error?: string
  from_demo?: boolean
  [key: string]: any
}

/**
 * Track a funnel event (server-side)
 * 
 * Use this in API routes to store events in database.
 * Client-side tracking should call this via API endpoint.
 */
export async function trackFunnelEvent(
  event: FunnelEvent,
  metadata: FunnelEventMetadata = {},
  userId?: string,
  organizationId?: string
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()

    // If userId/orgId not provided, try to get from auth
    let finalUserId = userId
    let finalOrgId = organizationId

    if (!finalUserId || !finalOrgId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        finalUserId = user.id
        const { data: userData } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        if (userData?.organization_id) {
          finalOrgId = userData.organization_id
        }
      }
    }

    // Use service role to bypass RLS (backend-only writes)
    // Create service role client directly
    const { createClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { error } = await serviceSupabase.from('funnel_events').insert({
      user_id: finalUserId || null,
      organization_id: finalOrgId || null,
      event,
      plan: metadata.plan || null,
      session_id: metadata.session_id || null,
      metadata: metadata,
      user_agent: metadata.user_agent || null,
    })

    if (error) {
      // Log but don't throw - events are non-critical
      console.warn('[FunnelTracking] Failed to store event:', {
        event,
        error: error.message,
      })
    } else {
      console.info('[FunnelTracking] ✅ Stored event:', event, metadata.session_id || '')
    }
  } catch (err: any) {
    // Silent fail - events are best-effort
    console.warn('[FunnelTracking] Exception storing event:', err?.message)
  }
}

/**
 * Get funnel events for an organization (for debugging)
 */
export async function getFunnelEvents(
  organizationId: string,
  limit: number = 100
): Promise<Array<{
  id: string
  event: string
  plan: string | null
  session_id: string | null
  metadata: any
  created_at: string
}>> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('funnel_events')
      .select('id, event, plan, session_id, metadata, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[FunnelTracking] Failed to get events:', error)
      return []
    }

    return data || []
  } catch (err: any) {
    console.error('[FunnelTracking] Exception getting events:', err?.message)
    return []
  }
}
