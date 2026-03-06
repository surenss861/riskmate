'use client';

import React, { useId, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatPeriodLabel, getStatusColor, type TrendPoint, type StatusByPeriodRow } from './chartUtils';

export type { TrendPoint };
export type { StatusByPeriodRow };

type TrendsResponse = { data: TrendPoint[] } | null;

type JobsTrendData = { period: string; created?: number; completed?: number };
type RiskTrendData = { period: string; value: number };

type AnalyticsTrendChartsProps = {
  trendsJobs: TrendsResponse;
  trendsCompletion: TrendsResponse;
  /** Real completed counts per period (by completion date). When provided, used for the completed series instead of deriving from creation * rate. */
  trendsCompletedCounts?: TrendsResponse | null;
  trendsRisk: TrendsResponse;
  jobCountsByStatus?: Record<string, number>;
  /** Optional: status counts per period (e.g. per week) for stacked bars by week. */
  statusByPeriod?: StatusByPeriodRow[];
  periodLabel?: string;
  /** When statusByPeriod is absent, use this range for bar drill-down so Jobs-by-status remains clickable. */
  periodRangeStart?: string;
  periodRangeEnd?: string;
  /** Bucket granularity for trend charts (Jobs, Risk, Completion); passed to onPeriodClick for correct start/end. */
  trendsGranularity?: 'day' | 'week' | 'month';
  /** Bucket granularity for Jobs-by-status chart; passed to onStatusClick so drill-down uses same grouping as statusByPeriod. */
  statusChartGranularity?: 'day' | 'week';
  isLoading?: boolean;
  onPeriodClick?: (period: string, opts?: { useCompletionDate?: boolean; rangeEnd?: string; granularity?: 'day' | 'week' | 'month' }) => void;
  onStatusClick?: (status: string, period?: string, opts?: { rangeEnd?: string; granularity?: 'day' | 'week' }) => void;
};

/** True when period is a valid ISO date (YYYY-MM-DD), YYYY-MM (month bucket for 1y), or week start for drill-down. */
function isValidPeriod(period: string): boolean {
  if (!period || typeof period !== 'string') return false;
  const s = period.slice(0, 10);
  if (s.length === 10) {
    const d = new Date(s + 'T00:00:00.000Z');
    return !isNaN(d.getTime());
  }
  if (period.length >= 7) {
    const y = parseInt(period.slice(0, 4), 10);
    const m = parseInt(period.slice(5, 7), 10);
    if (Number.isNaN(y) || Number.isNaN(m) || y < 1970 || y > 2100 || m < 1 || m > 12) return false;
    const d = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    return !isNaN(d.getTime());
  }
  return false;
}

/** Safely resolve the clicked data row from Recharts click event (e.g. unwrap event.payload). */
function getClickedRow(event: unknown): { period?: string; [k: string]: unknown } | null {
  if (event == null || typeof event !== 'object') return null;
  const obj = event as Record<string, unknown>;
  const row =
    obj.payload != null && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as { period?: string; [k: string]: unknown })
      : (obj as { period?: string; [k: string]: unknown });
  return row;
}

