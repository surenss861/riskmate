/**
 * Performance monitoring utilities
 * Lightweight metrics for dev environment
 */

// Performance budgets
export const PERFORMANCE_BUDGETS = {
  JOB_DETAIL_FIRST_RENDER: 800, // ms
  PREFETCHED_CLICK_TO_HEADER: 200, // ms
  MAX_DOUBLE_LOADS: 0, // No skeleton + spinner at same time
  MAX_PREFETCH_CONCURRENCY: 2, // Max concurrent prefetches
} as const

// Performance markers
let markers: Map<string, number> = new Map()

export const performance = {
  mark: (name: string) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      markers.set(name, performance.now())
      if (window.performance?.mark) {
        window.performance.mark(name)
      }
    }
  },

  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const start = markers.get(startMark)
      const end = endMark ? markers.get(endMark) : performance.now()
      
      if (start && end) {
        const duration = end - start
        const budget = PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS]
        
        if (budget && duration > budget) {
          console.warn(`⚠️ Performance budget exceeded: ${name} took ${duration.toFixed(0)}ms (budget: ${budget}ms)`)
        } else {
          console.log(`✅ ${name}: ${duration.toFixed(0)}ms`)
        }
        
        if (window.performance?.measure) {
          window.performance.measure(name, startMark, endMark)
        }
      }
    }
  },

  clear: () => {
    markers.clear()
  },
}

