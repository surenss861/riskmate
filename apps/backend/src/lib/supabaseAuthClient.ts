// ✅ MODULE LOADED MARKER - This MUST print if this file is being executed
console.log("[SUPABASE_AUTH_CLIENT] MODULE LOADED FROM:", __filename);
console.log("[SUPABASE_AUTH_CLIENT] MARKER: AUTH-ANON-v1");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clean = (v?: string): string => (v ?? "").trim().replace(/^['"]|['"]$/g, "");

let cached: SupabaseClient | null = null;

/**
 * Get Supabase client for auth validation (uses anon key, not service role)
 * This is safe for token validation and doesn't require admin privileges
 */
export function getSupabaseAuth(): SupabaseClient {
  if (cached) return cached;

  const url = clean(process.env.SUPABASE_URL);
  const anon = clean(process.env.SUPABASE_ANON_KEY);

  // ✅ These MUST print before any crash
  console.log(`[SUPABASE_AUTH_CLIENT] preflight SUPABASE_URL exists: ${Boolean(url)}`);
  console.log(`[SUPABASE_AUTH_CLIENT] preflight SUPABASE_URL preview: ${JSON.stringify(url.slice(0, 60))}`);
  console.log(`[SUPABASE_AUTH_CLIENT] preflight ANON_KEY length: ${anon.length}`);

  if (!url) throw new Error("[env] Missing SUPABASE_URL");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`[env] Invalid SUPABASE_URL: ${JSON.stringify(url)}`);
  }
  if (!anon) throw new Error("[env] Missing SUPABASE_ANON_KEY");

  console.log("[SUPABASE_AUTH_CLIENT] Creating Supabase auth client now…");
  cached = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log("[SUPABASE_AUTH_CLIENT] Supabase auth client created successfully");

  return cached;
}
