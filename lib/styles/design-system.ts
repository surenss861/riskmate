/**
 * Global Design System for RiskMate
 * 
 * This file defines standardized styles for cards, buttons, spacing, and other UI elements
 * to ensure consistency across the entire application.
 */

// Shadow System (Week 2: 3 levels only)
export const shadows = {
  flat: '', // No shadow - default cards
  raised: 'shadow-[0_4px_12px_rgba(0,0,0,0.3)]', // Modals, dropdowns
  focused: 'shadow-[0_0_0_2px_rgba(249,115,22,0.2)]', // Active/hover focus
}

// Card Styles (Week 2: consistent structure)
export const cardStyles = {
  base: 'rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm',
  elevated: `rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm ${shadows.raised}`,
  flat: 'rounded-lg border border-white/10 bg-[#0A0A0A]',
  padding: {
    sm: 'p-4', // 16px - compact
    md: 'p-6', // 24px - standard
    lg: 'p-8', // 32px - spacious
  },
}

// Motion System (Week 2: slower, premium feel)
export const motion = {
  // Transition timing (premium = slightly slower)
  fast: 'transition-all duration-150 ease-out',
  normal: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
  
  // Specific transitions
  hover: 'transition-colors duration-200 ease-out',
  focus: 'transition-all duration-150 ease-out',
  expand: 'transition-all duration-300 ease-out',
}

// Week 5: Standardized hover states (no bouncy motion)
export const hoverStates = {
  // Cards: subtle background change
  card: 'hover:bg-[#121212]/90 transition-colors duration-200 ease-out',
  // Rows: subtle background change
  row: 'hover:bg-white/5 transition-colors duration-200 ease-out',
  // Badges: subtle border/background change
  badge: 'hover:border-white/20 transition-colors duration-200 ease-out',
  // Tabs: color change only
  tab: 'hover:text-white transition-colors duration-200 ease-out',
  // Buttons: already defined in buttonStyles
  // Icon buttons: subtle scale (no bounce)
  iconButton: 'hover:bg-white/10 active:scale-95 transition-all duration-150 ease-out',
}

// Button Styles (Week 2: firm hover, clear disabled)
export const buttonStyles = {
  primary: `inline-flex items-center justify-center rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-black hover:bg-[#FB923C] ${motion.hover} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#F97316]`,
  secondary: `inline-flex items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/5 hover:border-white/30 ${motion.hover} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`,
  tertiary: `inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:border-white/15 ${motion.hover} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5`,
  sizes: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  },
}

// Spacing Scale (Week 2: Enterprise-grade rhythm)
export const spacing = {
  // Vertical spacing (predictable rhythm)
  tight: 'mb-2', // 8px - tight grouping
  normal: 'mb-4', // 16px - standard content spacing
  relaxed: 'mb-6', // 24px - section breaks
  section: 'mb-8', // 32px - major section breaks
  
  // Horizontal spacing
  gap: {
    tight: 'gap-2', // 8px
    normal: 'gap-4', // 16px
    relaxed: 'gap-6', // 24px
  },
  
  // Padding (consistent card structure)
  padding: {
    tight: 'p-4', // 16px - compact cards
    normal: 'p-6', // 24px - standard cards
    relaxed: 'p-8', // 32px - spacious cards
  },
  
  // Legacy (deprecated, use above)
  card: 'p-6',
  button: 'px-4 py-2',
  input: 'px-4 py-2',
}

// Typography
export const typography = {
  h1: 'text-4xl md:text-5xl font-bold font-display text-white',
  h2: 'text-2xl md:text-3xl font-semibold text-white',
  h3: 'text-xl font-semibold text-white',
  h4: 'text-lg font-semibold text-white',
  body: 'text-sm text-white/90',
  bodyMuted: 'text-sm text-white/60',
  caption: 'text-xs text-white/50',
  label: 'text-sm font-medium text-white/80',
}

