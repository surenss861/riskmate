import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobReport } from '@/lib/utils/jobReport'
import { buildJobPacket } from '@/lib/utils/packets/builder'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { isValidPacketType } from '@/lib/utils/packets/types'
import { computeSignatureHash } from '@/lib/utils/signatureHash'

export const runtime = 'nodejs'

/**
 * POST /api/reports/runs/[id]/finalize
 * Finalizes a report run after checking signature completeness
 */
export async function POST(
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

    // Get report run and verify access (full row needed for hash re-verification)
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

    // Check if already finalized/complete
    if (reportRun.status === 'final' || reportRun.status === 'complete') {
      return NextResponse.json(
        { message: 'Report run is already finalized' },
        { status: 400 }
      )
    }

    // Only runs in ready_for_signatures may be finalized (reject draft, superseded, and any other state)
    if (reportRun.status !== 'ready_for_signatures') {
      return NextResponse.json(
        { message: 'Report run must be in ready_for_signatures state to finalize', status: reportRun.status },
        { status: 400 }
      )
    }

    // Re-verify run payload hash (same logic as GET /api/reports/runs/[id]/verify)
    const packetType = reportRun.packet_type
    let currentPayload: any
    if (packetType && isValidPacketType(packetType)) {
      currentPayload = await buildJobPacket({
        jobId: reportRun.job_id,
        packetType,
        organizationId: reportRun.organization_id,
      })
    } else {
      currentPayload = await buildJobReport(
        reportRun.organization_id,
        reportRun.job_id
      )
    }
    const recomputedHash = computeCanonicalHash(currentPayload)
    if (recomputedHash !== reportRun.data_hash) {
      return NextResponse.json(
        {
          message: 'Cannot finalize: report data has changed since this run was created; hash mismatch',
          code: 'HASH_MISMATCH',
        },
        { status: 409 }
      )
    }

    // Re-verify each active signature's signature_hash (same logic as verify route)
    const { data: signaturesForVerify } = await supabase
      .from('report_signatures')
      .select('id, signature_role, signature_hash, signature_svg, signer_name, signer_title, revoked_at')
      .eq('report_run_id', reportRunId)

    const activeSignaturesForVerify = signaturesForVerify?.filter((s) => !s.revoked_at) || []
    for (const sig of activeSignaturesForVerify) {
      const recomputedSignatureHash = computeSignatureHash({
        dataHash: reportRun.data_hash,
        reportRunId,
        signatureSvg: sig.signature_svg ?? '',
        signerName: sig.signer_name ?? '',
        signerTitle: sig.signer_title ?? '',
        signatureRole: sig.signature_role ?? '',
      })
      if (recomputedSignatureHash !== sig.signature_hash) {
        return NextResponse.json(
          {
            message: 'Cannot finalize: signature verification failed; data may have been tampered',
            code: 'SIGNATURE_HASH_MISMATCH',
            signature_id: sig.id,
          },
          { status: 409 }
        )
      }
    }

    // Check signature completeness (use already-fetched active signatures)
    const REQUIRED_ROLES = ['prepared_by', 'reviewed_by', 'approved_by']
    const signedRoles = new Set(activeSignaturesForVerify.map((s) => s.signature_role))
    const missingRoles = REQUIRED_ROLES.filter((role) => !signedRoles.has(role))

    if (missingRoles.length > 0) {
      return NextResponse.json(
        {
          message: 'Cannot finalize: missing required signatures',
          missingRoles,
          signedRoles: Array.from(signedRoles),
        },
        { status: 400 }
      )
    }

    // Verify user can finalize (creator or admin)
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', reportRun.organization_id)
      .maybeSingle()

    const isCreator = reportRun.generated_by === user.id
    const isAdmin = member && ['owner', 'admin'].includes(member.role)

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { message: 'Only the report creator or an admin can finalize' },
        { status: 403 }
      )
    }

    // Finalize the report run with completion metadata.
    // Only set fields that exist: status, completed_at. Do not include completed_hash
    // unless the column exists (it may be absent in some deployments).
    const updateData: Record<string, unknown> = {
      status: 'complete',
      completed_at: new Date().toISOString(),
    }

    const { data: finalized, error: updateError } = await supabase
      .from('report_runs')
      .update(updateData)
      .eq('id', reportRunId)
      .select()
      .single()

    if (updateError || !finalized) {
      console.error('[reports/runs/finalize] Failed to finalize:', updateError)
      return NextResponse.json(
        { message: 'Failed to finalize report run', detail: updateError?.message },
        { status: 500 }
      )
    }

    // Log finalization event
    console.log(
      `[reports/runs/finalize] Report run ${reportRunId} finalized | job: ${finalized.job_id} | hash: ${finalized.data_hash.substring(0, 12)} | signed_by: ${user.id}`
    )

    return NextResponse.json({
      data: finalized,
      message: 'Report run finalized successfully',
    })
  } catch (error: any) {
    console.error('[reports/runs/finalize] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

