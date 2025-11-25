import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    const filePath = join(process.cwd(), 'public', 'favicon.svg')
    const fileContents = await readFile(filePath, 'utf-8')
    
    return new NextResponse(fileContents, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return new NextResponse('Not Found', { status: 404 })
  }
}

