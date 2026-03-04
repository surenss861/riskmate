'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { runSelectedOrganizationBootstrap } from '@/lib/selectedOrganizationBootstrap'

const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 3

/**
 * Runs selected-organization bootstrap when session exists. Sets the one-shot guard only
 * after bootstrap succeeds so a transient failure does not block future runs. Retries on
 * failure and re-runs when auth state/user changes (e.g. session token or user id).
 * Renders nothing. Mount inside ProtectedRoute so it runs for all authenticated pages.
 */
export function SelectedOrganizationBootstrap() {
  const lastBootstrappedAuthKey = useRef<string | null>(null)
  const previousAuthKeyRef = useRef<string | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [authKey, setAuthKey] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Track session so bootstrap re-runs when auth state or user changes
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const applySession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const key = session?.user?.id && session?.access_token
        ? `${session.user.id}:${session.access_token}`
        : null
      setAuthKey(key)
    }
    applySession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      applySession()
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authKey) return
    if (authKey !== previousAuthKeyRef.current) {
      previousAuthKeyRef.current = authKey
      setRetryCount(0)
      return // re-run when retryCount updates so new user gets full retries
    }
    if (lastBootstrappedAuthKey.current === authKey) return

    let cancelled = false
    const token = authKey.includes(':') ? authKey.slice(authKey.indexOf(':') + 1) : authKey

    const run = async () => {
      const result = await runSelectedOrganizationBootstrap(token)
      if (cancelled) return
      if (result.ok) {
        lastBootstrappedAuthKey.current = authKey
        return
      }
      // Surface failure: schedule retry so we don't get stuck after a transient error
      if (retryCount + 1 < MAX_RETRIES) {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = setTimeout(() => setRetryCount((c) => c + 1), RETRY_DELAY_MS)
      }
    }
    run()
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [authKey, retryCount])

  return null
}
