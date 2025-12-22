'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'

type GlassCardProps = {
  children: ReactNode
  className?: string
  href?: string
  onClick?: () => void
}

/**
 * GlassCard - Canonical surface component
 * Uses centralized design tokens for consistency across the app
 * Canon surface: bg-white/[0.03], border-white/10
 * 
 * For secondary surfaces (inputs, selects), use bg-white/5
 */
export function GlassCard({
  children,
  className,
  href,
  onClick,
}: GlassCardProps) {
  const cardContent = (
    <div
      className={clsx(
        'relative overflow-hidden rounded-3xl border border-white/10',
        'bg-white/[0.03] backdrop-blur-xl',
        'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        href || onClick ? 'cursor-pointer transition-all hover:opacity-90' : '',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )

  if (href) {
    return <a href={href}>{cardContent}</a>
  }

  return cardContent
}

