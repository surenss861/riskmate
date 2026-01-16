import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for browser use with proper session persistence.
 * 
 * Uses @supabase/ssr for Next.js App Router compatibility (handles cookies for SSR).
 * For client-side access, this ensures sessions are available via getSession().
 */
export function createSupabaseBrowserClient() {
  // createBrowserClient from @supabase/ssr handles cookies automatically for Next.js
  // It reads/writes to cookies which Next.js middleware can access
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
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





