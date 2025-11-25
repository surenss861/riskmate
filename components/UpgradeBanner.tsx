'use client'

import { trackUpgradeBannerSeen, trackUpgradeBannerClicked } from '@/lib/posthog'
import { useEffect } from 'react'
import StripeCheckout from './StripeCheckout'

interface UpgradeBannerProps {
  message?: string
  currentPlan?: 'starter' | 'pro' | 'business'
  upgradeTo?: 'pro' | 'business'
  onDismiss?: () => void
}

export default function UpgradeBanner({ 
  message = "You've reached your plan limit. Upgrade to Pro for unlimited jobs.",
  currentPlan = 'starter',
  upgradeTo = 'pro',
  onDismiss
}: UpgradeBannerProps) {
  useEffect(() => {
    trackUpgradeBannerSeen()
  }, [])

  const handleUpgrade = () => {
    trackUpgradeBannerClicked()
  }

  const upgradePrice = upgradeTo === 'pro' ? 59 : 129
  const upgradeName = upgradeTo === 'pro' ? 'Pro' : 'Business'

  return (
    <div className="p-6 bg-[#F97316]/10 border border-[#F97316]/50 rounded-xl mb-6 relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-[#A1A1A1] hover:text-white transition-colors"
        >
          ×
        </button>
      )}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-1 text-[#F97316]">Upgrade to {upgradeName}</h3>
          <p className="text-sm text-[#A1A1A1]">
            {message}
          </p>
        </div>
        <StripeCheckout
          plan={upgradeTo}
          price={upgradePrice}
          className="px-6 py-2 bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-colors font-semibold"
          onClick={handleUpgrade}
        >
          Upgrade to {upgradeName} →
        </StripeCheckout>
      </div>
    </div>
  )
}
