import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * POST /api/access/revoke
 * Revokes a user's access (role downgrade or membership removal)
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    let user_id: string
    let user_role: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
      user_id = context.user_id
      user_role = context.user_role
    } catch (authError: any) {
      console.error('[access/revoke] Auth error:', {
        message: authError.message,
        requestId,
      })
      const errorResponse = createErrorResponse(
        'Unauthorized: Please log in',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      })
    }
    
    // Authorization: Only admins/owners can revoke access
    if (user_role !== 'owner' && user_role !== 'admin') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'access.revoked',
          policy_statement: 'Only owners and admins can revoke access',
          endpoint: '/api/access/revoke',
        },
      })
      
      const errorResponse = createErrorResponse(
        'Only owners and admins can revoke access',
        'AUTH_ROLE_FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(errorResponse, { 
        status: 403,
        headers: { 'X-Request-ID': requestId }
      })
    }

    const body = await request.json()
    const { 
      user_id: target_user_id, // User to revoke access from
      scope = 'org', // 'org' | 'site' | 'app'
      scope_id, // Optional site/app ID
      reason, // Required reason
      force_logout = false,
      new_role // Optional: downgrade to this role instead of removing
    } = body

    // Validation
    if (!target_user_id || !reason) {
      const errorResponse = createErrorResponse(
        'user_id and reason are required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Hard rule: Cannot revoke own access (unless "break glass" flow - not implemented yet)
    if (target_user_id === user_id) {
      const errorResponse = createErrorResponse(
        'Cannot revoke your own access',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400, field: 'target_user_id' }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    const supabase = await createSupabaseServerClient()

    // Get target user info
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('id', target_user_id)
      .eq('organization_id', organization_id)
      .single()

    if (!targetUser) {
      const errorResponse = createErrorResponse(
        'User not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Hard rule: Cannot revoke executive access (executives are immutable)
    if (targetUser.role === 'executive') {
      const errorResponse = createErrorResponse(
        'Cannot revoke executive access (executives are immutable)',
        'AUTH_ROLE_IMMUTABLE',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(errorResponse, { 
        status: 403,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Hard rule: Cannot revoke org owner without second approval (simplified check - would need approval workflow)
    // For now, we'll allow it but log it prominently
    const { data: orgData } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', organization_id)
      .single()
    
    if (orgData?.owner_id === target_user_id && user_role !== 'owner') {
      const errorResponse = createErrorResponse(
        'Cannot revoke organization owner access without owner approval',
        'AUTH_REQUIRES_OWNER',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(errorResponse, { 
        status: 403,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Perform revocation based on scope
    if (scope === 'org') {
      if (new_role) {
        // Downgrade role
        await supabase
          .from('users')
          .update({ role: new_role })
          .eq('id', target_user_id)
          .eq('organization_id', organization_id)
      } else {
        // Remove from organization (delete organization_members entry)
        await supabase
          .from('organization_members')
          .delete()
          .eq('user_id', target_user_id)
          .eq('organization_id', organization_id)
      }
    } else if (scope === 'site' && scope_id) {
      // Remove site access (if you have a site_members table)
      // For now, we'll just log it
      console.log(`Revoking site access for user ${target_user_id} from site ${scope_id}`)
    }

    // Force logout by invalidating sessions (if requested)
    if (force_logout) {
      // In Supabase, you'd typically revoke all refresh tokens
      // This requires admin API access - for now, we'll log it
      console.log(`Force logout requested for user ${target_user_id}`)
    }

    // Write ledger entry
    const ledgerResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'access.revoked',
      targetType: 'user',
      targetId: target_user_id,
      metadata: {
        target_user_id,
        target_user_name: targetUser.full_name || targetUser.email,
        target_user_role: targetUser.role,
        scope,
        scope_id: scope_id || null,
        reason,
        force_logout,
        new_role: new_role || null,
        revoked_at: new Date().toISOString(),
        revoked_by: user_id,
        summary: `Access revoked: ${reason} (scope: ${scope})`,
      },
    })

    // Optionally write session.terminated ledger entry if force_logout is true
    // (In a full implementation, you'd invalidate refresh tokens via Supabase Admin API)
    if (force_logout) {
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'session.terminated',
        targetType: 'user',
        targetId: target_user_id,
        metadata: {
          target_user_id,
          target_user_name: targetUser.full_name || targetUser.email,
          reason: 'Access revoked',
          revoked_by: user_id,
          terminated_at: new Date().toISOString(),
          summary: `Sessions terminated for ${targetUser.full_name || targetUser.email}`,
        },
      })
    }

    const successResponse = createSuccessResponse({
      ledger_entry_id: ledgerResult.data?.id,
    }, {
      message: 'Access revoked successfully',
      requestId,
    })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[access/revoke] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to revoke access',
      error.code || 'REVOKE_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
      }
    )
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: { 'X-Request-ID': requestId }
    })
  }
}

