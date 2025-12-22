import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * POST /api/dev/generate-sample-events
 * Dev-only endpoint to generate sample events for testing UI
 * Generates 1 event per tab (governance, operations, access)
 * 
 * SECURITY: Hard-gated to development only. Returns 404 in production (not 403) to avoid attack-surface signaling.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  // Hard-gate: Only allow in development environments
  const isDevelopment = 
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
    (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')

  if (!isDevelopment) {
    // Return 404 (not 403) to avoid signaling this endpoint exists
    return NextResponse.json(
      createErrorResponse('Not found', 'NOT_FOUND', { requestId, statusCode: 404 }),
      { status: 404, headers: { 'X-Request-ID': requestId } }
    )
  }

  try {
    let organization_id: string
    let user_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
      user_id = context.user_id
    } catch (authError: any) {
      return NextResponse.json(
        createErrorResponse('Unauthorized: Please log in', 'UNAUTHORIZED', { requestId, statusCode: 401 }),
        { status: 401, headers: { 'X-Request-ID': requestId } }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Get user info
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email, role')
      .eq('id', user_id)
      .single()

    if (!userData) {
      return NextResponse.json(
        createErrorResponse('User not found', 'NOT_FOUND', { requestId, statusCode: 404 }),
        { status: 404, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Get a sample job/work record for operations events (if available)
    const { data: sampleJob } = await supabase
      .from('jobs')
      .select('id, client_name')
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .limit(1)
      .single()

    // Get another user for access events (if available) - don't use self for revocation
    const { data: sampleTargetUser } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('organization_id', organization_id)
      .neq('id', user_id)
      .limit(1)
      .single()

    const ledgerEntryIds: string[] = []
    const now = new Date()

    // 1. Governance Enforcement event: role violation
    const governanceResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'auth.role_violation',
      targetType: 'system',
      targetId: null,
      metadata: {
        attempted_action: 'job.update',
        policy_statement: 'Executives have read-only access and cannot update work records',
        endpoint: '/api/jobs/update',
        reason: 'Executive attempted to update a work record',
        blocked_reason: 'Role-based access control: Executives have read-only access',
        summary: 'Executive attempted to update a work record (blocked by governance policy)',
        request_id: requestId,
      },
    })
    if (governanceResult.data?.id) ledgerEntryIds.push(governanceResult.data.id)

    // 2. Operational Actions event: review queue assigned (with realistic job if available)
    const operationsResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'review_queue.assigned',
      targetType: sampleJob ? 'job' : 'event',
      targetId: sampleJob?.id || null,
      metadata: {
        work_record_id: sampleJob?.id || null,
        assignee_id: user_id,
        assignee_name: userData.full_name || userData.email,
        assignee_role: userData.role,
        due_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        priority: 'high',
        status_change: {
          before: 'open',
          after: 'assigned',
        },
        notes: 'Sample review assignment for testing Compliance Ledger UI',
        assigned_at: now.toISOString(),
        summary: `Assigned to ${userData.full_name || userData.email} (due: ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()})`,
        request_id: requestId,
      },
    })
    if (operationsResult.data?.id) ledgerEntryIds.push(operationsResult.data.id)

    // 3. Access & Security event: access revoked (use sample target user if available, otherwise self)
    const targetUserId = sampleTargetUser?.id || user_id
    const targetUserName = sampleTargetUser?.full_name || sampleTargetUser?.email || userData.full_name || userData.email
    const accessResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'access.revoked',
      targetType: 'user',
      targetId: targetUserId,
      metadata: {
        target_user_id: targetUserId,
        target_user_name: targetUserName,
        target_user_role: sampleTargetUser?.role || userData.role,
        scope: 'org',
        reason: 'Sample access revocation for testing Compliance Ledger UI',
        force_logout: false,
        revoked_at: now.toISOString(),
        revoked_by: user_id,
        summary: `Access revoked for ${targetUserName}: Sample access revocation for testing (scope: org)`,
        request_id: requestId,
      },
    })
    if (accessResult.data?.id) ledgerEntryIds.push(accessResult.data.id)

    return NextResponse.json(
      createSuccessResponse({
        generated: ledgerEntryIds.length,
        ledgerEntryIds,
        message: 'Sample events generated successfully',
      }, {
        message: `Generated ${ledgerEntryIds.length} sample events`,
        requestId,
      }),
      { headers: { 'X-Request-ID': requestId } }
    )
  } catch (error: any) {
    console.error('[dev/generate-sample-events] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    return NextResponse.json(
      createErrorResponse(
        error.message || 'Failed to generate sample events',
        error.code || 'GENERATION_ERROR',
        {
          requestId,
          statusCode: 500,
          details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
        }
      ),
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }
}

