// ✅ MODULE LOADED MARKER - This MUST print if this file is being executed
console.log("[SUPABASE_CLIENT] MODULE LOADED FROM:", __filename);
console.log("[SUPABASE_CLIENT] MARKER: 2D92D8D-LAZY-ADMIN-v3");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clean = (v?: string): string => (v ?? "").trim().replace(/^['"]|['"]$/g, "");

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = clean(process.env.SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ✅ These MUST print before any crash
  console.log(`[SUPABASE_CLIENT] preflight SUPABASE_URL exists: ${Boolean(url)}`);
  console.log(`[SUPABASE_CLIENT] preflight SUPABASE_URL preview: ${JSON.stringify(url.slice(0, 60))}`);
  console.log(`[SUPABASE_CLIENT] preflight SERVICE_ROLE_KEY length: ${key.length}`);

  if (!url) throw new Error("[env] Missing SUPABASE_URL");
  if (!/^https?:\/\//i.test(url)) throw new Error(`[env] Invalid SUPABASE_URL: ${JSON.stringify(url)}`);
  if (!key) throw new Error("[env] Missing SUPABASE_SERVICE_ROLE_KEY");

  console.log("[SUPABASE_CLIENT] Creating Supabase client now…");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log("[SUPABASE_CLIENT] Supabase client created successfully");

  return cached;
}

// Lazy getter - only creates client when property is accessed (not at import time)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = client[prop as keyof SupabaseClient];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
