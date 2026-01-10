/**
 * Skeleton - Trust-safe loading placeholder
 * 
 * Matches final component layout to prevent layout shift (CLS).
 * Uses subtle animation to indicate loading without distracting.
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}

/**
 * Skeleton - Loading placeholder that matches final component layout
 * 
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-3/5" rounded="lg" />
 * <Skeleton className="h-6 w-20" rounded="full" />
 * ```
 */
export function Skeleton({ className, rounded = 'lg', ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      className={cn(
        'animate-pulse bg-white/[0.06] ring-1 ring-white/[0.08]',
        ROUNDED[rounded],
        className
      )}
      aria-hidden="true"
    />
  )
}

