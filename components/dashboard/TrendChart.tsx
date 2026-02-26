'use client';

import React, { useMemo } from 'react';
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

export type TrendPoint = { period: string; value: number; label?: string };

type TrendsResponse = { data: TrendPoint[] } | null;

type JobsTrendData = { period: string; created?: number; completed?: number };
type RiskTrendData = { period: string; value: number };
/** One row per period (e.g. week); keys are status names, values are counts. */
type StatusByPeriodRow = { period: string; [status: string]: string | number };

type TrendChartProps = {
  trendsJobs: TrendsResponse;
  trendsCompletion: TrendsResponse;
  trendsRisk: TrendsResponse;
  /** Flat counts for whole range; used when statusByPeriod is not provided. */
  jobCountsByStatus?: Record<string, number>;
  /** Optional: status counts per period (e.g. per week) for stacked/clustered bars. */
  statusByPeriod?: StatusByPeriodRow[];
  periodLabel?: string;
  isLoading?: boolean;
  onPeriodClick?: (period: string) => void;
  onStatusClick?: (status: string, period?: string) => void;
};

function formatPeriodLabel(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: period.length > 10 ? 'numeric' : undefined,
  });
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#F97316',
  pending: '#94a3b8',
  open: '#94a3b8',
  unknown: '#64748b',
};

function getStatusColor(status: string): string {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  return STATUS_COLORS[key] ?? '#F97316';
}

export function TrendChart({
  trendsJobs,
  trendsCompletion,
  trendsRisk,
  jobCountsByStatus = {},
  statusByPeriod,
  periodLabel = 'Last 30 days',
  isLoading = false,
  onPeriodClick,
  onStatusClick,
}: TrendChartProps) {
  const jobsChartData = useMemo((): JobsTrendData[] => {
    const jobsByPeriod = new Map<string, { created?: number; completed?: number }>();
    (trendsJobs?.data ?? []).forEach((p: TrendPoint) =>
      jobsByPeriod.set(p.period, { ...jobsByPeriod.get(p.period), created: p.value })
    );
    (trendsCompletion?.data ?? []).forEach((p: TrendPoint) => {
      const cur = jobsByPeriod.get(p.period) ?? {};
      const created = cur.created ?? 0;
      const rate = Math.max(0, Math.min(100, p.value)) / 100;
      jobsByPeriod.set(p.period, { ...cur, completed: Math.round(created * rate) });
    });
    return Array.from(jobsByPeriod.entries())
      .map(([period, v]) => ({ period, ...v }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [trendsJobs, trendsCompletion]);

  const riskChartData = useMemo(
    (): RiskTrendData[] =>
      (trendsRisk?.data ?? []).map((p: TrendPoint) => ({ period: p.period, value: p.value })),
    [trendsRisk]
  );

  const statusChartData = useMemo(() => {
    if (statusByPeriod && statusByPeriod.length > 0) {
      return statusByPeriod;
    }
    const statuses = Object.entries(jobCountsByStatus).filter(([, count]) => count > 0);
    if (statuses.length === 0) return [];
    const periodKey = periodLabel || 'Selected period';
    const row: StatusByPeriodRow = { period: periodKey };
    statuses.forEach(([status, count]) => {
      row[status.replace(/_/g, ' ')] = count;
    });
    return [row];
  }, [statusByPeriod, jobCountsByStatus, periodLabel]);

  const statusKeys = useMemo(() => {
    if (statusByPeriod && statusByPeriod.length > 0) {
      const keys = new Set<string>();
      statusByPeriod.forEach((row) => {
        Object.keys(row).forEach((k) => {
          if (k !== 'period') keys.add(k);
        });
      });
      return Array.from(keys);
    }
    return Object.keys(jobCountsByStatus)
      .filter((k) => (jobCountsByStatus[k] ?? 0) > 0)
      .map((s) => s.replace(/_/g, ' '));
  }, [statusByPeriod, jobCountsByStatus]);

  const chartCommon = {
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
    stroke: 'rgba(255,255,255,0.08)',
  };

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

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      {/* Jobs over time: created + completed */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Jobs over time</h3>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        {jobsChartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-white/50 text-sm">No data</div>
        ) : (
          <div className="h-56">
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
                  contentStyle={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined, name?: string) => [
                    `${value ?? 0} jobs`,
                    name === 'created' ? 'Created' : 'Completed',
                  ]}
                />
                <Legend
                  formatter={(value) => (value === 'created' ? 'Created' : 'Completed')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="created"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#F97316' }}
                  connectNulls
                  onClick={(props: unknown) => {
                    const d = props as { period?: string };
                    if (d?.period) onPeriodClick?.(d.period);
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
                    const d = props as { period?: string };
                    if (d?.period) onPeriodClick?.(d.period);
                  }}
                  cursor={onPeriodClick ? 'pointer' : 'default'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Risk score trend (area) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Risk score trend</h3>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        {riskChartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-white/50 text-sm">No data</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskChartData} {...chartCommon}>
                <defs>
                  <linearGradient id="trendRiskGradient" x1="0" y1="0" x2="0" y2="1">
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
                  contentStyle={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined) => [
                    `Avg risk: ${(value ?? 0).toFixed(1)}`,
                    '',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  fill="url(#trendRiskGradient)"
                  strokeWidth={2}
                  onClick={(props: unknown) => {
                    const d = props as { period?: string };
                    if (d?.period) onPeriodClick?.(d.period);
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-2">Jobs by status</h3>
          <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusChartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartCommon.stroke} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                  }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined, name?: string) => [
                    value ?? 0,
                    name ?? '',
                  ]}
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
                      const row = payload as StatusByPeriodRow;
                      if (!row?.period) return;
                      onStatusClick?.(key, row.period);
                      onPeriodClick?.(row.period);
                    }}
                    cursor={onStatusClick || onPeriodClick ? 'pointer' : 'default'}
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

export default TrendChart;
