'use client'

import { ReactNode } from 'react'
import { designTokens } from '@/lib/styles/design-tokens'

type AppShellProps = {
  children: ReactNode
  className?: string
}

/**
 * AppShell - Consistent page container with landing page rhythm
 * Matches landing page container width and padding
 */
export function AppShell({ children, className = '' }: AppShellProps) {
  return (
    <div className={`relative mx-auto ${designTokens.spacing.pageContainer} ${designTokens.spacing.pagePaddingX} pt-32 pb-20 ${className}`}>
      {children}
    </div>
  )
}

