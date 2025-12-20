import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5173'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const backendUrl = `${BACKEND_URL}/api/audit/incidents/close`
    const authHeader = request.headers.get('authorization')
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Close incident proxy error:', error)
    return NextResponse.json(
      { message: 'Failed to close incident', error: error.message },
      { status: 500 }
    )
  }
}

