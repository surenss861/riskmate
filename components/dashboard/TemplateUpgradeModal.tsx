'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { X, Check } from 'lucide-react'

interface TemplateUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentCount: number
  limit: number
}

export function TemplateUpgradeModal({ isOpen, onClose, currentCount, limit }: TemplateUpgradeModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleUpgrade = () => {
    router.push('/pricing?from=templates')
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121212] border border-white/10 rounded-xl p-8 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Template Limit Reached</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-white/70">
            Starter includes up to <strong className="text-white">{limit} reusable templates</strong>. You&apos;ve already created all {limit}.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Check size={18} className="text-[#F97316] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Unlimited Templates</p>
                <p className="text-xs text-white/50">Create as many templates as your team needs</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check size={18} className="text-[#F97316] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Advanced Features</p>
                <p className="text-xs text-white/50">Unlock all Riskmate features for your team</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check size={18} className="text-[#F97316] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Priority Support</p>
                <p className="text-xs text-white/50">Get help when you need it most</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-white hover:border-white/30 transition-colors"
          >
            Manage Existing
          </button>
          <button
            onClick={handleUpgrade}
            className="flex-1 px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

