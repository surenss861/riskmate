'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { teamApi } from '@/lib/api'

export interface BulkAssignModalProps {
  isOpen: boolean
  onClose: () => void
  selectedJobs: Array<{ id: string; client_name: string }>
  onConfirm: (workerId: string) => Promise<void>
  loading?: boolean
}

export function BulkAssignModal({
  isOpen,
  onClose,
  selectedJobs,
  onConfirm,
  loading = false,
}: BulkAssignModalProps) {
  const [workerId, setWorkerId] = useState<string>('')
  const [members, setMembers] = useState<Array<{ id: string; full_name: string | null; email: string }>>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true)
      teamApi
        .get()
        .then((res) => {
          setMembers(res.members ?? [])
          if (res.members?.length && !workerId) {
            setWorkerId(res.members[0].id)
          }
        })
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false))
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!workerId) return
    await onConfirm(workerId)
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
          <h2 className="text-lg font-semibold text-white mb-1">Assign Jobs</h2>
          <p className="text-sm text-white/60 mb-4">
            Assign {selectedJobs.length} selected job{selectedJobs.length !== 1 ? 's' : ''} to a team member.
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
            <label className="block text-sm font-medium text-white/80 mb-2">Team member</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={loadingMembers}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#007aff]/50 disabled:opacity-50"
            >
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
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
              disabled={loading || loadingMembers || !workerId}
              className="flex-1 py-2.5 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: '#007aff' }}
            >
              {loading ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
