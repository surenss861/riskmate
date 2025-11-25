'use client'

import { useRef, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'

interface ScrollSectionProps {
  children: React.ReactNode
  className?: string
}

export default function ScrollSection({ children, className = '' }: ScrollSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

