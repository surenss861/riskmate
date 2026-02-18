import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Canonical actions that map to sub-routes. update_status is an alias for status. */
const BULK_ACTIONS = ['status', 'assign', 'delete', 'export'] as const
/** All accepted action values (canonical + aliases). */
const BULK_ACTIONS_ACCEPTED = ['status', 'update_status', 'assign', 'delete', 'export'] as const
type BulkAction = (typeof BULK_ACTIONS)[number]

/** Normalize action to canonical sub-route name. */
function normalizeBulkAction(action: string): BulkAction | null {
  if (action === 'update_status') return 'status'
  if (BULK_ACTIONS.includes(action as BulkAction)) return action as BulkAction
  return null
}

/**
 * POST /api/jobs/bulk
 * Single entrypoint for bulk job operations. Body must include action: 'status' | 'update_status' | 'assign' | 'delete' | 'export'
 * and the same payload as the corresponding sub-route (job_ids, and status | worker_id | formats as required).
 * Forwards to /api/jobs/bulk/:action and returns the same response (including results array, summary, data).
 */
export async function POST(request: NextRequest) {
  let body: { action?: unknown; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const action = body?.action
  if (typeof action !== 'string') {
    return NextResponse.json(
      {
        message: `action is required and must be one of: ${BULK_ACTIONS_ACCEPTED.join(', ')}`,
        allowed_actions: [...BULK_ACTIONS_ACCEPTED],
      },
      { status: 400 }
    )
  }
  const canonicalAction = normalizeBulkAction(action)
  if (!canonicalAction) {
    return NextResponse.json(
      {
        message: `action must be one of: ${BULK_ACTIONS_ACCEPTED.join(', ')}`,
        allowed_actions: [...BULK_ACTIONS_ACCEPTED],
      },
      { status: 400 }
    )
  }

  const { action: _drop, ...rest } = body
  const origin = new URL(request.url).origin
  const targetUrl = `${origin}/api/jobs/bulk/${canonicalAction}`

  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('Content-Type', 'application/json')

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: forwardedHeaders,
    body: JSON.stringify(rest),
  })

  const responseBody = await res.text()
  const contentType = res.headers.get('Content-Type') ?? 'application/json'
  return new NextResponse(responseBody, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      'Content-Type': contentType,
    },
  })
}
