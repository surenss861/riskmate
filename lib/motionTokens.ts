/**
 * Motion tokens — match docs/MOTION_TOKENS.md and iOS RMMotion.
 * Use these so web and app feel consistent.
 */
export const MotionTokens = {
  durationFast: 0.14,
  durationNormal: 0.22,
  durationSlow: 0.32,

  staggerStep: 0.045,

  easing: {
    easeOut: [0.16, 1, 0.3, 1] as const,
    easeOutSlow: [0.22, 1, 0.36, 1] as const,
  },

  shimmer: {
    duration: 1.25,
    opacity: 0.22,
  },
}
