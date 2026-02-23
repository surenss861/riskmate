/**
 * Next.js API: POST /api/notifications/task-completed.
 * Proxies to backend to notify task creator (push + email). Body: { userId, taskId, taskTitle, jobTitle?, jobId? }.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, '/api/notifications/task-completed', {
    method: 'POST',
    body,
  })
}
