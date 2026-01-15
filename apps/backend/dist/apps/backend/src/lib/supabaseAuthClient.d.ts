import { type SupabaseClient } from "@supabase/supabase-js";
/**
 * Get Supabase client for auth validation (uses anon key, not service role)
 * This is safe for token validation and doesn't require admin privileges
 */
export declare function getSupabaseAuth(): SupabaseClient;
//# sourceMappingURL=supabaseAuthClient.d.ts.map