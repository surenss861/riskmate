'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import { dateOnlyToApiBounds, type CustomRange } from '@/lib/utils/dateRange';

export type DashboardPeriod = '7d' | '30d' | '90d' | '1y' | 'custom';

type Summary = Awaited<ReturnType<typeof analyticsApi.summary>>;
type JobCompletion = Awaited<ReturnType<typeof analyticsApi.jobCompletion>>;
type ComplianceRate = Awaited<ReturnType<typeof analyticsApi.complianceRate>>;
type TeamPerformance = Awaited<ReturnType<typeof analyticsApi.teamPerformance>>;
type HazardFrequency = Awaited<ReturnType<typeof analyticsApi.hazardFrequency>>;
type RiskHeatmap = Awaited<ReturnType<typeof analyticsApi.riskHeatmap>>;
type Trends = Awaited<ReturnType<typeof analyticsApi.trends>>;
type Insights = Awaited<ReturnType<typeof analyticsApi.insights>>;

/** Compute current period [since, until]. For '1y' uses calendar year in UTC (Jan 1–today UTC); otherwise rolling window. */
function currentRangeForPeriod(period: DashboardPeriod): { since: string; until: string } {
  const now = new Date();
  if (period === '1y') {
    const y = now.getUTCFullYear();
    const since = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const until = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { since: since.toISOString(), until: until.toISOString() };
  }
  const until = new Date(now);
  until.setHours(23, 59, 59, 999);
  const days = parseInt(period.replace('d', ''), 10) || 30;
  const since = new Date(until.getTime());
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
}

