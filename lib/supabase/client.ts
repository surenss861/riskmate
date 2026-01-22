import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton pattern: prevent multiple GoTrueClient instances
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined
  // eslint-disable-next-line no-var
  var __supabaseAuthListenerAttached__: boolean | undefined
  // eslint-disable-next-line no-var
  var __supabaseListenerClientId__: string | undefined // Track which client the listener is attached to
}

/**
 * Creates a singleton Supabase client for browser use.
 * 
 * Uses globalThis caching so hot reload / route re-mounts don't create new instances.
 * This prevents "initial session emitted" warnings and auth weirdness.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  // Return existing singleton if it exists
  if (typeof window !== 'undefined' && globalThis.__supabase__) {
    // Hard guard: log warning in dev if somehow a second instance tries to create
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Supabase] ⚠️ Attempted to create second client instance - using singleton')
    }
    return globalThis.__supabase__
  }

  // Create new client only if it doesn't exist
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'riskmate.auth',
    },
  })

  // Cache in globalThis (survives hot reloads)
  if (typeof window !== 'undefined') {
    globalThis.__supabase__ = client
    // Generate a unique ID for this client instance (for listener guard)
    globalThis.__supabaseListenerClientId__ = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
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
 * Get the singleton Supabase client instance.
 * Use this instead of createSupabaseBrowserClient() when you just need the client.
 */
export function getSupabaseClient(): SupabaseClient {
  return createSupabaseBrowserClient()
}

/**
 * Exported singleton instance (enterprise-grade lock).
 * 
 * Instead of calling createSupabaseBrowserClient() everywhere, import this instance.
 * This reduces "someone calls the factory in a weird place" risk.
 */
export const supabase = createSupabaseBrowserClient()

/**
 * Safe session getter that handles refresh token errors gracefully.
 * 
 * If refresh token is invalid (stale/cleared), signs out locally and returns null.
 * This prevents auth errors from breaking the UI.
 */
export async function safeGetSession() {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()

    // If refresh token is invalid, treat as logged out
    if (error?.message?.toLowerCase().includes('refresh token')) {
      console.warn('[Supabase] Invalid refresh token - signing out locally:', error.message)
      // Sign out locally only (don't trigger global signout)
      await supabase.auth.signOut({ scope: 'local' })
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





