'use client'

import { useDemo } from '@/lib/demo/useDemo'

export function DemoBanner() {
  const { isDemo } = useDemo()
  
  if (!isDemo) return null

  return (
    <div className="bg-gradient-to-r from-[#F97316] to-[#FB923C] text-black px-4 py-2 text-center text-sm font-semibold">
      <div className="flex items-center justify-center gap-2">
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
    </div>
  )
}

