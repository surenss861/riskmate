'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import clsx from 'clsx';

type KpiTileProps = {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  description?: string;
  highlightColor?: string;
  isLoading?: boolean;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
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

const trendColor = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  flat: 'text-[#A1A1A1]',
};

export function KpiTile({
  title,
  value,
  prefix,
  suffix,
  description,
  highlightColor = '#F97316',
  isLoading = false,
  trend = 'flat',
  trendLabel,
}: KpiTileProps) {
  const [displayValue, setDisplayValue] = useState('0');
  const spring = useSpring(0, {
    stiffness: 120,
    damping: 16,
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(formatNumber(latest));
    });
    return () => {
      unsubscribe();
    };
  }, [spring]);

  const trendText = useMemo(() => {
    if (!trendLabel) return null;
    return trendLabel;
  }, [trendLabel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -6 }}
      transition={{ duration: 0.35 }}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#111111]/80 p-6 shadow-[0_24px_80px_rgba(8,8,24,0.55)] backdrop-blur-2xl transition-transform duration-300"
    >
      <span className="pointer-events-none absolute -top-20 left-10 h-40 w-40 rounded-full bg-[#F97316]/15 blur-[120px]" />
      <span className="pointer-events-none absolute -bottom-24 right-6 h-44 w-44 rounded-full bg-[#38BDF8]/12 blur-[140px]" />
      <span className="shine-on-hover pointer-events-none absolute inset-0 rounded-3xl" />
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-[0.32em] text-white/55">{title}</p>
        <span
          className="glow-indicator h-2 w-2 rounded-full"
          style={{
            background: highlightColor,
            boxShadow: `0 0 12px ${highlightColor}`,
          }}
        />
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight text-white">
          {prefix}
          {isLoading ? '—' : displayValue}
          {suffix}
        </span>
      </div>

      {description && (
        <p className="mt-3 text-sm leading-relaxed text-white/65">{description}</p>
      )}

      {trendText && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <div
            className={clsx(
              'font-medium uppercase tracking-wide',
              trendColor[trend]
            )}
          >
            {trend === 'up' && '▲'}
            {trend === 'down' && '▼'}
            {trend === 'flat' && '■'}
          </div>
          <span className="text-[#9FA6BE]">{trendText}</span>
        </div>
      )}
    </motion.div>
  );
}

export default KpiTile;

