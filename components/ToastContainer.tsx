'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, Info, AlertTriangle, Copy } from 'lucide-react'
import { subscribeToToasts, Toast, toast } from '@/lib/utils/toast'

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsubscribe = subscribeToToasts(setToasts)
    return unsubscribe
  }, [])

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getToastStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/20 border-green-500/50'
      case 'error':
        return 'bg-red-500/20 border-red-500/50'
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50'
      default:
        return 'bg-blue-500/20 border-blue-500/50'
    }
  }

  const copyRequestId = (requestId: string) => {
    navigator.clipboard.writeText(requestId)
    toast.info('Request ID copied to clipboard')
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto border rounded-lg p-4 shadow-xl max-w-md backdrop-blur-sm ${getToastStyles(t.type)} animate-in slide-in-from-top-5 duration-300`}
        >
          <div className="flex items-start gap-3">
            {getToastIcon(t.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{t.message}</p>
              {t.requestId && process.env.NODE_ENV === 'development' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-white/50 font-mono">ID: {t.requestId.slice(0, 8)}...</span>
                  <button
                    onClick={() => copyRequestId(t.requestId!)}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                    title="Copy Request ID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => toast.remove(t.id)}
              className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

