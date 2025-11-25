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
      } = await supabase.auth.getSession()

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
      // Fallback: force modal if fetch fails
      setLegalAccepted(false)
    } finally {
      setLegalChecked(true)
    }
  }

  const handleAccept = async () => {
    await legalApi.accept()
    await loadLegalStatus()
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

