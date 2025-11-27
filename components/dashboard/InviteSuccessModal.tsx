'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface InviteSuccessModalProps {
  isOpen: boolean
  email: string
  temporaryPassword: string
  onClose: () => void
}

export function InviteSuccessModal({
  isOpen,
  email,
  temporaryPassword,
  onClose,
}: InviteSuccessModalProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(temporaryPassword)
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
              className="bg-[#121212] border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl pointer-events-auto"
            >
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-white text-center mb-2">
                Invite Sent!
              </h3>

              {/* Message */}
              <p className="text-white/70 text-center mb-6">
                Share the temporary password with <span className="font-semibold text-white">{email}</span>. They&apos;ll need to reset it on first login.
              </p>

              {/* Password Display */}
              <div className="bg-black/40 border border-white/10 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/60 mb-1">Temporary Password</div>
                    <div className="font-mono text-lg text-white break-all">
                      {temporaryPassword}
                    </div>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex-shrink-0 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm font-medium transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

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

