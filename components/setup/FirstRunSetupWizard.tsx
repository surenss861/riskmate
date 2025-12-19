'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Building2, MapPin, User, CheckCircle2, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cardStyles, buttonStyles, typography } from '@/lib/styles/design-system'

export type IndustryType = 
  | 'residential_trades'
  | 'commercial_contractors'
  | 'facilities_services'
  | 'fire_life_safety'
  | 'infrastructure_heavy_civil'
  | 'other'

export type BuyerRole = 'owner' | 'safety_lead' | 'executive' | 'ops_manager'

interface FirstRunSetupWizardProps {
  isOpen: boolean
  onComplete: () => void
  onSkip: () => void
}

const INDUSTRIES: Array<{ value: IndustryType; label: string; description: string }> = [
  {
    value: 'residential_trades',
    label: 'Residential Trades',
    description: 'Electrical, Plumbing, HVAC, Roofing, Landscaping',
  },
  {
    value: 'commercial_contractors',
    label: 'Commercial Contractors',
    description: 'GC, Multi-trade, Tenant Improvements',
  },
  {
    value: 'facilities_services',
    label: 'Facilities & Building Services',
    description: 'Janitorial, Maintenance, Security Systems',
  },
  {
    value: 'fire_life_safety',
    label: 'Fire & Life Safety',
    description: 'Fire Protection, Sprinklers, Inspections',
  },
  {
    value: 'infrastructure_heavy_civil',
    label: 'Infrastructure / Heavy Civil',
    description: 'Utilities, Pipeline, Rail, Environmental',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Custom configuration',
  },
]

const BUYER_ROLES: Array<{ value: BuyerRole; label: string; description: string }> = [
  {
    value: 'owner',
    label: 'Owner / Founder',
    description: 'Full authority, billing, org settings',
  },
  {
    value: 'safety_lead',
    label: 'Safety Lead',
    description: 'Operational risk owner, sees all flagged jobs',
  },
  {
    value: 'executive',
    label: 'Executive / Risk',
    description: 'Oversight visibility, no editing',
  },
  {
    value: 'ops_manager',
    label: 'Operations Manager',
    description: 'Day-to-day execution, team coordination',
  },
]

