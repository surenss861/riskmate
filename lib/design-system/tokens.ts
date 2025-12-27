/**
 * RiskMate Design System Tokens
 * 
 * Single source of truth for both marketing site and app UI.
 * Two "skins" use the same tokens but different application rules.
 */

// ============================================
// COLORS
// ============================================
export const colors = {
  // Brand
  cordovan: '#912F40', // Primary accent (trustworthy, premium)
  cordovanLight: '#B84D5F',
  cordovanDark: '#6B1F2D',
  
  // Neutrals
  black: '#111111',
  gray900: '#1A1A1A',
  gray800: '#2D2D2D',
  gray700: '#404040',
  gray600: '#555555',
  gray500: '#707070',
  gray400: '#999999',
  gray300: '#CCCCCC',
  gray200: '#E6E6E6',
  gray100: '#F5F5F5',
  gray50: '#FAFAFA',
  white: '#FFFFFF',
  
  // Semantic
  success: '#34C759',
  warning: '#FFCC00',
  error: '#FF6B35',
  critical: '#912F40', // Same as cordovan for critical risk
  
  // Risk levels
  riskLow: '#34C759',
  riskMedium: '#FFCC00',
  riskHigh: '#FF6B35',
  riskCritical: '#912F40',
  
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#FAFAFA',
  bgTertiary: '#F5F5F5',
  
  // Borders
  borderLight: '#E6E6E6',
  borderMedium: '#CCCCCC',
  borderDark: '#999999',
  
  // Glass/Overlay
  glassWhite: 'rgba(255, 255, 255, 0.8)',
  glassBlack: 'rgba(17, 17, 17, 0.6)',
} as const

// ============================================
// TYPOGRAPHY
// ============================================
export const typography = {
  // Font families
  fontDisplay: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif', // Can upgrade to Inter/Cabinet later
  fontBody: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  
  // Marketing (larger, more expressive)
  marketing: {
    h1: { fontSize: 'clamp(3rem, 8vw, 5rem)', lineHeight: 1.1, fontWeight: 700 },
    h2: { fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.2, fontWeight: 700 },
    h3: { fontSize: 'clamp(1.5rem, 3vw, 2rem)', lineHeight: 1.3, fontWeight: 600 },
    body: { fontSize: 'clamp(1rem, 1.5vw, 1.125rem)', lineHeight: 1.6, fontWeight: 400 },
    caption: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 },
  },
  
  // App (tighter, more information-dense)
  app: {
    h1: { fontSize: '2rem', lineHeight: 1.2, fontWeight: 700 },
    h2: { fontSize: '1.5rem', lineHeight: 1.3, fontWeight: 600 },
    h3: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 600 },
    body: { fontSize: '0.9375rem', lineHeight: 1.5, fontWeight: 400 },
    caption: { fontSize: '0.8125rem', lineHeight: 1.4, fontWeight: 400 },
    small: { fontSize: '0.75rem', lineHeight: 1.4, fontWeight: 400 },
  },
} as const

// ============================================
// SPACING
// ============================================
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '6rem',   // 96px
  '5xl': '8rem',   // 128px
  
  // Marketing (more generous)
  marketing: {
    section: '8rem',      // Section spacing
    container: '1.5rem',  // Container padding
    card: '2rem',         // Card padding
  },
  
  // App (tighter)
  app: {
    section: '3rem',
    container: '1rem',
    card: '1.5rem',
  },
} as const

// ============================================
// BORDER RADIUS
// ============================================
export const radius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
} as const

// ============================================
// SHADOWS
// ============================================
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Glass effect
  glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
} as const

// ============================================
// BLUR
// ============================================
export const blur = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  xl: '24px',
  '2xl': '40px',
} as const

// ============================================
// Z-INDEX
// ============================================
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const

// ============================================
// BREAKPOINTS
// ============================================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// ============================================
// TRANSITIONS
// ============================================
export const transitions = {
  fast: '150ms ease',
  base: '250ms ease',
  slow: '350ms ease',
  bounce: '400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const

// ============================================
// EXPORT TYPES
// ============================================
export type ColorKey = keyof typeof colors
export type SpacingKey = keyof typeof spacing
export type RadiusKey = keyof typeof radius
export type ShadowKey = keyof typeof shadows

