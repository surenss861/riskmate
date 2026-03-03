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

/** Forward to the bulk sub-route (POST) and return the response. */
async function forwardToBulkAction(
  request: NextRequest,
  canonicalAction: BulkAction,
  rest: Record<string, unknown>
): Promise<NextResponse> {
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
    headers: { 'Content-Type': contentType },
  })
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
  return forwardToBulkAction(request, canonicalAction, rest as Record<string, unknown>)
}

/**
 * PATCH /api/jobs/bulk
 * REST alias for bulk update operations. Body must include action: 'status' | 'update_status' | 'assign'
 * and the same payload as the sub-route (job_ids, and status or worker_id). Delegates to the same sub-route as POST.
 */
export async function PATCH(request: NextRequest) {
  let body: { action?: unknown; job_ids?: unknown; status?: unknown; worker_id?: unknown; [key: string]: unknown }
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
        message: 'PATCH body must include action: "status", "update_status", or "assign"',
        allowed_actions: ['status', 'update_status', 'assign'],
      },
      { status: 400 }
    )
  }
  const canonicalAction = normalizeBulkAction(action)
  if (canonicalAction !== 'status' && canonicalAction !== 'assign') {
    return NextResponse.json(
      {
        message: 'PATCH only supports action: "status", "update_status", or "assign"',
        allowed_actions: ['status', 'update_status', 'assign'],
      },
      { status: 400 }
    )
  }

  const { action: _drop, ...rest } = body
  return forwardToBulkAction(request, canonicalAction, rest as Record<string, unknown>)
}

/**
 * DELETE /api/jobs/bulk
 * REST alias for bulk delete. Body must include job_ids (array of job IDs). Delegates to the same sub-route as POST action "delete".
 */
export async function DELETE(request: NextRequest) {
  let body: { job_ids?: unknown; action?: unknown; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const jobIds = body?.job_ids
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return NextResponse.json(
      { message: 'DELETE body must include job_ids (non-empty array)' },
      { status: 400 }
    )
  }

  return forwardToBulkAction(request, 'delete', { job_ids: jobIds })
}
