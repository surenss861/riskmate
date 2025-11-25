import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Always ensure we return a valid response, even if everything fails
  try {
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
      return response
    }

    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            get(name: string) {
              try {
                return request.cookies.get(name)?.value
              } catch {
                return undefined
              }
            },
            set(name: string, value: string, options: any) {
              try {
                request.cookies.set(name, value)
                response = NextResponse.next({
                  request: {
                    headers: request.headers,
                  },
                })
                response.cookies.set(name, value, options)
              } catch {
                // Silently fail cookie setting
              }
            },
            remove(name: string, options: any) {
              try {
                request.cookies.set(name, '')
                response = NextResponse.next({
                  request: {
                    headers: request.headers,
                  },
                })
                response.cookies.set(name, '', { ...options, maxAge: 0 })
              } catch {
                // Silently fail cookie removal
              }
            },
          },
        }
      )

      // Supabase session handling - refresh session if needed
      try {
        await supabase.auth.getUser()
        // User data is available but we don't need to do anything with it here
        // The middleware just refreshes the session
      } catch (authError) {
        // If auth fails, continue without blocking the request
        // Don't log in production to avoid noise
      }
    } catch (error) {
      // If Supabase client creation fails, continue without blocking
      // Return the response we already created
    }

    return response
  } catch (error) {
    // Ultimate fallback - if everything fails, return a basic response
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
