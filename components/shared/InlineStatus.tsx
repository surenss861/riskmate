/**
 * InlineStatus - Tiny, consistent loading/status line
 * 
 * For inline loading states: "Loading ledger events...", "Saving...", etc.
 * Uses defensibility terms from lib/copy/terms.ts vocabulary.
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InlineStatusProps {
  label: string
  className?: string
  variant?: 'loading' | 'success' | 'error'
}

/**
 * InlineStatus - Small status indicator for inline loading states
 * 
 * @example
 * ```tsx
 * <InlineStatus label="Loading ledger events..." />
 * <InlineStatus label="Building proof pack..." variant="loading" />
 * ```
 */
export function InlineStatus({
  label,
  className,
  variant = 'loading',
}: InlineStatusProps) {
  const variantStyles = {
    loading: 'text-white/60',
    success: 'text-green-400/80',
    error: 'text-red-400/80',
  }

  return (
    <div
      className={cn('text-xs', variantStyles[variant], className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </div>
  )
}

