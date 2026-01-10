/**
 * EmptyState - Trust-safe empty state component
 * 
 * For true empty states only (when !isLoading && items.length === 0).
 * Loading states are handled by skeletons (Phase 4A).
 * 
 * Always includes:
 * - Title + description (what's missing)
 * - Optional hint (defensibility context: "Actions appear here as ledger events")
 * - Optional action (clear filters, create item, etc.)
 * 
 * Must never imply verification ("Verified") where it doesn't exist.
 * Must use defensibility terminology (ledger events, chain of custody, etc.).
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from './Button'

export interface EmptyStateProps {
  title: string
  description: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  children?: React.ReactNode
}

/**
 * EmptyState - Consistent empty state component
 * 
 * @example
 * ```tsx
 * {!loading && events.length === 0 ? (
 *   <EmptyState
 *     title="No ledger events"
 *     description="No events match your current filters."
 *     hint="Every action is recorded as an immutable ledger event."
 *     actionLabel="Clear Filters"
 *     onAction={() => clearFilters()}
 *   />
 * ) : null}
 * ```
 */
export function EmptyState({
  title,
  description,
  hint,
  actionLabel,
  onAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] p-6',
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-2 min-w-0">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="text-sm text-white/70">{description}</div>
        {hint ? (
          <div className="text-xs text-white/55 mt-1">{hint}</div>
        ) : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

