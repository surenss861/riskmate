import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyticsApi } from '@/lib/api';

export type MitigationAnalytics = Awaited<ReturnType<typeof analyticsApi.mitigations>>;

type UseAnalyticsOptions = {
  range?: string;
  crewId?: string;
  orgId?: string;
  refreshIntervalMs?: number;
  enabled?: boolean;
};

type UseAnalyticsResult = {
  data: MitigationAnalytics | null;
  isLoading: boolean;
  isError: boolean;
  isFeatureLocked: boolean;
  refetch: () => Promise<void>;
  lastUpdated: string | null;
};

const DEFAULT_ANALYTICS: MitigationAnalytics = {
  org_id: '',
  range_days: 30,
  completion_rate: 0,
  avg_time_to_close_hours: 0,
  high_risk_jobs: 0,
  evidence_count: 0,
  jobs_with_evidence: 0,
  jobs_without_evidence: 0,
  avg_time_to_first_evidence_hours: 0,
  trend: [],
};

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsResult {
  const { range, crewId, orgId, refreshIntervalMs, enabled = true } = options;
  const [data, setData] = useState<MitigationAnalytics | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isError, setError] = useState<boolean>(false);
  const [isFeatureLocked, setFeatureLocked] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    setLoading(true);
    setError(false);
    setFeatureLocked(false);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await analyticsApi.mitigations({
        orgId,
        range,
        crewId,
      });

      if (!controller.signal.aborted) {
        setData(response);
        setLastUpdated(new Date().toISOString());
        setFeatureLocked(false);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Analytics fetch failed', error);
        setError(true);
        const code = (error as any)?.code ?? (error as any)?.response?.data?.code;
        if (code === 'FEATURE_NOT_ALLOWED') {
          setFeatureLocked(true);
        }
        setData((current) => current ?? DEFAULT_ANALYTICS);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [crewId, orgId, range, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData, enabled]);

  useEffect(() => {
    if (!enabled || !refreshIntervalMs || refreshIntervalMs <= 0) {
      return;
    }

    const interval = setInterval(() => {
      fetchData().catch(() => null);
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [fetchData, refreshIntervalMs, enabled]);

  const resultData = useMemo(() => {
    if (!data) return DEFAULT_ANALYTICS;
    return {
      ...data,
      completion_rate: Number(data.completion_rate.toFixed(3)),
      avg_time_to_close_hours: Number(data.avg_time_to_close_hours.toFixed(2)),
    };
  }, [data]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data: resultData,
    isLoading,
    isError,
    isFeatureLocked,
    refetch,
    lastUpdated,
  };
}

