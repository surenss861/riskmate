'use client';

import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';

export type DashboardPeriod = '7d' | '30d' | '90d' | '1y' | 'custom';

type Summary = Awaited<ReturnType<typeof analyticsApi.summary>>;
type JobCompletion = Awaited<ReturnType<typeof analyticsApi.jobCompletion>>;
type ComplianceRate = Awaited<ReturnType<typeof analyticsApi.complianceRate>>;
type TeamPerformance = Awaited<ReturnType<typeof analyticsApi.teamPerformance>>;
type HazardFrequency = Awaited<ReturnType<typeof analyticsApi.hazardFrequency>>;
type Trends = Awaited<ReturnType<typeof analyticsApi.trends>>;
type Insights = Awaited<ReturnType<typeof analyticsApi.insights>>;

/** Compute current period [since, until]. For '1y' uses calendar year (Jan 1–today); otherwise rolling window. */
function currentRangeForPeriod(period: DashboardPeriod): { since: string; until: string } {
  const now = new Date();
  const until = new Date(now);
  until.setHours(23, 59, 59, 999);
  if (period === '1y') {
    const since = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { since: since.toISOString(), until: until.toISOString() };
  }
  const days = parseInt(period.replace('d', ''), 10) || 30;
  const since = new Date(until.getTime());
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
}

/** Compute prior period [since, until]. For '1y' uses prior calendar year (Jan 1–Dec 31); otherwise same-length window before current. */
function priorRangeForPeriod(period: DashboardPeriod): { since: string; until: string } {
  const now = new Date();
  if (period === '1y') {
    const y = now.getFullYear() - 1;
    const priorSince = new Date(y, 0, 1, 0, 0, 0, 0);
    const priorUntil = new Date(y, 11, 31, 23, 59, 59, 999);
    return { since: priorSince.toISOString(), until: priorUntil.toISOString() };
  }
  const until = new Date(now);
  until.setHours(23, 59, 59, 999);
  const days = parseInt(period.replace('d', ''), 10) || 30;
  const currentSince = new Date(until.getTime());
  currentSince.setDate(currentSince.getDate() - (days - 1));
  currentSince.setHours(0, 0, 0, 0);
  const priorUntil = new Date(currentSince.getTime());
  priorUntil.setMilliseconds(priorUntil.getMilliseconds() - 1);
  const priorSince = new Date(priorUntil.getTime());
  priorSince.setDate(priorSince.getDate() - (days - 1));
  priorSince.setHours(0, 0, 0, 0);
  return { since: priorSince.toISOString(), until: priorUntil.toISOString() };
}

/** One row per period (e.g. week); keys are status names, values are counts. period is ISO date for drill-down. */
export type StatusByPeriodRow = { period: string; [status: string]: string | number };

export type AnalyticsDashboardData = {
  summary: Summary | null;
  jobCompletion: JobCompletion | null;
  complianceRate: ComplianceRate | null;
  teamPerformance: TeamPerformance | null;
  hazardFrequency: HazardFrequency | null;
  trendsJobs: Trends | null;
  trendsRisk: Trends | null;
  trendsCompletion: Trends | null;
  /** Real completed job counts per period (by completion date); for Jobs-over-time chart completed series. */
  trendsCompletedCounts: Trends | null;
  insights: Insights | null;
  /** Weekly (or daily) job status counts per period for Jobs-by-status chart; valid ISO period for drill-down. */
  statusByPeriod: StatusByPeriodRow[] | null;
  /** Prior period KPIs for trend comparison (same length window before current). */
  priorSummary: Summary | null;
  priorJobCompletion: JobCompletion | null;
  priorComplianceRate: ComplianceRate | null;
  /** Prior period risk trend (for avg-risk KPI trend vs prior period). */
  priorTrendsRisk: Trends | null;
};

export type AnalyticsDashboardState = {
  data: AnalyticsDashboardData;
  isLoading: boolean;
  isLocked: boolean;
  error: boolean;
  refetch: () => Promise<void>;
};

const emptyData: AnalyticsDashboardData = {
  summary: null,
  jobCompletion: null,
  complianceRate: null,
  teamPerformance: null,
  hazardFrequency: null,
  trendsJobs: null,
  trendsRisk: null,
  trendsCompletion: null,
  trendsCompletedCounts: null,
  insights: null,
  statusByPeriod: null,
  priorSummary: null,
  priorJobCompletion: null,
  priorComplianceRate: null,
  priorTrendsRisk: null,
};

export type CustomRange = { start: string; end: string };

