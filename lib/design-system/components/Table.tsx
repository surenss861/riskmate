import React from 'react'
import { colors, spacing, radius } from '../tokens'
import { cn } from '@/lib/utils/cn'

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
  striped?: boolean
}

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

export interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
}

/**
 * Enterprise-grade Table Component
 * 
 * Used primarily in app UI for data display
 * Supports zebra striping, hover states, and clean styling
 */
export function Table({ striped = true, className, children, ...props }: TableProps) {
  return (
    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
      <table
        className={cn('table', className)}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9375rem',
        }}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children, ...props }: TableHeaderProps) {
  return (
    <thead {...props}>
      {children}
    </thead>
  )
}

export function TableBody({ children, ...props }: TableBodyProps) {
  return (
    <tbody {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn('table-row', className)}
      style={{
        borderBottom: `1px solid ${colors.borderLight}`,
      }}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TableHeaderCell({ children, className, ...props }: TableHeaderCellProps) {
  return (
    <th
      className={cn('table-header-cell', className)}
      style={{
        padding: spacing.md,
        textAlign: 'left',
        fontWeight: 600,
        color: colors.black,
        backgroundColor: colors.lightGrayBg,
        fontSize: '0.875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
      {...props}
    >
      {children}
    </th>
  )
}

export function TableCell({ children, className, ...props }: TableCellProps) {
  return (
    <td
      className={cn('table-cell', className)}
      style={{
        padding: spacing.md,
        color: colors.gray700,
      }}
      {...props}
    >
      {children}
    </td>
  )
}

