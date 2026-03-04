'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { MotionTokens } from '@/lib/motionTokens'

/**
 * Page enter: opacity 0→1, y 8→0 (Reduce Motion: opacity only).
 * Page exit: opacity 1→0, y 0→-6.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion() ?? false

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 8 }
  const center = { opacity: 1, y: 0 }
  const exit = reduce ? { opacity: 0 } : { opacity: 0, y: -6 }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={enter}
        animate={center}
        exit={exit}
        transition={{
          duration: MotionTokens.durationNormal,
          ease: MotionTokens.easing.easeOut,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
