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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login')
        setLoading(false)
        return
      }
      setAuthenticated(true)
      setLoading(false)
      loadLegalStatus().catch(() => null)
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadLegalStatus = async () => {
    try {
      const [status, version] = await Promise.all([
        legalApi.getStatus(),
        legalApi.getVersion(),
      ])
      setLegalAccepted(status.accepted)
      setLegalVersion(version.version)
      setLegalUpdatedAt(version.updated_at)
    } catch (err: any) {
      console.error('Failed to load legal status', err)
      // Enhanced error handling: if unauthorized, redirect to login
      // Otherwise, show modal to allow acceptance
      if (err?.code === 'AUTH_UNAUTHORIZED' || err?.message?.includes('Unauthorized')) {
        // Session expired - redirect to login
        router.push('/login')
        return
      }
      // For other errors, force modal to allow user to accept
      setLegalAccepted(false)
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

