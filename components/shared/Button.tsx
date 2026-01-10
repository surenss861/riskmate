'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

/**
 * Button - Standardized button component matching landing page style
 * 
 * Variants:
 * - primary: Orange accent (use sparingly - CTAs only)
 * - secondary: Glass button (like landing "Try Demo")
 * - ghost: Text-only
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantStyles = {
    primary: 'bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg shadow-[0_4px_16px_rgba(249,115,22,0.3)] hover:shadow-[0_6px_24px_rgba(249,115,22,0.4)]',
    secondary: 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-lg backdrop-blur-sm',
    ghost: 'text-white/70 hover:text-white bg-transparent',
  }
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  }

  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

