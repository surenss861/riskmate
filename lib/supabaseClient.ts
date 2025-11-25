import { createSupabaseBrowserClient } from './supabase/client'

// Export a singleton instance for client-side auth
export const supabase = createSupabaseBrowserClient()

