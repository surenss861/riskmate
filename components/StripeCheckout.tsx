'use client'

import { useState } from 'react'
import { trackCheckoutStarted } from '@/lib/posthog'

interface StripeCheckoutProps {
  plan: 'starter' | 'pro' | 'business'
  price: number
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function StripeCheckout({ plan, price, children, className = '', onClick }: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    trackCheckoutStarted(plan)
    onClick?.()

    try {
      // Create Stripe Checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          price,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start checkout')
      }

      const { url } = data || {}

      if (url) {
        window.location.href = url
      } else {
        throw new Error('Checkout session not initialized')
      }
    } catch (error: any) {
      console.error('Checkout error:', error)
      alert(error?.message || 'Unable to start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={className}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}

