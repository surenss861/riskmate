'use client'

import { useEffect } from 'react'
import { ensureAuthListener } from '@/lib/supabase/authListener'

/**
 * Auth Provider Component
 * 
 * Initializes the Supabase auth listener exactly once.
 * Should be placed in the root layout to ensure it runs on app bootstrap.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ensure auth listener is attached exactly once
    ensureAuthListener()
  }, [])

  return <>{children}</>
}
