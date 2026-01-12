import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function clean(v?: string): string {
  return (v ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function requireHttpUrl(name: string, raw: string): void {
  if (!raw) {
    throw new Error(`[env] Missing ${name}`);
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(
      `[env] ${name} must start with http(s)://. Got: ${JSON.stringify(raw)}`
    );
  }
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const urlRaw = process.env.SUPABASE_URL;
  const keyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ✅ LOGS THAT WILL PRINT BEFORE createClient
  console.log(`[SUPABASE_CLIENT] preflight SUPABASE_URL exists: ${Boolean(urlRaw)}`);
  console.log(
    `[SUPABASE_CLIENT] preflight SUPABASE_URL preview: ${urlRaw ? JSON.stringify(urlRaw.slice(0, 40)) : 'null'}`
  );
  console.log(`[SUPABASE_CLIENT] preflight SERVICE_ROLE_KEY exists: ${Boolean(keyRaw)}`);
  console.log(`[SUPABASE_CLIENT] preflight SERVICE_ROLE_KEY length: ${keyRaw ? keyRaw.length : 0}`);

  const url = clean(urlRaw);
  const key = clean(keyRaw);

  requireHttpUrl("SUPABASE_URL", url);
  if (!key) {
    throw new Error("[env] Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  console.log("[SUPABASE_CLIENT] Creating Supabase client now…");

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("[SUPABASE_CLIENT] Supabase client created successfully");

  return cached;
}

// Legacy export for backwards compatibility (lazy-loaded)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient];
  },
});

