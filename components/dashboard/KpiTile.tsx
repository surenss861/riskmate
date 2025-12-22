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
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
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
  href,
  onClick,
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
    >
      <div className="text-xs uppercase tracking-wider text-white/50 mb-2">{title}</div>
      
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold font-display text-white">
          {prefix}
          {isLoading ? '—' : displayValue}
          {suffix}
        </span>
      </div>

      {description && (
        <p className="mt-3 text-sm text-white/60 leading-relaxed">{description}</p>
      )}

      {trendText && (
        <div className="mt-4">
          <span className={clsx(
            'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-400/90' :
            trend === 'down' ? 'bg-red-500/10 text-red-400/90' :
            'bg-white/5 text-white/60'
          )}>
            {trendText}
          </span>
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

