'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

type TrendPoint = {
  date: string;
  completion_rate: number;
};

type TrendChartProps = {
  data: TrendPoint[];
  rangeDays: number;
  onRangeChange?: (next: number) => void;
  isLoading?: boolean;
  emptyReason?: 'no_jobs' | 'no_events' | null;
  onCreateJob?: () => void;
  onViewMitigations?: () => void;
};

const RANGES = [30, 90];

const formatPercent = (value: number) =>
  `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const formatDateLabel = (isoDate: string) => {
  const date = new Date(isoDate);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString(undefined, options);
};

const CHART_DIMENSIONS = {
  width: 720,
  height: 220,
  paddingX: 20,
  paddingY: 30,
};

export function TrendChart({
  data,
  rangeDays,
  onRangeChange,
  isLoading = false,
  emptyReason,
  onCreateJob,
  onViewMitigations,
}: TrendChartProps) {
  const paddedData = useMemo(() => {
    return data.length > 0 ? data : [{ date: new Date().toISOString().slice(0, 10), completion_rate: 0 }];
  }, [data]);

  const points = useMemo(() => {
    if (!paddedData.length) return [];
    const { width, height, paddingX, paddingY } = CHART_DIMENSIONS;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    return paddedData.map((point, index) => {
      const x = paddingX + (usableWidth * index) / Math.max(paddedData.length - 1, 1);
      const y =
        paddingY + usableHeight * (1 - Math.max(0, Math.min(1, point.completion_rate)));
      return { x, y, original: point };
    });
  }, [paddedData]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const start = points[0];
    const { height, paddingX, paddingY } = CHART_DIMENSIONS;
    const baseY = height - paddingY;

    const line = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return `${line} L ${points[points.length - 1].x} ${baseY} L ${paddingX} ${baseY} Z`;
  }, [points]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  }, [points]);

  const latestPoint = points[points.length - 1];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111111]/80 p-6 shadow-[0_28px_90px_rgba(8,8,24,0.55)] backdrop-blur-2xl">
      <span className="pointer-events-none absolute -right-32 top-[-120px] h-60 w-60 rounded-full bg-[#F97316]/18 blur-[140px]" />
      <span className="pointer-events-none absolute -left-36 bottom-[-100px] h-64 w-64 rounded-full bg-[#38BDF8]/14 blur-[150px]" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">Mitigation Completion Trend</h3>
          <p className="text-sm text-white/65">
            How fast crews are closing mitigations over the last {rangeDays} days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((range) => (
            <button
              key={range}
              onClick={() => onRangeChange?.(range)}
              className={`rounded-full border px-4 py-2 text-sm transition backdrop-blur-sm ${
                rangeDays === range
                  ? 'border-transparent bg-gradient-to-r from-[#F97316] via-[#FF8A3D] to-[#FFD166] text-black shadow-[0_12px_32px_rgba(249,115,22,0.35)]'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {range}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 h-[220px] w-full animate-pulse rounded-2xl bg-white/5" />
      ) : (paddedData.length === 0 || emptyReason) ? (
        <div className="mt-10 flex h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-8">
          {emptyReason === 'no_jobs' ? (
            <>
              <svg className="w-12 h-12 text-white/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-base font-medium text-white mb-1">No jobs in this range</p>
              <p className="text-sm text-white/60 mb-4">Create a job to start tracking trends</p>
              {onCreateJob && (
                <button
                  onClick={onCreateJob}
                  className="px-4 py-2 bg-[#F97316] text-white rounded-lg text-sm font-medium hover:bg-[#F97316]/90 transition-colors"
                >
                  Create Job
                </button>
              )}
            </>
          ) : emptyReason === 'no_events' ? (
            <>
              <svg className="w-12 h-12 text-white/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-base font-medium text-white mb-1">No completions yet</p>
              <p className="text-sm text-white/60 mb-4">View open mitigations to track progress</p>
              {onViewMitigations && (
                <button
                  onClick={onViewMitigations}
                  className="px-4 py-2 bg-[#F97316] text-white rounded-lg text-sm font-medium hover:bg-[#F97316]/90 transition-colors"
                >
                  View Open Mitigations
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-[#9FA6BE]">Insufficient data to display trend.</p>
          )}
        </div>
      ) : (
        <div className="relative mt-8 overflow-hidden">
          <svg
            viewBox={`0 0 ${CHART_DIMENSIONS.width} ${CHART_DIMENSIONS.height}`}
            className="w-full"
          >
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#29E673" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#FF6F30" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#29E673" />
                <stop offset="100%" stopColor="#FF6F30" />
              </linearGradient>
            </defs>

            <motion.path
              d={areaPath}
              fill="url(#trendGradient)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />

            <motion.path
              d={linePath}
              fill="none"
              stroke="url(#trendLine)"
              strokeWidth={3}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />

            {/* Y Axis ticks */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const y =
                CHART_DIMENSIONS.paddingY +
                (CHART_DIMENSIONS.height - CHART_DIMENSIONS.paddingY * 2) * (1 - tick);
              return (
                <g key={tick}>
                  <line
                    x1={CHART_DIMENSIONS.paddingX}
                    x2={CHART_DIMENSIONS.width - CHART_DIMENSIONS.paddingX}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4 8"
                  />
                  <text
                    x={CHART_DIMENSIONS.paddingX - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[10px] fill-white/45"
                  >
                    {formatPercent(tick)}
                  </text>
                </g>
              );
            })}

            {/* X Axis labels */}
            {points.map((point, index) => {
              const showLabel =
                index === 0 ||
                index === points.length - 1 ||
                (rangeDays === 90 ? index % 15 === 0 : index % 7 === 0);

              if (!showLabel) return null;
              return (
                <text
                  key={point.original.date}
                  x={point.x}
                  y={CHART_DIMENSIONS.height - CHART_DIMENSIONS.paddingY + 20}
                  textAnchor="middle"
                  className="text-[10px] fill-white/45"
                >
                  {formatDateLabel(point.original.date)}
                </text>
              );
            })}

            {/* Latest point marker */}
            {latestPoint && (
              <g>
                <circle
                  cx={latestPoint.x}
                  cy={latestPoint.y}
                  r={6}
                  fill="#F97316"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={2}
                />
                <text
                  x={latestPoint.x}
                  y={latestPoint.y - 14}
                  textAnchor="middle"
                  className="text-xs font-medium fill-[#F97316]"
                >
                  {formatPercent(latestPoint.original.completion_rate)}
                </text>
              </g>
            )}
          </svg>
        </div>
      )}
    </div>
  );
}

export default TrendChart;

