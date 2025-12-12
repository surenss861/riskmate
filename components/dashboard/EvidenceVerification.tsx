'use client'

import { useState } from 'react'
import * as React from 'react'
import { motion } from 'framer-motion'
import { modalStyles, buttonStyles, spacing, shadows, inputStyles } from '@/lib/styles/design-system'
import { ConfirmModal } from './ConfirmModal'

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
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)
  const [optimisticItems, setOptimisticItems] = useState<EvidenceItem[]>(items)
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set())
  const [rejectConfirm, setRejectConfirm] = useState<{ id: string; name: string; reason: string } | null>(null)

  // Sync optimistic items with prop changes
  React.useEffect(() => {
    setOptimisticItems(items)
  }, [items])

  const canVerify = userRole === 'owner' || userRole === 'admin'

  const filteredItems = optimisticItems.filter((item) => {
    if (filter === 'all') return true
    return item.status === filter
  })

  const handleApprove = async (id: string) => {
    // Prevent double-click spam
    if (pendingItemIds.has(id)) return

    const item = optimisticItems.find((i) => i.id === id)
    if (!item) return

    // Optimistic update - approve immediately
    setPendingItemIds((prev) => new Set(prev).add(id))
    setVerifyingId(id)
    const previousItems = [...optimisticItems]
    setOptimisticItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: 'approved' as const, verifiedBy: 'You', verifiedAt: new Date().toISOString() }
          : i
      )
    )

    try {
      await onVerify(id, 'approved')
    } catch (err) {
      // Rollback on error
      setOptimisticItems(previousItems)
      console.error('Failed to approve evidence:', err)
    } finally {
      setVerifyingId(null)
      setPendingItemIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      return // Modal will handle validation
    }
    const item = optimisticItems.find((i) => i.id === showRejectModal)
    if (!item) return
    setRejectConfirm({ id: item.id, name: item.name, reason: rejectionReason.trim() })
    setShowRejectModal(null)
  }

  const confirmReject = async () => {
    if (!rejectConfirm) return
    const { id, reason } = rejectConfirm
    
    // Prevent double-click spam
    if (pendingItemIds.has(id)) return

    // Optimistic update - reject immediately
    setPendingItemIds((prev) => new Set(prev).add(id))
    setRejectingId(id)
    const previousItems = [...optimisticItems]
    setOptimisticItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: 'rejected' as const, verifiedBy: 'You', verifiedAt: new Date().toISOString(), rejectionReason: reason }
          : i
      )
    )
    setRejectionReason('')
    setRejectConfirm(null)

    try {
      await onVerify(id, 'rejected', reason)
    } catch (err) {
      // Rollback on error
      setOptimisticItems(previousItems)
      setShowRejectModal(id) // Reopen modal on error
      setRejectionReason(reason) // Restore reason
      setRejectConfirm(null)
      console.error('Failed to reject evidence:', err)
      throw err
    } finally {
      setRejectingId(null)
      setPendingItemIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (!canVerify) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
        <p className="text-sm text-white/50">
          Only owners and admins can verify evidence.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
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
            <div className="text-center py-8 border border-white/10 rounded-lg bg-[#121212]/40">
              <p className="text-sm text-white font-medium mb-2">
                {filter === 'all' ? 'No evidence uploaded yet' : `No ${filter} evidence`}
              </p>
              <p className="text-xs text-white/60 max-w-md mx-auto">
                {filter === 'all' 
                  ? 'Upload photos and documents to document site conditions. All evidence is timestamped and can be verified by managers for compliance.'
                  : filter === 'pending'
                  ? 'No evidence waiting for review. Approved or rejected items are shown in their respective tabs.'
                  : `No ${filter} evidence items. Upload evidence to start the verification process.`}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg border border-white/10 bg-[#121212]/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-lg border border-white/10 bg-[#121212] text-white/70">
                        {item.type}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-lg border ${
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
                        onClick={() => handleApprove(item.id)}
                        disabled={verifyingId === item.id || pendingItemIds.has(item.id)}
                        className="px-3 py-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {verifyingId === item.id ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setShowRejectModal(item.id)}
                        disabled={verifyingId === item.id || pendingItemIds.has(item.id)}
                        className="px-3 py-1 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className={modalStyles.backdrop}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md ${modalStyles.container} ${shadows.raised}`}
          >
            <h3 className={`${modalStyles.title} ${spacing.tight}`}>Reject Evidence</h3>
            <p className={`text-sm text-white/60 ${spacing.normal}`}>
              Why are you rejecting this evidence? (Optional but recommended)
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Photo quality too low, missing required documentation..."
              className={inputStyles.textarea}
              rows={3}
              autoFocus
            />
            <div className={`flex ${spacing.gap.normal} ${spacing.normal}`}>
              <button
                onClick={() => {
                  setShowRejectModal(null)
                  setRejectionReason('')
                }}
                className={`flex-1 ${buttonStyles.secondary}`}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={rejectConfirm !== null}
        title="Reject Evidence"
        message={`Reject "${rejectConfirm?.name}"? This will mark it as rejected and require a reason for compliance.`}
        consequence={rejectConfirm?.reason ? `Reason: ${rejectConfirm.reason}` : undefined}
        confirmLabel="Reject Evidence"
        onConfirm={confirmReject}
        onCancel={() => {
          if (rejectConfirm) {
            setShowRejectModal(rejectConfirm.id)
            setRejectionReason(rejectConfirm.reason)
          }
          setRejectConfirm(null)
        }}
        destructive={true}
      />
    </>
  )
}
