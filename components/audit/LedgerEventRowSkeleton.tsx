/**
 * LedgerEventRowSkeleton - Skeleton for event row matching TrustReceiptStrip layout
 * 
 * Matches exact layout of event rows to prevent layout shift:
 * - EventChip (badges)
 * - TrustReceiptStrip (who/when/what)
 * - IntegrityBadge
 * - Optional EnforcementBanner (if blocked)
 */

'use client'

import { Skeleton } from '@/components/shared/Skeleton'

/**
 * LedgerEventRowSkeleton - Loading placeholder for single event row
 * 
 * Matches:
 * - Container: p-4 rounded-lg border
 * - EventChip area: badges + event type
 * - TrustReceiptStrip area: actor + timestamp + summary
 * - IntegrityBadge area
 * - Height/spacing to prevent CLS
 */
export function LedgerEventRowSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-white/10 bg-white/5">
      {/* EventChip area: Badges + event type */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>

      {/* TrustReceiptStrip area: Actor + timestamp + summary */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-3 w-4/5 rounded-md" />
      </div>

      {/* IntegrityBadge area */}
      <div className="mb-3">
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

