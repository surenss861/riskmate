'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { legalApi } from '@/lib/api'
import LegalModal from '@/components/LegalModal'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [legalChecked, setLegalChecked] = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(true)
  const [legalVersion, setLegalVersion] = useState<string>('')
  const [legalUpdatedAt, setLegalUpdatedAt] = useState<string | undefined>(undefined)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      // Handle refresh token errors gracefully (treat as logged out)
      if (sessionError?.message?.toLowerCase().includes('refresh token')) {
        console.warn('[ProtectedRoute] Invalid refresh token - signing out:', sessionError.message)
        // Sign out locally only (don't trigger global signout)
        await supabase.auth.signOut({ scope: 'local' })
        router.push('/login')
        setLoading(false)
        return
      }

      // Other errors are non-fatal - continue as guest
      if (sessionError) {
        console.warn('[ProtectedRoute] Session error (non-fatal):', sessionError.message)
        router.push('/login')
        setLoading(false)
        return
      }

      if (!session) {
        router.push('/login')
        setLoading(false)
        return
      }

      setAuthenticated(true)
      setLoading(false)
      await loadLegalStatus()
    }

    checkSession()

    // Note: Auth state changes are handled globally by ensureAuthListener() in AuthProvider
    // No need to attach another listener here (would create duplicates)
    // The global listener will handle refresh token errors and sign-out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadLegalStatus = async () => {
    try {
      // Double-check session is still valid before making API calls
      const supabase = createSupabaseBrowserClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      // If session is invalid or refresh token error, don't make API calls
      if (sessionError?.message?.toLowerCase().includes('refresh token') || !session) {
        console.warn('[ProtectedRoute] Session invalid when loading legal status - redirecting to login')
        router.push('/login')
        setLegalChecked(true)
        return
      }

      const [status, version] = await Promise.all([
        legalApi.getStatus(),
        legalApi.getVersion(),
      ])
      setLegalAccepted(status.accepted)
      setLegalVersion(version.version)
      setLegalUpdatedAt(version.updated_at)
    } catch (err: any) {
      console.error('Failed to load legal status', err)
      // Enhanced error handling: if unauthorized, verify session before redirecting
      if (err?.code === 'AUTH_UNAUTHORIZED' || err?.message?.includes('Unauthorized')) {
        // Verify session is actually invalid before redirecting
        const supabase = createSupabaseBrowserClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError?.message?.toLowerCase().includes('refresh token')) {
          // Refresh token is invalid - clear storage and redirect
          console.warn('[ProtectedRoute] Refresh token invalid - clearing auth and redirecting')
          await supabase.auth.signOut({ scope: 'local' })
          router.push('/login')
          return
        }
        
        if (!session) {
          // No session - redirect to login
          router.push('/login')
          return
        }
        
        // Session is valid but API returned 401 - might be a transient error or deployment issue
        // Don't redirect, just mark as not accepted so user can accept terms
        // This prevents logout loops when the API is temporarily unavailable
        console.warn('[ProtectedRoute] API returned 401 but session is valid - treating as not accepted (non-fatal)')
        setLegalAccepted(false)
      } else {
        // For other errors, force modal to allow user to accept
        setLegalAccepted(false)
      }
    } finally {
      setLegalChecked(true)
    }
  }

  const handleAccept = async () => {
    try {
      await legalApi.accept()
      // Reload status to confirm acceptance
      await loadLegalStatus()
    } catch (err: any) {
      // Re-throw to let LegalModal handle the error display
      throw err
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto mb-4"></div>
          <p className="text-[#A1A1A1]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return (
    <>
      {children}
      <LegalModal
        open={legalChecked && !legalAccepted}
        version={legalVersion}
        updatedAt={legalUpdatedAt}
        onAccept={handleAccept}
      />
    </>
  )
}

