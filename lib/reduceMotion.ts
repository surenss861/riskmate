/**
 * Reduce motion — respect prefers-reduced-motion (align with iOS RMMotion.reduceMotion).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}
