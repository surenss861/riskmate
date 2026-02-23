/**
 * Next.js API: POST /api/notifications/schedule-task-reminder.
 * Proxies to backend to run overdue/due-soon reminder for one task. Body: { taskId }.
 */
import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return proxyToBackend(request, '/api/notifications/schedule-task-reminder', {
    method: 'POST',
    body,
  })
}
