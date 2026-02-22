/**
 * Next.js API: POST /api/tasks/[id]/complete (mark done), DELETE (reopen).
 * Proxies to the backend so completeTask and reopenTask are used; response shape
 * matches the ticket contract (including assigned_user).
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, `/api/tasks/${id}/complete`, { method: 'POST' })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, `/api/tasks/${id}/complete`, { method: 'DELETE' })
}
