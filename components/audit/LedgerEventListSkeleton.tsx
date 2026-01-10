/**
 * LedgerEventListSkeleton - Skeleton for event list
 * 
 * Shows multiple event row skeletons in a vertical list.
 */

'use client'

import { LedgerEventRowSkeleton } from './LedgerEventRowSkeleton'

/**
 * LedgerEventListSkeleton - Loading placeholder for event list
 * 
 * @example
 * ```tsx
 * {loading ? (
 *   <LedgerEventListSkeleton />
 * ) : (
 *   <LedgerEventList events={events} />
 * )}
 * ```
 */
export function LedgerEventListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <LedgerEventRowSkeleton key={i} />
      ))}
    </div>
  )
}

