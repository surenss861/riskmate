'use client'

import { motion } from 'framer-motion'
import { MotionTokens } from '@/lib/motionTokens'
import { prefersReducedMotion } from '@/lib/reduceMotion'

/**
 * Card hover (translateY -2px) + press (scale 0.98). Reduce Motion: no motion.
 * Wrap clickable cards (navigate, modal, primary action). Optional onClick + rest forwarded to motion.div.
 */
export function PressableCard({
  children,
  className,
  onClick,
  ...rest
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
} & Omit<React.ComponentPropsWithoutRef<typeof motion.div>, 'children' | 'className'>) {
  const reduce = prefersReducedMotion()

  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{
        duration: MotionTokens.durationFast,
        ease: MotionTokens.easing.easeOut,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
