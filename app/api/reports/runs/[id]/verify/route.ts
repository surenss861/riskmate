import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobReport } from '@/lib/utils/jobReport'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'

export const runtime = 'nodejs'

/**
 * GET /api/reports/runs/[id]/verify
 * Verifies report_run integrity by recomputing hash and checking signatures
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: reportRunId } = await params

    // Get report run
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('*')
      .eq('id', reportRunId)
      .single()

    if (runError || !reportRun) {
      return NextResponse.json(
        { message: 'Report run not found' },
        { status: 404 }
      )
    }

    // Verify user belongs to organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.organization_id !== reportRun.organization_id) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }

    // Rebuild report payload and recompute hash
    const currentPayload = await buildJobReport(
      reportRun.organization_id,
      reportRun.job_id
    )
    const recomputedHash = computeCanonicalHash(currentPayload)

    // Compare hashes
    const hashMatches = recomputedHash === reportRun.data_hash
    const hashMismatchReason = hashMatches
      ? null
      : 'Report data has changed since this run was created'

    // Get signatures
    const { data: signatures } = await supabase
      .from('report_signatures')
      .select('id, signature_role, signature_hash, signed_at, revoked_at')
      .eq('report_run_id', reportRunId)

    const activeSignatures = signatures?.filter((s) => !s.revoked_at) || []
    const revokedSignatures = signatures?.filter((s) => s.revoked_at) || []

    // Verify signature hashes (recompute and compare)
    const signatureVerifications = activeSignatures.map((sig) => {
      // Note: Full signature verification would require recomputing hash from SVG + signer data
      // For now, we just check that signature exists and hasn't been revoked
      return {
        signature_id: sig.id,
        role: sig.signature_role,
        signed_at: sig.signed_at,
        hash_present: !!sig.signature_hash,
        revoked: false,
      }
    })

    const REQUIRED_ROLES = ['prepared_by', 'reviewed_by', 'approved_by']
    const signedRoles = new Set(activeSignatures.map((s) => s.signature_role))
    const missingRoles = REQUIRED_ROLES.filter((role) => !signedRoles.has(role))

    return NextResponse.json({
      data: {
        report_run_id: reportRun.id,
        status: reportRun.status,
        verification: {
          hash_match: hashMatches,
          hash_mismatch_reason: hashMismatchReason,
          stored_hash: reportRun.data_hash.substring(0, 12) + '...',
          recomputed_hash: recomputedHash.substring(0, 12) + '...',
        },
        signatures: {
          total: signatures?.length || 0,
          active: activeSignatures.length,
          revoked: revokedSignatures.length,
          required_roles: REQUIRED_ROLES,
          signed_roles: Array.from(signedRoles),
          missing_roles: missingRoles,
          is_complete: missingRoles.length === 0,
          verifications: signatureVerifications,
        },
        generated_at: reportRun.generated_at,
        verified_at: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[reports/runs/verify] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

