'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { modalStyles, buttonStyles, spacing, shadows } from '@/lib/styles/design-system'

interface ErrorModalProps {
  isOpen: boolean
  title?: string
  message: string
  onClose: () => void
}

export function ErrorModal({
  isOpen,
  title = 'Error',
  message,
  onClose,
}: ErrorModalProps) {
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
            className={modalStyles.backdrop}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`${modalStyles.container} border-red-500/30 max-w-md w-full ${shadows.raised} pointer-events-auto`}
            >
              {/* Error Icon */}
              <div className={`flex justify-center ${spacing.relaxed}`}>
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
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

              {/* Close Button */}
              <button
                onClick={onClose}
                className={`w-full ${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
              >
                OK
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

