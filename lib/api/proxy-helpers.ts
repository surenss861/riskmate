import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5173'

export async function getSessionToken(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('Failed to get session token:', error)
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
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { method = 'GET', body, isFileDownload = false } = options

    // Build URL with query params for GET requests
    let backendUrl = `${BACKEND_URL}${endpoint}`
    if (method === 'GET' && request.nextUrl.searchParams.toString()) {
      backendUrl += `?${request.nextUrl.searchParams.toString()}`
    }

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
      console.error(`Backend error for ${endpoint}:`, error, 'Status:', response.status)
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
    console.error(`Proxy error for ${endpoint}:`, error)
    return NextResponse.json(
      { message: 'Failed to proxy request', error: error.message },
      { status: 500 }
    )
  }
}

export { BACKEND_URL }

