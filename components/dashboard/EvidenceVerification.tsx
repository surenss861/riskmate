'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface EvidenceItem {
  id: string
  type: 'photo' | 'document' | 'mitigation'
  name: string
  url?: string
  status: 'pending' | 'approved' | 'rejected'
  submittedBy: string
  submittedAt: string
  verifiedBy?: string
  verifiedAt?: string
  rejectionReason?: string
}

interface EvidenceVerificationProps {
  jobId: string
  items: EvidenceItem[]
  onVerify: (id: string, status: 'approved' | 'rejected', reason?: string) => Promise<void>
  userRole: 'owner' | 'admin' | 'member'
}

export function EvidenceVerification({
  jobId,
  items,
  onVerify,
  userRole,
}: EvidenceVerificationProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const canVerify = userRole === 'owner' || userRole === 'admin'

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true
    return item.status === filter
  })

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    setRejectingId(id)
    try {
      await onVerify(id, 'rejected', rejectionReason)
      setRejectionReason('')
    } finally {
      setRejectingId(null)
    }
  }

  if (!canVerify) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
        <p className="text-sm text-white/50">
          Only owners and admins can verify evidence.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Evidence Verification</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Review and approve or reject photos, documents, and mitigation items.
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[#F97316] text-black font-semibold'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <p className="text-sm">No {filter === 'all' ? '' : filter} evidence items</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border border-white/10 bg-white/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded border bg-white/5 text-white/70">
                      {item.type}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        item.status === 'approved'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : item.status === 'rejected'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{item.name}</h4>
                  <p className="text-xs text-white/50">
                    Submitted by {item.submittedBy} on{' '}
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </p>
                  {item.verifiedBy && (
                    <p className="text-xs text-white/50 mt-1">
                      Verified by {item.verifiedBy} on{' '}
                      {new Date(item.verifiedAt!).toLocaleDateString()}
                    </p>
                  )}
                  {item.rejectionReason && (
                    <p className="text-xs text-red-400 mt-1">
                      Reason: {item.rejectionReason}
                    </p>
                  )}
                </div>
                {item.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onVerify(item.id, 'approved')}
                      className="px-3 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Rejection reason:')
                        if (reason) {
                          handleReject(item.id)
                        }
                      }}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

