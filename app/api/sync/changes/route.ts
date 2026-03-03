/**
 * Next.js API: GET /api/sync/changes
 * Proxies to the backend sync changes endpoint for offline-first iOS and web clients.
 * Forwards since, limit, offset, entity (and other) query params via request.nextUrl.searchParams.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/sync/changes', { method: 'GET' })
}
