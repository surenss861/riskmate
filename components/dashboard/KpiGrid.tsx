'use client';

import { KpiTile } from './KpiTile';

export type KpiGridItem = {
  id: string;
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

type KpiGridProps = {
  items: KpiGridItem[];
};

export function KpiGrid({ items }: KpiGridProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <KpiTile key={item.id} {...item} />
      ))}
    </div>
  );
}

export default KpiGrid;