export function useAnalyticsDashboard(
  period: DashboardPeriod,
  enabled: boolean = true,
  customRange?: CustomRange | null
): AnalyticsDashboardState {
  const [data, setData] = useState<AnalyticsDashboardData>(emptyData);
  const [isLoading, setLoading] = useState(false);
  const [isLocked, setLocked] = useState(false);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    // Never send range: 'custom' or period: 'custom' to analyticsApi without explicit since/until.
    if (period === 'custom' && (!customRange?.start || !customRange?.end)) {
      return;
    }

    setLoading(true);
    setError(false);

    const useCustom = period === 'custom' && customRange?.start && customRange?.end;
    const useCalendarYear = period === '1y';
    const currentRange = useCalendarYear ? currentRangeForPeriod('1y') : null;
    const since = useCustom ? customRange!.start : useCalendarYear ? currentRange!.since : undefined;
    const until = useCustom ? customRange!.end : useCalendarYear ? currentRange!.until : undefined;
    const rangeForSummary = period === '1y' ? undefined : period;
    const prior = useCustom ? null : priorRangeForPeriod(period);
    const groupBy: 'day' | 'week' | 'month' = period === '7d' ? 'day' : period === '1y' ? 'month' : 'week';
    const statusByPeriodGroupBy: 'day' | 'week' = period === '7d' ? 'day' : 'week';
    const useExplicitRange = useCustom || useCalendarYear;
    const trendsParams = useExplicitRange
      ? { since: since!, until: until!, groupBy: useCalendarYear ? ('month' as const) : ('day' as const), metric: 'jobs' as const }
      : { period, groupBy, metric: 'jobs' as const };
    const statusByPeriodParams = useExplicitRange
      ? { since: since!, until: until!, groupBy: statusByPeriodGroupBy }
      : { period, groupBy: statusByPeriodGroupBy };

    try {
      const [
        summaryRes,
        jobCompletionRes,
        complianceRes,
        teamRes,
        hazardRes,
        trendsJobsRes,
        trendsRiskRes,
        trendsCompletionRes,
        trendsCompletedCountsRes,
        insightsRes,
        statusByPeriodRes,
        priorSummaryRes,
        priorJobCompletionRes,
        priorComplianceRes,
        priorTrendsRiskRes,
      ] = await Promise.all([
        useExplicitRange ? analyticsApi.summary({ since: since!, until: until! }) : analyticsApi.summary({ range: rangeForSummary! }),
        useExplicitRange ? analyticsApi.jobCompletion({ since: since!, until: until! }) : analyticsApi.jobCompletion({ period }),
        useExplicitRange ? analyticsApi.complianceRate({ since: since!, until: until! }) : analyticsApi.complianceRate({ period }),
        useExplicitRange ? analyticsApi.teamPerformance({ since: since!, until: until! }) : analyticsApi.teamPerformance({ period }),
        useExplicitRange ? analyticsApi.hazardFrequency({ since: since!, until: until!, groupBy: 'type' }) : analyticsApi.hazardFrequency({ period, groupBy: 'type' }),
        analyticsApi.trends({ ...trendsParams, metric: 'jobs' }),
        analyticsApi.trends({ ...(useExplicitRange ? { since: since!, until: until!, groupBy } : { period, groupBy }), metric: 'risk' }),
        analyticsApi.trends({ ...(useExplicitRange ? { since: since!, until: until!, groupBy } : { period, groupBy }), metric: 'completion' }),
        analyticsApi.trends({ ...(useExplicitRange ? { since: since!, until: until!, groupBy } : { period, groupBy }), metric: 'jobs_completed' }),
        (() => {
          const insightsRange = useExplicitRange ? { since: since!, until: until! } : currentRangeForPeriod(period);
          return analyticsApi.insights(insightsRange);
        })(),
        analyticsApi.statusByPeriod(statusByPeriodParams),
        prior ? analyticsApi.summary({ since: prior.since, until: prior.until }) : Promise.resolve(null),
        prior ? analyticsApi.jobCompletion({ since: prior.since, until: prior.until }) : Promise.resolve(null),
        prior ? analyticsApi.complianceRate({ since: prior.since, until: prior.until }) : Promise.resolve(null),
        prior ? analyticsApi.trends({ since: prior.since, until: prior.until, groupBy, metric: 'risk' }) : Promise.resolve(null),
      ]);

      const locked =
        summaryRes.locked ||
        jobCompletionRes.locked ||
        complianceRes.locked ||
        teamRes.locked ||
        hazardRes.locked ||
        insightsRes?.locked;

      setLocked(!!locked);
      const statusByPeriod = statusByPeriodRes?.data ?? null;
      setData({
        summary: summaryRes,
        jobCompletion: jobCompletionRes,
        complianceRate: complianceRes,
        teamPerformance: teamRes,
        hazardFrequency: hazardRes,
        trendsJobs: trendsJobsRes,
        trendsRisk: trendsRiskRes,
        trendsCompletion: trendsCompletionRes,
        trendsCompletedCounts: trendsCompletedCountsRes,
        insights: insightsRes,
        statusByPeriod: Array.isArray(statusByPeriod) ? statusByPeriod : null,
        priorSummary: priorSummaryRes,
        priorJobCompletion: priorJobCompletionRes,
        priorComplianceRate: priorComplianceRes,
        priorTrendsRisk: priorTrendsRiskRes,
      });
    } catch (e) {
      console.error('Analytics dashboard fetch failed', e);
      setError(true);
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, [period, enabled, customRange?.start, customRange?.end]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, isLocked, error, refetch };
}
