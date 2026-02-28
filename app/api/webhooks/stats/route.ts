import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWebhookOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getUserRole, ForbiddenError, UnauthorizedError } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

const ROUTE = '/api/webhooks/stats'

/** GET - Aggregate delivery stats per endpoint (full history). Requires owner/admin in each org. */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const { organization_ids, user_id } = await getWebhookOrganizationContext(request)
    const admin = createSupabaseAdminClient()
    const roleResults = await Promise.all(
      organization_ids.map(async (orgId) => {
        const role = await getUserRole(admin, user_id, orgId)
        return { orgId, role } as const
      })
    )
    const adminOrgIds = roleResults
      .filter((r) => r.role === 'owner' || r.role === 'admin')
      .map((r) => r.orgId)
    if (adminOrgIds.length === 0) {
      const { response, errorId } = createErrorResponse(
        'Forbidden: Only owners and admins can view webhook stats',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    // Use admin client with explicit org scoping (adminOrgIds) so Bearer and cookie auth behave identically
    const results = await Promise.allSettled(
      adminOrgIds.map((orgId) =>
        admin.rpc('get_webhook_endpoint_stats', { p_org_id: orgId })
      )
    )
    const allRows: unknown[] = []
    for (let i = 0; i < results.length; i++) {
      const settled = results[i]
      const orgId = adminOrgIds[i]
      if (settled.status === 'rejected') {
        logApiError(500, 'QUERY_ERROR', 'stats-rpc-error', requestId, orgId, settled.reason?.message ?? 'RPC failed', {
          category: 'internal', severity: 'error', route: ROUTE,
        })
        continue
      }
      const { data: rows, error } = settled.value
      if (error) {
        logApiError(500, 'QUERY_ERROR', 'stats-rpc-error', requestId, orgId, error.message, {
          category: 'internal', severity: 'error', route: ROUTE,
        })
        continue
      }
      if (Array.isArray(rows)) allRows.push(...rows)
    }

    const list = allRows
    const data: Record<string, {
      delivered: number
      pending: number
      failed: number
      lastDelivery: string | null
      lastSuccessAt: string | null
      lastTerminalFailureAt: string | null
      lastFailureAt: string | null
    }> = {}
    for (const row of list) {
      const r = row as {
        endpoint_id: string
        delivered: number
        pending: number
        failed: number
        last_delivery: string | null
        last_success_at: string | null
        last_terminal_failure_at: string | null
        last_failure_at: string | null
      }
      data[r.endpoint_id] = {
        delivered: Number(r.delivered ?? 0),
        pending: Number(r.pending ?? 0),
        failed: Number(r.failed ?? 0),
        lastDelivery: r.last_delivery ?? null,
        lastSuccessAt: r.last_success_at ?? null,
        lastTerminalFailureAt: r.last_terminal_failure_at ?? null,
        lastFailureAt: r.last_failure_at ?? null,
      }
    }

    return NextResponse.json({ data })
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) {
      const { response, errorId } = createErrorResponse(
        err.message,
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (err instanceof UnauthorizedError) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    const { response, errorId } = createErrorResponse(
      msg,
      'INTERNAL_ERROR',
      { requestId, statusCode: 500 }
    )
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
