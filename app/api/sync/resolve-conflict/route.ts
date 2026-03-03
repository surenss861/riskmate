/**
 * Next.js API: POST /api/sync/resolve-conflict
 * Proxies to the backend sync resolve-conflict endpoint for offline-first iOS and web clients.
 */
import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  return proxyToBackend(request, '/api/sync/resolve-conflict', {
    method: 'POST',
    body,
  })
}
