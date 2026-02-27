'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import type { DashboardPeriod } from '@/lib/types/analytics';
import type { CustomRange } from '@/lib/utils/dateRange';

export type TeamPerformanceMember = {
  user_id: string;
  name: string;
  jobs_assigned: number;
  jobs_completed: number;
  completion_rate: number;
  avg_days: number;
  overdue_count: number;
};

type TeamPerformanceTableProps = {
  members: TeamPerformanceMember[];
  periodLabel?: string;
  period?: DashboardPeriod;
  periodOptions?: { value: DashboardPeriod; label: string }[];
  onPeriodChange?: (period: DashboardPeriod, customRange?: CustomRange) => void;
  isLoading?: boolean;
};

type SortKey = 'name' | 'jobs_assigned' | 'jobs_completed' | 'completion_rate' | 'avg_days' | 'overdue_count';

function Th({
  label,
  keyName,
  sortKey,
  sortAsc,
  onSort,
  className,
}: {
  label: string;
  keyName: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(keyName)}
        className="inline-flex items-center gap-1 text-left text-xs uppercase tracking-wider text-white/60 hover:text-white/80 transition-colors"
      >
        {label}
        {sortKey === keyName && (sortAsc ? ' ↑' : ' ↓')}
      </button>
    </th>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function completionRateClass(rate: number): string {
  if (rate > 80) return 'text-emerald-400';
  if (rate >= 60 && rate <= 80) return 'text-amber-400';
  return 'text-red-400';
}

export function TeamPerformanceTable({
  members,
  periodLabel = 'Last 30 days',
  period,
  periodOptions = [],
  onPeriodChange,
  isLoading = false,
}: TeamPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('completion_rate');
  const [sortAsc, setSortAsc] = useState(false);
  const showPeriodSelector = period != null && periodOptions.length > 0 && onPeriodChange != null;
  const periodSelector = showPeriodSelector ? (
    <select
      value={period}
      onChange={(e) => onPeriodChange!(e.target.value as DashboardPeriod)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#F97316]"
      aria-label="Time period for team performance"
    >
      {periodOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ) : null;

  const sorted = useMemo(() => {
    const list = [...members];
    list.sort((a, b) => {
      let aVal: number | string = a[sortKey];
      let bVal: number | string = b[sortKey];
      if (sortKey === 'name') {
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [members, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'name' || key === 'overdue_count');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white">Team performance</h3>
          {periodSelector}
        </div>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        <div className="h-48 bg-white/5 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white">Team performance</h3>
          {periodSelector}
        </div>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        <p className="text-sm text-white/50">No team data in this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold text-white">Team performance</h3>
        {periodSelector}
      </div>
      <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-white/10">
              <Th label="Name" keyName="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="pb-3 pr-4" />
              <Th label="Assigned" keyName="jobs_assigned" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="pb-3 pr-4 text-right" />
              <Th label="Completed" keyName="jobs_completed" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="pb-3 pr-4 text-right" />
              <Th label="Completion" keyName="completion_rate" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="pb-3 pr-4 text-right" />
              <Th label="Avg days" keyName="avg_days" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="pb-3 pr-4 text-right" />
              <Th label="Overdue" keyName="overdue_count" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="pb-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.user_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white shrink-0"
                      aria-hidden
                    >
                      {getInitials(m.name || '?')}
                    </div>
                    <span className="text-sm text-white/90 truncate max-w-[120px]">
                      {m.name || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-right text-sm text-white/80 tabular-nums">
                  {m.jobs_assigned}
                </td>
                <td className="py-3 pr-4 text-right text-sm text-white/80 tabular-nums">
                  {m.jobs_completed}
                </td>
                <td className={clsx('py-3 pr-4 text-right text-sm font-medium tabular-nums', completionRateClass(m.completion_rate))}>
                  {Math.round(m.completion_rate)}%
                </td>
                <td className="py-3 pr-4 text-right text-sm text-white/80 tabular-nums">
                  {typeof m.avg_days === 'number' ? m.avg_days.toFixed(1) : '—'}
                </td>
                <td className="py-3 text-right text-sm tabular-nums">
                  {m.overdue_count > 0 ? (
                    <span className="text-amber-400">{m.overdue_count}</span>
                  ) : (
                    <span className="text-white/50">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeamPerformanceTable;
