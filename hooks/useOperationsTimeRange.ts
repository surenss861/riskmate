'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { DashboardPeriod } from '@/components/dashboard/DashboardOverview';
import type { CustomRange } from '@/lib/utils/dateRange';
import { toLocalDateString, toDateOnly } from '@/lib/utils/dateRange';

export type TimeRange = '7d' | '30d' | '90d' | 'all' | 'custom';

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
    if (timeRangeParam === 'custom' && rangeStartParam && rangeEndParam) return 'custom';
    return timeRangeParam === '1y' ? 'all' : (timeRangeParam as TimeRange) || '30d';
  });
  const [customRange, setCustomRange] = useState<CustomRange | null>(() => {
    if (timeRangeParam === 'custom' && rangeStartParam && rangeEndParam) {
      return { start: toDateOnly(rangeStartParam), end: toDateOnly(rangeEndParam) };
    }
    return null;
  });
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>(() =>
    timeRangeParam === 'custom' && rangeStartParam && rangeEndParam ? 'custom' : (timeRange === 'all' ? '1y' : (timeRange as DashboardPeriod))
  );

  // Sync time range and custom range from URL query params
  useEffect(() => {
    const param = searchParams.get('time_range') as string | null;
    const start = searchParams.get('range_start')?.trim() ?? '';
    const end = searchParams.get('range_end')?.trim() ?? '';
    if (param === 'custom' && start && end) {
      setTimeRange('custom');
      setCustomRange({ start: toDateOnly(start), end: toDateOnly(end) });
      setDashboardPeriod('custom');
    } else if (param === '1y') {
      setTimeRange('all');
      setCustomRange(null);
      setDashboardPeriod('1y');
    } else if (param && ['7d', '30d', '90d', 'all'].includes(param)) {
      setTimeRange(param as TimeRange);
      setCustomRange(null);
      setDashboardPeriod(param === 'all' ? '1y' : (param as DashboardPeriod));
    }
  }, [searchParams]);

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
        refetchRef.current?.();
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
      refetchRef.current?.();
    },
    [searchParams, pathname, router, refetchRef]
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
        refetchRef.current?.();
      } else {
        setCustomRange(null);
        const newRange: TimeRange = period === '1y' ? 'all' : (period as TimeRange);
        setTimeRange(newRange);
        const params = new URLSearchParams(searchParams.toString());
        params.set('time_range', period === '1y' ? '1y' : newRange);
        params.delete('range_start');
        params.delete('range_end');
        router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
        refetchRef.current?.();
      }
    },
    [searchParams, pathname, router, refetchRef]
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
