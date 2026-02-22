/**
 * Next.js API: GET/POST /api/task-templates.
 * Proxies to the backend so listTaskTemplates and createTaskTemplate are used;
 * same response shape as the backend.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/task-templates', { method: 'GET' })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, '/api/task-templates', {
    method: 'POST',
    body,
  })
}
