import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !/^https?:\/\//.test(url)) {
  throw new Error(
    `Missing/invalid SUPABASE_URL: "${url ?? ''}". ` +
    `Expected format: https://<project-ref>.supabase.co`
  );
}

if (!key) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. ' +
    'This must be your Supabase service role key (server-side only, never expose to clients).'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

