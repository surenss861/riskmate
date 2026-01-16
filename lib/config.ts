/**
 * Centralized configuration for API endpoints
 * 
 * This is the single source of truth for backend URL.
 * All API calls should use BACKEND_URL from this file.
 */

// Backend API base URL
// In production: https://api.riskmate.dev
// In development: http://localhost:5173 (or NEXT_PUBLIC_BACKEND_URL if set)
export const BACKEND_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.riskmate.dev')
    : (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.riskmate.dev');

// Supabase configuration
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
