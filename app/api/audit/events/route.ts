import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/api/audit/events', { method: 'GET' })
}

