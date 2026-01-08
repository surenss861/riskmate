/**
 * Core PDF Design Tokens
 * 
 * Reusable design system for all PDF reports
 * Single source of truth for spacing, typography, and colors
 */

export const PDF_CORE_TOKENS = {
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
    h1: 30,
    h2: 17,
    h3: 16,
    body: 10.5,
    caption: 9,
    kpiValue: 24,
    kpiLabel: 9,
    kpiDelta: 8,
  },
  spacing: {
    margin: 48,
    sectionGap: 32,
    rowSpacing: 20,
    cardPadding: 16,
    tableRowHeight: 26,
    tableCellPadding: 12,
  },
}

