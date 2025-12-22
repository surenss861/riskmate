'use client'

import { ReactNode } from 'react'

type AppBackgroundProps = {
  children: ReactNode
}

/**
 * AppBackground - Provides the same ambient gradient backdrop as landing page
 * Single subtle orange radial glow - no extra effects
 */
export function AppBackground({ children }: AppBackgroundProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white">
      {/* Ambient Gradient Backdrop - Same as landing page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.05),_transparent_55%)]" />
      </div>
      {children}
    </div>
  )
}

