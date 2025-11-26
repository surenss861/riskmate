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

    const { data: factors, error } = await supabase
      .from('risk_factors')
      .select('id, code, name, description, severity, category')
      .eq('is_active', true)
      .order('severity', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ data: factors || [] })
  } catch (error: any) {
    console.error('Risk factors fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch risk factors' },
      { status: 500 }
    )
  }
}