// Badge Styles (Week 5: Unified, consistent, semantic)
export const badgeStyles = {
  // Week 5: Same size, same radius everywhere
  base: 'px-2 py-1 rounded-lg text-xs font-medium border',
  
  risk: {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  
  status: {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'on-hold': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  
  // Week 5: Evidence verification badges (Pending/Approved/Rejected)
  verification: {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  
  // Week 5: Plan badges
  plan: {
    starter: 'bg-white/5 text-white/70 border-white/10',
    pro: 'bg-[#F97316]/20 text-[#F97316] border-[#F97316]/30',
    business: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
}

// Tab Styles
export const tabStyles = {
  container: 'flex gap-2 border-b border-white/10',
  item: 'px-4 py-2 text-sm font-medium transition-colors',
  active: 'text-[#F97316] border-b-2 border-[#F97316]',
  inactive: 'text-white/60 hover:text-white',
}

// Modal Styles (Week 2: consistent max-width, clear separation)
export const modalStyles = {
  backdrop: `fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm`,
  container: `relative mx-4 my-8 w-full max-w-4xl rounded-lg border border-white/10 bg-[#121212] p-6 max-h-[calc(100vh-4rem)] overflow-y-auto ${shadows.raised}`,
  header: `flex items-center justify-between ${spacing.relaxed}`,
  title: 'text-xl font-semibold text-white',
  closeButton: `text-white/60 hover:text-white ${motion.hover}`,
  footer: `flex items-center justify-end gap-3 ${spacing.relaxed} pt-6 border-t border-white/10`,
}

// Input Styles (Week 2: consistent height, subtle focus)
export const inputStyles = {
  base: `w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316]/30 ${motion.focus}`,
  textarea: `w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316]/30 ${motion.focus} resize-none`,
  select: `w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316]/30 ${motion.focus}`,
}

// Divider Styles (Week 2: subtle, used sparingly)
export const dividerStyles = {
  horizontal: 'border-t border-white/5', // Reduced opacity
  vertical: 'border-l border-white/5',
  section: 'border-t border-white/10 mt-8 pt-8', // Section breaks only
}

// Empty State Styles
export const emptyStateStyles = {
  container: 'text-center py-12 border border-white/10 rounded-lg bg-black/20',
  icon: 'text-4xl mb-4',
  title: 'text-sm font-medium text-white mb-2',
  description: 'text-xs text-white/60 mb-4 max-w-md mx-auto',
  action: buttonStyles.primary,
}

// Helper functions for badges
export const getRiskBadgeClass = (riskLevel: string | null): string => {
  if (!riskLevel) return `${badgeStyles.base} ${badgeStyles.risk.low}`
  const level = riskLevel.toLowerCase()
  if (level === 'critical' || level === 'very high') return `${badgeStyles.base} ${badgeStyles.risk.critical}`
  if (level === 'high') return `${badgeStyles.base} ${badgeStyles.risk.high}`
  if (level === 'medium' || level === 'moderate') return `${badgeStyles.base} ${badgeStyles.risk.medium}`
  return `${badgeStyles.base} ${badgeStyles.risk.low}`
}

export const getStatusBadgeClass = (status: string | null): string => {
  if (!status) return `${badgeStyles.base} ${badgeStyles.status.active}`
  const statusLower = status.toLowerCase()
  if (statusLower === 'completed' || statusLower === 'done') return `${badgeStyles.base} ${badgeStyles.status.completed}`
  if (statusLower === 'on-hold' || statusLower === 'on hold' || statusLower === 'paused') return `${badgeStyles.base} ${badgeStyles.status['on-hold']}`
  if (statusLower === 'cancelled' || statusLower === 'canceled') return `${badgeStyles.base} ${badgeStyles.status.cancelled}`
  return `${badgeStyles.base} ${badgeStyles.status.active}`
}

export const getRiskBadgeClassFromScore = (score: number | null): string => {
  if (score === null) return `${badgeStyles.base} bg-gray-500/20 text-gray-400 border-gray-500/30`
  if (score >= 71) return `${badgeStyles.base} ${badgeStyles.risk.critical}`
  if (score >= 41) return `${badgeStyles.base} ${badgeStyles.risk.high}`
  if (score >= 21) return `${badgeStyles.base} ${badgeStyles.risk.medium}`
  return `${badgeStyles.base} ${badgeStyles.risk.low}`
}

