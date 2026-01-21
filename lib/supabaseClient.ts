import { getSupabaseClient } from './supabase/client'

// Export a singleton instance for client-side auth
// This uses the same singleton from lib/supabase/client.ts
export const supabase = getSupabaseClient()

