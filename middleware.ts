import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // ✅ Allow headless print loads when token is present (bypasses auth)
  const isPrintRoute =
    pathname.includes('/reports/packet/print/') ||
    (pathname.includes('/reports/') && pathname.includes('/print/'))
  
  if (isPrintRoute && searchParams.has('token')) {
    // Print route with token - allow through (no auth required)
    return NextResponse.next()
  }

  // For all other routes, continue with normal Next.js behavior
  return NextResponse.next()
}

// Only run middleware on specific paths
export const config = {
  matcher: [
    '/reports/:path*',
  ],
}

