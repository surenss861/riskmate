import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mitigationId: string }> }
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

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organization_id = userData.organization_id
    const { id: jobId, mitigationId } = await params
    const body = await request.json()
    const { done } = body

    if (typeof done !== 'boolean') {
      return NextResponse.json(
        { message: "'done' boolean field is required" },
        { status: 400 }
      )
    }

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Update mitigation item
    const updatePayload = {
      done,
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? user.id : null,
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('mitigation_items')
      .update(updatePayload)
      .eq('id', mitigationId)
      .eq('job_id', jobId)
      .select('id, title, description, done, is_completed, completed_at, created_at')
      .maybeSingle()

    if (updateError) {
      if ((updateError as any).code === 'PGRST116') {
        return NextResponse.json(
          { message: 'Mitigation item not found' },
          { status: 404 }
        )
      }
      throw updateError
    }

    if (!updatedItem) {
      return NextResponse.json(
        { message: 'Mitigation item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: updatedItem })
  } catch (error: any) {
    console.error('Mitigation update failed:', error)
    return NextResponse.json(
      { message: 'Failed to update mitigation item' },
      { status: 500 }
    )
  }
}

