import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * POST /api/comments/[id]/unresolve — clear is_resolved, resolved_by, resolved_at.
 * Proxies to backend so unresolveComment is used; same response shape as backend.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params
  return proxyToBackend(request, `/api/comments/${commentId}/unresolve`, { method: 'POST' })
}
