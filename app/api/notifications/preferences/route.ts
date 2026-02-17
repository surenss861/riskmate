import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const PREFERENCES_ENDPOINT = '/api/notifications/preferences'

/** GET /api/notifications/preferences — get current user's notification preferences (proxies to backend). */
export async function GET(request: NextRequest) {
  try {
    return await proxyToBackend(request, PREFERENCES_ENDPOINT, { method: 'GET' })
  } catch (error: unknown) {
    console.error('Notification preferences GET proxy error:', error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to load notification preferences',
        code: 'PREFERENCES_LOAD_ERROR',
      },
      { status: 500 }
    )
  }
}

/** PATCH /api/notifications/preferences — update current user's notification preferences (proxies to backend). */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    return await proxyToBackend(request, PREFERENCES_ENDPOINT, {
      method: 'PATCH',
      body,
    })
  } catch (error: unknown) {
    console.error('Notification preferences PATCH proxy error:', error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to update notification preferences',
        code: 'PREFERENCES_UPDATE_ERROR',
      },
      { status: 500 }
    )
  }
}
