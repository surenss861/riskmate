'use client'

import { MotionTokens } from '@/lib/motionTokens'
import { prefersReducedMotion } from '@/lib/reduceMotion'

/**
 * Skeleton block with shimmer (duration 1.25, opacity 0.22). Reduce Motion: no shimmer.
 * Same rule as iOS: shimmer only content blocks, not whole page.
 */
export function SkeletonShimmer({ className }: { className?: string }) {
  const reduce = prefersReducedMotion()

  return (
    <div
      className={['relative overflow-hidden rounded-xl bg-white/5', className ?? ''].join(' ')}
    >
      {!reduce && (
        <div
          className="absolute inset-0 rm-shimmer-sweep"
          style={{
            opacity: MotionTokens.shimmer.opacity,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent)',
          }}
        />
      )}
    </div>
  )
}
