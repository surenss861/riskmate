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
 * 
 * Includes guards for:
 * - React Strict Mode double-invocation
 * - Hot module reload (HMR) edge cases
 * - Listener attached to wrong client instance
 */
export function ensureAuthListener() {
  // Only attach listener once (even across hot reloads)
  if (typeof window === 'undefined') return
  
  // Guard 1: Already attached flag
  if (globalThis.__supabaseAuthListenerAttached__) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Supabase] ensureAuthListener() called but listener already attached (Strict Mode or HMR)')
    }
    return
  }

  const supabase = getSupabaseClient()
  const currentClientId = globalThis.__supabaseListenerClientId__

  // Guard 2: Verify listener is attached to the active singleton
  if (!currentClientId) {
    console.warn('[Supabase] ⚠️ Client ID not found - listener may be attached to wrong instance')
  }

  globalThis.__supabaseAuthListenerAttached__ = true

  if (process.env.NODE_ENV === 'development') {
    console.log('[Supabase] ✅ Auth listener attached', {
      clientId: currentClientId,
      timestamp: new Date().toISOString(),
    })
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    // Guard 3: Verify this event is from the active singleton
    if (process.env.NODE_ENV === 'development' && globalThis.__supabaseListenerClientId__ !== currentClientId) {
      console.warn('[Supabase] ⚠️ Auth event from different client instance - possible singleton violation')
    }

    // Handle refresh token errors gracefully
    if (event === 'TOKEN_REFRESHED' && !session) {
      console.warn('[Supabase] Token refresh failed - signing out locally')
      // Sign out locally only (don't trigger global signout)
      await supabase.auth.signOut({ scope: 'local' })
    }

    // Handle SIGNED_OUT events that might be caused by invalid refresh tokens
    if (event === 'SIGNED_OUT' && !session) {
      // Clear any stale storage
      if (typeof window !== 'undefined') {
        try {
          // Clear the auth storage key
          localStorage.removeItem('riskmate.auth')
          // Also clear any Supabase-related keys
          const keysToRemove: string[] = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && (key.includes('supabase') || key.includes('riskmate.auth'))) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key))
        } catch (e) {
          console.warn('[Supabase] Failed to clear storage:', e)
        }
      }
    }

    // Log auth state changes in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Supabase] Auth state changed:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        clientId: currentClientId,
      })
    }
  })
}
