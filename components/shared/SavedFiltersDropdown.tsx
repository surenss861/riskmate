'use client'

import React, { useState, useEffect, useRef } from 'react'
import { filtersApi } from '@/lib/api'
import type { FilterGroup } from '@/lib/jobs/filterConfig'

export interface SavedFilterItem {
  id: string
  name: string
  filter_config: Record<string, unknown>
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface SavedFiltersDropdownProps {
  /** Currently applied filter config (from URL/state) */
  currentFilterConfig: FilterGroup | null
  /** Currently applied saved filter id, if any */
  savedFilterId: string | null
  /** Callback when user applies a saved filter (id + config) */
  onApply: (savedFilterId: string | null, filterConfig: FilterGroup | null) => void
  /** Callback to get shareable URL for current state */
  getShareUrl?: () => string
  className?: string
}

export function SavedFiltersDropdown({
  currentFilterConfig,
  savedFilterId,
  onApply,
  getShareUrl,
  className = '',
}: SavedFiltersDropdownProps) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<SavedFilterItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    filtersApi
      .list()
      .then((res) => setFilters(res.data || []))
      .catch(() => setFilters([]))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const handleApply = (item: SavedFilterItem) => {
    const config = (item.filter_config as FilterGroup) ?? null
    onApply(item.id, config)
    setOpen(false)
  }

  const handleClear = () => {
    onApply(null, null)
    setOpen(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await filtersApi.delete(id)
      setFilters((prev) => prev.filter((f) => f.id !== id))
      if (savedFilterId === id) handleClear()
    } catch {
      // keep list as-is
    } finally {
      setDeletingId(null)
    }
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = getShareUrl?.() ?? (typeof window !== 'undefined' ? window.location.href : '')
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => setOpen(false))
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/20 text-sm"
      >
        <span>Saved filters</span>
        <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[220px] rounded-lg border border-white/10 bg-[#1A1A1A] shadow-xl z-50 py-1 max-h-[320px] overflow-y-auto">
          {(currentFilterConfig || savedFilterId) && (
            <>
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Clear saved filter
              </button>
              <div className="border-t border-white/10 my-1" />
            </>
          )}
          {getShareUrl && (
            <>
              <button
                type="button"
                onClick={handleShare}
                className="w-full text-left px-4 py-2 text-sm text-[#F97316] hover:bg-white/5 flex items-center gap-2"
              >
                Copy shareable link
              </button>
              <div className="border-t border-white/10 my-1" />
            </>
          )}
          {loading ? (
            <div className="px-4 py-6 text-center text-white/50 text-sm">Loading…</div>
          ) : filters.length === 0 ? (
            <div className="px-4 py-6 text-center text-white/50 text-sm">No saved filters</div>
          ) : (
            filters.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 px-4 py-2 group ${savedFilterId === item.id ? 'bg-[#F97316]/10' : 'hover:bg-white/5'}`}
              >
                <button
                  type="button"
                  onClick={() => handleApply(item)}
                  className="flex-1 text-left text-sm text-white truncate"
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, item.id)}
                  disabled={deletingId === item.id}
                  className="p-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Delete filter"
                >
                  {deletingId === item.id ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '×'
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
