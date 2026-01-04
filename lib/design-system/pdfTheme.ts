/**
 * PDF Theme Tokens
 * Consistent design system for PDF packets
 * Minimal, court-ready, brand-aligned
 */

export const pdfTheme = {
  colors: {
    ink: '#0B0B0B', // Primary text (near-black)
    muted: '#525252', // Secondary text
    borders: '#EAEAEA', // Lines and borders (light gray)
    paper: '#FFFFFF', // Background (white)
    accent: '#F97316', // RiskMate Orange - only for emphasis (headers, dividers, badges)
    accentLight: '#FED7AA', // Lighter orange for backgrounds if needed
  },
  
  spacing: {
    pageMargin: '16mm',
    sectionGap: '20pt',
    cardPadding: '14pt',
    gridGap: '14pt',
    textGap: '10pt',
  },
  
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    sizes: {
      h1: '22pt',
      h2: '18pt',
      h3: '14pt',
      body: '11pt',
      caption: '9pt',
      small: '8pt',
    },
    weights: {
      bold: 700,
      semibold: 600,
      regular: 400,
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.5,
      relaxed: 1.6,
    },
  },
  
  borders: {
    thin: '0.5pt',
    medium: '1pt',
    thick: '2pt',
    radius: '4pt',
  },
  
  header: {
    height: '48pt',
    fontSize: '9pt',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
  },
  
  footer: {
    height: '40pt',
    fontSize: '8pt',
    textColor: '#666666',
    borderColor: '#E5E5E5',
  },
} as const

