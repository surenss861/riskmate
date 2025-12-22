'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'

type PageSectionProps = {
  children: ReactNode
  className?: string
}

/**
 * PageSection - Enforces consistent spacing between page sections
 * Always uses mb-16 (64px) - the canonical section gap
 * 
 * Rule: Any "page section" must use PageSection and never raw mb-*
 * This prevents density drift and maintains editorial spacing
 */
export function PageSection({ children, className }: PageSectionProps) {
  return (
    <section className={clsx('mb-16', className)}>
      {children}
    </section>
  )
}

