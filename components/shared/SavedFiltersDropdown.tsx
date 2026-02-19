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
  /** Called after a filter is created or updated so parent can refresh (e.g. jobs list) */
  onFilterSaved?: () => void
  className?: string
}

export function SavedFiltersDropdown({
  currentFilterConfig,
  savedFilterId,
  onApply,
  getShareUrl,
  onFilterSaved,
  className = '',
}: SavedFiltersDropdownProps) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<SavedFilterItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createShared, setCreateShared] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [togglingShareId, setTogglingShareId] = useState<string | null>(null)
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

  const handleCreateFilter = async () => {
    if (!createName.trim() || createSubmitting) return
    const config = currentFilterConfig ?? { operator: 'AND', conditions: [] }
    setCreateSubmitting(true)
    try {
      const { data } = await filtersApi.create({
        name: createName.trim(),
        filter_config: config as Record<string, unknown>,
        is_shared: createShared,
      })
      setCreateModalOpen(false)
      setCreateName('')
      setCreateShared(false)
      setFilters((prev) => [...prev, { ...data, created_at: '', updated_at: '' }])
      onApply(data.id, data.filter_config as FilterGroup)
      onFilterSaved?.()
    } catch {
      // keep modal open
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleToggleShare = async (e: React.MouseEvent, item: SavedFilterItem) => {
    e.stopPropagation()
    setTogglingShareId(item.id)
    try {
      await filtersApi.update(item.id, { is_shared: !item.is_shared })
      setFilters((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, is_shared: !f.is_shared } : f))
      )
      onFilterSaved?.()
    } catch {
      // keep state as-is
    } finally {
      setTogglingShareId(null)
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
          {currentFilterConfig != null && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(true)
                  setCreateName('')
                  setCreateShared(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#F97316] hover:bg-white/5 flex items-center gap-2"
              >
                Save current filter
              </button>
              <div className="border-t border-white/10 my-1" />
            </>
          )}
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
                  className="flex-1 min-w-0 text-left text-sm text-white truncate"
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleToggleShare(e, item)}
                  disabled={togglingShareId === item.id}
                  className="p-1 text-white/40 hover:text-[#F97316] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 shrink-0"
                  title={item.is_shared ? 'Shared with team (click to unshare)' : 'Share with team'}
                >
                  {togglingShareId === item.id ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, item.id)}
                  disabled={deletingId === item.id}
                  className="p-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 shrink-0"
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

      {createModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !createSubmitting && setCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1A1A1A] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-sm font-medium text-white">Save current filter</div>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Filter name"
              className="mb-3 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#F97316]/50 outline-none"
              autoFocus
            />
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={createShared}
                onChange={(e) => setCreateShared(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#F97316] focus:ring-[#F97316]/50"
              />
              Share with team
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                disabled={createSubmitting}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!createName.trim() || createSubmitting}
                onClick={handleCreateFilter}
                className="rounded-lg bg-[#F97316] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#F97316]/90 disabled:opacity-50"
              >
                {createSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