/** Compute prior period [since, until]. For '1y' uses prior calendar year in UTC (Jan 1–Dec 31 UTC); otherwise same-length window before current. */
function priorRangeForPeriod(period: DashboardPeriod): { since: string; until: string } {
  const now = new Date();
  if (period === '1y') {
    const y = now.getUTCFullYear() - 1;
    const priorSince = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const priorUntil = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
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
  riskHeatmap: RiskHeatmap | null;
  trendsJobs: Trends | null;
  trendsRisk: Trends | null;
  trendsCompletion: Trends | null;
  /** Compliance rate trend series (for Compliance KPI sparkline). */
  trendsCompliance: Trends | null;
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
  /** Prior period compliance trend (for Compliance KPI prior comparison). */
  priorTrendsCompliance: Trends | null;
};

/** Per-section error flags: true when that endpoint failed on last refresh; valid data may still be from previous load. */
export type AnalyticsSectionErrors = {
  summary: boolean;
  jobCompletion: boolean;
  complianceRate: boolean;
  teamPerformance: boolean;
  hazardFrequency: boolean;
  riskHeatmap: boolean;
  trendsJobs: boolean;
  trendsRisk: boolean;
  trendsCompletion: boolean;
  trendsCompliance: boolean;
  trendsCompletedCounts: boolean;
  insights: boolean;
  statusByPeriod: boolean;
  priorSummary: boolean;
  priorJobCompletion: boolean;
  priorComplianceRate: boolean;
  priorTrendsRisk: boolean;
  priorTrendsCompliance: boolean;
};

const noSectionErrors: AnalyticsSectionErrors = {
  summary: false,
  jobCompletion: false,
  complianceRate: false,
  teamPerformance: false,
  hazardFrequency: false,
  riskHeatmap: false,
  trendsJobs: false,
  trendsRisk: false,
  trendsCompletion: false,
  trendsCompliance: false,
  trendsCompletedCounts: false,
  insights: false,
  statusByPeriod: false,
  priorSummary: false,
  priorJobCompletion: false,
  priorComplianceRate: false,
  priorTrendsRisk: false,
  priorTrendsCompliance: false,
};

export type AnalyticsDashboardState = {
  data: AnalyticsDashboardData;
  isLoading: boolean;
  isLocked: boolean;
  error: boolean;
  /** Per-section error flags; when true, that section's endpoint failed on last refresh (UI should show unavailable/error, not zero). */
  sectionErrors: AnalyticsSectionErrors;
  refetch: () => Promise<void>;
  /** groupBy used for trends and statusByPeriod (day/week/month); use in drill-down for aligned ranges */
  effectiveGroupBy: 'day' | 'week' | 'month';
};

const emptyData: AnalyticsDashboardData = {
  summary: null,
  jobCompletion: null,
  complianceRate: null,
  teamPerformance: null,
  hazardFrequency: null,
  riskHeatmap: null,
  trendsJobs: null,
  trendsRisk: null,
  trendsCompletion: null,
  trendsCompliance: null,
  trendsCompletedCounts: null,
  insights: null,
  statusByPeriod: null,
  priorSummary: null,
  priorJobCompletion: null,
  priorComplianceRate: null,
  priorTrendsRisk: null,
  priorTrendsCompliance: null,
};

export type { CustomRange };

export function useAnalyticsDashboard(
  period: DashboardPeriod,
  enabled: boolean = true,
  customRange?: CustomRange | null
): AnalyticsDashboardState {
  const [data, setData] = useState<AnalyticsDashboardData>(emptyData);
  const [isLoading, setLoading] = useState(false);
  const [isLocked, setLocked] = useState(false);
  const [error, setError] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<AnalyticsSectionErrors>(noSectionErrors);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    // Never send range: 'custom' or period: 'custom' to analyticsApi without explicit since/until.
    if (period === 'custom' && (!customRange?.start || !customRange?.end)) {
      return;
    }

    setLoading(true);
    setError(false);
    setSectionErrors(noSectionErrors);

    const useCustom = period === 'custom' && customRange?.start && customRange?.end;
    const useCalendarYear = period === '1y';
    const currentRange = useCalendarYear ? currentRangeForPeriod('1y') : null;
    const customBounds = useCustom ? dateOnlyToApiBounds(customRange!.start, customRange!.end) : null;
    const since = useCustom ? customBounds!.since : useCalendarYear ? currentRange!.since : undefined;
    const until = useCustom ? customBounds!.until : useCalendarYear ? currentRange!.until : undefined;
    const rangeForSummary = period === '1y' ? undefined : period;
    const prior = useCustom ? null : priorRangeForPeriod(period);
    // Single groupBy for custom: day for short ranges, week for longer; same for all trends and statusByPeriod
    const groupBy: 'day' | 'week' | 'month' =
      useCustom
        ? (() => {
            const rangeMs = new Date(customRange!.end + 'T12:00:00').getTime() - new Date(customRange!.start + 'T12:00:00').getTime();
            const rangeDays = rangeMs / (24 * 60 * 60 * 1000);
            return rangeDays <= 14 ? ('day' as const) : ('week' as const);
          })()
        : period === '7d'
          ? 'day'
          : period === '1y'
            ? 'month'
            : 'week';
    const statusByPeriodGroupBy: 'day' | 'week' =
      period === 'custom' && useCustom
        ? (groupBy === 'month' ? 'week' : groupBy)
        : period === '7d'
          ? 'day'
          : 'week';
    const useExplicitRange = useCustom || useCalendarYear;
    const trendsParams = useExplicitRange
      ? { since: since!, until: until!, groupBy, metric: 'jobs' as const }
      : { period, groupBy, metric: 'jobs' as const };
    const statusByPeriodParams = useExplicitRange
      ? { since: since!, until: until!, groupBy: statusByPeriodGroupBy }
      : { period, groupBy: statusByPeriodGroupBy };

    const promises = [
      useExplicitRange ? analyticsApi.summary({ since: since!, until: until! }) : analyticsApi.summary({ range: rangeForSummary! }),
      useExplicitRange ? analyticsApi.jobCompletion({ since: since!, until: until! }) : analyticsApi.jobCompletion({ period }),
      useExplicitRange ? analyticsApi.complianceRate({ since: since!, until: until! }) : analyticsApi.complianceRate({ period }),
      useExplicitRange ? analyticsApi.teamPerformance({ since: since!, until: until! }) : analyticsApi.teamPerformance({ period }),
      useExplicitRange ? analyticsApi.hazardFrequency({ since: since!, until: until!, groupBy: 'type' }) : analyticsApi.hazardFrequency({ period, groupBy: 'type' }),
      useExplicitRange ? analyticsApi.riskHeatmap({ since: since!, until: until! }) : analyticsApi.riskHeatmap({ period }),
      analyticsApi.trends({ ...trendsParams, metric: 'jobs' }),
      analyticsApi.trends({ ...(useExplicitRange ? { since: since!, until: until!, groupBy } : { period, groupBy }), metric: 'risk' }),
      analyticsApi.trends({ ...(useExplicitRange ? { since: since!, until: until!, groupBy } : { period, groupBy }), metric: 'completion' }),
      analyticsApi.trends({ ...(useExplicitRange ? { since: since!, until: until!, groupBy } : { period, groupBy }), metric: 'compliance' }),
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
      prior ? analyticsApi.trends({ since: prior.since, until: prior.until, groupBy, metric: 'compliance' }) : Promise.resolve(null),
    ];

    try {
      const results = await Promise.allSettled(promises);

      const get = <T>(i: number): T | null =>
        results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : null;

      const summaryRes = get<Summary>(0);
      const jobCompletionRes = get<JobCompletion>(1);
      const complianceRes = get<ComplianceRate>(2);
      const teamRes = get<TeamPerformance>(3);
      const hazardRes = get<HazardFrequency>(4);
      const riskHeatmapRes = get<RiskHeatmap>(5);
      const trendsJobsRes = get<Trends>(6);
      const trendsRiskRes = get<Trends>(7);
      const trendsCompletionRes = get<Trends>(8);
      const trendsComplianceRes = get<Trends>(9);
      const trendsCompletedCountsRes = get<Trends>(10);
      const insightsRes = get<Insights | null>(11);
      const statusByPeriodRes = get<{ data?: StatusByPeriodRow[] } | null>(12);
      const priorSummaryRes = get<Summary | null>(13);
      const priorJobCompletionRes = get<JobCompletion | null>(14);
      const priorComplianceRes = get<ComplianceRate | null>(15);
      const priorTrendsRiskRes = get<Trends | null>(16);
      const priorTrendsComplianceRes = get<Trends | null>(17);

      const err = (i: number) => results[i].status === 'rejected';
      setSectionErrors({
        summary: err(0),
        jobCompletion: err(1),
        complianceRate: err(2),
        teamPerformance: err(3),
        hazardFrequency: err(4),
        riskHeatmap: err(5),
        trendsJobs: err(6),
        trendsRisk: err(7),
        trendsCompletion: err(8),
        trendsCompliance: err(9),
        trendsCompletedCounts: err(10),
        insights: err(11),
        statusByPeriod: err(12),
        priorSummary: err(13),
        priorJobCompletion: err(14),
        priorComplianceRate: err(15),
        priorTrendsRisk: err(16),
        priorTrendsCompliance: err(17),
      });

      const locked =
        (summaryRes?.locked ?? false) ||
        (jobCompletionRes?.locked ?? false) ||
        (complianceRes?.locked ?? false) ||
        (teamRes?.locked ?? false) ||
        (hazardRes?.locked ?? false) ||
        (insightsRes?.locked ?? false);
      setLocked(!!locked);

      const statusByPeriod = statusByPeriodRes?.data ?? null;

      setData((prev) => ({
        summary: summaryRes ?? prev.summary,
        jobCompletion: jobCompletionRes ?? prev.jobCompletion,
        complianceRate: complianceRes ?? prev.complianceRate,
        teamPerformance: teamRes ?? prev.teamPerformance,
        hazardFrequency: hazardRes ?? prev.hazardFrequency,
        riskHeatmap: riskHeatmapRes ?? prev.riskHeatmap,
        trendsJobs: trendsJobsRes ?? prev.trendsJobs,
        trendsRisk: trendsRiskRes ?? prev.trendsRisk,
        trendsCompletion: trendsCompletionRes ?? prev.trendsCompletion,
        trendsCompliance: trendsComplianceRes ?? prev.trendsCompliance,
        trendsCompletedCounts: trendsCompletedCountsRes ?? prev.trendsCompletedCounts,
        insights: insightsRes ?? prev.insights,
        statusByPeriod: Array.isArray(statusByPeriod) ? statusByPeriod : (prev.statusByPeriod ?? null),
        priorSummary: priorSummaryRes ?? prev.priorSummary,
        priorJobCompletion: priorJobCompletionRes ?? prev.priorJobCompletion,
        priorComplianceRate: priorComplianceRes ?? prev.priorComplianceRate,
        priorTrendsRisk: priorTrendsRiskRes ?? prev.priorTrendsRisk,
        priorTrendsCompliance: priorTrendsComplianceRes ?? prev.priorTrendsCompliance,
      }));
    } catch (e) {
      console.error('Analytics dashboard fetch failed', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [period, enabled, customRange?.start, customRange?.end]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const effectiveGroupBy: 'day' | 'week' | 'month' = useMemo(() => {
    if (period === 'custom' && customRange?.start && customRange?.end) {
      const rangeMs = new Date(customRange.end + 'T12:00:00').getTime() - new Date(customRange.start + 'T12:00:00').getTime();
      const rangeDays = rangeMs / (24 * 60 * 60 * 1000);
      return rangeDays <= 14 ? 'day' : 'week';
    }
    return period === '7d' ? 'day' : period === '1y' ? 'month' : 'week';
  }, [period, customRange?.start, customRange?.end]);

  return { data, isLoading, isLocked, error, sectionErrors, refetch, effectiveGroupBy };
}
