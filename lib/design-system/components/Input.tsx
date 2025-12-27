import React from 'react'
import { colors, spacing, radius, shadows } from '../tokens'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

/**
 * Shared Input Component
 * 
 * Used in both marketing forms and app UI
 */
export function Input({
  label,
  error,
  helperText,
  className,
  ...props
}: InputProps) {
  return (
    <div className="input-wrapper">
      {label && (
        <label
          className="block mb-2 text-sm font-medium"
          style={{ color: colors.black }}
        >
          {label}
        </label>
      )}
      <input
        className={cn('input', className)}
        style={{
          width: '100%',
          padding: spacing.md,
          borderRadius: radius.lg,
          border: `1px solid ${error ? colors.error : colors.borderLight}`,
          backgroundColor: colors.bgPrimary,
          color: colors.black,
          fontSize: '0.9375rem',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          ...(error && {
            boxShadow: `0 0 0 3px ${colors.error}20`,
          }),
        }}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm" style={{ color: colors.error }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm" style={{ color: colors.gray600 }}>
          {helperText}
        </p>
      )}
    </div>
  )
}

