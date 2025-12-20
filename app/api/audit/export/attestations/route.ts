import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5173'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Forward to backend
    const backendUrl = `${BACKEND_URL}/api/audit/export/attestations`
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization')
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }))
      return NextResponse.json(error, { status: response.status })
    }

    // Forward the file download
    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || 'text/csv'
    const contentDisposition = response.headers.get('content-disposition') || 'attachment; filename="attestations.csv"'
    
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    })
  } catch (error: any) {
    console.error('Attestations export proxy error:', error)
    return NextResponse.json(
      { message: 'Failed to export attestations', error: error.message },
      { status: 500 }
    )
  }
}

