import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status')
    const risk_level = searchParams.get('risk_level')

    const offset = (page - 1) * limit

    let query = supabase
      .from('jobs')
      .select('id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (risk_level) {
      query = query.eq('risk_level', risk_level)
    }

    const { data: jobs, error } = await query

    if (error) throw error

    // Get total count for pagination
    let countQuery = supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    if (risk_level) {
      countQuery = countQuery.eq('risk_level', risk_level)
    }

    const { count, error: countError } = await countQuery

    if (countError) throw countError

    return NextResponse.json({
      data: jobs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Jobs fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

