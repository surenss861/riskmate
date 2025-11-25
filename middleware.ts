import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check if Supabase environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars are missing, just return the response without auth handling
    console.warn('Supabase environment variables not set, skipping auth middleware')
    return response
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set(name, value)
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: any) {
            request.cookies.set(name, '')
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set(name, '', { ...options, maxAge: 0 })
          },
        },
      }
    )

    // Supabase session handling - refresh session if needed
    try {
      const { data: { user } } = await supabase.auth.getUser()
      // User data is available but we don't need to do anything with it here
      // The middleware just refreshes the session
    } catch (authError) {
      // If auth fails, continue without blocking the request
      console.warn('Auth check failed in middleware:', authError)
    }
  } catch (error) {
    // If Supabase client creation fails, continue without blocking
    console.error('Middleware error:', error)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
