'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface BulkDeleteConfirmationProps {
  isOpen: boolean
  onClose: () => void
  selectedJobs: Array<{ id: string; client_name: string }>
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function BulkDeleteConfirmation({
  isOpen,
  onClose,
  selectedJobs,
  onConfirm,
  loading = false,
}: BulkDeleteConfirmationProps) {
  if (!isOpen) return null

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
          className="bg-[#1A1A1A] border border-red-500/30 rounded-xl shadow-xl max-w-md w-full p-6 pointer-events-auto"
        >
          <h2 className="text-lg font-semibold text-white mb-1">Delete Jobs</h2>
          <p className="text-sm text-white/60 mb-2">
            You are about to permanently delete {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}. This action cannot be undone.
          </p>
          <p className="text-xs text-red-400/80 mb-4">
            Only draft jobs without audit data can be deleted. Others may be archived instead.
          </p>

          <div className="bg-white/5 rounded-lg p-3 mb-6 max-h-36 overflow-y-auto">
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
              onClick={async () => {
                await onConfirm()
                // Parent closes modal only on full success; do not call onClose() here so failure paths leave modal open
              }}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
