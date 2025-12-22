'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'
import { GlassCard } from './GlassCard'

type TableProps = {
  children: ReactNode
  className?: string
}

/**
 * Table - Standardized table with glass card container
 * Rows have subtle separators, muted column headers
 */
export function Table({ children, className }: TableProps) {
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
}

export function TableHead({ children }: TableHeadProps) {
  return (
    <thead className="border-b border-white/10">
      {children}
    </thead>
  )
}

type TableBodyProps = {
  children: ReactNode
}

export function TableBody({ children }: TableBodyProps) {
  return (
    <tbody className="divide-y divide-white/5">
      {children}
    </tbody>
  )
}

type TableRowProps = {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function TableRow({ children, className, hover = true }: TableRowProps) {
  return (
    <tr
      className={clsx(
        hover && 'transition-colors hover:bg-white/3',
        className
      )}
    >
      {children}
    </tr>
  )
}

type TableHeaderCellProps = {
  children: ReactNode
  className?: string
}

export function TableHeaderCell({ children, className }: TableHeaderCellProps) {
  return (
    <th
      className={clsx(
        'px-6 py-3 text-left text-sm font-medium text-white/60',
        className
      )}
    >
      {children}
    </th>
  )
}

type TableCellProps = {
  children: ReactNode
  className?: string
}

export function TableCell({ children, className }: TableCellProps) {
  return (
    <td
      className={clsx(
        'px-6 py-4 text-sm text-white/90',
        className
      )}
    >
      {children}
    </td>
  )
}

