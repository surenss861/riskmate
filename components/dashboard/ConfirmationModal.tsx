'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { modalStyles, buttonStyles, spacing, shadows } from '@/lib/styles/design-system'

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  loading = false,
}: ConfirmationModalProps) {
  const variantStyles = {
    danger: {
      icon: 'text-red-400',
      iconBg: 'bg-red-500/20',
      button: 'bg-red-600 hover:bg-red-700',
      border: 'border-red-500/30',
    },
    warning: {
      icon: 'text-yellow-400',
      iconBg: 'bg-yellow-500/20',
      button: 'bg-yellow-600 hover:bg-yellow-700',
      border: 'border-yellow-500/30',
    },
    default: {
      icon: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      button: buttonStyles.primary,
      border: 'border-white/10',
    },
  }

  const styles = variantStyles[variant]

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
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`${modalStyles.container} ${styles.border} max-w-md w-full ${shadows.raised} pointer-events-auto`}
            >
              {/* Icon */}
              <div className={`flex justify-center ${spacing.relaxed}`}>
                <div className={`w-16 h-16 rounded-full ${styles.iconBg} flex items-center justify-center`}>
                  {variant === 'danger' && (
                    <svg
                      className={`w-8 h-8 ${styles.icon}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  )}
                  {variant === 'warning' && (
                    <svg
                      className={`w-8 h-8 ${styles.icon}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  )}
                  {      variant === 'default' && (
                    <svg
                      className={`w-8 h-8 ${styles.icon}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className={`${modalStyles.title} text-center ${spacing.normal}`}>
                {title}
              </h3>

              {/* Message */}
              <p className={`text-white/70 text-center ${spacing.relaxed}`}>
                {message}
              </p>

              {/* Action Buttons */}
              <div className={`flex gap-3 ${spacing.normal}`}>
                <button
                  onClick={onCancel}
                  disabled={loading}
                  className={`flex-1 ${buttonStyles.secondary} ${buttonStyles.sizes.lg} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={async () => {
                    await onConfirm()
                  }}
                  disabled={loading}
                  className={`flex-1 ${styles.button} ${buttonStyles.sizes.lg} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Processing...' : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

