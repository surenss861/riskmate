'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RiskMateLogo from '@/components/RiskMateLogo'
import { buttonStyles } from '@/lib/styles/design-system'

interface DemoNavbarProps {
  onRestart?: () => void
}

export function DemoNavbar({ onRestart }: DemoNavbarProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const handleRestart = () => {
    if (onRestart) {
      onRestart()
    } else {
      router.push('/demo')
    }
  }

  const handleCopyLink = async () => {
    if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <RiskMateLogo size="md" showText />
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg">
            DEMO MODE
          </span>
          <p className="text-xs text-white/50 hidden sm:block">
            Actions are simulated for demonstration purposes.
          </p>
          <button
            onClick={handleCopyLink}
            className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} text-xs`}
            title="Copy demo link"
          >
            {copied ? 'Link copied' : 'Copy Demo Link'}
          </button>
          <button
            onClick={handleRestart}
            className={`${buttonStyles.secondary} ${buttonStyles.sizes.sm} text-xs`}
          >
            Restart Demo
          </button>
        </div>
      </div>
    </header>
  )
}

