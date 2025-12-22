'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: 'default' | 'search'
}

/**
 * Input - Standardized input component
 * 
 * Rules:
 * - Height locked: 44-48px (h-11 to h-12)
 * - Secondary surface: bg-white/5 border-white/10
 * - Focus ring: ring-1 ring-white/20 border-white/20
 * - Placeholder: text-white/40
 * - Icons: w-4 h-4 text-white/40 (if search variant)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseStyles = clsx(
      'h-11', // 44px - locked height
      'px-4 py-2.5',
      'bg-white/5', // Secondary surface
      'border border-white/10',
      'backdrop-blur-sm',
      'rounded-lg',
      'text-sm text-white/90',
      'placeholder:text-white/40',
      'transition-all duration-200',
      'focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variant === 'search' && 'pl-10', // Space for search icon
      className
    )

    return <input ref={ref} className={baseStyles} {...props} />
  }
)

Input.displayName = 'Input'

