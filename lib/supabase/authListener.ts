/**
 * Auth State Change Listener
 * 
 * Attaches onAuthStateChange listener exactly once to prevent duplicate listeners.
 * Handles refresh token errors gracefully by signing out locally.
 */

import { getSupabaseClient } from './client'

/**
 * Ensures the auth state change listener is attached exactly once.
 * 
 * Call this once in your app bootstrap (e.g., root layout or auth provider).
 * Prevents duplicate listeners from React re-mounts or hot reloads.
 */
export function ensureAuthListener() {
  // Only attach listener once (even across hot reloads)
  if (typeof window === 'undefined') return
  if (globalThis.__supabaseAuthListenerAttached__) return

  globalThis.__supabaseAuthListenerAttached__ = true

  const supabase = getSupabaseClient()

  supabase.auth.onAuthStateChange(async (event, session) => {
    // Handle refresh token errors gracefully
    if (event === 'TOKEN_REFRESHED' && !session) {
      console.warn('[Supabase] Token refresh failed - signing out locally')
      // Sign out locally only (don't trigger global signout)
      await supabase.auth.signOut({ scope: 'local' })
    }

    // Log auth state changes in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Supabase] Auth state changed:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      })
    }
  })
}
