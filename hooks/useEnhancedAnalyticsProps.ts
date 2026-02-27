'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalyticsDashboardData, AnalyticsSectionErrors } from '@/hooks/useAnalyticsDashboard';
import type { DashboardPeriod } from '@/lib/types/analytics';
import type { EnhancedAnalyticsProps } from '@/components/dashboard/DashboardOverview';
import type { CustomRange } from '@/lib/utils/dateRange';
import { dateOnlyToApiBounds, presetPeriodToApiBounds, type PresetPeriod } from '@/lib/utils/dateRange';

/** Compute start/end ISO bounds for drill-down from chart bucket. */
function periodRangeFromGranularity(
  period: string,
  granularity: 'day' | 'week' | 'month',
  rangeEnd?: string
): { start: string; end: string } {
  if (rangeEnd != null && rangeEnd.length >= 10) {
    const startDay = period.slice(0, 10);
    const endDay = rangeEnd.slice(0, 10);
    return {
      start: `${startDay}T00:00:00.000Z`,
      end: `${endDay}T23:59:59.999Z`,
    };
  }
  if (granularity === 'day') {
    const dayStr = period.slice(0, 10);
    return {
      start: `${dayStr}T00:00:00.000Z`,
      end: `${dayStr}T23:59:59.999Z`,
    };
  }
  if (granularity === 'month') {
    const y = parseInt(period.slice(0, 4), 10);
    const m = parseInt(period.slice(5, 7), 10) - 1;
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString();
    return { start, end };
  }
  const weekStart = new Date(`${period.slice(0, 10)}T00:00:00Z`);
  const start = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate(), 0, 0, 0, 0)).toISOString();
  const weekEndDate = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  weekEndDate.setUTCHours(23, 59, 59, 999);
  return { start, end: weekEndDate.toISOString() };
}

export type UseEnhancedAnalyticsPropsParams = {
  dashboardData: AnalyticsDashboardData | null;
  dashboardLocked: boolean;
  analyticsLocked: boolean;
  dashboardLoading: boolean;
  dashboardSectionErrors: AnalyticsSectionErrors;
  analyticsPeriod: DashboardPeriod;
  customRange: CustomRange | null;
  effectiveGroupBy: 'day' | 'week' | 'month';
  statusChartGroupBy: 'day' | 'week';
  periodLabels: Record<DashboardPeriod, string>;
  userId: string | undefined;
  organizationId: string | null;
  onAnalyticsPeriodChange: (period: DashboardPeriod, range?: CustomRange) => void;
};

