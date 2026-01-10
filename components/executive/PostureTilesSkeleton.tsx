/**
 * PostureTilesSkeleton - Skeleton for Defensibility Posture section (4 tiles)
 * 
 * Matches exact layout of Executive page posture tiles to prevent layout shift.
 */

'use client'

import { Skeleton } from '@/components/shared/Skeleton'

/**
 * PostureTilesSkeleton - Loading placeholder for 4-tile posture grid
 * 
 * Matches:
 * - Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
 * - Tile structure: icon + IntegrityBadge top-right, label, value, description
 * - Fixed heights and spacing to prevent CLS
 */
export function PostureTilesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
        >
          {/* Top: Icon + Badge */}
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
          </div>

          {/* Label */}
          <Skeleton className="h-3 w-24 mb-2 rounded-md" />

          {/* Value */}
          <Skeleton className="h-8 w-20 mb-2 rounded-md" />

          {/* Description */}
          <Skeleton className="h-3 w-full mb-1 rounded-md" />
          <Skeleton className="h-3 w-4/5 rounded-md" />
        </div>
      ))}
    </div>
  )
}

