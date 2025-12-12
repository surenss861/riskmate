'use client'

import RiskMateLogo from '@/components/RiskMateLogo'

export function DemoNavbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <RiskMateLogo size="md" showText />
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg">
            DEMO MODE
          </span>
          <p className="text-xs text-white/50">
            Actions are simulated for demonstration purposes.
          </p>
        </div>
      </div>
    </header>
  )
}