export function useEnhancedAnalyticsProps(params: UseEnhancedAnalyticsPropsParams): EnhancedAnalyticsProps | undefined {
  const router = useRouter();
  const {
    dashboardData,
    dashboardLocked,
    analyticsLocked,
    dashboardLoading,
    dashboardSectionErrors: se,
    analyticsPeriod,
    customRange,
    effectiveGroupBy,
    statusChartGroupBy,
    periodLabels,
    userId,
    organizationId,
    onAnalyticsPeriodChange,
  } = params;

  return useMemo(() => {
    if (!dashboardData || dashboardLocked || analyticsLocked) return undefined;
    const jc = dashboardData.jobCompletion;
    const cr = dashboardData.complianceRate;
    const summary = dashboardData.summary;
    const priorJc = dashboardData.priorJobCompletion;
    const priorCr = dashboardData.priorComplianceRate;
    const jobCounts = summary?.job_counts_by_status ?? {};
    const totalJobs = jc?.total ?? 0;
    const completionRate = jc?.completion_rate ?? 0;
    const avgRiskFromSummary = summary?.avg_risk != null ? Number(summary.avg_risk) : null;
    const avgRiskUnavailable = se.summary;
    const complianceOverall = cr?.overall ?? 0;

    const priorTotal = priorJc != null ? priorJc.total : undefined;
    const priorCompletion = priorJc != null ? priorJc.completion_rate : undefined;
    const priorCompliance = priorCr != null ? priorCr.overall : undefined;
    const priorRiskData = dashboardData.priorTrendsRisk?.data ?? [];
    const priorAvgRisk = priorRiskData.length > 0 ? priorRiskData.reduce((a, p) => a + p.value, 0) / priorRiskData.length : undefined;
    const avgRiskKpi = avgRiskFromSummary ?? 0;

    const percentChange = (current: number, previous: number): number | undefined => {
      if (previous === 0) return current > 0 ? 100 : undefined;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };
    const trendFromDelta = (delta: number | undefined): 'up' | 'down' | 'flat' => {
      if (delta == null) return 'flat';
      if (delta > 0) return 'up';
      if (delta < 0) return 'down';
      return 'flat';
    };
    const trendForMetric = (current: number, prior: number, higherIsBetter: boolean): 'up' | 'down' | 'flat' => {
      const pct = percentChange(current, prior);
      if (pct == null || pct === 0) return 'flat';
      if (higherIsBetter) return pct > 0 ? 'up' : 'down';
      return pct < 0 ? 'up' : 'down';
    };

    const priorUnavailableForJobs = se.priorSummary || se.priorJobCompletion;
    const priorUnavailableForRisk = se.priorTrendsRisk || avgRiskUnavailable;
    const priorUnavailableForCompliance = se.priorComplianceRate;

    const totalJobsTrendPct = priorUnavailableForJobs ? undefined : (priorTotal !== undefined ? percentChange(totalJobs, priorTotal) : undefined);
    const completionTrendPct = priorUnavailableForJobs ? undefined : (priorCompletion !== undefined ? percentChange(completionRate, priorCompletion) : undefined);
    const avgRiskTrendPct = priorUnavailableForRisk ? undefined : (priorAvgRisk !== undefined ? percentChange(avgRiskKpi, priorAvgRisk) : undefined);
    const avgRiskTrend = priorUnavailableForRisk ? 'flat' : (priorAvgRisk !== undefined ? trendForMetric(avgRiskKpi, priorAvgRisk, false) : 'flat');
    const avgRiskTrendDirection =
      avgRiskTrendPct == null || avgRiskTrendPct === 0 ? 'flat' : avgRiskTrendPct > 0 ? 'up' : 'down';

    const kpiItems: EnhancedAnalyticsProps['kpiItems'] = [
      {
        id: 'total-jobs',
        title: 'Total Jobs',
        value: totalJobs,
        unavailable: se.summary || se.jobCompletion,
        trend: priorUnavailableForJobs ? 'flat' : trendFromDelta(totalJobsTrendPct),
        trendPercent: priorUnavailableForJobs ? undefined : totalJobsTrendPct,
        previousValue: priorUnavailableForJobs ? undefined : priorTotal,
        trendLabel: periodLabels[analyticsPeriod],
        sparklineData: dashboardData.trendsJobs?.data?.slice(-7).map((d) => d.value) ?? [],
      },
      {
        id: 'completion-rate',
        title: 'Completion Rate',
        value: Math.round(completionRate),
        suffix: '%',
        unavailable: se.jobCompletion,
        trend: priorUnavailableForJobs ? 'flat' : (priorCompletion !== undefined ? trendForMetric(completionRate, priorCompletion, true) : 'flat'),
        trendPercent: priorUnavailableForJobs ? undefined : completionTrendPct,
        previousValue: priorUnavailableForJobs ? undefined : (priorCompletion !== undefined ? Math.round(priorCompletion) : undefined),
        sparklineData: dashboardData.trendsCompletion?.data?.slice(-7).map((d) => d.value) ?? [],
      },
      {
        id: 'avg-risk',
        title: 'Avg Risk Score',
        value: Math.round(avgRiskKpi * 10) / 10,
        unavailable: avgRiskUnavailable,
        trend: avgRiskTrend,
        trendDirection: avgRiskTrendDirection,
        trendPercent: priorUnavailableForRisk ? undefined : avgRiskTrendPct,
        previousValue: priorUnavailableForRisk ? undefined : (priorAvgRisk !== undefined ? Math.round(priorAvgRisk * 10) / 10 : undefined),
        sparklineData: dashboardData.trendsRisk?.data?.slice(-7).map((d) => d.value) ?? [],
      },
      {
        id: 'compliance-rate',
        title: 'Compliance Rate',
        value: Math.round(complianceOverall),
        suffix: '%',
        unavailable: se.complianceRate,
        trend: priorUnavailableForCompliance ? 'flat' : (priorCompliance !== undefined ? trendForMetric(complianceOverall, priorCompliance, true) : 'flat'),
        trendPercent: priorUnavailableForCompliance ? undefined : (priorCompliance !== undefined ? percentChange(complianceOverall, priorCompliance) : undefined),
        previousValue: priorUnavailableForCompliance ? undefined : (priorCompliance !== undefined ? Math.round(priorCompliance) : undefined),
        sparklineData: dashboardData.trendsCompliance?.data?.slice(-7).map((d) => d.value) ?? [],
      },
    ];

    const useCustom = analyticsPeriod === 'custom' && customRange?.start && customRange?.end;
    const periodRangeStart = useCustom
      ? customRange!.start
      : analyticsPeriod === '1y'
        ? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1, 0, 0, 0, 0)).toISOString().slice(0, 10)
        : (() => {
            const days = analyticsPeriod === '7d' ? 7 : analyticsPeriod === '90d' ? 90 : 30;
            const d = new Date();
            d.setDate(d.getDate() - (days - 1));
            return d.toISOString().slice(0, 10);
          })();
    const periodRangeEnd = useCustom
      ? customRange!.end
      : analyticsPeriod === '1y'
        ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0, 0)).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    return {
      period: analyticsPeriod,
      onPeriodChange: onAnalyticsPeriodChange,
      periodLabel: periodLabels[analyticsPeriod],
      customRange: analyticsPeriod === 'custom' ? customRange : null,
      periodRangeStart,
      periodRangeEnd,
      trendsGranularity: effectiveGroupBy,
      statusChartGranularity: statusChartGroupBy,
      kpiItems,
      insightsDismissalScope: analyticsPeriod === 'custom' && customRange?.start && customRange?.end
        ? `${userId ?? ''}-${organizationId ?? ''}-${analyticsPeriod}-${periodRangeStart}-${periodRangeEnd}`
        : `${userId ?? ''}-${organizationId ?? ''}-${analyticsPeriod}`,
      insights: (dashboardData.insights?.insights ?? []).map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        description: i.description,
        severity: i.severity,
        action_url: i.action_url,
        metric_value: i.metric_value,
        metric_label: i.metric_label,
      })),
      insightsLoading: dashboardLoading && dashboardData.insights === null,
      trendsJobs: dashboardData.trendsJobs,
      trendsRisk: dashboardData.trendsRisk,
      trendsCompletion: dashboardData.trendsCompletion,
      trendsCompletedCounts: dashboardData.trendsCompletedCounts ?? null,
      jobCountsByStatus: jobCounts,
      statusByPeriod: dashboardData.statusByPeriod ?? undefined,
      hazardItems: dashboardData.hazardFrequency?.items ?? [],
      riskHeatmap: dashboardData.riskHeatmap ?? null,
      teamMembers: dashboardData.teamPerformance?.members ?? [],
      isLoading: dashboardLoading,
      onPeriodClick: (period: string, opts?: { useCompletionDate?: boolean; rangeEnd?: string; granularity?: 'day' | 'week' | 'month' }) => {
        const granularity = opts?.granularity ?? effectiveGroupBy;
        const { start, end } = periodRangeFromGranularity(period, granularity, opts?.rangeEnd);
        const params = new URLSearchParams();
        if (opts?.useCompletionDate) {
          params.set('completed_after', start);
          params.set('completed_before', end);
        } else {
          params.set('created_after', start);
          params.set('created_before', end);
        }
        router.push(`/operations/jobs?${params.toString()}`);
      },
      onStatusClick: (status: string, period?: string, opts?: { rangeEnd?: string; granularity?: 'day' | 'week' }) => {
        const params = new URLSearchParams();
        params.set('status', status.replace(/\s+/g, '_').toLowerCase());
        if (period) {
          const granularity = opts?.granularity ?? statusChartGroupBy;
          const { start, end } = periodRangeFromGranularity(period, granularity, opts?.rangeEnd);
          params.set('created_after', start);
          params.set('created_before', end);
        }
        router.push(`/operations/jobs?${params.toString()}`);
      },
      onHazardCategoryClick: (category: string) => {
        const params = new URLSearchParams();
        params.set('hazard', category);
        let bounds: { since: string; until: string };
        if (analyticsPeriod === 'custom' && customRange?.start && customRange?.end) {
          bounds = dateOnlyToApiBounds(customRange.start, customRange.end);
        } else {
          const preset: PresetPeriod =
            analyticsPeriod === '1y' ? '1y' : analyticsPeriod === '7d' ? '7d' : analyticsPeriod === '90d' ? '90d' : '30d';
          bounds = presetPeriodToApiBounds(preset);
        }
        params.set('created_after', bounds.since);
        params.set('created_before', bounds.until);
        if (analyticsPeriod !== 'custom') {
          params.set('time_range', analyticsPeriod);
        }
        router.push(`/operations/jobs?${params.toString()}`);
      },
    };
  }, [
    dashboardData,
    dashboardLocked,
    analyticsLocked,
    dashboardLoading,
    se,
    analyticsPeriod,
    customRange,
    effectiveGroupBy,
    statusChartGroupBy,
    periodLabels,
    userId,
    organizationId,
    onAnalyticsPeriodChange,
    router,
  ]);
}