export function AnalyticsTrendCharts({
  trendsJobs,
  trendsCompletion,
  trendsCompletedCounts,
  trendsRisk,
  jobCountsByStatus = {},
  statusByPeriod,
  periodLabel = 'Last 30 days',
  periodRangeStart,
  periodRangeEnd,
  trendsGranularity,
  statusChartGranularity,
  isLoading = false,
  onPeriodClick,
  onStatusClick,
}: AnalyticsTrendChartsProps) {
  const jobsChartData = useMemo((): JobsTrendData[] => {
    const jobsByPeriod = new Map<string, { created?: number; completed?: number }>();
    (trendsJobs?.data ?? []).forEach((p: TrendPoint) =>
      jobsByPeriod.set(p.period, { ...jobsByPeriod.get(p.period), created: p.value })
    );
    if (trendsCompletedCounts?.data?.length) {
      (trendsCompletedCounts.data as TrendPoint[]).forEach((p: TrendPoint) => {
        const cur = jobsByPeriod.get(p.period) ?? {};
        jobsByPeriod.set(p.period, { ...cur, completed: Math.round(Number(p.value ?? 0)) });
      });
    } else {
      (trendsCompletion?.data ?? []).forEach((p: TrendPoint) => {
        const cur = jobsByPeriod.get(p.period) ?? {};
        const created = cur.created ?? 0;
        const rate = Math.max(0, Math.min(100, p.value)) / 100;
        jobsByPeriod.set(p.period, { ...cur, completed: Math.round(created * rate) });
      });
    }
    return Array.from(jobsByPeriod.entries())
      .map(([period, v]) => ({ period, ...v }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [trendsJobs, trendsCompletion, trendsCompletedCounts]);

  const riskChartData = useMemo(
    (): RiskTrendData[] =>
      (trendsRisk?.data ?? []).map((p: TrendPoint) => ({ period: p.period, value: p.value })),
    [trendsRisk]
  );

  const hasStatusByPeriod = statusByPeriod && statusByPeriod.length > 0;
  const statusChartData = useMemo((): StatusByPeriodRow[] => {
    if (hasStatusByPeriod) return statusByPeriod;
    const counts = jobCountsByStatus ?? {};
    const keys = Object.keys(counts).filter(
      (k) => typeof counts[k] === 'number' && (counts[k] as number) > 0
    );
    if (keys.length === 0) return [];
    const row: StatusByPeriodRow = { period: periodLabel || 'Total' };
    keys.forEach((k) => (row[k] = counts[k] as number));
    return [row];
  }, [statusByPeriod, jobCountsByStatus, periodLabel, hasStatusByPeriod]);

  const gradientId = useId();

  const statusKeys = useMemo(
    () =>
      statusChartData.length > 0
        ? Array.from(
            new Set(statusChartData.flatMap((row) => Object.keys(row).filter((k) => k !== 'period')))
          )
        : [],
    [statusChartData]
  );

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Jobs over time</h3>
          <div className="h-56 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Risk score trend</h3>
          <div className="h-56 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const chartCommon = {
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
    stroke: 'rgba(255,255,255,0.08)',
  };

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 min-w-0">
      {/* Jobs over time: created + completed */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 min-w-0">
        <h3 className="text-lg font-semibold text-white mb-2">Jobs over time</h3>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        {jobsChartData.length === 0 ? (
          <div className="min-w-0 w-full h-56 flex items-center justify-center text-white/50 text-sm">No data</div>
        ) : (
          <div className="min-w-0 w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={jobsChartData} {...chartCommon}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartCommon.stroke} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={(v) => String(v)}
                />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined, name?: string) => [
                    `${value ?? 0} jobs`,
                    name === 'created' ? 'Created' : 'Completed',
                  ]}
                />
                <Legend formatter={(value) => (value === 'created' ? 'Created' : 'Completed')} wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="created"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#F97316' }}
                  connectNulls
                  onClick={(props: unknown) => {
                    const row = getClickedRow(props);
                    if (row?.period && isValidPeriod(row.period)) onPeriodClick?.(row.period, { granularity: trendsGranularity });
                  }}
                  cursor={onPeriodClick ? 'pointer' : 'default'}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="completed"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#22c55e' }}
                  connectNulls
                  onClick={(props: unknown) => {
                    const row = getClickedRow(props);
                    if (row?.period && isValidPeriod(row.period)) onPeriodClick?.(row.period, { useCompletionDate: true, granularity: trendsGranularity });
                  }}
                  cursor={onPeriodClick ? 'pointer' : 'default'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Risk score trend (area) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 min-w-0">
        <h3 className="text-lg font-semibold text-white mb-2">Risk score trend</h3>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        {riskChartData.length === 0 ? (
          <div className="min-w-0 w-full h-56 flex items-center justify-center text-white/50 text-sm">No data</div>
        ) : (
          <div className="min-w-0 w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskChartData} {...chartCommon}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartCommon.stroke} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined) => [`Avg risk: ${(value ?? 0).toFixed(1)}`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  fill={`url(#${gradientId})`}
                  strokeWidth={2}
                  onClick={(props: unknown) => {
                    const row = getClickedRow(props);
                    if (row?.period && isValidPeriod(row.period)) onPeriodClick?.(row.period, { granularity: trendsGranularity });
                  }}
                  cursor={onPeriodClick ? 'pointer' : 'default'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Jobs by status per week (stacked bars with period on each bar) */}
      {statusChartData.length > 0 && statusKeys.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-2">Jobs by status</h3>
          <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
          <div className="min-w-0 w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartCommon.stroke} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined, name?: string) => [value ?? 0, name ?? '']}
                />
                {statusKeys.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="status"
                    fill={getStatusColor(key)}
                    radius={[0, 0, 0, 0]}
                    name={key}
                    onClick={(payload: unknown) => {
                      const row = getClickedRow(payload) as StatusByPeriodRow | null;
                      const periodValid = row?.period && isValidPeriod(row.period);
                      const fallbackRange = !hasStatusByPeriod && periodRangeStart;
                      if (!periodValid && !fallbackRange) return;
                      const drillPeriod = periodValid ? row.period : periodRangeStart!;
                      const rangeEndOpt = fallbackRange && periodRangeEnd ? { rangeEnd: periodRangeEnd } : undefined;
                      const granularityOpt = statusChartGranularity != null ? { granularity: statusChartGranularity } : undefined;
                      const statusOpts = { ...rangeEndOpt, ...granularityOpt };
                      if (onStatusClick) {
                        onStatusClick(key, drillPeriod, statusOpts);
                        return;
                      }
                      const statusNorm = key.replace(/\s+/g, '_').toLowerCase();
                      const useCompletionDate = statusNorm === 'completed';
                      onPeriodClick?.(drillPeriod, { useCompletionDate, ...rangeEndOpt, granularity: trendsGranularity });
                    }}
                    cursor={
                      (onStatusClick || onPeriodClick) &&
                      (statusChartData.some((row) => isValidPeriod(row.period)) || (!!periodRangeStart && !hasStatusByPeriod))
                        ? 'pointer'
                        : 'default'
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsTrendCharts;
