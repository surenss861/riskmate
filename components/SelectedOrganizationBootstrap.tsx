'use client'

import { useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { runSelectedOrganizationBootstrap } from '@/lib/selectedOrganizationBootstrap'

/**
 * Runs selected-organization bootstrap once when mounted and session exists.
 * Renders nothing. Mount inside ProtectedRoute so it runs for all authenticated pages.
 */
export function SelectedOrganizationBootstrap() {
  const didRun = useRef(false)
  useEffect(() => {
    if (didRun.current) return
    let cancelled = false
    const run = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || !session?.access_token) return
      didRun.current = true
      await runSelectedOrganizationBootstrap(session.access_token)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
