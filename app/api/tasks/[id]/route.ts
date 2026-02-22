/**
 * Next.js API: GET/PATCH/DELETE /api/tasks/[id].
 * Proxies to the backend so getTask, updateTask, deleteTask are used; response shape
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
  return proxyToBackend(request, `/api/tasks/${id}`, { method: 'GET' })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, `/api/tasks/${id}`, {
    method: 'PATCH',
    body,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, `/api/tasks/${id}`, { method: 'DELETE' })
}
