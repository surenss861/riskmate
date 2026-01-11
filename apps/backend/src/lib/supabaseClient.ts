import { createClient } from "@supabase/supabase-js";

// Debug: Log what we're receiving from Railway (safe - no secrets exposed)
// This log confirms the new build is running (commit cc80181+)
console.log('[SUPABASE_CLIENT] Initializing with enhanced validation (build: cc80181+)');
const urlRaw = process.env.SUPABASE_URL;
const keyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[env] SUPABASE_URL exists:', !!urlRaw);
console.log('[env] SUPABASE_URL preview:', urlRaw ? JSON.stringify(urlRaw.slice(0, 30)) : 'null');
console.log('[env] SUPABASE_URL length:', urlRaw ? urlRaw.length : 0);
console.log('[env] SERVICE_ROLE_KEY exists:', !!keyRaw);
console.log('[env] SERVICE_ROLE_KEY length:', keyRaw ? keyRaw.length : 0);

// Normalize: Remove quotes and trim whitespace (common Railway paste errors)
const url = urlRaw?.replace(/^["']|["']$/g, '').trim();
const key = keyRaw?.replace(/^["']|["']$/g, '').trim();

if (!url || !/^https?:\/\//.test(url)) {
  throw new Error(
    `Missing/invalid SUPABASE_URL: "${url ?? ''}". ` +
    `Expected format: https://<project-ref>.supabase.co. ` +
    `Raw value: ${urlRaw ? JSON.stringify(urlRaw) : 'undefined'}`
  );
}

if (!key) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. ' +
    'This must be your Supabase service role key (server-side only, never expose to clients). ' +
    `Key length received: ${keyRaw ? keyRaw.length : 0}`
  );
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

