'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import clsx from 'clsx';
import Link from 'next/link';

type KpiTileProps = {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  description?: string;
  highlightColor?: string;
  isLoading?: boolean;
  /** When true, show "Unavailable" instead of value (endpoint failed). */
  unavailable?: boolean;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  /** Percentage change vs previous period (e.g. 12 for "↑ 12%") */
  trendPercent?: number;
  /** Previous period value for tooltip */
  previousValue?: number;
  /** Mini sparkline values (e.g. last 7 points) */
  sparklineData?: number[];
  href?: string;
  onClick?: () => void;
};

const formatNumber = (value: number) => {
  if (Number.isNaN(value)) return '0';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
  }
  return value.toFixed(value % 1 === 0 ? 0 : value < 10 ? 1 : 0);
};

const trendColorClass = {
  up: 'text-emerald-400 bg-emerald-500/10',
  down: 'text-red-400 bg-red-500/10',
  flat: 'text-[#A1A1A1] bg-white/5',
};

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const w = 64;
  const h = 24;
  const padding = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/40"
        points={points.join(' ')}
      />
    </svg>
  );
}

export function KpiTile({
  title,
  value,
  prefix,
  suffix,
  description,
  highlightColor = '#F97316',
  isLoading = false,
  unavailable = false,
  trend = 'flat',
  trendLabel,
  trendPercent,
  previousValue,
  sparklineData,
  href,
  onClick,
}: KpiTileProps) {
  const [displayValue, setDisplayValue] = useState('0');
  const [showTooltip, setShowTooltip] = useState(false);
  const spring = useSpring(0, {
    stiffness: 120,
    damping: 16,
  });

  useEffect(() => {
    if (!unavailable) spring.set(value);
  }, [spring, value, unavailable]);

  useEffect(() => {
    if (unavailable) return;
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(formatNumber(latest));
    });
    return () => {
      unsubscribe();
    };
  }, [spring, unavailable]);

  const trendDisplay = useMemo(() => {
    const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    if (trendPercent != null && !Number.isNaN(trendPercent)) {
      return `${arrow} ${trendPercent > 0 ? trendPercent : -trendPercent}%`;
    }
    return trendLabel ?? null;
  }, [trend, trendLabel, trendPercent]);

  const tileContent = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.35 }}
      className={clsx(
        "group relative overflow-hidden rounded-3xl border border-white/10",
        "bg-white/[0.03] backdrop-blur-xl",
        "shadow-[0_4px_24px_rgba(0,0,0,0.15)] p-6 transition-transform duration-300",
        (href || onClick) && "cursor-pointer"
      )}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(previousValue != null)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="text-xs uppercase tracking-wider text-white/50 mb-2">{title}</div>
      
      <div className="mt-2 flex items-baseline gap-2">
        <span 
          className="text-3xl font-bold font-display text-white tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums slashed-zero' }}
        >
          {prefix}
          {isLoading ? '—' : unavailable ? '—' : displayValue}
          {suffix}
        </span>
        {unavailable && !isLoading && (
          <span className="text-sm font-medium text-amber-400/90">Unavailable</span>
        )}
      </div>

      {description && (
        <p className="mt-3 text-sm text-white/60 leading-relaxed">{description}</p>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {sparklineData && sparklineData.length > 0 && !isLoading && (
          <Sparkline data={sparklineData} />
        )}
        {trendDisplay && (
          <span className={clsx(
            'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
            trendColorClass[trend]
          )}>
            {trendDisplay}
          </span>
        )}
      </div>

      {showTooltip && previousValue != null && (
        <div className="absolute bottom-4 left-6 right-6 rounded-lg bg-black/80 border border-white/10 px-3 py-2 text-xs text-white/80">
          Previous period: {prefix}{formatNumber(previousValue)}{suffix}
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{tileContent}</Link>
  }

  return tileContent
}

export default KpiTile;

