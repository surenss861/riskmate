'use client'

import { X, CheckCircle2, XCircle, Copy, ExternalLink } from 'lucide-react'
import { buttonStyles } from '@/lib/styles/design-system'

interface Failure {
  id: string
  code: string
  message: string
}

interface BulkActionResultModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  succeededCount: number
  failedCount: number
  succeededIds?: string[]
  failures?: Failure[]
  requestId?: string
  onShowInTable?: (ids: string[]) => void
}

export function BulkActionResultModal({
  isOpen,
  onClose,
  title,
  succeededCount,
  failedCount,
  succeededIds = [],
  failures = [],
  requestId,
  onShowInTable,
}: BulkActionResultModalProps) {
  if (!isOpen) return null

  const copyRequestId = () => {
    if (requestId) {
      navigator.clipboard.writeText(requestId)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <CheckCircle2 size={20} />
                <span className="font-medium">Succeeded</span>
              </div>
              <div className="text-2xl font-bold text-white">{succeededCount}</div>
            </div>
            {failedCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <XCircle size={20} />
                  <span className="font-medium">Failed</span>
                </div>
                <div className="text-2xl font-bold text-white">{failedCount}</div>
              </div>
            )}
          </div>

          {/* Failures List */}
          {failures.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-3">Failed Items</h3>
              <div className="space-y-2">
                {failures.map((failure) => (
                  <div
                    key={failure.id}
                    className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-white font-mono text-sm mb-1">
                          {failure.id.slice(0, 8)}...
                        </div>
                        <div className="text-red-400 text-sm font-medium mb-1">
                          {failure.code}
                        </div>
                        <div className="text-white/70 text-sm">
                          {failure.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {onShowInTable && (
                <button
                  onClick={() => {
                    onShowInTable(failures.map(f => f.id))
                    onClose()
                  }}
                  className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} mt-3 flex items-center gap-2`}
                >
                  <ExternalLink size={14} />
                  Show Failed Items in Table
                </button>
              )}
            </div>
          )}

          {/* Request ID (dev mode) */}
          {requestId && process.env.NODE_ENV === 'development' && (
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Request ID (dev):</span>
                <div className="flex items-center gap-2">
                  <code className="text-white/80 text-xs font-mono bg-white/5 px-2 py-1 rounded">
                    {requestId}
                  </code>
                  <button
                    onClick={copyRequestId}
                    className="text-white/60 hover:text-white transition-colors"
                    title="Copy Request ID"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className={`${buttonStyles.primary} ${buttonStyles.sizes.md}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

