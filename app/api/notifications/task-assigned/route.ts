/**
 * Next.js API: POST /api/notifications/task-assigned.
 * Proxies to backend to notify assignee (push + email). Body: { userId, taskId, taskTitle, jobId, jobTitle? }.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, '/api/notifications/task-assigned', {
    method: 'POST',
    body,
  })
}
