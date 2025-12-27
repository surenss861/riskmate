import React from 'react'
import { colors, spacing, radius, shadows } from '../tokens'
import { cn } from '@/lib/utils/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated'
  padding?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

/**
 * Shared Card Component
 * 
 * Marketing: Uses glass variant for premium feel
 * App: Uses default variant for clean, enterprise look
 */
export function Card({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  const paddingStyles = {
    sm: spacing.md,
    md: spacing.lg,
    lg: spacing.xl,
  }

  const variantStyles = {
    default: {
      backgroundColor: colors.bgPrimary,
      border: `1px solid ${colors.borderLight}`,
      boxShadow: shadows.sm,
    },
    glass: {
      backgroundColor: colors.glassWhite,
      backdropFilter: 'blur(20px)',
      border: `1px solid ${colors.borderLight}40`,
      boxShadow: shadows.glass,
    },
    elevated: {
      backgroundColor: colors.bgPrimary,
      border: `1px solid ${colors.borderLight}`,
      boxShadow: shadows.lg,
    },
  }

  return (
    <div
      className={cn('card', className)}
      style={{
        borderRadius: radius.xl,
        padding: paddingStyles[padding],
        ...variantStyles[variant],
      }}
      {...props}
    >
      {children}
    </div>
  )
}

