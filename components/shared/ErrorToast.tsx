'use client'

import { useState } from 'react'
import { XCircle, X, Copy, CheckCircle2 } from 'lucide-react'
import { formatProxyErrorTitle } from '@/lib/utils/extractProxyError'

interface ErrorToastProps {
  message: string
  description?: string
  errorId?: string
  code?: string
  hint?: string
  onClose: () => void
  onRetry?: () => void
  className?: string
}

export function ErrorToast({
  message,
  description,
  errorId,
  code,
  hint,
  onClose,
  onRetry,
  className = '',
}: ErrorToastProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyErrorId = async () => {
    if (!errorId) return
    try {
      await navigator.clipboard.writeText(errorId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy error ID:', err)
    }
  }

  // Format title if we have code and errorId
  const title = errorId && code ? formatProxyErrorTitle(code, errorId, message) : message

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-4 rounded-lg border bg-red-500/20 border-red-500/40 text-red-400 max-w-md shadow-xl ${className}`}
    >
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="text-xs opacity-80">{description}</p>
          )}
          {hint && (
            <p className="text-xs opacity-70 italic">{hint}</p>
          )}
          {errorId && (
            <div className="flex items-center gap-2 pt-2 border-t border-red-500/20">
              <span className="text-xs text-white/60 font-mono flex-1 min-w-0 truncate">
                Error ID: {errorId}
              </span>
              <button
                onClick={handleCopyErrorId}
                className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors underline flex-shrink-0"
                title="Copy Error ID"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          )}
          {onRetry && (
            <div className="pt-2">
              <button
                onClick={onRetry}
                className="text-xs text-white/70 hover:text-white transition-colors underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

