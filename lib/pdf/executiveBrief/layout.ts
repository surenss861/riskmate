/**
 * Layout Constants for Executive Brief PDF
 * 
 * Page region definitions for locked Page 1 layout
 */

export const PAGE_REGIONS = {
  // Page 1 fixed regions
  headerBand: {
    height: 0.14, // 14% of page height
    y: 0,
  },
  kpiCards: {
    height: 95, // Fixed height for KPI card strip
  },
  gauge: {
    height: 100, // Fixed height for risk posture gauge
  },
  summary: {
    maxBullets: 3, // Cap executive summary bullets
  },
  metricsTable: {
    headerHeight: 30, // Table header + section header
    rowHeight: 26, // Per-row height
  },
  dataCoverage: {
    height: 80, // Approximate height for compact data coverage
  },
  // Page 2 regions
  actions: {
    minHeight: 120, // Minimum space for recommended actions
  },
  methodology: {
    height: 100, // Approximate height for methodology section
  },
  // Layout rules
  page1Bottom: 80, // Footer space
  page2Bottom: 80,
  defaultPageCount: 2, // Default is 2 pages (no page 3 unless necessary)
} as const

export type PageRegions = typeof PAGE_REGIONS

