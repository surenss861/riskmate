'use client'

import { ReactNode } from 'react'
import clsx from 'clsx'

type FilterBarProps = {
  children: ReactNode
  className?: string
}

/**
 * FilterBar - Container for filters (time range, search, sort, pills)
 * Consistent styling across all pages
 */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-4 mb-6', className)}>
      {children}
    </div>
  )
}

type SegmentedControlProps = {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div className="inline-flex bg-white/5 border border-white/10 rounded-lg p-1 backdrop-blur-sm">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-md transition-all',
            value === option.value
              ? 'bg-[#F97316] text-black shadow-sm'
              : 'text-white/70 hover:text-white hover:bg-white/5'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className }: SearchInputProps) {
  return (
    <div className={clsx('relative', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 pl-10 text-sm text-white/90 placeholder-white/40 transition focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 w-64"
      />
      <svg
        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  )
}

type FilterPillProps = {
  label: string
  onRemove?: () => void
  className?: string
}

export function FilterPill({ label, onRemove, className }: FilterPillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/80',
        className
      )}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          ×
        </button>
      )}
    </span>
  )
}

