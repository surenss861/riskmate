/**
 * PDF Theme Tokens
 * Consistent design system for PDF packets
 * Minimal, court-ready, brand-aligned
 */

export const pdfTheme = {
  colors: {
    ink: '#0A0A0A', // Primary text
    muted: '#525252', // Secondary text
    borders: '#E5E5E5', // Lines and borders
    paper: '#FFFFFF', // Background
    accent: '#F97316', // Brand orange - only for emphasis (headers, dividers, badges)
    accentLight: '#FED7AA', // Lighter orange for backgrounds if needed
  },
  
  spacing: {
    pageMargin: '16mm',
    sectionGap: '24pt',
    cardPadding: '16pt',
    gridGap: '16pt',
    textGap: '12pt',
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

