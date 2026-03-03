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

/** Hop-by-hop and other headers we must not forward from the delegated response. */
const BULK_RESPONSE_HEADERS_EXCLUDE = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length', // NextResponse sets this from the body
])

/** Headers we allow when forwarding to the bulk sub-route. Excludes hop-by-hop and framing headers (e.g. content-length, host, connection). */
const BULK_FORWARD_ALLOWED_HEADERS = [
  'authorization',
  'cookie',
  'x-request-id',
  'x-correlation-id',
  'x-trace-id',
  'x-client',
  'x-app-version',
  'x-device-id',
] as const

function buildForwardHeaders(request: NextRequest): Headers {
  const out = new Headers()
  out.set('Content-Type', 'application/json')
  for (const name of BULK_FORWARD_ALLOWED_HEADERS) {
    const value = request.headers.get(name)
    if (value != null) out.set(name, value)
  }
  return out
}

/** Forward to the bulk sub-route (POST) and return the response. */
async function forwardToBulkAction(
  request: NextRequest,
  canonicalAction: BulkAction,
  rest: Record<string, unknown>
): Promise<NextResponse> {
  const origin = new URL(request.url).origin
  const targetUrl = `${origin}/api/jobs/bulk/${canonicalAction}`
  const headers = buildForwardHeaders(request)
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(rest),
  })
  const responseBody = await res.text()
  const outHeaders = new Headers()
  outHeaders.set('Content-Type', res.headers.get('Content-Type') ?? 'application/json')
  res.headers.forEach((value, name) => {
    const lower = name.toLowerCase()
    if (!BULK_RESPONSE_HEADERS_EXCLUDE.has(lower)) {
      outHeaders.set(name, value)
    }
  })
  return new NextResponse(responseBody, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
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

  const action = body?.action
  if (action !== undefined && action !== 'delete') {
    return NextResponse.json(
      { message: 'DELETE only allows action "delete" or no action; received conflicting action' },
      { status: 400 }
    )
  }

  return forwardToBulkAction(request, 'delete', { job_ids: jobIds })
}
