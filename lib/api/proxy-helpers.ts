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
      // CRITICAL: Always generate an error ID first (even if backend doesn't provide one)
      const { randomUUID } = await import('crypto')
      let errorId = response.headers.get('X-Error-ID')
      if (!errorId) {
        errorId = randomUUID()
        console.warn(`[Proxy] Backend did not provide error ID for ${endpoint}, generated: ${errorId}`)
      }
      
      // Try to get error text (might be JSON, HTML, or plaintext)
      const errorText = await response.text()
      let error: any
      try {
        error = JSON.parse(errorText)
      } catch {
        // If response is not JSON (HTML error page, plaintext, etc.), wrap it
        error = { 
          message: 'Backend request failed', 
          raw: errorText.length > 500 ? errorText.substring(0, 500) + '...' : errorText, // Truncate long HTML responses
          upstream_content_type: response.headers.get('content-type'),
        }
      }
      
      // Extract error ID from backend response (may be in headers or JSON)
      errorId = errorId || error.error_id || error.errorId || errorId
      
      console.error(`[Proxy] Backend error for ${endpoint}:`, {
        status: response.status,
        error,
        errorId,
        backendUrl,
        headers: Object.fromEntries(response.headers.entries()),
      })
      
      // CRITICAL: Always return JSON, even if upstream returned HTML/plaintext
      // This ensures frontend can always parse the error and extract error_id
      return NextResponse.json({
        // Always include error_id (generated if backend didn't provide)
        error_id: errorId,
        // Ensure code is present (use from error or default)
        code: error.code || (response.status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
        // Ensure message is present
        message: error.message || error.error || 'Backend request failed',
        // Include hint if available
        ...(error.support_hint && { support_hint: error.support_hint }),
        ...(error.hint && { hint: error.hint }),
        // Include upstream details if response was not JSON
        ...(error.upstream_content_type && { 
          upstream: {
            content_type: error.upstream_content_type,
            raw_snippet: error.raw,
          }
        }),
        // Pass through other error fields
        ...(error.request_id && { request_id: error.request_id }),
        _proxy: {
          backend_url: backendUrl,
          status: response.status,
        },
      }, { 
        status: response.status,
        // Always include error ID header
        headers: { 
          'X-Error-ID': errorId,
          'Content-Type': 'application/json', // Force JSON content type
        },
      })
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
    // CRITICAL: Always generate an error ID for proxy errors
    // This ensures every failure is traceable, even for proxy-level errors
    const { randomUUID } = await import('crypto')
    const errorId = randomUUID()
    
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
      errorId,
    })
    
    // Return more helpful error for connection issues
    if (isConnectionError) {
      const isLocalhostDefault = BACKEND_URL === 'http://localhost:5173' && !process.env.BACKEND_URL
      return NextResponse.json(
        { 
          message: 'Backend server is not accessible',
          error: error.message,
          code: 'BACKEND_CONNECTION_ERROR',
          error_id: errorId,
          support_hint: isLocalhostDefault
            ? 'BACKEND_URL environment variable is not set. The backend server must be deployed separately and BACKEND_URL must point to it.'
            : 'Check that the backend server is running and accessible at the configured URL. For long-running operations (ZIP generation), consider async job pattern.',
          _proxy: {
            backend_url: backendUrl,
            configured_backend_url: BACKEND_URL,
            troubleshooting: [
              'Verify BACKEND_URL environment variable is set correctly',
              'Check that backend server is running and accessible',
              'For Vercel deployments, ensure backend is deployed separately',
              'For long operations (>30s), use async job + polling pattern',
            ],
          },
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { 
          status: 503, // Service Unavailable
          headers: { 'X-Error-ID': errorId },
        }
      )
    }
    
    return NextResponse.json(
      { 
        message: 'Failed to proxy request', 
        error: error.message,
        code: error.code || 'PROXY_ERROR',
        error_id: errorId,
        _proxy: {
          backend_url: backendUrl,
          configured_backend_url: BACKEND_URL,
        },
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { 
        status: 500,
        headers: { 'X-Error-ID': errorId },
      }
    )
  }
}

export { BACKEND_URL }

