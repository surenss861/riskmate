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
};

export function useAnalyticsDashboard(
  period: DashboardPeriod,
  enabled: boolean = true
): AnalyticsDashboardState {
  const [data, setData] = useState<AnalyticsDashboardData>(emptyData);
  const [isLoading, setLoading] = useState(false);
  const [isLocked, setLocked] = useState(false);
  const [error, setError] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(false);

    const rangeForSummary = period === '1y' ? '365d' : period;

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
      ] = await Promise.all([
        analyticsApi.summary({ range: rangeForSummary }),
        analyticsApi.jobCompletion({ period }),
        analyticsApi.complianceRate({ period }),
        analyticsApi.teamPerformance({ period }),
        analyticsApi.hazardFrequency({ period, groupBy: 'type' }),
        analyticsApi.trends({ period, groupBy: period === '7d' ? 'day' : period === '1y' ? 'month' : 'week', metric: 'jobs' }),
        analyticsApi.trends({ period, groupBy: period === '7d' ? 'day' : period === '1y' ? 'month' : 'week', metric: 'risk' }),
        analyticsApi.trends({ period, groupBy: period === '7d' ? 'day' : period === '1y' ? 'month' : 'week', metric: 'completion' }),
        analyticsApi.insights(),
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
      });
    } catch (e) {
      console.error('Analytics dashboard fetch failed', e);
      setError(true);
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, [period, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, isLocked, error, refetch };
}
