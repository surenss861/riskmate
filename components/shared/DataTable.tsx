'use client'

import { ReactNode } from 'react'
import { GlassCard } from './GlassCard'
import { Badge } from './Badge'
import clsx from 'clsx'

type DataTableProps = {
  children: ReactNode
  className?: string
}

/**
 * DataTable - Standardized table container
 * Enforces editorial density and styling
 * 
 * Rules:
 * - Uses GlassCard container
 * - No inner cell borders (only row separators)
 * - Increased row height + padding (editorial density)
 * - Row separators: hairline (divide-white/5)
 */
export function DataTable({ children, className }: DataTableProps) {
  return (
    <GlassCard className={clsx('overflow-hidden p-0', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
    </GlassCard>
  )
}

type TableHeadProps = {
  children: ReactNode
  className?: string
}

export function TableHead({ children, className }: TableHeadProps) {
  return (
    <thead className={clsx('border-b border-white/10', className)}>
      {children}
    </thead>
  )
}

type TableBodyProps = {
  children: ReactNode
  className?: string
}

export function TableBody({ children, className }: TableBodyProps) {
  return (
    <tbody className={clsx('divide-y divide-white/5', className)}>
      {children}
    </tbody>
  )
}

type TableRowProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
}

/**
 * TableRow - Editorial density row
 * 
 * Rules:
 * - Height: py-4 (16px vertical padding = generous spacing)
 * - Hover: subtle surface shift (bg-white/5), no bright outlines
 * - Clickable rows: cursor-pointer
 */
export function TableRow({ children, className, onClick }: TableRowProps) {
  return (
    <tr
      className={clsx(
        'group',
        'px-6 py-4', // Editorial padding
        'transition-colors duration-200',
        onClick && 'cursor-pointer hover:bg-white/5',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

type TableHeaderCellProps = {
  children: ReactNode
  className?: string
  colSpan?: number
}

export function TableHeaderCell({ children, className, colSpan }: TableHeaderCellProps) {
  return (
    <th
      className={clsx(
        'px-6 py-3 text-left',
        'text-xs font-medium text-white/60 uppercase tracking-wider',
        className
      )}
      colSpan={colSpan}
    >
      {children}
    </th>
  )
}

type TableCellProps = {
  children: ReactNode
  className?: string
  colSpan?: number
}

/**
 * TableCell - Standardized cell styling
 * 
 * Rules:
 * - Padding: px-6 py-4 (matches row padding)
 * - Text: Base sans-serif (no serif in data)
 * - Status: Use Badge component only
 */
export function TableCell({ children, className, colSpan }: TableCellProps) {
  return (
    <td
      className={clsx(
        'px-6 py-4',
        'text-sm text-white/90',
        className
      )}
      colSpan={colSpan}
    >
      {children}
    </td>
  )
}

// Re-export Badge for convenience (status indicators)
export { Badge }

