/**
 * Global Design System for RiskMate
 * 
 * This file defines standardized styles for cards, buttons, spacing, and other UI elements
 * to ensure consistency across the entire application.
 */

// Card Styles
export const cardStyles = {
  base: 'rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm',
  elevated: 'rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.4)]',
  flat: 'rounded-lg border border-white/10 bg-[#0A0A0A]',
  padding: {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },
}

// Button Styles
export const buttonStyles = {
  primary: 'inline-flex items-center justify-center rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-black hover:bg-[#FB923C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'inline-flex items-center justify-center rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/5 hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  tertiary: 'inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:border-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  sizes: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  },
}

// Spacing Scale
export const spacing = {
  section: 'mb-8', // Space between major sections
  card: 'p-6 md:p-8', // Standard card padding
  button: 'px-4 py-2', // Standard button padding
  input: 'px-4 py-2', // Standard input padding
  gap: {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  },
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

// Badge Styles
export const badgeStyles = {
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
  base: 'px-2 py-1 rounded text-xs font-medium border',
}

// Tab Styles
export const tabStyles = {
  container: 'flex gap-2 border-b border-white/10',
  item: 'px-4 py-2 text-sm font-medium transition-colors',
  active: 'text-[#F97316] border-b-2 border-[#F97316]',
  inactive: 'text-white/60 hover:text-white',
}

// Modal Styles
export const modalStyles = {
  backdrop: 'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm',
  container: 'relative mx-4 my-8 w-full max-w-4xl rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6 max-h-[calc(100vh-4rem)] overflow-y-auto',
  header: 'flex items-center justify-between mb-6',
  title: 'text-xl font-semibold text-white',
  closeButton: 'text-white/60 hover:text-white transition-colors',
}

// Input Styles
export const inputStyles = {
  base: 'w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]/30 transition-colors',
  textarea: 'w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]/30 transition-colors resize-none',
  select: 'w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]/30 transition-colors',
}

// Divider Styles
export const dividerStyles = {
  horizontal: 'border-t border-white/10',
  vertical: 'border-l border-white/10',
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

