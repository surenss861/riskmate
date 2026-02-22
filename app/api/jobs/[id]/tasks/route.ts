/**
 * Next.js API: GET/POST /api/jobs/[id]/tasks.
 * Proxies to the backend so listTasksByJob and createTask are used; response shape
 * matches the ticket contract (including assigned_user).
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, `/api/jobs/${id}/tasks`, { method: 'GET' })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, `/api/jobs/${id}/tasks`, {
    method: 'POST',
    body,
  })
}
