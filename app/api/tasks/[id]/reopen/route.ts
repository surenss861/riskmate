/**
 * Next.js API: POST /api/tasks/[id]/reopen.
 * Proxies to the backend so task service logic is used; response shape
 * matches the backend contract.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, `/api/tasks/${id}/reopen`, { method: 'POST' })
}