export function FirstRunSetupWizard({ isOpen, onComplete, onSkip }: FirstRunSetupWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [industry, setIndustry] = useState<IndustryType | null>(null)
  const [siteCount, setSiteCount] = useState<string>('1')
  const [buyerRole, setBuyerRole] = useState<BuyerRole | null>(null)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [configurationError, setConfigurationError] = useState<string | null>(null)

  const handleNext = async () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1)
    } else {
      // Final step: configure system
      await handleConfigure()
    }
  }

  const handleConfigure = async () => {
    if (!industry || !buyerRole) {
      setConfigurationError('Please complete all steps')
      return
    }

    setIsConfiguring(true)
    setConfigurationError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Get organization
      const { data: userRow } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!userRow?.organization_id) {
        throw new Error('Organization not found')
      }

      // Update organization with industry/vertical
      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          trade_type: industry,
          // Store setup metadata
          metadata: {
            industry_type: industry,
            site_count: parseInt(siteCount) || 1,
            buyer_role: buyerRole,
            setup_completed_at: new Date().toISOString(),
          },
        })
        .eq('id', userRow.organization_id)

      if (orgError) {
        throw orgError
      }

      // Create initial sites if multi-site
      const siteCountNum = parseInt(siteCount) || 1
      if (siteCountNum > 1) {
        for (let i = 1; i <= siteCountNum; i++) {
          await supabase
            .from('sites')
            .insert({
              organization_id: userRow.organization_id,
              name: `Site ${i}`,
              created_by: user.id,
            })
        }
      }

      // Mark setup as completed
      await supabase
        .from('users')
        .update({
          has_completed_onboarding: true,
          setup_completed: true,
        })
        .eq('id', user.id)

      // Auto-configure default proof pack preference based on industry
      // (This will be used when generating proof packs)
      const defaultProofPack = industry === 'fire_life_safety' || industry === 'infrastructure_heavy_civil'
        ? 'audit'
        : industry === 'residential_trades'
        ? 'insurance'
        : 'compliance'

      // Store in user preferences or org metadata
      await supabase
        .from('organizations')
        .update({
          metadata: {
            industry_type: industry,
            site_count: siteCountNum,
            buyer_role: buyerRole,
            default_proof_pack: defaultProofPack,
            setup_completed_at: new Date().toISOString(),
          },
        })
        .eq('id', userRow.organization_id)

      // Clear any demo data (if exists)
      // This is handled by checking for demo flags in jobs/templates

      onComplete()
    } catch (err: any) {
      console.error('Setup configuration error:', err)
      setConfigurationError(err.message || 'Failed to configure system')
      setIsConfiguring(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (!isOpen) return null

  const progress = ((currentStep + 1) / 3) * 100

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onSkip}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#121212] p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#F97316] to-[#FF8A3D]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-white/50 mt-2 text-center">
              Step {currentStep + 1} of 3
            </p>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-[#F97316]" />
                    <h2 className={`${typography.h2}`}>What industry are you in?</h2>
                  </div>
                  <p className="text-white/60">
                    We&apos;ll configure playbooks and default settings for your operation type.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.value}
                        onClick={() => setIndustry(ind.value)}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          industry === ind.value
                            ? 'border-[#F97316] bg-[#F97316]/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="font-semibold text-white mb-1">{ind.label}</div>
                        <div className="text-xs text-white/60">{ind.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-6 h-6 text-[#F97316]" />
                    <h2 className={`${typography.h2}`}>How many sites do you manage?</h2>
                  </div>
                  <p className="text-white/60">
                    Multi-site operations get site-specific job tracking and reporting.
                  </p>
                  <div>
                    <input
                      type="number"
                      min="1"
                      value={siteCount}
                      onChange={(e) => setSiteCount(e.target.value)}
                      placeholder="1"
                      className="w-full px-4 py-3 rounded-lg border border-white/10 bg-[#121212]/60 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316]/30"
                    />
                    <p className="text-xs text-white/50 mt-2">
                      You can add more sites later from Settings.
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <User className="w-6 h-6 text-[#F97316]" />
                    <h2 className={`${typography.h2}`}>What&apos;s your primary role?</h2>
                  </div>
                  <p className="text-white/60">
                    This helps us show you the right views and capabilities.
                  </p>
                  <div className="space-y-3">
                    {BUYER_ROLES.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => setBuyerRole(role.value)}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          buyerRole === role.value
                            ? 'border-[#F97316] bg-[#F97316]/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="font-semibold text-white mb-1">{role.label}</div>
                        <div className="text-xs text-white/60">{role.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 text-center">
                  {isConfiguring ? (
                    <>
                      <Loader2 className="w-12 h-12 text-[#F97316] animate-spin mx-auto" />
                      <h2 className={`${typography.h2}`}>Configuring your system...</h2>
                      <p className="text-white/60">
                        Setting up playbooks, default proof packs, and site structure.
                      </p>
                    </>
                  ) : configurationError ? (
                    <>
                      <div className="text-red-400 mb-4">{configurationError}</div>
                      <button
                        onClick={handleConfigure}
                        className={`${buttonStyles.primary}`}
                      >
                        Try Again
                      </button>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
                      <h2 className={`${typography.h2}`}>Setup Complete</h2>
                      <p className="text-white/60">
                        Your system is configured and ready to use.
                      </p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
              <button
                onClick={currentStep === 0 ? onSkip : handleBack}
                className="text-white/60 hover:text-white transition-colors"
              >
                {currentStep === 0 ? 'Skip' : 'Back'}
              </button>
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 0 && !industry) ||
                  (currentStep === 1 && !siteCount) ||
                  (currentStep === 2 && !buyerRole)
                }
                className={`${buttonStyles.primary} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {currentStep === 2 ? 'Complete Setup' : 'Next →'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

