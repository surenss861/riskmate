import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * GET /api/comments/[id]/replies — list replies for a comment.
 * Proxies to backend so listReplies is used; same response shape as backend.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  return proxyToBackend(request, `/api/comments/${commentId}/replies`, { method: 'GET' })
}

/**
 * POST /api/comments/[id]/replies — create a reply (entity from parent comment).
 * Proxies to backend so createComment with parent_id is used; same response shape as backend.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, `/api/comments/${commentId}/replies`, {
    method: 'POST',
    body,
  })
}
