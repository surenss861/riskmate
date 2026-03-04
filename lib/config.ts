/**
 * Centralized configuration for API endpoints
 * 
 * This is the single source of truth for backend URL.
 * All API calls should use BACKEND_URL from this file.
 * 
 * IMPORTANT: No localhost fallbacks in production builds.
 * Set NEXT_PUBLIC_API_URL in Vercel environment variables.
 */

// Backend API base URL - use NEXT_PUBLIC_API_URL (canonical env var)
// Production: https://api.riskmate.dev
// Development: Set NEXT_PUBLIC_API_URL=http://localhost:5173 in .env.local (never in production)
export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.riskmate.dev';

/** Canonical app origin for server-side delegation (e.g. bulk action proxy). Never derived from request URL. */
export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/** Pattern for allowed app origins (dev localhost, riskmate.com.au, *.vercel.app). Used to guard bulk delegation. */
export const APP_ORIGIN_ALLOWED_PATTERN =
  /^(https?:\/\/)(localhost|127\.0\.0\.1|[\w.-]*riskmate\.com\.au|[\w.-]*\.vercel\.app)(:\d+)?(\/|$)/i

/** True when APP_ORIGIN is localhost/127.0.0.1 (unsafe for server-side delegation in production). */
export function isAppOriginLocalhost(): boolean {
  return APP_ORIGIN.includes('localhost') || APP_ORIGIN.includes('127.0.0.1')
}

/** True when deployment is production but not on Vercel (e.g. Railway, Fly.io). */
export function isProductionNonVercel(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1'
}

// Server-side: warn when production would use localhost (bulk delegation would fail)
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  if (isAppOriginLocalhost()) {
    console.error('[Config] ❌ CRITICAL: APP_ORIGIN resolves to localhost in production. Bulk operations will fail.')
    console.error('[Config] Set NEXT_PUBLIC_APP_URL to your app URL (e.g. https://riskmate.com.au) for non-Vercel deployments.')
  }
  if (!APP_ORIGIN_ALLOWED_PATTERN.test(APP_ORIGIN)) {
    console.error('[Config] ⚠️ APP_ORIGIN may be misconfigured (unexpected host). Expected localhost (dev) or riskmate.com.au / *.vercel.app:', APP_ORIGIN)
  }
}

// Validate: Never use localhost in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  if (BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1')) {
    console.error('[Config] ❌ CRITICAL: localhost detected in production BACKEND_URL:', BACKEND_URL);
    console.error('[Config] Set NEXT_PUBLIC_API_URL=https://api.riskmate.dev in Vercel environment variables');
  }
}

// Supabase configuration
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
