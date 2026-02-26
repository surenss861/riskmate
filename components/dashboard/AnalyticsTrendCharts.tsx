'use client';

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
  isLoading?: boolean;
  onPeriodClick?: (period: string, opts?: { useCompletionDate?: boolean }) => void;
  onStatusClick?: (status: string, period?: string) => void;
};

function formatPeriodLabel(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: period.length > 10 ? 'numeric' : undefined });
}

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

export function AnalyticsTrendCharts({
  trendsJobs,
  trendsCompletion,
  trendsCompletedCounts,
  trendsRisk,
  jobCountsByStatus = {},
  statusByPeriod,
  periodLabel = 'Last 30 days',
  isLoading = false,
  onPeriodClick,
  onStatusClick,
}: AnalyticsTrendChartsProps) {
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
  const jobsChartData: JobsTrendData[] = Array.from(jobsByPeriod.entries())
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const riskChartData: RiskTrendData[] = (trendsRisk?.data ?? []).map((p: TrendPoint) => ({
    period: p.period,
    value: p.value,
  }));

  // Use statusByPeriod when available; otherwise build a single-row dataset from jobCountsByStatus so the Jobs-by-status chart still renders.
  const hasStatusByPeriod = statusByPeriod && statusByPeriod.length > 0;
  const statusChartData: StatusByPeriodRow[] = hasStatusByPeriod
    ? statusByPeriod
    : (() => {
        const counts = jobCountsByStatus ?? {};
        const keys = Object.keys(counts).filter(
          (k) => typeof counts[k] === 'number' && (counts[k] as number) > 0
        );
        if (keys.length === 0) return [];
        const row: StatusByPeriodRow = { period: periodLabel || 'Total' };
        keys.forEach((k) => (row[k] = counts[k] as number));
        return [row];
      })();

  const statusKeys =
    statusChartData.length > 0
      ? Array.from(
          new Set(statusChartData.flatMap((row) => Object.keys(row).filter((k) => k !== 'period')))
        )
      : [];

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
                    const d = props as { period?: string };
                    if (d?.period && isValidPeriod(d.period)) onPeriodClick?.(d.period);
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
                    if (d?.period && isValidPeriod(d.period)) onPeriodClick?.(d.period, { useCompletionDate: true });
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
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#riskGradient)"
                  strokeWidth={2}
                  onClick={(props: unknown) => {
                    const d = props as { period?: string };
                    if (d?.period && isValidPeriod(d.period)) onPeriodClick?.(d.period);
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
                      const row = payload as StatusByPeriodRow;
                      if (!row?.period || !isValidPeriod(row.period)) return;
                      onStatusClick?.(key, row.period);
                      const statusNorm = key.replace(/\s+/g, '_').toLowerCase();
                      const useCompletionDate = statusNorm === 'completed';
                      onPeriodClick?.(row.period, { useCompletionDate });
                    }}
                    cursor={
                      (onStatusClick || onPeriodClick) &&
                      statusChartData.some((row) => isValidPeriod(row.period))
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
