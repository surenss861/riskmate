import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * PATCH /api/comments/[id] — update comment content (author only).
 * Proxies to backend so updateComment is used; same response shape as backend.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, `/api/comments/${commentId}`, {
    method: 'PATCH',
    body,
  })
}

/**
 * DELETE /api/comments/[id] — soft-delete comment (author or org admin).
 * Proxies to backend so deleteComment is used; returns 204 on success.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  return proxyToBackend(request, `/api/comments/${commentId}`, { method: 'DELETE' })
}
