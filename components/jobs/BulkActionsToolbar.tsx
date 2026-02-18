'use client'

import React, { useState, useRef, useEffect } from 'react'

export type ExportFormat = 'csv' | 'pdf'

export interface BulkActionsToolbarProps {
  selectedCount: number
  onStatusChange: () => void
  onAssign: () => void
  onExport: (formats: ExportFormat[]) => void
  onDelete: () => void
  onClearSelection: () => void
  /** Optional: disable actions when bulk APIs are not ready (e.g. export) */
  disableExport?: boolean
  /** Permission flags: hide or disable bulk actions when user lacks permission */
  canChangeStatus?: boolean
  canAssign?: boolean
  canExport?: boolean
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
  canExport = true,
  canDelete = true,
  selectionOverCap = false,
  bulkCap = 100,
}: BulkActionsToolbarProps) {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false)
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [exportDropdownOpen])

  if (selectedCount === 0) return null

  const disabled = selectionOverCap

  const handleExportChoice = (formats: ExportFormat[]) => {
    setExportDropdownOpen(false)
    onExport(formats)
  }

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
          {canExport && (
          <div className="relative" ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen((o) => !o)}
              disabled={disableExport || disabled}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span aria-hidden>📥</span>
              Export
              <span className="text-xs opacity-80">▼</span>
            </button>
            {exportDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-40 min-w-[160px] py-1 rounded-lg shadow-lg bg-[#1A1A1A] border border-white/10">
                <button
                  type="button"
                  onClick={() => handleExportChoice(['csv'])}
                  className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
                >
                  Export as CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportChoice(['pdf'])}
                  className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
                >
                  Export as PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExportChoice(['csv', 'pdf'])}
                  className="w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 transition-colors border-t border-white/5"
                >
                  Export as CSV & PDF
                </button>
              </div>
            )}
          </div>
          )}
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
