import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * POST /api/comments/[id]/resolve — mark comment resolved (author or admin).
 * Proxies to backend so resolveComment is used; same response shape as backend.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  return proxyToBackend(request, `/api/comments/${commentId}/resolve`, { method: 'POST' })
}

/**
 * DELETE /api/comments/[id]/resolve — unresolve comment (backward compatibility).
 * Proxies to backend; prefer POST /api/comments/[id]/unresolve.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  return proxyToBackend(request, `/api/comments/${commentId}/resolve`, { method: 'DELETE' })
}
