import { NextRequest, NextResponse } from 'next/server'
import { reconcileAllSubscriptions } from '@/lib/reconciliation'

export const runtime = 'nodejs'

/**
 * POST /api/cron/reconcile-subscriptions
 * 
 * Cron job endpoint to reconcile all subscriptions.
 * Prevents drift between Stripe and database.
 * 
 * Should be called daily/weekly via Vercel Cron or similar.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (if using Vercel Cron)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const result = await reconcileAllSubscriptions()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Reconciliation failed:', error)
    return NextResponse.json(
      {
        error: error.message || 'Reconciliation failed',
      },
      { status: 500 }
    )
  }
}

