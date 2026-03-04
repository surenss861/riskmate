'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MotionTokens } from '@/lib/motionTokens'
import { prefersReducedMotion } from '@/lib/reduceMotion'

type Phase = 0 | 1 | 2 // 0 hashing, 1 locked, 2 verified

/**
 * Proof Pack sealing moment: Hashing → Locked → Verified (same cadence as iOS).
 * Reduce Motion: jump to Verified.
 */
export function ProofSealStatus({ start }: { start: boolean }) {
  const reduce = prefersReducedMotion()
  const [phase, setPhase] = useState<Phase>(2)

  useEffect(() => {
    if (!start) return
    if (reduce) {
      setPhase(2)
      return
    }
    setPhase(0)
    const t1 = setTimeout(() => setPhase(1), 500)
    const t2 = setTimeout(() => setPhase(2), 1000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [start, reduce])

  const label = useMemo(() => {
    if (phase === 0) return ['Hashing…', 'Computing receipt hash']
    if (phase === 1) return ['Locked', 'Sealing proof pack']
    return ['Verified', 'Receipt anchored']
  }, [phase])

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MotionTokens.durationNormal,
        ease: MotionTokens.easing.easeOut,
      }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="text-sm font-semibold">{label[0]}</div>
      <div className="mt-1 text-xs text-white/60">{label[1]}</div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-white/40 transition-all"
          style={{ width: phase === 0 ? '33%' : phase === 1 ? '66%' : '100%' }}
        />
      </div>
    </motion.div>
  )
}
