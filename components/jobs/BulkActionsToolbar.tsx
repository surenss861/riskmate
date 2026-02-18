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
  /** Permission flags: hide or disable bulk actions when user lacks permission */
  canChangeStatus?: boolean
  canAssign?: boolean
  canDelete?: boolean
  /** When true, selection exceeds batch cap; disable bulk actions and show message */
  selectionOverCap?: boolean
  /** Maximum allowed selection for bulk operations (e.g. 100) */
  bulkCap?: number
}

export function BulkActionsToolbar({
  selectedCount,
  onStatusChange,
  onAssign,
  onExport,
  onDelete,
  onClearSelection,
  disableExport = false,
  canChangeStatus = true,
  canAssign = true,
  canDelete = true,
  selectionOverCap = false,
  bulkCap = 100,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null

  const disabled = selectionOverCap

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 rounded-lg shadow-lg text-white"
      style={{ background: '#007aff' }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-semibold text-base whitespace-nowrap">
          {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
        </span>
        {selectionOverCap && (
          <span className="text-sm text-white/90">
            Maximum {bulkCap} jobs per bulk action. Clear some selections or run actions in smaller batches.
          </span>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {canChangeStatus && (
            <button
              type="button"
              onClick={onStatusChange}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span aria-hidden>📋</span>
              Change Status
            </button>
          )}
          {canAssign && (
            <button
              type="button"
              onClick={onAssign}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span aria-hidden>👤</span>
              Assign
            </button>
          )}
          <button
            type="button"
            onClick={onExport}
            disabled={disableExport || disabled}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span aria-hidden>📥</span>
            Export
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-red-500/30 hover:bg-red-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span aria-hidden>🗑️</span>
              Delete
            </button>
          )}
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
