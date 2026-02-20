import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * GET /api/jobs/[id]/comments — list comments for a job.
 * Proxies to backend so listComments is used; same response shape as backend.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  return proxyToBackend(request, `/api/jobs/${jobId}/comments`, { method: 'GET' })
}

/**
 * POST /api/jobs/[id]/comments — create a comment on a job.
 * Proxies to backend so createComment is used; same response shape as backend.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, `/api/jobs/${jobId}/comments`, {
    method: 'POST',
    body,
  })
}
