import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  try {
    return await proxyToBackend(request, '/api/account/organization', {
      method: 'PATCH',
    })
  } catch (error: any) {
    console.error('Organization update proxy error:', error)
    return NextResponse.json(
      { 
        message: error?.message || 'Failed to update organization',
        code: 'ORGANIZATION_UPDATE_ERROR'
      },
      { status: 500 }
    )
  }
}
