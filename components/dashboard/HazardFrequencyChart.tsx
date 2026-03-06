'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DashboardPeriod } from '@/lib/types/analytics';
import type { CustomRange } from '@/lib/utils/dateRange';

/** Safely resolve the clicked data row from Recharts click event (prefer nested payload, with fallback). */
function getClickedRow(event: unknown): { name?: string; category?: string; [k: string]: unknown } | null {
  if (event == null || typeof event !== 'object') return null;
  const obj = event as Record<string, unknown>;
  const row =
    obj.payload != null && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as { name?: string; category?: string; [k: string]: unknown })
      : (obj as { name?: string; category?: string; [k: string]: unknown });
  return row;
}

/** Resolve non-empty category string from clicked row (name is chart display; category is source field). */
function getCategoryFromRow(row: { name?: string; category?: string } | null): string {
  if (row == null) return '';
  const fromName = typeof row.name === 'string' ? row.name.trim() : '';
  if (fromName) return fromName;
  const fromCategory = typeof row.category === 'string' ? row.category.trim() : '';
  return fromCategory;
}

export type HazardFrequencyItem = {
  category: string;
  count: number;
  avg_risk: number;
  trend: 'up' | 'down' | 'neutral';
};

type HazardFrequencyChartProps = {
  items: HazardFrequencyItem[];
  periodLabel?: string;
  period?: DashboardPeriod;
  periodOptions?: { value: DashboardPeriod; label: string }[];
  onPeriodChange?: (period: DashboardPeriod, customRange?: CustomRange) => void;
  isLoading?: boolean;
  onCategoryClick?: (category: string) => void;
};

function riskToColor(avgRisk: number): string {
  if (avgRisk >= 75) return '#ef4444'; // red
  if (avgRisk >= 50) return '#f97316'; // orange
  if (avgRisk >= 25) return '#eab308'; // yellow
  return '#22c55e'; // green
}

export function HazardFrequencyChart({
  items,
  periodLabel = 'Last 30 days',
  period,
  periodOptions = [],
  onPeriodChange,
  isLoading = false,
  onCategoryClick,
}: HazardFrequencyChartProps) {
  const showPeriodSelector = period != null && periodOptions.length > 0 && onPeriodChange != null;
  const data = [...items]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((i) => ({
      name: i.category || 'Unknown',
      count: i.count,
      avg_risk: i.avg_risk,
      fill: riskToColor(i.avg_risk),
    }));

  const periodSelector = showPeriodSelector ? (
    <select
      value={period}
      onChange={(e) => onPeriodChange!(e.target.value as DashboardPeriod)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
      aria-label="Time period for hazard chart"
    >
      {periodOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ) : null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white">Top hazard types</h3>
          {periodSelector}
        </div>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        <div className="h-64 bg-white/5 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white">Top hazard types</h3>
          {periodSelector}
        </div>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        <div className="h-64 flex items-center justify-center text-white/50 text-sm">
          No hazard data in this period
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold text-white">Top hazard types</h3>
        {periodSelector}
      </div>
      <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
      <div className="min-w-0 w-full h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
              formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { avg_risk?: number } }) => [
                `${value ?? 0} jobs · avg risk ${props.payload?.avg_risk?.toFixed(0) ?? '0'}`,
                '',
              ]}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              cursor={onCategoryClick ? 'pointer' : 'default'}
              onClick={
                onCategoryClick
                  ? (event: unknown) => {
                      const row = getClickedRow(event);
                      const category = getCategoryFromRow(row);
                      if (category) onCategoryClick(category);
                    }
                  : undefined
              }
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default HazardFrequencyChart;
