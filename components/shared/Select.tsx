'use client'

import { SelectHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

/**
 * Select - Standardized select component
 * 
 * Rules:
 * - Height locked: 44px (h-11)
 * - Secondary surface: bg-white/5 border-white/10
 * - Focus ring: ring-1 ring-white/20 border-white/20
 * - Chevron icon: Consistent size/opacity (via native select styling)
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    const baseStyles = clsx(
      'h-11', // 44px - locked height
      'px-3 py-2.5',
      'bg-white/5', // Secondary surface
      'border border-white/10',
      'backdrop-blur-sm',
      'rounded-lg',
      'text-sm text-white/80',
      'transition-all duration-200',
      'focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      // Native select arrow styling (browser default is fine, just ensure contrast)
      'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'rgba(255,255,255,0.4)\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")] bg-no-repeat bg-right pr-8 bg-[length:16px_16px]',
      className
    )

    return <select ref={ref} className={baseStyles} {...props} />
  }
)

Select.displayName = 'Select'

