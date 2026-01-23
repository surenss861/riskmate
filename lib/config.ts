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
