'use client'

import { motion, AnimatePresence } from 'framer-motion'

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121212] border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl pointer-events-auto"
            >
              {/* Error Icon */}
              <div className="flex justify-center mb-6">
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
              <h3 className="text-2xl font-bold text-white text-center mb-4">
                {title}
              </h3>

              {/* Message */}
              <p className="text-white/70 text-center mb-6">
                {message}
              </p>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C] transition-colors"
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

