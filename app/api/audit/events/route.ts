import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5173'

export async function GET(request: NextRequest) {
  try {
    // Get all query parameters from the request
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    
    // Forward to backend
    const backendUrl = `${BACKEND_URL}/api/audit/events${queryString ? `?${queryString}` : ''}`
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      // Forward CORS headers
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Backend request failed' }))
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Audit events proxy error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch audit events', error: error.message },
      { status: 500 }
    )
  }
}

