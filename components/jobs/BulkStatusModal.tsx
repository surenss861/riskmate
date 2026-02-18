'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/** Canonical strings matching job filter options (active/on-hold map to DB in_progress/on_hold). */
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export type BulkStatusValue = (typeof STATUS_OPTIONS)[number]['value']

/** Map canonical UI status to DB status for API and local state. */
export function canonicalStatusToDb(canonical: BulkStatusValue): string {
  if (canonical === 'active') return 'in_progress'
  if (canonical === 'on-hold') return 'on_hold'
  return canonical
}

/** Map DB status to user-friendly display label. */
const DB_STATUS_TO_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
}
export function dbStatusToLabel(dbStatus: string): string {
  return DB_STATUS_TO_LABEL[dbStatus] ?? dbStatus
}

export interface BulkStatusModalProps {
  isOpen: boolean
  onClose: () => void
  selectedJobs: Array<{ id: string; client_name: string }>
  onConfirm: (status: string) => Promise<void>
  loading?: boolean
}

export function BulkStatusModal({
  isOpen,
  onClose,
  selectedJobs,
  onConfirm,
  loading = false,
}: BulkStatusModalProps) {
  const [status, setStatus] = useState<BulkStatusValue>('active')

  if (!isOpen) return null

  const handleConfirm = async () => {
    const allowedValues = STATUS_OPTIONS.map((o) => o.value)
    if (!allowedValues.includes(status)) return
    const dbStatus = canonicalStatusToDb(status)
    await onConfirm(dbStatus)
    // Parent closes modal only on full success; do not call onClose() here so failure paths leave modal open
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl max-w-md w-full p-6 pointer-events-auto"
        >
          <h2 className="text-lg font-semibold text-white mb-1">Change Status</h2>
          <p className="text-sm text-white/60 mb-4">
            Update the status for {selectedJobs.length} selected job{selectedJobs.length !== 1 ? 's' : ''}.
          </p>

          <div className="bg-white/5 rounded-lg p-3 mb-4 max-h-36 overflow-y-auto">
            {selectedJobs.slice(0, 10).map((job) => (
              <div key={job.id} className="text-sm text-white/80 py-0.5">
                • {job.client_name}
              </div>
            ))}
            {selectedJobs.length > 10 && (
              <div className="text-xs text-white/50 pt-1">
                +{selectedJobs.length - 10} more
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-white/80 mb-2">New Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BulkStatusValue)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]/50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: '#007aff' }}
            >
              {loading ? 'Updating…' : `Update ${selectedJobs.length} Job${selectedJobs.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
