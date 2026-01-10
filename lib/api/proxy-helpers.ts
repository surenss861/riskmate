import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Server-only: BACKEND_URL should never be exposed to client
// NEXT_PUBLIC_BACKEND_URL is only for fallback in local dev
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5173'

// Validate BACKEND_URL is set (fail fast in production)
if (process.env.NODE_ENV === 'production' && !process.env.BACKEND_URL) {
  console.error('[Proxy] ERROR: BACKEND_URL environment variable is not set in production!')
  console.error('[Proxy] Deployment instructions:')
  console.error('[Proxy]   1. Go to Vercel Project → Settings → Environment Variables')
  console.error('[Proxy]   2. Add BACKEND_URL = https://your-backend-url.com (not localhost)')
  console.error('[Proxy]   3. Redeploy (env vars don\'t apply to already-built deployments)')
  console.error('[Proxy]   4. Backend must be deployed separately (Fly.io / Render / Railway / etc.)')
}

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
    timeout?: number // Optional timeout in ms (default 25s for file downloads, 10s for JSON)
  } = {}
): Promise<NextResponse> {
  // Declare backendUrl outside try block so it's accessible in catch
  let backendUrl = `${BACKEND_URL}${endpoint}`
  
  // Validate BACKEND_URL is set
  if (!BACKEND_URL || BACKEND_URL === 'http://localhost:5173') {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    console.error('[Proxy] ERROR: BACKEND_URL not properly configured')
    return NextResponse.json({
      message: 'Backend server configuration error',
      error: 'BACKEND_URL environment variable is not set',
      code: 'BACKEND_CONFIG_ERROR',
      hint: isProduction
        ? 'Set BACKEND_URL in Vercel: Project → Settings → Environment Variables → Add BACKEND_URL = https://your-backend-url.com → Redeploy (env vars don\'t apply to already-built deployments). Backend must be deployed separately (Fly.io / Render / Railway / etc.).'
        : 'Set BACKEND_URL environment variable in .env.local. Backend server must be running separately.',
      troubleshooting: isProduction ? [
        'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
        'Add: BACKEND_URL = https://your-backend-url.com (your actual backend URL, not localhost)',
        'Select: Production + Preview (and Development if using Vercel dev envs)',
        'Click "Save" and redeploy (deployments don\'t pick up new env vars automatically)',
        'Verify backend is accessible at the URL you set',
      ] : [
        'Set BACKEND_URL in .env.local file',
        'Format: BACKEND_URL=http://localhost:5173 (or your backend URL)',
        'Ensure backend server is running',
        'Restart Next.js dev server after adding env var',
      ],
    }, { status: 500 })
  }
  
  try {
    const sessionToken = await getSessionToken(request)
    if (!sessionToken) {
      console.error(`[Proxy] No session token for ${endpoint}`)
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { method = 'GET', body, isFileDownload = false, timeout } = options

    // Build URL with query params for GET requests
    backendUrl = `${BACKEND_URL}${endpoint}`
    if (method === 'GET' && request.nextUrl.searchParams.toString()) {
      backendUrl += `?${request.nextUrl.searchParams.toString()}`
    }

    console.log(`[Proxy] ${method} ${backendUrl}`)

    // Set timeout (longer for file downloads like ZIP generation)
    const defaultTimeout = isFileDownload ? 30_000 : 10_000 // 30s for ZIP, 10s for JSON
    const requestTimeout = timeout || defaultTimeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, requestTimeout)

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      cache: 'no-store',
      signal: controller.signal, // Enable timeout/abort
    }

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    let response: Response
    try {
      response = await fetch(backendUrl, fetchOptions)
      clearTimeout(timeoutId) // Clear timeout if request completes
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      // Handle abort (timeout)
      if (fetchError.name === 'AbortError' || controller.signal.aborted) {
        console.error(`[Proxy] Request timeout for ${endpoint} after ${requestTimeout}ms`)
        return NextResponse.json({
          message: 'Request timeout',
          error: `Backend request exceeded ${requestTimeout}ms timeout`,
          code: 'REQUEST_TIMEOUT',
          _proxy: {
            backend_url: backendUrl,
            timeout_ms: requestTimeout,
            hint: 'The backend server may be slow or unreachable. For long-running operations like ZIP generation, consider using async job pattern.',
          },
        }, { status: 504 }) // Gateway Timeout
      }
      
      // Re-throw other fetch errors (will be caught by outer catch)
      throw fetchError
    }

    if (!response.ok) {
      // Try to get error text first (might not be JSON)
      const errorText = await response.text()
      let error: any
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { message: errorText || 'Backend request failed', raw: errorText }
      }
      
      console.error(`[Proxy] Backend error for ${endpoint}:`, {
        status: response.status,
        error,
        backendUrl,
        headers: Object.fromEntries(response.headers.entries()),
      })
      
      // Include the actual backend error in response for debugging
      return NextResponse.json({
        ...error,
        _proxy: {
          backend_url: backendUrl,
          status: response.status,
        },
      }, { status: response.status })
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
    const isConnectionError = 
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('fetch failed') ||
      error.code === 'ECONNREFUSED' ||
      error.cause?.code === 'ECONNREFUSED' ||
      error.name === 'TypeError' && error.message?.includes('fetch')
    
    console.error(`[Proxy] Error for ${endpoint}:`, {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
      backendUrl,
      BACKEND_URL,
      isConnectionError,
    })
    
    // Return more helpful error for connection issues
    if (isConnectionError) {
      const isLocalhostDefault = BACKEND_URL === 'http://localhost:5173' && !process.env.BACKEND_URL
      return NextResponse.json(
        { 
          message: 'Backend server is not accessible',
          error: error.message,
          code: 'BACKEND_CONNECTION_ERROR',
          _proxy: {
            backend_url: backendUrl,
            configured_backend_url: BACKEND_URL,
            hint: isLocalhostDefault
              ? 'BACKEND_URL environment variable is not set. The backend server must be deployed separately and BACKEND_URL must point to it.'
              : 'Check that the backend server is running and accessible at the configured URL. For long-running operations (ZIP generation), consider async job pattern.',
            troubleshooting: [
              'Verify BACKEND_URL environment variable is set correctly',
              'Check that backend server is running and accessible',
              'For Vercel deployments, ensure backend is deployed separately',
              'For long operations (>30s), use async job + polling pattern',
            ],
          },
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 503 } // Service Unavailable
      )
    }
    
    return NextResponse.json(
      { 
        message: 'Failed to proxy request', 
        error: error.message,
        code: error.code || 'PROXY_ERROR',
        _proxy: {
          backend_url: backendUrl,
          configured_backend_url: BACKEND_URL,
        },
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export { BACKEND_URL }

