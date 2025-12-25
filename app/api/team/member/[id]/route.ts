import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(
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

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const { id: memberId } = await params
    const organizationId = userData.organization_id

    // Get optional reassign_to from query params
    const { searchParams } = new URL(request.url)
    const reassignTo = searchParams.get('reassign_to') || null

    // Call SECURITY DEFINER RPC function
    // This handles all authorization, dependency cleanup, and soft removal
    const { data, error } = await supabase.rpc('remove_team_member', {
      p_organization_id: organizationId,
      p_member_user_id: memberId,
      p_reassign_to: reassignTo,
    })

    if (error) {
      // RPC function returns user-friendly error messages
      const errorMessage = error.message || 'Failed to remove teammate'
      
      // Map common error codes to HTTP status codes
      let statusCode = 500
      if (errorMessage.includes('not authorized') || errorMessage.includes('only owners')) {
        statusCode = 403
      } else if (errorMessage.includes('not found') || errorMessage.includes('already removed')) {
        statusCode = 404
      } else if (errorMessage.includes('cannot remove') || errorMessage.includes('last owner')) {
        statusCode = 400
      }

      return NextResponse.json(
        {
          message: errorMessage,
          code: error.code,
        },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      status: 'removed',
      ...data,
    })
  } catch (error: any) {
    console.error('Member removal failed:', error)
    
    const errorMessage = error?.message || 'Failed to remove teammate'
    const statusCode = error?.status || 500
    
    return NextResponse.json(
      { 
        message: errorMessage,
        code: error?.code,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: statusCode }
    )
  }
}

