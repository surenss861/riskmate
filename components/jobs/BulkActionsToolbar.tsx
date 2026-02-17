'use client'

import React from 'react'

export interface BulkActionsToolbarProps {
  selectedCount: number
  onStatusChange: () => void
  onAssign: () => void
  onExport: () => void
  onDelete: () => void
  onClearSelection: () => void
  /** Optional: disable actions when bulk APIs are not ready (e.g. export) */
  disableExport?: boolean
}

export function BulkActionsToolbar({
  selectedCount,
  onStatusChange,
  onAssign,
  onExport,
  onDelete,
  onClearSelection,
  disableExport = false,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 rounded-lg shadow-lg text-white"
      style={{ background: '#007aff' }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-semibold text-base whitespace-nowrap">
          {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onStatusChange}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors"
          >
            <span aria-hidden>📋</span>
            Change Status
          </button>
          <button
            type="button"
            onClick={onAssign}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors"
          >
            <span aria-hidden>👤</span>
            Assign
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={disableExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span aria-hidden>📥</span>
            Export
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-red-500/30 hover:bg-red-500/40 transition-colors"
          >
            <span aria-hidden>🗑️</span>
            Delete
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onClearSelection}
        className="p-2 rounded-md text-white hover:bg-white/20 transition-colors"
        title="Clear selection"
        aria-label="Clear selection"
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
  )
}
