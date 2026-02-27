'use client';

/**
 * TrendChart: compatibility wrapper for the legacy API.
 * @deprecated Prefer AnalyticsTrendCharts for the enhanced analytics layout; it supports
 * trendsCompletedCounts, period-range drill-down, and granularity-aware callbacks.
 */

import React from 'react';
import { AnalyticsTrendCharts } from './AnalyticsTrendCharts';
import type { TrendPoint, StatusByPeriodRow } from './chartUtils';

export type { TrendPoint };

type TrendsResponse = { data: TrendPoint[] } | null;

type TrendChartProps = {
  trendsJobs: TrendsResponse;
  trendsCompletion: TrendsResponse;
  trendsRisk: TrendsResponse;
  jobCountsByStatus?: Record<string, number>;
  statusByPeriod?: StatusByPeriodRow[];
  periodLabel?: string;
  isLoading?: boolean;
  onPeriodClick?: (period: string) => void;
  onStatusClick?: (status: string, period?: string) => void;
};

export function TrendChart({
  trendsJobs,
  trendsCompletion,
  trendsRisk,
  jobCountsByStatus = {},
  statusByPeriod,
  periodLabel = 'Last 30 days',
  isLoading = false,
  onPeriodClick,
  onStatusClick,
}: TrendChartProps) {
  return (
    <AnalyticsTrendCharts
      trendsJobs={trendsJobs}
      trendsCompletion={trendsCompletion}
      trendsRisk={trendsRisk}
      jobCountsByStatus={jobCountsByStatus}
      statusByPeriod={statusByPeriod}
      periodLabel={periodLabel}
      isLoading={isLoading}
      onPeriodClick={onPeriodClick ? (period) => onPeriodClick(period) : undefined}
      onStatusClick={onStatusClick ? (status, period) => onStatusClick(status, period) : undefined}
    />
  );
}

export default TrendChart;
