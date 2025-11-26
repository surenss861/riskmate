import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

const BASE_SHARE_URL =
  process.env.REPORT_SHARE_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://riskmate.vercel.app'

const SHARE_TOKEN_SECRET =
  process.env.REPORT_SHARE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'riskmate-share-secret'

const SHARE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

const toBase64Url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function signSharePayload(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', SHARE_TOKEN_SECRET).update(body).digest()

  return `${toBase64Url(body)}.${toBase64Url(signature)}`
}

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
    const { id: jobId } = await params

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, organization_id')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SHARE_TOKEN_TTL_SECONDS
    const token = signSharePayload({
      job_id: jobId,
      organization_id,
      exp: expiresAt,
    })

    return NextResponse.json({
      data: {
        url: `${BASE_SHARE_URL}/public/report/${token}`,
        token,
        expires_at: new Date(expiresAt * 1000).toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Share link generation failed:', error)
    return NextResponse.json(
      { message: 'Failed to generate share link' },
      { status: 500 }
    )
  }
}

