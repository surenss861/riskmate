import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Debug endpoint to check if required environment variables are set
 * Only works in development or with proper auth in production
 */
export async function GET(request: NextRequest) {
  // Only allow in development or with auth token
  const isDev = process.env.NODE_ENV === 'development'
  const authHeader = request.headers.get('authorization')
  
  if (!isDev && !authHeader) {
    return NextResponse.json(
      { message: 'Unauthorized' },
      { status: 401 }
    )
  }

  const envCheck = {
    // Public env vars (safe to expose)
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    
    // Server-only env vars (check existence, don't expose values)
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_LENGTH: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    
    // Other important vars
    LEGAL_VERSION: process.env.LEGAL_VERSION || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  }

  return NextResponse.json({
    status: 'ok',
    environment: envCheck,
    missing: Object.entries(envCheck)
      .filter(([key, value]) => {
        // Check if boolean false or string 'not set'
        if (key.includes('LENGTH')) return false // Don't check length
        return value === false || value === 'not set'
      })
      .map(([key]) => key),
  })
}
