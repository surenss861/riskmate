'use client'

import { useDemo } from '@/lib/demo/useDemo'
import { Link2, RotateCcw } from 'lucide-react'

export function DemoBanner() {
  const { isDemo, resetDemo, copyDemoLink } = useDemo()
  
  if (!isDemo) return null

  return (
    <div className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-black px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <span>Demo Mode — All actions are simulated. No data is saved.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyDemoLink}
            className="px-3 py-1 bg-black/20 hover:bg-black/30 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Link2 className="w-3 h-3" />
            Copy Link
          </button>
          <button
            onClick={() => {
              if (window.confirm('Reset demo to baseline fixtures? All local changes will be lost.')) {
                resetDemo()
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    const toast = document.createElement('div')
                    toast.className = 'fixed bottom-4 right-4 z-50 max-w-md rounded-lg bg-green-500 px-4 py-3 text-sm text-white shadow-lg'
                    toast.textContent = 'Demo restored to baseline (v1.0 fixtures)'
                    document.body.appendChild(toast)
                    setTimeout(() => toast.remove(), 3000)
                  }
                }, 100)
              }
            }}
            className="px-3 py-1 bg-black/20 hover:bg-black/30 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Reset demo to baseline fixtures"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

