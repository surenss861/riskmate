import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5173'

export async function getSessionToken(request?: NextRequest): Promise<string | null> {
  // First, try to get token from Authorization header (sent by frontend)
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('[Proxy] Using token from Authorization header')
      return token
    }
  }

  // Fallback: try to get session from cookies (Supabase SSR)
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('[Proxy] Session error:', sessionError)
      return null
    }
    
    if (!session) {
      console.error('[Proxy] No session found in cookies')
      return null
    }
    
    console.log('[Proxy] Using token from Supabase session cookies')
    return session.access_token || null
  } catch (error: any) {
    console.error('[Proxy] Failed to get session token:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return null
  }
}

export async function proxyToBackend(
  request: NextRequest,
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: any
    isFileDownload?: boolean
  } = {}
): Promise<NextResponse> {
  try {
    const sessionToken = await getSessionToken(request)
    if (!sessionToken) {
      console.error(`[Proxy] No session token for ${endpoint}`)
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { method = 'GET', body, isFileDownload = false } = options

    // Build URL with query params for GET requests
    let backendUrl = `${BACKEND_URL}${endpoint}`
    if (method === 'GET' && request.nextUrl.searchParams.toString()) {
      backendUrl += `?${request.nextUrl.searchParams.toString()}`
    }

    console.log(`[Proxy] ${method} ${backendUrl}`)

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      cache: 'no-store',
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(backendUrl, fetchOptions)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Backend request failed' }))
      console.error(`[Proxy] Backend error for ${endpoint}:`, error, 'Status:', response.status)
      return NextResponse.json(error, { status: response.status })
    }

    if (isFileDownload) {
      const blob = await response.blob()
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const contentDisposition = response.headers.get('content-disposition') || `attachment; filename="${endpoint.split('/').pop()}"`
      
      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': contentDisposition,
        },
      })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error(`[Proxy] Error for ${endpoint}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
      backendUrl: BACKEND_URL,
    })
    return NextResponse.json(
      { 
        message: 'Failed to proxy request', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export { BACKEND_URL }

