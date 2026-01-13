import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy-helpers'

// Force Node.js runtime (not Edge) for heavy operations
export const runtime = 'nodejs'
// Increase timeout to 60 seconds for proof pack generation (PDFs + ZIP)
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const body = await request.json()
  // Proof pack generation (ZIP + multiple PDFs) can take 30-60 seconds
  // Increase timeout to 55 seconds (just under Vercel's 60s maxDuration limit)
  return proxyToBackend(request, '/api/audit/export/pack', { 
    method: 'POST', 
    body, 
    isFileDownload: true,
    timeout: 55_000 // 55 seconds (proxy timeout, separate from Vercel maxDuration)
  })
}

