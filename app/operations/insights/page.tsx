'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { AlertTriangle, TrendingDown, FileSignature } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { analyticsApi } from '@/lib/api';
import { dateOnlyToApiBounds, presetPeriodToApiBounds, toDateOnly } from '@/lib/utils/dateRange';
import { AppBackground, AppShell, PageHeader, GlassCard } from '@/components/shared';
import { SkeletonLoader } from '@/components/dashboard/SkeletonLoader';
import { useUserRole } from '@/hooks/useUserRole';

type SeverityIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
const severityConfig: Record<string, { bg: string; border: string; icon: SeverityIcon }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-400/30', icon: AlertTriangle },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-400/30', icon: TrendingDown },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-400/30', icon: FileSignature },
};

function getSeverityStyle(severity: string) {
  return severityConfig[severity.toLowerCase()] ?? severityConfig.info;
}

const PERIOD_LABELS: Record<string, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '1y': 'This Year',
};

function InsightsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeRange = searchParams.get('time_range') || '30d';
  const rangeStart = searchParams.get('range_start')?.trim() ?? '';
  const rangeEnd = searchParams.get('range_end')?.trim() ?? '';

  const { user, userRole, roleFetchError, refetchRole } = useUserRole();
  const [insights, setInsights] = useState<Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    action_url: string;
    metric_value?: number;
    metric_label?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const { since, until, periodLabel } = useMemo(() => {
    if (timeRange === 'custom' && rangeStart && rangeEnd) {
      const start = toDateOnly(rangeStart);
      const end = toDateOnly(rangeEnd);
      const bounds = dateOnlyToApiBounds(start, end);
      const label = `${new Date(start + 'T12:00:00').toLocaleDateString()} – ${new Date(end + 'T12:00:00').toLocaleDateString()}`;
      return { since: bounds.since, until: bounds.until, periodLabel: label };
    }
    const period = (timeRange === 'all' ? '1y' : timeRange) as '7d' | '30d' | '90d' | '1y';
    const bounds = presetPeriodToApiBounds(period);
    return { since: bounds.since, until: bounds.until, periodLabel: PERIOD_LABELS[period] || timeRange };
  }, [timeRange, rangeStart, rangeEnd]);


  useEffect(() => {
    if (userRole === null || userRole === 'member') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchInsights = async () => {
      setLoading(true);
      try {
        const res = await analyticsApi.insights({ since, until });
        if (!cancelled) {
          setInsights(res.insights ?? []);
          setLocked(!!res.locked);
        }
      } catch {
        if (!cancelled) setInsights([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInsights();
    return () => { cancelled = true; };
  }, [since, until, userRole]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    const { cacheInvalidation } = await import('@/lib/cache');
    cacheInvalidation.clearAll();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isMember = userRole === 'member';

  if (roleFetchError) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <DashboardNavbar email={user?.email} onLogout={handleLogout} />
          <AppShell>
            <GlassCard className="p-8 text-center border-amber-500/30 bg-amber-500/5">
              <p className="text-amber-200/90 mb-2">We couldn’t load your role. You may not have access to this page.</p>
              <p className="text-sm text-white/60 mb-4">Please try again or contact your administrator.</p>
              <button
                type="button"
                onClick={() => refetchRole()}
                className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-medium text-black hover:bg-[#FB923C] transition-colors"
              >
                Retry
              </button>
              <Link href="/operations" className="mt-4 inline-block text-sm text-[#F97316] hover:text-[#FB923C] ml-4">
                ← Back to Operations
              </Link>
            </GlassCard>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    );
  }

  if (userRole === null) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <DashboardNavbar email={user?.email} onLogout={handleLogout} />
          <AppShell>
            <div className="p-8 text-white/60 flex items-center justify-center min-h-[200px]">Loading…</div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    );
  }

  if (isMember) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <DashboardNavbar email={user?.email} onLogout={handleLogout} />
          <AppShell>
            <GlassCard className="p-8 text-center">
              <p className="text-white/70">Insights are available to owners and admins.</p>
              <Link href="/operations" className="mt-4 inline-block text-sm text-[#F97316] hover:text-[#FB923C]">
                ← Back to Operations
              </Link>
            </GlassCard>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar email={user?.email} onLogout={handleLogout} />
        <AppShell>
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <PageHeader
                  title="Insights"
                  subtitle="Actionable insights for the selected period."
                  showDivider
                  className="mb-0"
                />
                <p className="mt-2 text-sm text-white/60">
                  Period: <span className="text-white/80 font-medium">{periodLabel}</span>
                </p>
              </div>
              <Link
                href={timeRange === 'custom' && rangeStart && rangeEnd
                  ? `/operations?time_range=custom&range_start=${rangeStart}&range_end=${rangeEnd}`
                  : `/operations?time_range=${timeRange}`}
                className="text-sm text-[#F97316] hover:text-[#FB923C] transition-colors"
              >
                ← Back to Operations
              </Link>
            </div>
          </div>

          {locked && (
            <GlassCard className="p-4 mb-6 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm text-amber-200/90">Insights are from cache. Upgrade for live data.</p>
            </GlassCard>
          )}

          <GlassCard className="p-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/5">
                    <SkeletonLoader variant="circular" width="24px" height="24px" className="shrink-0" />
                    <div className="flex-1 space-y-2">
                      <SkeletonLoader variant="text" lines={1} width="60%" />
                      <SkeletonLoader variant="text" lines={2} width="100%" />
                    </div>
                  </div>
                ))}
              </div>
            ) : insights.length === 0 ? (
              <p className="text-sm text-white/50">No actionable insights for this period.</p>
            ) : (
              <ul className="space-y-2">
                {insights.map((insight) => {
                  const { icon: Icon } = getSeverityStyle(insight.severity);
                  return (
                    <li
                      key={insight.id}
                      className={clsx(
                        'flex gap-3 p-3 rounded-lg border transition-colors',
                        getSeverityStyle(insight.severity).bg,
                        getSeverityStyle(insight.severity).border
                      )}
                    >
                      <div className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 text-white/70" aria-hidden>
                        <Icon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{insight.title}</p>
                        <p className="text-xs text-white/60 mt-1">{insight.description}</p>
                        {insight.action_url ? (
                          <Link
                            href={insight.action_url}
                            className="inline-block mt-2 text-xs text-[#F97316] hover:text-[#FB923C] transition-colors"
                          >
                            {insight.metric_label || 'View details'} →
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </AppShell>
      </AppBackground>
    </ProtectedRoute>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <AppBackground>
          <AppShell>
            <div className="p-8 text-white/60">Loading...</div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    }>
      <InsightsPageInner />
    </Suspense>
  );
}
