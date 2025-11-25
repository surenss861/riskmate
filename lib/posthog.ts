'use client'

// PostHog tracking setup
export const initPostHog = () => {
  if (typeof window === 'undefined') return

  // Only initialize if PostHog is available
  if ((window as any).posthog) {
    return (window as any).posthog
  }

  // PostHog will be loaded via script tag in layout
  // This is just a helper to ensure it's available
  return null
}

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return

  if ((window as any).posthog) {
    (window as any).posthog.capture(eventName, properties)
  } else {
    // Fallback: log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[PostHog]', eventName, properties)
    }
  }
}

// Pre-defined event helpers
export const trackJobCreated = (plan: string, riskFlagsCount: number) => {
  trackEvent('job_created', { plan, risk_flags_count: riskFlagsCount })
}

export const trackRiskScored = (score: number, level: string) => {
  trackEvent('risk_scored', { score, level })
}

export const trackMitigationChecked = (itemId: string) => {
  trackEvent('mitigation_checked', { item_id: itemId })
}

export const trackReportGenerated = (ms: number, pages: number, plan: string) => {
  trackEvent('report_generated', { ms, pages, plan })
}

export const trackUpgradeBannerSeen = () => {
  trackEvent('upgrade_banner_seen')
}

export const trackUpgradeBannerClicked = () => {
  trackEvent('upgrade_banner_clicked')
}

export const trackCheckoutStarted = (plan: string) => {
  trackEvent('checkout_started', { plan })
}

export const trackCheckoutCompleted = (plan: string) => {
  trackEvent('checkout_completed', { plan })
}

export const trackStarterBlock11thJob = () => {
  trackEvent('starter_block_11th_job')
}

