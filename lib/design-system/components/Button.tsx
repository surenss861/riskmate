import React from 'react'
import { colors, spacing, radius, shadows, transitions } from '../tokens'
import { cn } from '@/lib/utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

/**
 * Shared Button Component
 * 
 * Supports both marketing (larger, more expressive) and app (compact) variants
 * via size prop and context.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    borderRadius: radius.lg,
    fontWeight: 600,
    transition: transitions.base,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  }

  const sizeStyles = {
    sm: {
      padding: `${spacing.sm} ${spacing.md}`,
      fontSize: '0.875rem',
    },
    md: {
      padding: `${spacing.md} ${spacing.lg}`,
      fontSize: '1rem',
    },
    lg: {
      padding: `${spacing.lg} ${spacing.xl}`,
      fontSize: '1.125rem',
    },
  }

  const variantStyles = {
    primary: {
      backgroundColor: colors.cordovan,
      color: colors.white,
      border: 'none',
      boxShadow: `0 4px 14px 0 ${colors.cordovan}40`,
    },
    secondary: {
      backgroundColor: colors.gray100,
      color: colors.black,
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: colors.cordovan,
      border: `2px solid ${colors.cordovan}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.gray600,
      border: 'none',
    },
  }

  return (
    <button
      className={cn('button', className)}
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          style={{ marginRight: spacing.xs }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            strokeOpacity="0.25"
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

