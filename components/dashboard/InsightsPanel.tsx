'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertTriangle, TrendingDown, FileSignature } from 'lucide-react';
import { SkeletonLoader } from './SkeletonLoader';

const DISMISSED_STORAGE_KEY = 'riskmate-insights-dismissed';
const MAX_DISMISSED_IDS = 200;

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr.slice(-MAX_DISMISSED_IDS) : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(ids).slice(-MAX_DISMISSED_IDS);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export type InsightItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  action_url: string;
  metric_value?: number;
  metric_label?: string;
};

type InsightsPanelProps = {
  insights: InsightItem[];
  isLoading: boolean;
  viewAllHref?: string;
};

const severityConfig: Record<string, { bg: string; border: string; icon: React.ElementType }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-400/30', icon: AlertTriangle },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-400/30', icon: TrendingDown },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-400/30', icon: FileSignature },
};

function getSeverityStyle(severity: string) {
  return severityConfig[severity.toLowerCase()] ?? severityConfig.info;
}

export function InsightsPanel({ insights, isLoading, viewAllHref = '/operations?time_range=30d' }: InsightsPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissedIds(loadDismissedIds());
  }, []);

  const visible = insights.filter((i) => !dismissedIds.has(i.id));

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      saveDismissedIds(next);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Insights</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/5">
              <SkeletonLoader variant="circular" width="24px" height="24px" className="shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonLoader variant="text" lines={1} width="60%" />
                <SkeletonLoader variant="text" lines={2} width="100%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Insights</h3>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-sm text-[#F97316] hover:text-[#FB923C] transition-colors"
            >
              View All →
            </Link>
          )}
        </div>
        <p className="text-sm text-white/50">No actionable insights right now. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Insights</h3>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm text-[#F97316] hover:text-[#FB923C] transition-colors"
          >
            View All →
          </Link>
        )}
      </div>
      <ul className="space-y-2">
        {visible.slice(0, 5).map((insight) => {
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
                {React.createElement(Icon)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{insight.title}</p>
                <p className="text-xs text-white/60 mt-1">{insight.description}</p>
                {insight.action_url ? (
                  <Link
                    href={insight.action_url as string}
                    className="inline-block mt-2 text-xs text-[#F97316] hover:text-[#FB923C] transition-colors"
                  >
                    {insight.metric_label || 'View details'} →
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(insight.id)}
                className="shrink-0 p-1 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                aria-label="Dismiss insight"
              >
                <span className="text-sm">×</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default InsightsPanel;
