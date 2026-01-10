'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'

export type BadgeVariant = 'neutral' | 'warning' | 'critical' | 'success'

type BadgeProps = {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

/**
 * Badge - Status indicator using muted glass backgrounds
 * No colored dots - use badges instead
 */
export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  const variantStyles = {
    neutral: 'bg-white/5 text-white/80 border border-white/10',
    warning: 'bg-[#F97316]/10 text-[#F97316]/90 border border-[#F97316]/20',
    critical: 'bg-red-500/10 text-red-400/90 border border-red-500/20',
    success: 'bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/20',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

