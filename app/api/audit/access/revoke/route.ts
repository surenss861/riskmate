import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyToBackend(request, '/api/audit/access/revoke', { method: 'POST', body })
}

