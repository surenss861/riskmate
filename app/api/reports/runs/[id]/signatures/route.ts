import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { validateSignatureSvg } from '@/lib/utils/signatureValidation'

export const runtime = 'nodejs'

/**
 * POST /api/reports/runs/[id]/signatures
 * Creates a signature for a report run
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
    const body = await request.json()
    const {
      signer_name,
      signer_title,
      signature_role,
      signature_svg,
      signer_user_id = user.id, // Default to current user
      attestationAccepted = false, // Must be explicitly true
      attestation_text: bodyAttestationText,
    } = body

    if (!signer_name || !signer_title || !signature_role || !signature_svg) {
      return NextResponse.json(
        { message: 'Missing required fields: signer_name, signer_title, signature_role, signature_svg' },
        { status: 400 }
      )
    }

    // Validate attestation_text: must be non-empty string (signer-accepted wording persisted for proof)
    const attestationText =
      typeof bodyAttestationText === 'string' && bodyAttestationText.trim().length > 0
        ? bodyAttestationText.trim()
        : null
    if (!attestationText) {
      return NextResponse.json(
        { message: 'attestation_text is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!['prepared_by', 'reviewed_by', 'approved_by', 'other'].includes(signature_role)) {
      return NextResponse.json(
        { message: 'Invalid signature_role. Must be: prepared_by, reviewed_by, approved_by, or other' },
        { status: 400 }
      )
    }

    if (!attestationAccepted) {
      return NextResponse.json(
        { message: 'Attestation acceptance is required to sign' },
        { status: 400 }
      )
    }

    // Validate SVG signature
    const svgValidation = validateSignatureSvg(signature_svg)
    if (!svgValidation.valid) {
      return NextResponse.json(
        { message: svgValidation.error || 'Invalid signature SVG' },
        { status: 400 }
      )
    }

    // Get report run and verify access
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('organization_id, status, data_hash')
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

    // When signer_user_id is provided, verify the signer exists and is in the same organization
    if (signer_user_id != null) {
      const { data: signerUser, error: signerError } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('id', signer_user_id)
        .maybeSingle()

      if (signerError || !signerUser) {
        return NextResponse.json(
          { message: 'Signer user not found' },
          { status: 400 }
        )
      }
      if (signerUser.organization_id !== reportRun.organization_id) {
        return NextResponse.json(
          { message: 'Signer must belong to the same organization as the report run' },
          { status: 403 }
        )
      }
    }

    // Verify signer is the current user (unless admin creating for someone else)
    if (signer_user_id !== user.id) {
      // Check if user is admin
      const { data: member } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', reportRun.organization_id)
        .maybeSingle()

      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json(
          { message: 'Only admins can create signatures for other users' },
          { status: 403 }
        )
      }
    }

    // Require run to be in non-draft, signing-ready state so signatures are bound to a frozen payload
    if (reportRun.status === 'draft') {
      return NextResponse.json(
        { message: 'Report run is still in draft. Move the run to ready_for_signatures before signing.' },
        { status: 400 }
      )
    }

    if (reportRun.status === 'superseded') {
      return NextResponse.json(
        { message: 'Cannot sign a superseded report run. Please create a new report run.' },
        { status: 400 }
      )
    }

    if (reportRun.status === 'complete' || reportRun.status === 'final') {
      return NextResponse.json(
        {
          message: 'This report run is sealed and cannot be modified. Create a new report run to make changes.',
          status: reportRun.status,
        },
        { status: 409 }
      )
    }

    // Signing-ready state: ready_for_signatures only (reject any other non-draft state)
    if (reportRun.status !== 'ready_for_signatures') {
      return NextResponse.json(
        { message: 'Report run is not in a signing-ready state. Status must be ready_for_signatures.' },
        { status: 400 }
      )
    }

    // Require data_hash to bind signature to the frozen run payload
    if (!reportRun.data_hash || typeof reportRun.data_hash !== 'string') {
      return NextResponse.json(
        { message: 'Report run has no data_hash; cannot bind signature to payload.' },
        { status: 400 }
      )
    }

    // For required roles only: enforce single signature per role (allow multiple "other")
    const requiredRoles = ['prepared_by', 'reviewed_by', 'approved_by']
    if (requiredRoles.includes(signature_role)) {
      const { data: existing } = await supabase
        .from('report_signatures')
        .select('id, signer_name, signed_at')
        .eq('report_run_id', reportRunId)
        .eq('signature_role', signature_role)
        .is('revoked_at', null)
        .maybeSingle()

      if (existing) {
        const signedAt = existing.signed_at
          ? new Date(existing.signed_at).toLocaleString('en-US', {
              timeZone: 'America/New_York',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short',
            })
          : 'previously'
        return NextResponse.json(
          {
            message: `Already signed by ${existing.signer_name} at ${signedAt} ET. Refreshing...`,
            existing_signature: {
              signer_name: existing.signer_name,
              signed_at: existing.signed_at,
            },
          },
          { status: 409 }
        )
      }
    }

    // Compute signature hash per contract: signature_svg, signer_name, signer_title, signature_role only
    const signatureHash = createHash('sha256')
      .update(signature_svg)
      .update(signer_name)
      .update(signer_title)
      .update(signature_role)
      .digest('hex')

    // Get IP and user agent for audit trail
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent') || null

    // Get signer email if signer_user_id exists
    let signerEmail: string | null = null
    const finalSignerUserId = signer_user_id === user.id ? user.id : signer_user_id
    if (finalSignerUserId) {
      const { data: signerUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', finalSignerUserId)
        .maybeSingle()
      signerEmail = signerUser?.email || null
    }

    // Create signature (attestation_text validated above; store signer-accepted wording for tamper-evident proof)
    const { data: signature, error: createError } = await supabase
      .from('report_signatures')
      .insert({
        organization_id: reportRun.organization_id,
        report_run_id: reportRunId,
        signer_user_id: finalSignerUserId,
        signer_name,
        signer_title,
        signature_role,
        signature_svg,
        signature_hash: signatureHash,
        ip_address: ipAddress,
        user_agent: userAgent,
        attestation_text: attestationText,
      })
      .select()
      .single()

    if (createError) {
      console.error('[reports/runs/signatures] Failed to create signature:', createError)
      return NextResponse.json(
        { message: 'Failed to create signature', detail: createError.message },
        { status: 500 }
      )
    }

    // Attach email and ensure attestation_text is in response for downstream views (e.g. SignatureProofSection)
    const signatureWithEmail = {
      ...signature,
      signer_email: signerEmail,
      attestation_text: signature?.attestation_text ?? attestationText,
    }

    // Log signature creation
    console.log(
      `[reports/runs/signatures] Signature created | run: ${reportRunId} | role: ${signature_role} | signer: ${signer_name} (${signer_user_id || 'external'})`
    )

    return NextResponse.json({ data: signatureWithEmail })
  } catch (error: any) {
    console.error('[reports/runs/signatures] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reports/runs/[id]/signatures
 * Gets all signatures for a report run
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

    // Get report run and verify access
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('organization_id')
      .eq('id', reportRunId)
      .maybeSingle()

    if (runError || !reportRun) {
      return NextResponse.json(
        { message: 'Report run not found', detail: runError?.message },
        { status: 404 }
      )
    }

    // Verify user belongs to organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData || userData.organization_id !== reportRun.organization_id) {
      return NextResponse.json(
        { message: 'Access denied', detail: userError?.message },
        { status: 403 }
      )
    }

    // Get signatures (non-revoked only)
    // Note: We use stored signer data (name/title) for audit integrity
    // This ensures signatures include the identity snapshot at sign-time
    const { data: signatures, error } = await supabase
      .from('report_signatures')
      .select(`
        id,
        report_run_id,
        signer_user_id,
        signer_name,
        signer_title,
        signature_role,
        signature_svg,
        signed_at,
        signature_hash,
        ip_address,
        user_agent,
        attestation_text,
        revoked_at,
        created_at
      `)
      .eq('report_run_id', reportRunId)
      .is('revoked_at', null)
      .order('signed_at', { ascending: true })

    if (error) {
      console.error('[reports/runs/signatures] Failed to fetch signatures:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        reportRunId,
      })
      return NextResponse.json(
        { 
          message: 'Failed to fetch signatures', 
          detail: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      )
    }

    console.log(`[reports/runs/signatures] Successfully fetched ${signatures?.length || 0} signatures for run ${reportRunId}`)
    return NextResponse.json({ data: signatures || [] })
  } catch (error: any) {
    console.error('[reports/runs/signatures] Unexpected error:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json(
      { 
        message: 'Internal server error', 
        detail: error?.message,
        type: error?.name || 'UnknownError',
      },
      { status: 500 }
    )
  }
}

