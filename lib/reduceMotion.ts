'use client'

import { useState, useEffect } from 'react'

/**
 * Reduce motion — respect prefers-reduced-motion (align with iOS RMMotion.reduceMotion).
 * For reactive updates when the user toggles OS Reduce Motion, use usePrefersReducedMotion()
 * or Framer Motion's useReducedMotion() in components.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/**
 * React hook that subscribes to prefers-reduced-motion and updates when the user toggles it in OS settings.
 * Use in components that need reactive reduce-motion without Framer Motion; otherwise use useReducedMotion() from 'framer-motion'.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const handler = () => setReduce(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduce
}
