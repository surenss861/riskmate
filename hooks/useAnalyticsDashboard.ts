'use client';

import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';

export type DashboardPeriod = '7d' | '30d' | '90d' | '1y';

type Summary = Awaited<ReturnType<typeof analyticsApi.summary>>;
type JobCompletion = Awaited<ReturnType<typeof analyticsApi.jobCompletion>>;
type ComplianceRate = Awaited<ReturnType<typeof analyticsApi.complianceRate>>;
type TeamPerformance = Awaited<ReturnType<typeof analyticsApi.teamPerformance>>;
type HazardFrequency = Awaited<ReturnType<typeof analyticsApi.hazardFrequency>>;
type Trends = Awaited<ReturnType<typeof analyticsApi.trends>>;
type Insights = Awaited<ReturnType<typeof analyticsApi.insights>>;

/** Compute prior period [since, until] (same length as current, immediately before). */
function priorRangeForPeriod(period: DashboardPeriod): { since: string; until: string } {
  const now = new Date();
  const until = new Date(now);
  until.setHours(23, 59, 59, 999);
  const days = period === '1y' ? 365 : parseInt(period.replace('d', ''), 10) || 30;
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

export type AnalyticsDashboardData = {
  summary: Summary | null;
  jobCompletion: JobCompletion | null;
  complianceRate: ComplianceRate | null;
  teamPerformance: TeamPerformance | null;
  hazardFrequency: HazardFrequency | null;
  trendsJobs: Trends | null;
  trendsRisk: Trends | null;
  trendsCompletion: Trends | null;
  insights: Insights | null;
  /** Prior period KPIs for trend comparison (same length window before current). */
  priorSummary: Summary | null;
  priorJobCompletion: JobCompletion | null;
  priorComplianceRate: ComplianceRate | null;
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
  insights: null,
  priorSummary: null,
  priorJobCompletion: null,
  priorComplianceRate: null,
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

    setLoading(true);
    setError(false);

    const useCustom = period === 'custom' && customRange?.start && customRange?.end;
    const since = useCustom ? customRange!.start : undefined;
    const until = useCustom ? customRange!.end : undefined;
    const rangeForSummary = period === '1y' ? '365d' : period;
    const prior = useCustom ? null : priorRangeForPeriod(period);
    const groupBy = period === '7d' ? 'day' : period === '1y' ? 'month' : 'week';
    const trendsParams = useCustom
      ? { since, until, groupBy: 'day' as const, metric: 'jobs' as const }
      : { period, groupBy, metric: 'jobs' as const };

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
        insightsRes,
        priorSummaryRes,
        priorJobCompletionRes,
        priorComplianceRes,
      ] = await Promise.all([
        useCustom ? analyticsApi.summary({ since, until }) : analyticsApi.summary({ range: rangeForSummary }),
        useCustom ? analyticsApi.jobCompletion({ since, until }) : analyticsApi.jobCompletion({ period }),
        useCustom ? analyticsApi.complianceRate({ since, until }) : analyticsApi.complianceRate({ period }),
        useCustom ? analyticsApi.teamPerformance({ since, until }) : analyticsApi.teamPerformance({ period }),
        useCustom ? analyticsApi.hazardFrequency({ since, until, groupBy: 'type' }) : analyticsApi.hazardFrequency({ period, groupBy: 'type' }),
        analyticsApi.trends({ ...trendsParams, metric: 'jobs' }),
        analyticsApi.trends({ ...(useCustom ? { since, until, groupBy: 'day' as const } : { period, groupBy }), metric: 'risk' }),
        analyticsApi.trends({ ...(useCustom ? { since, until, groupBy: 'day' as const } : { period, groupBy }), metric: 'completion' }),
        analyticsApi.insights(),
        prior ? analyticsApi.summary({ since: prior.since, until: prior.until }) : Promise.resolve(null),
        prior ? analyticsApi.jobCompletion({ since: prior.since, until: prior.until }) : Promise.resolve(null),
        prior ? analyticsApi.complianceRate({ since: prior.since, until: prior.until }) : Promise.resolve(null),
      ]);

      const locked =
        summaryRes.locked ||
        jobCompletionRes.locked ||
        complianceRes.locked ||
        teamRes.locked ||
        hazardRes.locked ||
        insightsRes?.locked;

      setLocked(!!locked);
      setData({
        summary: summaryRes,
        jobCompletion: jobCompletionRes,
        complianceRate: complianceRes,
        teamPerformance: teamRes,
        hazardFrequency: hazardRes,
        trendsJobs: trendsJobsRes,
        trendsRisk: trendsRiskRes,
        trendsCompletion: trendsCompletionRes,
        insights: insightsRes,
        priorSummary: priorSummaryRes,
        priorJobCompletion: priorJobCompletionRes,
        priorComplianceRate: priorComplianceRes,
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
