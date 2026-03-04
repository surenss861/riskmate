import { NextRequest, NextResponse } from 'next/server'
import { APP_ORIGIN } from '@/lib/config'

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

/** Timeout for delegated bulk sub-route fetch (ms). Prevents hanging requests. */
const BULK_FORWARD_TIMEOUT_MS = 30_000

/**
 * Forward to the bulk sub-route (POST) and return the response.
 * Target URL is built from server-controlled APP_ORIGIN only; request Host/URL are never used,
 * so delegated fetch cannot be influenced by client headers (credential exfiltration protection).
 * Cookie header is forwarded so session auth is preserved for the internal request.
 * Transport failures (fetch throw, timeout) return structured JSON with 502 and stable code.
 */
async function forwardToBulkAction(
  request: NextRequest,
  canonicalAction: BulkAction,
  rest: Record<string, unknown>
): Promise<NextResponse> {
  const targetUrl = `${APP_ORIGIN}/api/jobs/bulk/${canonicalAction}`
  const headers = buildForwardHeaders(request)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BULK_FORWARD_TIMEOUT_MS)

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(rest),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const responseBody = await res.text()
    const outHeaders = new Headers()
    outHeaders.set('Content-Type', res.headers.get('Content-Type') ?? 'application/json')
    // Preserve repeated headers (e.g. multiple Set-Cookie): use getSetCookie() for set-cookie, append for others.
    const setCookieValues =
      typeof (res.headers as Headers & { getSetCookie?(): string[] }).getSetCookie === 'function'
        ? (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie()
        : []
    for (const cookie of setCookieValues) {
      outHeaders.append('set-cookie', cookie)
    }
    res.headers.forEach((value, name) => {
      const lower = name.toLowerCase()
      if (lower === 'set-cookie') return
      if (lower === 'content-type') return // already set above; avoid duplicate
      if (!BULK_RESPONSE_HEADERS_EXCLUDE.has(lower)) {
        outHeaders.append(name, value)
      }
    })
    return new NextResponse(responseBody, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    const isAbort = err instanceof Error && err.name === 'AbortError'
    const message = isAbort
      ? 'Bulk action request timed out.'
      : 'Bulk action request failed due to a temporary connectivity issue.'
    return NextResponse.json(
      { message, code: 'BULK_DELEGATION_ERROR' },
      { status: 502 }
    )
  }
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
 * REST alias for bulk update operations. Body may include action: 'status' | 'update_status' | 'assign'
 * for backward compatibility, or omit action and send { job_ids, status } for status update or
 * { job_ids, worker_id } for assignment. Ambiguous payloads (e.g. both status and worker_id without action)
 * return 400. Delegates to the same sub-route as POST.
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

  let canonicalAction: 'status' | 'assign' | null = null
  const action = body?.action

  if (typeof action === 'string') {
    const normalized = normalizeBulkAction(action)
    if (normalized === 'status' || normalized === 'assign') {
      canonicalAction = normalized
    } else {
      return NextResponse.json(
        {
          message: `PATCH action must be one of: status, update_status, assign. Received: "${action}".`,
          allowed_actions: ['status', 'update_status', 'assign'],
        },
        { status: 400 }
      )
    }
  }

  if (canonicalAction === null) {
    const hasStatus = body?.status !== undefined
    const hasWorkerId = body?.worker_id !== undefined
    if (hasStatus && hasWorkerId) {
      return NextResponse.json(
        {
          message: 'PATCH body is ambiguous: both status and worker_id present. Specify action: "status" or "assign".',
          allowed_actions: ['status', 'update_status', 'assign'],
        },
        { status: 400 }
      )
    }
    if (hasStatus) {
      canonicalAction = 'status'
    } else if (hasWorkerId) {
      canonicalAction = 'assign'
    } else {
      return NextResponse.json(
        {
          message: 'PATCH body must include action or inferrable payload: include "status" for status update or "worker_id" for assignment.',
          allowed_actions: ['status', 'update_status', 'assign'],
        },
        { status: 400 }
      )
    }
  }

  const { action: _drop, ...rest } = body
  return forwardToBulkAction(request, canonicalAction as 'status' | 'assign', rest as Record<string, unknown>)
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
