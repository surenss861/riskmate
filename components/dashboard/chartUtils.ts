/**
 * Shared types and utilities for dashboard trend/analytics charts.
 * Used by TrendChart.tsx and AnalyticsTrendCharts.tsx to avoid duplication.
 */

export type TrendPoint = { period: string; value: number; label?: string };

/** One row per period (e.g. week); keys are status names, values are counts. */
export type StatusByPeriodRow = { period: string; [status: string]: string | number };

export function formatPeriodLabel(period: string): string {
  const trimmed = period.trim();
  // YYYY-MM month bucket: parse as UTC month to avoid timezone off-by-one
  if (trimmed.length === 7 && /^\d{4}-\d{2}$/.test(trimmed)) {
    const year = parseInt(trimmed.slice(0, 4), 10);
    const month = parseInt(trimmed.slice(5, 7), 10) - 1;
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)));
  }
  // YYYY-MM-DD: append noon UTC so parsing is stable and not off-by-one-day
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const dateStr = trimmed.slice(0, 10) + 'T12:00:00Z';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: trimmed.length > 10 ? 'numeric' : undefined,
        timeZone: 'UTC',
      });
    }
  }
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
