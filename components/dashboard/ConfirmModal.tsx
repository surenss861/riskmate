'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalStyles, buttonStyles, spacing, shadows } from '@/lib/styles/design-system'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  consequence?: string // Optional callout for what will happen
  confirmLabel: string // Explicit action label (e.g., "Archive Template", not "Confirm")
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  destructive?: boolean // If true, confirm button is red outline
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmModalProps) {
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm()
      onCancel() // Close modal after successful confirm
    } catch (err) {
      console.error('Confirm action failed:', err)
      // Keep modal open on error
    } finally {
      setConfirming(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className={`${modalStyles.backdrop} z-[60]`}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`${modalStyles.container} max-w-md w-full ${shadows.raised} pointer-events-auto`}
            >
              {/* Title */}
              <h3 className={`${modalStyles.title} ${spacing.normal}`}>
                {title}
              </h3>

              {/* Message */}
              <p className={`text-white/70 ${spacing.normal}`}>
                {message}
              </p>

              {/* Consequence Callout (if provided) */}
              {consequence && (
                <div className={`bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 ${spacing.normal}`}>
                  <p className="text-sm text-yellow-400">
                    {consequence}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className={`flex gap-3 ${spacing.normal}`}>
                <button
                  onClick={onCancel}
                  disabled={confirming}
                  className={`flex-1 ${buttonStyles.secondary} ${buttonStyles.sizes.lg} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    destructive
                      ? 'border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500/70'
                      : buttonStyles.primary
                  } ${buttonStyles.sizes.lg}`}
                >
                  {confirming ? 'Processing...' : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
