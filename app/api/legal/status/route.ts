import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const LEGAL_VERSION = process.env.LEGAL_VERSION || '2025-12-riskmate-terms'

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

    // Check if user has accepted the current version
    const { data: acceptance } = await supabase
      .from('legal_acceptances')
      .select('accepted_at')
      .eq('user_id', user.id)
      .eq('version', LEGAL_VERSION)
      .maybeSingle()

    return NextResponse.json({
      accepted: !!acceptance,
      accepted_at: acceptance?.accepted_at ?? null,
      version: LEGAL_VERSION,
    })
  } catch (error: any) {
    console.error('Legal status fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch legal status' },
      { status: 500 }
    )
  }
}

