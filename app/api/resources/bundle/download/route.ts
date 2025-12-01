import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Track bundle downloads (optional analytics)
 * In production, you might want to:
 * - Track downloads in a database
 * - Send to analytics service
 * - Rate limit downloads
 */
export async function POST(request: NextRequest) {
  try {
    const { resourceId } = await request.json()

    // Optional: Track download in database or analytics
    // For now, just return success
    // In production, you could:
    // - Log to Supabase audit_logs
    // - Track in PostHog/Mixpanel
    // - Rate limit per IP

    return NextResponse.json({
      success: true,
      message: 'Download tracked',
      resourceId,
    })
  } catch (error: any) {
    console.error('Bundle download tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track download' },
      { status: 500 }
    )
  }
}

