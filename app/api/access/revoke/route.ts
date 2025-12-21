import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

/**
 * POST /api/access/revoke
 * Revokes a user's access (role downgrade or membership removal)
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext()
    
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
      
      return NextResponse.json(
        { ok: false, code: 'AUTH_ROLE_FORBIDDEN', message: 'Only owners and admins can revoke access' },
        { status: 403 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'user_id and reason are required' },
        { status: 400 }
      )
    }

    // Guardrail: Cannot revoke own access
    if (target_user_id === user_id) {
      return NextResponse.json(
        { ok: false, message: 'Cannot revoke your own access' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'User not found' },
        { status: 404 }
      )
    }

    // Guardrail: Cannot revoke executive access (executives are immutable)
    if (targetUser.role === 'executive') {
      return NextResponse.json(
        { ok: false, message: 'Cannot revoke executive access (executives are immutable)' },
        { status: 403 }
      )
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

    return NextResponse.json({
      ok: true,
      message: 'Access revoked successfully',
      ledger_entry_id: ledgerResult.data?.id,
    })
  } catch (error: any) {
    console.error('[access/revoke] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to revoke access',
        code: 'REVOKE_ERROR',
      },
      { status: 500 }
    )
  }
}

