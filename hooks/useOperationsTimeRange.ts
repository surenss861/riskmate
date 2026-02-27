'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { DashboardPeriod } from '@/lib/types/analytics';
import type { CustomRange } from '@/lib/utils/dateRange';
import { toLocalDateString, toDateOnly } from '@/lib/utils/dateRange';

export type TimeRange = '7d' | '30d' | '90d' | 'all' | 'custom';

function parseTimeRangeFromParams(
  param: string | null,
  start: string,
  end: string
): { timeRange: TimeRange; customRange: CustomRange | null; dashboardPeriod: DashboardPeriod } {
  if (param === 'custom' && start && end) {
    return {
      timeRange: 'custom',
      customRange: { start: toDateOnly(start), end: toDateOnly(end) },
      dashboardPeriod: 'custom',
    };
  }
  if (param === '1y') {
    return { timeRange: 'all', customRange: null, dashboardPeriod: '1y' };
  }
  if (param === '7d' || param === '30d' || param === '90d') {
    const tr = param as TimeRange;
    return { timeRange: tr, customRange: null, dashboardPeriod: tr as DashboardPeriod };
  }
  // Invalid, unknown, or custom without both bounds → fallback 30d so dashboardPeriod is always fetchable
  return { timeRange: '30d', customRange: null, dashboardPeriod: '30d' };
}

export type UseOperationsTimeRangeParams = {
  /** Ref that the caller sets to a function that refetches analytics and dashboard (avoids circular dependency). */
  refetchRef: React.MutableRefObject<(() => Promise<void>) | null>;
};

export function useOperationsTimeRange({ refetchRef }: UseOperationsTimeRangeParams) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const timeRangeParam = searchParams.get('time_range') as string | null;
  const rangeStartParam = searchParams.get('range_start')?.trim() ?? '';
  const rangeEndParam = searchParams.get('range_end')?.trim() ?? '';

  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const parsed = parseTimeRangeFromParams(timeRangeParam, rangeStartParam, rangeEndParam);
    return parsed.timeRange;
  });
  const [customRange, setCustomRange] = useState<CustomRange | null>(() => {
    const parsed = parseTimeRangeFromParams(timeRangeParam, rangeStartParam, rangeEndParam);
    return parsed.customRange;
  });
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>(() => {
    const parsed = parseTimeRangeFromParams(timeRangeParam, rangeStartParam, rangeEndParam);
    return parsed.dashboardPeriod;
  });

  // Sync time range and custom range from URL; normalize invalid/partial query state so dashboardPeriod is always fetchable
  useEffect(() => {
    const param = searchParams.get('time_range') as string | null;
    const start = searchParams.get('range_start')?.trim() ?? '';
    const end = searchParams.get('range_end')?.trim() ?? '';
    const parsed = parseTimeRangeFromParams(param, start, end);

    setTimeRange(parsed.timeRange);
    setCustomRange(parsed.customRange);
    setDashboardPeriod(parsed.dashboardPeriod);

    // Normalize URL when state was invalid or incomplete custom (so URL and state stay in sync)
    if (parsed.dashboardPeriod === '30d' && param !== '30d') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('time_range', '30d');
      params.delete('range_start');
      params.delete('range_end');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  // Sync dashboard period from main time range when it changes
  useEffect(() => {
    const derived: DashboardPeriod = timeRange === 'all' ? '1y' : timeRange;
    setDashboardPeriod((p) => (p !== 'custom' ? derived : p));
  }, [timeRange]);

  const handleTimeRangeChange = useCallback(
    (newRange: TimeRange) => {
      if (newRange === 'custom') {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime());
        startDate.setDate(startDate.getDate() - 29);
        const defaultRange: CustomRange = {
          start: toLocalDateString(startDate),
          end: toLocalDateString(endDate),
        };
        setCustomRange(defaultRange);
        setTimeRange('custom');
        setDashboardPeriod('custom');
        const params = new URLSearchParams(searchParams.toString());
        params.set('time_range', 'custom');
        params.set('range_start', defaultRange.start);
        params.set('range_end', defaultRange.end);
        router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
        return;
      }
      setTimeRange(newRange);
      setCustomRange(null);
      setDashboardPeriod(newRange === 'all' ? '1y' : (newRange as DashboardPeriod));
      const params = new URLSearchParams(searchParams.toString());
      params.set('time_range', newRange === 'all' ? '1y' : newRange);
      params.delete('range_start');
      params.delete('range_end');
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const handleAnalyticsPeriodChange = useCallback(
    (period: DashboardPeriod, range?: CustomRange) => {
      if (period === 'custom' && !range) return;
      setDashboardPeriod(period);
      if (period === 'custom' && range) {
        const normalized: CustomRange = { start: toDateOnly(range.start), end: toDateOnly(range.end) };
        setCustomRange(normalized);
        setTimeRange('custom');
        const params = new URLSearchParams(searchParams.toString());
        params.set('time_range', 'custom');
        params.set('range_start', normalized.start);
        params.set('range_end', normalized.end);
        router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
      } else {
        setCustomRange(null);
        const newRange: TimeRange = period === '1y' ? 'all' : (period as TimeRange);
        setTimeRange(newRange);
        const params = new URLSearchParams(searchParams.toString());
        params.set('time_range', period === '1y' ? '1y' : newRange);
        params.delete('range_start');
        params.delete('range_end');
        router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
      }
    },
    [searchParams, pathname, router]
  );

  return {
    timeRange,
    setTimeRange,
    customRange,
    setCustomRange,
    dashboardPeriod,
    setDashboardPeriod,
    handleTimeRangeChange,
    handleAnalyticsPeriodChange,
  };
}
