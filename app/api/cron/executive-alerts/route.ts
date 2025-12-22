import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // Disable caching for cron

/**
 * POST /api/cron/executive-alerts
 * 
 * Vercel Cron endpoint that triggers executive alert checks.
 * This endpoint is protected by:
 * 1. Vercel cron secret (if configured)
 * 2. EXEC_ALERT_CRON_SECRET bearer token
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/executive-alerts",
 *     "schedule": "0 9 * * *" // Daily 9am UTC
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (if Vercel cron headers are present)
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret') // Optional Vercel cron secret
    
    const expectedCronSecret = process.env.EXEC_ALERT_CRON_SECRET
    
    if (!expectedCronSecret) {
      console.error('EXEC_ALERT_CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    // Check bearer token in Authorization header
    const bearerToken = authHeader?.replace('Bearer ', '')
    
    // If bearer token is provided, use it; otherwise allow Vercel cron secret (if configured)
    const isAuthorized = bearerToken === expectedCronSecret || 
                        (cronSecret && cronSecret === expectedCronSecret) ||
                        (process.env.VERCEL && !authHeader && !cronSecret) // In Vercel, cron requests come from internal network

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get time_range from query params or body (defaults to 7d)
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('time_range') || '7d'

    // Call the backend alert check endpoint
    // In production, the backend runs as a separate service
    // For Next.js API routes, we can call the backend directly via its URL
    // Or if backend is on same host, use internal URL
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173'
    const response = await fetch(`${backendUrl}/api/executive/alerts/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expectedCronSecret}`,
      },
      body: JSON.stringify({ time_range: timeRange }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend alert check failed:', response.status, errorText)
      return NextResponse.json(
        { 
          error: 'Backend alert check failed',
          status: response.status,
          detail: errorText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
    })
  } catch (error: any) {
    console.error('Cron execution failed:', error)
    return NextResponse.json(
      { 
        error: 'Cron execution failed',
        message: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/executive-alerts
 * 
 * Health check endpoint to verify the cron route is accessible.
 * Requires EXEC_ALERT_CRON_SECRET for security.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedCronSecret = process.env.EXEC_ALERT_CRON_SECRET

  if (!expectedCronSecret) {
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    )
  }

  const bearerToken = authHeader?.replace('Bearer ', '')
  
  if (bearerToken !== expectedCronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/executive/alerts/check',
    timestamp: new Date().toISOString(),
  })
}

