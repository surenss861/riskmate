'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalStyles, buttonStyles, spacing, shadows } from '@/lib/styles/design-system'

type ModalVariant = 'error' | 'success' | 'info' | 'warning'

interface ErrorModalProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
  onRetry?: () => void | Promise<void>
  retryLabel?: string
  showBackButton?: boolean
  onBack?: () => void
  backLabel?: string
  variant?: ModalVariant
}

export function ErrorModal({
  isOpen,
  title = 'Something went wrong',
  message,
  onClose,
  onRetry,
  retryLabel = 'Try Again',
  showBackButton = false,
  onBack,
  backLabel = 'Back to Jobs',
  variant = 'error',
}: ErrorModalProps) {
  const [retrying, setRetrying] = useState(false)
  
  // Variant styles
  const variantStyles = {
    error: {
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      iconPath: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    success: {
      border: 'border-green-500/30',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
      iconPath: 'M5 13l4 4L19 7',
    },
    info: {
      border: 'border-blue-500/30',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    warning: {
      border: 'border-yellow-500/30',
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
  }
  
  const styles = variantStyles[variant]
  const defaultTitle = variant === 'error' ? 'Something went wrong' : variant === 'success' ? 'Success' : variant === 'info' ? 'Information' : 'Warning'
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                  <svg
                    className={`w-8 h-8 ${styles.iconColor}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={styles.iconPath}
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h3 className={`${modalStyles.title} text-center ${spacing.normal}`}>
                {title || defaultTitle}
              </h3>

              {/* Message */}
              <p className={`text-white/70 text-center ${spacing.relaxed}`}>
                {message}
              </p>

              {/* Action Buttons */}
              <div className={`flex gap-3 ${spacing.normal}`}>
                {showBackButton && onBack && (
                  <button
                    onClick={onBack}
                    className={`flex-1 ${buttonStyles.secondary} ${buttonStyles.sizes.lg}`}
                  >
                    {backLabel}
                  </button>
                )}
                {onRetry && (
                  <button
                    onClick={async () => {
                      setRetrying(true)
                      try {
                        await onRetry()
                        onClose()
                      } catch (err) {
                        // Keep modal open if retry fails
                        console.error('Retry failed:', err)
                      } finally {
                        setRetrying(false)
                      }
                    }}
                    disabled={retrying}
                    className={`flex-1 ${buttonStyles.primary} ${buttonStyles.sizes.lg} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {retrying ? 'Retrying...' : retryLabel}
                  </button>
                )}
                {!onRetry && (
                  <button
                    onClick={onClose}
                    className={`w-full ${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
                  >
                    OK
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

