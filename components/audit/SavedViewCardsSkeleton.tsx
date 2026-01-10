/**
 * SavedViewCardsSkeleton - Skeleton for SavedViewCards grid
 * 
 * Matches exact layout of SavedViewCards to prevent layout shift.
 * 5 cards in responsive grid (1 col mobile, 2 col tablet, 5 col desktop).
 */

'use client'

import { Skeleton } from '@/components/shared/Skeleton'

/**
 * SavedViewCardsSkeleton - Loading placeholder for saved view cards grid
 * 
 * Matches:
 * - Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4
 * - Card structure: icon + IntegrityBadge top-right, title, description, 3 buttons, pack preview slot
 * - Height and spacing to prevent CLS
 */
export function SavedViewCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          {/* Top: Icon + Badge */}
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="h-6 w-6 rounded" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
            </div>
          </div>

          {/* Title */}
          <Skeleton className="h-5 w-4/5 mb-2 rounded-md" />

          {/* Description */}
          <Skeleton className="h-3 w-full mb-1 rounded-md" />
          <Skeleton className="h-3 w-11/12 mb-3 rounded-md" />

          {/* Primary Action Button */}
          <Skeleton className="h-9 w-full rounded-lg mb-2" />

          {/* Secondary Action Button (if exists) */}
          <Skeleton className="h-7 w-full rounded-lg mb-2" />

          {/* Export CSV Button */}
          <Skeleton className="h-7 w-full rounded-lg mb-3" />

          {/* Pack Preview Slot */}
          <div className="mt-3 -mb-1">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

