'use client';

import { useMemo } from 'react';

export type RiskHeatmapBucket = {
  job_type: string;
  day_of_week: number;
  avg_risk: number;
  count: number;
};

type RiskHeatmapProps = {
  periodLabel: string;
  buckets: RiskHeatmapBucket[];
  isLoading?: boolean;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function heatmapKey(jobType: string, day: number): string {
  return `${jobType}|${day}`;
}

function riskToBg(avgRisk: number): string {
  if (avgRisk >= 75) return 'bg-red-500/60';
  if (avgRisk >= 50) return 'bg-orange-500/60';
  if (avgRisk >= 25) return 'bg-amber-500/60';
  if (avgRisk > 0) return 'bg-emerald-500/60';
  return 'bg-white/5';
}

export function RiskHeatmap({
  periodLabel,
  buckets,
  isLoading = false,
}: RiskHeatmapProps) {
  const { map, jobList } = useMemo(() => {
    const m = new Map<string, { avg_risk: number; count: number }>();
    const jobTypes = new Set<string>();
    for (const b of buckets) {
      const jobType = b.job_type || 'other';
      m.set(heatmapKey(jobType, b.day_of_week), { avg_risk: b.avg_risk, count: b.count });
      jobTypes.add(jobType);
    }
    return { map: m, jobList: [...jobTypes].sort() };
  }, [buckets]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Risk heatmap</h3>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        <div className="h-48 bg-white/5 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (jobList.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Risk heatmap</h3>
        <p className="text-sm text-white/50 mb-4">{periodLabel}</p>
        <div className="h-32 flex items-center justify-center text-white/50 text-sm">
          No risk data in this period
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h3 className="text-lg font-semibold text-white mb-2">Risk heatmap</h3>
      <p className="text-sm text-white/50 mb-4">
        Average risk by job type and day of week · {periodLabel}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-white/60 font-medium">Job type</th>
              {DAY_LABELS.map((label, i) => (
                <th key={i} className="py-2 px-1 text-center text-white/60 font-medium min-w-[2.5rem]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobList.map((jobType) => (
              <tr key={jobType}>
                <td className="py-1.5 pr-3 text-white/80 truncate max-w-[8rem]" title={jobType}>
                  {jobType}
                </td>
                {DAY_LABELS.map((_, dayIndex) => {
                  const cell = map.get(heatmapKey(jobType, dayIndex));
                  const avg = cell?.avg_risk ?? null;
                  const count = cell?.count ?? 0;
                  return (
                    <td key={dayIndex} className="py-1.5 px-1 text-center">
                      {avg != null ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 min-w-[2rem] ${riskToBg(avg)} text-white font-medium`}
                          title={count ? `${avg.toFixed(1)} avg · ${count} jobs` : `${avg.toFixed(1)}`}
                        >
                          {avg.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
