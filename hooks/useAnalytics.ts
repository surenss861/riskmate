import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyticsApi, type AnalyticsSummaryResponse } from '@/lib/api';

export type MitigationAnalytics = Awaited<ReturnType<typeof analyticsApi.mitigations>>;

type UseAnalyticsOptions = {
  range?: string;
  since?: string;
  until?: string;
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
  jobs_total: 0,
  jobs_scored: 0,
  jobs_with_any_evidence: 0,
  jobs_with_photo_evidence: 0,
  jobs_missing_required_evidence: 0,
  required_evidence_policy: null,
  avg_time_to_first_photo_minutes: null,
  trend_empty_reason: null,
  locked: false,
};

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsResult {
  const { range, since, until, crewId, orgId, refreshIntervalMs, enabled = true } = options;
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

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await analyticsApi.mitigations({
        orgId,
        range,
        since,
        until,
        crewId,
      });

      if (!controller.signal.aborted) {
        if (response.locked) {
          setFeatureLocked(true);
          setData((current) => current ?? DEFAULT_ANALYTICS);
        } else {
          setFeatureLocked(false);
          setData(response);
        }
        setLastUpdated(new Date().toISOString());
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
  }, [crewId, orgId, range, since, until, enabled]);

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

    let interval: NodeJS.Timeout | null = null;
    let stopped = false;

    const run = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        await fetchData();
      } catch (e) {
        // Stop polling on network errors to prevent spam
        if (!stopped && interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    };

    const start = () => {
      if (interval || stopped) return;
      run(); // Run immediately
      interval = setInterval(run, refreshIntervalMs);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    const onOnline = () => {
      if (!stopped) start();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    start();

    return () => {
      stopped = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
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

type UseAnalyticsSummaryOptions = {
  range?: string;
  orgId?: string;
  enabled?: boolean;
};

export function useAnalyticsSummary(
  options: UseAnalyticsSummaryOptions = {}
): {
  data: AnalyticsSummaryResponse | null;
  isLoading: boolean;
  isError: boolean;
  isFeatureLocked: boolean;
  refetch: () => Promise<void>;
} {
  const { range, orgId, enabled = true } = options;
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [isError, setError] = useState(false);
  const [isFeatureLocked, setFeatureLocked] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    if (controllerRef.current) controllerRef.current.abort();
    setLoading(true);
    setError(false);
    setFeatureLocked(false);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await analyticsApi.summary({ orgId, range });
      if (!controller.signal.aborted) setData(response);
      if (!controller.signal.aborted && response.locked) setFeatureLocked(true);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Analytics summary fetch failed', err);
        setError(true);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [orgId, range, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    return () => controllerRef.current?.abort();
  }, [fetchData, enabled]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  return { data, isLoading, isError, isFeatureLocked, refetch };
}

