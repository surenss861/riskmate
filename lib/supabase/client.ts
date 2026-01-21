import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for browser use with proper session persistence.
 * 
 * Uses @supabase/ssr for Next.js App Router compatibility (handles cookies for SSR).
 * For client-side access, this ensures sessions are available via getSession().
 */
export function createSupabaseBrowserClient() {
  // Use regular createClient for browser (supports auth options)
  // createBrowserClient from @supabase/ssr is for SSR cookie handling, but doesn't support auth options
  // For client-side, we use createClient with localStorage persistence
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'riskmate.auth',
      },
    }
  )
  
  // Global auth state change listener: handle refresh token failures gracefully
  if (typeof window !== 'undefined') {
    client.auth.onAuthStateChange((event, session) => {
      // If session becomes null unexpectedly (e.g., refresh token invalid), treat as logged out
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Clear any stale session state
        console.log('[Supabase] Session cleared - user logged out');
      }
    });
  }
  
  // In development, log session status for debugging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('[Supabase] Session error:', error);
      } else if (session) {
        console.log('[Supabase] Session active:', {
          userId: session.user.id,
          expiresAt: new Date(session.expires_at! * 1000).toISOString(),
          hasAccessToken: !!session.access_token,
          tokenLength: session.access_token?.length || 0,
        });
      } else {
        console.warn('[Supabase] No active session - user needs to log in');
      }
    });
  }
  
  return client
}

/**
 * Safe session getter that handles refresh token errors gracefully.
 * 
 * If refresh token is invalid (stale/cleared), signs out locally and returns null.
 * This prevents auth errors from breaking the UI.
 */
export async function safeGetSession() {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.getSession()

    // If refresh token is invalid, treat as logged out
    if (error?.message?.toLowerCase().includes('refresh token')) {
      console.warn('[Supabase] Invalid refresh token - signing out locally:', error.message)
      await supabase.auth.signOut()
      return null
    }

    // Other errors are non-fatal (e.g., network issues)
    if (error) {
      console.warn('[Supabase] Session error (non-fatal):', error.message)
      return null
    }

    return data.session ?? null
  } catch (err: any) {
    console.error('[Supabase] Exception getting session:', err?.message)
    return null
  }
}

// For server-side operations with service role
export function createSupabaseServiceClient() {
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





