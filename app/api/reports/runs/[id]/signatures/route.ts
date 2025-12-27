import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

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
    } = body

    if (!signer_name || !signer_title || !signature_role || !signature_svg) {
      return NextResponse.json(
        { message: 'Missing required fields: signer_name, signer_title, signature_role, signature_svg' },
        { status: 400 }
      )
    }

    if (!['prepared_by', 'reviewed_by', 'approved_by', 'other'].includes(signature_role)) {
      return NextResponse.json(
        { message: 'Invalid signature_role. Must be: prepared_by, reviewed_by, approved_by, or other' },
        { status: 400 }
      )
    }

    // Get report run and verify access
    const { data: reportRun, error: runError } = await supabase
      .from('report_runs')
      .select('organization_id, status')
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

    // Verify signer is the current user (unless admin creating for someone else)
    if (signer_user_id !== user.id) {
      // Check if user is admin
      const { data: member } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', reportRun.organization_id)
        .single()

      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json(
          { message: 'Only admins can create signatures for other users' },
          { status: 403 }
        )
      }
    }

    // Check if signature for this role already exists (non-revoked)
    const { data: existing } = await supabase
      .from('report_signatures')
      .select('id')
      .eq('report_run_id', reportRunId)
      .eq('signature_role', signature_role)
      .is('revoked_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { message: 'A signature for this role already exists. Revoke it first if needed.' },
        { status: 409 }
      )
    }

    // Compute signature hash (tamper detection)
    const signatureHash = createHash('sha256')
      .update(signature_svg)
      .update(signer_name)
      .update(signer_title)
      .update(signature_role)
      .digest('hex')

    // Get IP and user agent for audit trail
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent') || null

    // Create signature
    const { data: signature, error: createError } = await supabase
      .from('report_signatures')
      .insert({
        organization_id: reportRun.organization_id,
        report_run_id: reportRunId,
        signer_user_id: signer_user_id === user.id ? user.id : signer_user_id,
        signer_name,
        signer_title,
        signature_role,
        signature_svg,
        signature_hash: signatureHash,
        ip_address: ipAddress,
        user_agent: userAgent,
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

    return NextResponse.json({ data: signature })
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
    const { data: reportRun } = await supabase
      .from('report_runs')
      .select('organization_id')
      .eq('id', reportRunId)
      .single()

    if (!reportRun) {
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

    // Get signatures (non-revoked only)
    const { data: signatures, error } = await supabase
      .from('report_signatures')
      .select('*')
      .eq('report_run_id', reportRunId)
      .is('revoked_at', null)
      .order('signed_at', { ascending: true })

    if (error) {
      console.error('[reports/runs/signatures] Failed to fetch signatures:', error)
      return NextResponse.json(
        { message: 'Failed to fetch signatures', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: signatures || [] })
  } catch (error: any) {
    console.error('[reports/runs/signatures] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

