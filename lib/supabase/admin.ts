/**
 * Supabase Admin Client
 * 
 * Uses SERVICE_ROLE_KEY for privileged operations that bypass RLS
 * DO NOT expose this client to the browser - only use in server-side API routes
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client with service role privileges
 * This bypasses RLS and should ONLY be used in server-side API routes
 * 
 * @throws Error if required environment variables are missing
 */
export function createSupabaseAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

