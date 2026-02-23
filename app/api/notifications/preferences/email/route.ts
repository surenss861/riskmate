import { NextRequest, NextResponse } from 'next/server'
import { BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const PREFERENCES_EMAIL_ENDPOINT = '/api/notifications/preferences/email'

/**
 * GET /api/notifications/preferences/email — public: get preferences by signed token (no session).
 * Query: token. Proxies to backend; used by /preferences/email page when token is present.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json(
        { message: 'Missing token', code: 'MISSING_TOKEN' },
        { status: 400 }
      )
    }
    const url = `${BACKEND_URL}${PREFERENCES_EMAIL_ENDPOINT}?token=${encodeURIComponent(token)}`
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { message: data.message ?? 'Failed to load preferences', code: data.code },
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Preferences email GET proxy error:', error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to load notification preferences',
        code: 'PREFERENCES_LOAD_ERROR',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/preferences/email — public: update preferences by signed token (no session).
 * Body: token, plus preference keys. Proxies to backend; used by /preferences/email page.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = body?.token ?? request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json(
        { message: 'Missing token', code: 'MISSING_TOKEN' },
        { status: 400 }
      )
    }
    const url = `${BACKEND_URL}${PREFERENCES_EMAIL_ENDPOINT}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { message: data.message ?? 'Failed to update preferences', code: data.code },
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Preferences email PATCH proxy error:', error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to update notification preferences',
        code: 'PREFERENCES_UPDATE_ERROR',
      },
      { status: 500 }
    )
  }
}
