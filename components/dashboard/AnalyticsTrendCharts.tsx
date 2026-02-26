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

type JobsTrendData = { period: string; created?: number; completionRate?: number };
type RiskTrendData = { period: string; value: number };
type StatusBarData = { status: string; count: number }[];

type AnalyticsTrendChartsProps = {
  trendsJobs: TrendsResponse;
  trendsCompletion: TrendsResponse;
  trendsRisk: TrendsResponse;
  jobCountsByStatus?: Record<string, number>;
  periodLabel?: string;
  isLoading?: boolean;
  onPeriodClick?: (period: string) => void;
};

function formatPeriodLabel(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: period.length > 10 ? 'numeric' : undefined });
}

export function AnalyticsTrendCharts({
  trendsJobs,
  trendsCompletion,
  trendsRisk,
  jobCountsByStatus = {},
  periodLabel = 'Last 30 days',
  isLoading = false,
  onPeriodClick,
}: AnalyticsTrendChartsProps) {
  const jobsByPeriod = new Map<string, { created?: number; completionRate?: number }>();
  (trendsJobs?.data ?? []).forEach((p: TrendPoint) => jobsByPeriod.set(p.period, { ...jobsByPeriod.get(p.period), created: p.value }));
  (trendsCompletion?.data ?? []).forEach((p: TrendPoint) => jobsByPeriod.set(p.period, { ...jobsByPeriod.get(p.period), completionRate: p.value }));
  const jobsChartData: JobsTrendData[] = Array.from(jobsByPeriod.entries())
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const riskChartData: RiskTrendData[] = (trendsRisk?.data ?? []).map((p: TrendPoint) => ({
    period: p.period,
    value: p.value,
  }));

  const statusBarData: StatusBarData = Object.entries(jobCountsByStatus).map(([status, count]) => ({
    status: status.replace(/_/g, ' '),
    count,
  }));

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
      {/* Jobs over time: created + completion rate */}
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
                  yAxisId="left"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  tickFormatter={(v) => String(v)}
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelFormatter={(label) => formatPeriodLabel(String(label))}
                  formatter={(value: number | undefined, name: string | undefined) => [name === 'created' ? `${value ?? 0} jobs` : `${value ?? 0}%`, name === 'created' ? 'Created' : 'Completion rate']}
                />
                <Legend formatter={() => null} />
                <Line
                  yAxisId="left"
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
                  yAxisId="right"
                  type="monotone"
                  dataKey="completionRate"
                  name="completionRate"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#22c55e' }}
                  connectNulls
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
                    if (d?.period) onPeriodClick?.(d.period);
                  }}
                  cursor={onPeriodClick ? 'pointer' : 'default'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Jobs by status (bar) */}
      {statusBarData.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-2">Jobs by status</h3>
          <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBarData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartCommon.stroke} />
                <XAxis
                  dataKey="status"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  formatter={(value: number | undefined) => [value ?? 0, 'Jobs']}
                />
                <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} name="Jobs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsTrendCharts;
