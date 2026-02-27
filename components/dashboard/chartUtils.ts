/**
 * Shared types and utilities for dashboard trend/analytics charts.
 * Used by TrendChart.tsx and AnalyticsTrendCharts.tsx to avoid duplication.
 */

export type TrendPoint = { period: string; value: number; label?: string };

/** One row per period (e.g. week); keys are status names, values are counts. */
export type StatusByPeriodRow = { period: string; [status: string]: string | number };

export function formatPeriodLabel(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: period.length > 10 ? 'numeric' : undefined,
  });
}

export const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#F97316',
  pending: '#94a3b8',
  open: '#94a3b8',
  unknown: '#64748b',
};

export function getStatusColor(status: string): string {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  return STATUS_COLORS[key] ?? '#F97316';
}
