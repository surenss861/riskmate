'use client'

import { ReactNode } from 'react'
import { GlassCard } from './GlassCard'
import { Button } from './Button'
import clsx from 'clsx'

type ChartCardProps = {
  title?: string
  children: ReactNode
  className?: string
  emptyReason?: 'no_jobs' | 'no_events' | 'not_configured' | null
  emptyTitle?: string
  emptyMessage?: string
  onCreateJob?: () => void
  onViewData?: () => void
}

/**
 * ChartCard - Standardized chart wrapper component
 * Enforces consistent styling, typography, empty states, and CTA behavior
 * 
 * Rules:
 * - Title uses font-display (serif, section-title size)
 * - Gridlines use subtle opacity (rgba(255,255,255,0.06))
 * - Axis labels use muted sans token
 * - Empty states always use editorial CTAs
 * - Tooltips use secondary surface (bg-white/5)
 */
export function ChartCard({
  title,
  children,
  className,
  emptyReason,
  emptyTitle,
  emptyMessage,
  onCreateJob,
  onViewData,
}: ChartCardProps) {
  const hasEmptyState = emptyReason !== null && emptyReason !== undefined

  return (
    <GlassCard className={clsx('p-8', className)}>
      {title && (
        <h3 className="text-xl font-bold font-display text-white mb-6">
          {title}
        </h3>
      )}
      
      {hasEmptyState ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">
            {emptyTitle || getEmptyTitle(emptyReason)}
          </h4>
          <p className="text-sm text-white/60 mb-6 max-w-md">
            {emptyMessage || getEmptyMessage(emptyReason)}
          </p>
          {emptyReason === 'no_jobs' && onCreateJob && (
            <Button variant="primary" onClick={onCreateJob}>
              Create Job
            </Button>
          )}
          {emptyReason === 'no_events' && onViewData && (
            <Button variant="secondary" onClick={onViewData}>
              View Open Items
            </Button>
          )}
        </div>
      ) : (
        children
      )}
    </GlassCard>
  )
}

function getEmptyTitle(reason: string): string {
  switch (reason) {
    case 'no_jobs':
      return 'No jobs in this range'
    case 'no_events':
      return 'No activity yet'
    case 'not_configured':
      return 'Tracking not enabled'
    default:
      return 'No data available'
  }
}

function getEmptyMessage(reason: string): string {
  switch (reason) {
    case 'no_jobs':
      return 'Create a job to start tracking trends and compliance metrics.'
    case 'no_events':
      return 'Complete mitigations or create attestations to see activity here.'
    case 'not_configured':
      return 'Enable tracking in settings to view charts and trends.'
    default:
      return 'Data will appear here once available.'
  }
}

// Chart tokens are exported from lib/styles/chart-tokens.ts
// Import them from there for use in chart libraries

