import React from 'react'
import { colors, radius, spacing } from '../tokens'
import { cn } from '@/lib/utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

export function Badge({
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: {
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: '0.75rem',
    },
    md: {
      padding: `${spacing.sm} ${spacing.md}`,
      fontSize: '0.875rem',
    },
  }

  const variantStyles = {
    default: {
      backgroundColor: colors.gray100,
      color: colors.gray700,
    },
    success: {
      backgroundColor: colors.success + '20',
      color: colors.success,
    },
    warning: {
      backgroundColor: colors.warning + '20',
      color: colors.warning,
    },
    error: {
      backgroundColor: colors.error + '20',
      color: colors.error,
    },
    info: {
      backgroundColor: colors.cordovan + '20',
      color: colors.cordovan,
    },
  }

  return (
    <span
      className={cn('badge', className)}
      style={{
        borderRadius: radius.full,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      {...props}
    >
      {children}
    </span>
  )
}

