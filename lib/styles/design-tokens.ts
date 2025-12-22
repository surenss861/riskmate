/**
 * Design System Tokens - Single source of truth
 * These tokens ensure consistency across landing page and app
 */

export const designTokens = {
  colors: {
    bg: '#0A0A0A',
    surface: 'rgba(255, 255, 255, 0.04)',
    surfaceHover: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.1)',
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    text: 'rgba(255, 255, 255, 0.9)',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    textSubtle: 'rgba(255, 255, 255, 0.4)',
    accent: '#F97316',
    accentGlow: 'rgba(249, 115, 22, 0.08)',
    accentGradient: 'linear-gradient(to right, #F97316, #FFC857)',
  },
  spacing: {
    pageContainer: 'max-w-6xl',
    pagePaddingX: 'px-6 md:px-10',
    pagePaddingY: 'py-10 md:py-14',
    sectionGap: 'mb-12 md:mb-16',
  },
  typography: {
    pageTitle: 'text-4xl md:text-5xl font-bold font-display',
    sectionTitle: 'text-2xl md:text-3xl font-bold font-display',
    cardTitle: 'text-xl font-semibold',
    body: 'text-base text-white/70',
    bodyMuted: 'text-sm text-white/60',
    label: 'text-sm font-medium text-white/90',
    labelMuted: 'text-sm text-white/60',
  },
  radius: {
    card: 'rounded-3xl',
    button: 'rounded-lg',
    badge: 'rounded-full',
    input: 'rounded-lg',
  },
  effects: {
    backdropBlur: 'backdrop-blur-sm',
    shadow: 'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
    shadowSoft: 'shadow-[0_4px_16px_rgba(0,0,0,0.2)]',
  },
} as const

/**
 * Design Rules (non-negotiable)
 * 
 * 1. Orange (accent) is ONLY for:
 *    - Primary CTAs
 *    - Selected states (time range, active nav)
 *    - Key highlights (hairline dividers, key numbers)
 * 
 * 2. Status indicators:
 *    - Use badges, not colored dots
 *    - Badge backgrounds: white/5 (neutral), orange/10 (warning), red/10 (critical)
 * 
 * 3. Typography:
 *    - Serif (font-display): Page titles, section titles only
 *    - Sans-serif: Everything else (data, labels, UI)
 * 
 * 4. Background:
 *    - Single ambient orange glow (radial gradient)
 *    - No extra glows per card
 * 
 * 5. Spacing:
 *    - Sections: 48-72px vertical space
 *    - Avoid cramped layouts
 */

