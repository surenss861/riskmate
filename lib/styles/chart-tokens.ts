/**
 * Chart Style Tokens - Global chart styling rules
 * 
 * These tokens enforce consistent chart styling across the app.
 * Apply these globally to your chart library configuration.
 * 
 * Rules:
 * - Gridlines: Subtle opacity (0.06)
 * - Axis labels: Muted sans (text-white/60)
 * - Axis ticks: Very muted (text-white/40)
 * - Tooltips: Secondary surface (bg-white/5)
 * - No heavy chart borders (rely on card border)
 */

export const chartTokens = {
  gridlines: {
    stroke: 'rgba(255, 255, 255, 0.06)',
    strokeWidth: 1,
  },
  axis: {
    labelColor: 'rgba(255, 255, 255, 0.6)', // text-white/60
    tickColor: 'rgba(255, 255, 255, 0.4)', // text-white/40
    fontSize: '12px', // text-sm
    fontFamily: 'sans-serif',
  },
  tooltip: {
    background: 'rgba(255, 255, 255, 0.05)', // bg-white/5
    border: 'rgba(255, 255, 255, 0.1)', // border-white/10
    borderRadius: '8px', // rounded-lg
    padding: '8px 12px',
    labelColor: 'rgba(255, 255, 255, 0.6)', // text-white/60
    valueColor: 'rgba(255, 255, 255, 0.9)', // text-white/90
    fontSize: '12px',
  },
} as const

/**
 * Apply these to your chart library configuration
 * 
 * Example for Recharts:
 * ```tsx
 * import { chartTokens } from '@/lib/styles/chart-tokens'
 * 
 * <LineChart>
 *   <CartesianGrid 
 *     stroke={chartTokens.gridlines.stroke}
 *     strokeWidth={chartTokens.gridlines.strokeWidth}
 *   />
 *   <XAxis 
 *     tick={{ fill: chartTokens.axis.tickColor, fontSize: chartTokens.axis.fontSize }}
 *     label={{ fill: chartTokens.axis.labelColor, fontSize: chartTokens.axis.fontSize }}
 *   />
 * </LineChart>
 * ```
 */

