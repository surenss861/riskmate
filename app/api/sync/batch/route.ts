/**
 * Next.js API: POST /api/sync/batch
 * Proxies to the backend sync batch endpoint for offline-first iOS and web clients.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, '/api/sync/batch', {
    method: 'POST',
    body,
  })
}
