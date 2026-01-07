/**
 * Design Tokens for Executive Brief PDF
 * 
 * Single source of truth for spacing, typography, and colors
 * Locked to 8pt grid system for premium feel
 */

export const PDF_TOKENS = {
  colors: {
    primaryText: '#1A1A1A',
    secondaryText: '#666666',
    borderGray: '#E5E5E5',
    lightGrayBg: '#F5F5F5',
    cardBg: '#FAFAFA',
    tableHeaderBg: '#F8F9FA',
    white: '#FFFFFF',
    riskLow: '#10B981',
    riskMedium: '#F59E0B',
    riskHigh: '#EF4444',
    accent: '#2563EB',
    accentLight: '#3B82F6',
  },
  fonts: {
    header: 'Helvetica-Bold',
    body: 'Helvetica',
  },
  sizes: {
    h1: 32, // Premium title size
    h2: 22, // Section headers
    h3: 16, // Org name
    body: 11,
    caption: 9,
    kpiValue: 24, // Big numbers in KPI cards
    kpiLabel: 9,
  },
  spacing: {
    margin: 48, // 6 * 8pt
    sectionGap: 32, // 4 * 8pt
    rowSpacing: 20, // Not perfect 8pt, but maintains readability
    cardPadding: 16, // 2 * 8pt
    tableRowHeight: 26, // Taller rows for readability
    tableCellPadding: 12,
  },
  borderRadius: {
    card: 4, // Subtle rounded corners for cards
  },
  // 8pt grid multipliers for consistent spacing
  grid: {
    unit: 8,
    x1: 8,
    x2: 16,
    x3: 24,
    x4: 32,
    x5: 40,
    x6: 48,
  },
} as const

// Export type for tokens
export type PDFTokens = typeof PDF_TOKENS

