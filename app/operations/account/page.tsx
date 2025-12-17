'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { TemplatesManager } from '@/components/dashboard/TemplatesManager'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { subscriptionsApi, accountApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { cardStyles, buttonStyles, spacing, typography, dividerStyles } from '@/lib/styles/design-system'
import { Check, X, Edit2, Save, Loader2 } from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  updated_at?: string
}

interface Organization {
  id: string
  name: string
  updated_at?: string
}

type SettingsSection = 'profile' | 'organization' | 'billing' | 'templates' | 'security' | 'danger'

export default function AccountPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldValue, setFieldValue] = useState<string>('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/')
          return
        }

        setUserEmail(user.email ?? null)

        // Load user profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, phone, role, organization_id, updated_at')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        setProfile({
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone,
          role: userData.role,
          updated_at: userData.updated_at,
        })

        // Redirect members to dashboard
        if (userData.role === 'member') {
          router.push('/operations')
          return
        }

        // Load organization
        if (userData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id, name, updated_at')
            .eq('id', userData.organization_id)
            .single()

          if (!orgError && orgData) {
            setOrganization(orgData)
          }
        }

        // Load subscription
        try {
          const subData = await subscriptionsApi.get()
          setSubscription(subData.data)
        } catch (subError) {
          console.warn('Failed to load subscription:', subError)
        }
      } catch (err: any) {
        console.error('Failed to load account data:', err)
        setError(err?.message || 'Failed to load account data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleInlineEdit = (field: string, currentValue: string | null) => {
    setEditingField(field)
    setFieldValue(currentValue || '')
    setSaveState('idle')
  }

  const handleInlineSave = async (field: string) => {
    if (!profile || !organization) return

    setUpdating(true)
    setSaveState('saving')
    setError(null)

    try {
      if (field === 'full_name' || field === 'phone') {
        // Update profile via backend API (includes audit logging)
        const response = await accountApi.updateProfile({
          [field]: fieldValue || null,
        })

        setProfile({
          ...profile,
          [field]: fieldValue || null,
          updated_at: new Date().toISOString(),
        })
      } else if (field === 'org_name') {
        // Update organization via backend API (includes audit logging)
        if (profile.role !== 'owner' && profile.role !== 'admin') {
          throw new Error('Only owners and admins can update organization name')
        }

        const response = await accountApi.updateOrganization(fieldValue)

        setOrganization({
          ...organization,
          name: fieldValue,
          updated_at: new Date().toISOString(),
        })
      }

      setSaveState('saved')
      setEditingField(null)
      
      // Reset save state after 2 seconds
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err: any) {
      console.error('Failed to update:', err)
      setSaveState('error')
      setError(err?.message || 'Couldn\'t save that change. Your data is still here — try again.')
      setTimeout(() => {
        setSaveState('idle')
        setEditingField(null)
      }, 3000)
    } finally {
      setUpdating(false)
    }
  }

  const handleInlineCancel = () => {
    setEditingField(null)
    setFieldValue('')
    setSaveState('idle')
  }

  const formatStatus = (status: string | null) => {
    if (!status) return 'No Plan'
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const sidebarSections: { id: SettingsSection; label: string; icon?: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'organization', label: 'Organization' },
    { id: 'billing', label: 'Billing' },
    { id: 'templates', label: 'Templates' },
    { id: 'security', label: 'Security' },
    { id: 'danger', label: 'Danger Zone' },
  ]

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white">
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto" />
              <p className="text-white/60">Loading account...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!profile) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white">
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <p className="text-white/70">{error || 'Failed to load account'}</p>
              <button
                onClick={() => router.push('/operations')}
                className={`${buttonStyles.primary} ${buttonStyles.sizes.lg}`}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <DashboardNavbar email={userEmail} onLogout={handleLogout} />

        <main className="mx-auto max-w-7xl px-6 py-14">
          <div className="flex gap-8">
            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0">
              <div className="sticky top-24">
                <h1 className={`${typography.h2} ${spacing.tight} mb-6`}>Settings</h1>
                <nav className="space-y-1">
                  {sidebarSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`
                        w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${
                          activeSection === section.id
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      {section.label}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {error && (
                <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className={typography.h3}>Profile</h2>
                      <p className="text-sm text-white/50 mt-1">
                        Last updated: {formatDate(profile.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Email (read-only) */}
                    <div className="pb-4 border-b border-white/10">
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Email
                      </label>
                      <div className="text-white">{profile.email}</div>
                      <p className="text-xs text-white/40 mt-1">Email cannot be changed</p>
                    </div>

                    {/* Full Name */}
                    <div className="pb-4 border-b border-white/10">
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Full Name
                      </label>
                      {editingField === 'full_name' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={fieldValue}
                            onChange={(e) => setFieldValue(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                            placeholder="Enter your full name"
                            autoFocus
                          />
                          <button
                            onClick={() => handleInlineSave('full_name')}
                            disabled={updating}
                            className="p-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg transition-colors disabled:opacity-50"
                          >
                            {saveState === 'saving' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : saveState === 'saved' ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={handleInlineCancel}
                            disabled={updating}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <div className="text-white">{profile.full_name || 'Not set'}</div>
                          <button
                            onClick={() => handleInlineEdit('full_name', profile.full_name)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/5 rounded transition-all"
                          >
                            <Edit2 className="h-4 w-4 text-white/60" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="pb-4 border-b border-white/10">
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Phone
                      </label>
                      {editingField === 'phone' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="tel"
                            value={fieldValue}
                            onChange={(e) => setFieldValue(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                            placeholder="Enter your phone number"
                            autoFocus
                          />
                          <button
                            onClick={() => handleInlineSave('phone')}
                            disabled={updating}
                            className="p-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg transition-colors disabled:opacity-50"
                          >
                            {saveState === 'saving' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : saveState === 'saved' ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={handleInlineCancel}
                            disabled={updating}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <div className="text-white">{profile.phone || 'Not set'}</div>
                          <button
                            onClick={() => handleInlineEdit('phone', profile.phone)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/5 rounded transition-all"
                          >
                            <Edit2 className="h-4 w-4 text-white/60" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Role (read-only) */}
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Role
                      </label>
                      <div className="text-white">{profile.role.toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Organization Section */}
              {activeSection === 'organization' && organization && (
                <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className={typography.h3}>Organization</h2>
                      <p className="text-sm text-white/50 mt-1">
                        Last updated: {formatDate(organization.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Organization Name */}
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Organization Name
                      </label>
                      {editingField === 'org_name' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={fieldValue}
                            onChange={(e) => setFieldValue(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                            placeholder="Enter organization name"
                            autoFocus
                          />
                          <button
                            onClick={() => handleInlineSave('org_name')}
                            disabled={updating}
                            className="p-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg transition-colors disabled:opacity-50"
                          >
                            {saveState === 'saving' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : saveState === 'saved' ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={handleInlineCancel}
                            disabled={updating}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <div className="text-white">{organization.name}</div>
                          {(profile.role === 'owner' || profile.role === 'admin') && (
                            <button
                              onClick={() => handleInlineEdit('org_name', organization.name)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/5 rounded transition-all"
                            >
                              <Edit2 className="h-4 w-4 text-white/60" />
                            </button>
                          )}
                        </div>
                      )}
                      {profile.role !== 'owner' && profile.role !== 'admin' && (
                        <p className="text-xs text-white/40 mt-1">
                          Only owners and admins can update organization name
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Section */}
              {activeSection === 'billing' && (
                <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className={typography.h3}>Plan & Billing</h2>
                      <p className="text-sm text-white/50 mt-1">Contract summary</p>
                    </div>
                  </div>

                  {subscription ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6 pb-4 border-b border-white/10">
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                            Current Plan
                          </label>
                          <div className="text-white font-semibold">
                            {subscription.tier ? subscription.tier.toUpperCase() : 'No Plan'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                            Status
                          </label>
                          <div className="text-white">{formatStatus(subscription.status)}</div>
                        </div>
                      </div>

                      {subscription.current_period_end && (
                        <div className="pb-4 border-b border-white/10">
                          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                            Renewal Date
                          </label>
                          <div className="text-white">
                            {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      )}

                      {subscription.jobsLimit !== null && (
                        <div className="pb-4 border-b border-white/10">
                          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                            Monthly Job Limit
                          </label>
                          <div className="text-white">
                            {subscription.jobsLimit === null ? 'Unlimited' : subscription.jobsLimit}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Link
                          href="/operations/account/change-plan"
                          className={`${buttonStyles.primary} inline-block text-center`}
                        >
                          Change Plan
                        </Link>
                        {subscription.stripe_customer_id && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await subscriptionsApi.createPortalSession()
                                window.location.href = response.url
                              } catch (err: any) {
                                setError(err?.message || 'Failed to open billing portal')
                              }
                            }}
                            className={`${buttonStyles.secondary} bg-white/5 hover:bg-white/10 border-white/10`}
                          >
                            View Invoices
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-white/60">No active subscription</p>
                      <button
                        onClick={() => router.push('/pricing')}
                        className={buttonStyles.primary}
                      >
                        View Pricing Plans
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Templates Section */}
              {activeSection === 'templates' && organization && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <TemplatesManager 
                    organizationId={organization.id} 
                    subscriptionTier={subscription?.tier || 'starter'}
                  />
                </motion.div>
              )}

              {/* Security Section */}
              {activeSection === 'security' && (
                <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className={typography.h3}>Security</h2>
                      <p className="text-sm text-white/50 mt-1">Account security settings</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="pb-4 border-b border-white/10">
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Password
                      </label>
                      <p className="text-sm text-white/60 mb-3">
                        Change your password to keep your account secure
                      </p>
                      <button
                        className={`${buttonStyles.secondary} bg-white/5 hover:bg-white/10 border-white/10`}
                        onClick={() => {
                          // TODO: Implement password reset flow
                          setError('Password reset coming soon')
                        }}
                      >
                        Change Password
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                        Two-Factor Authentication
                      </label>
                      <p className="text-sm text-white/60 mb-3">
                        Add an extra layer of security to your account
                      </p>
                      <button
                        className={`${buttonStyles.secondary} bg-white/5 hover:bg-white/10 border-white/10`}
                        onClick={() => {
                          setError('2FA coming soon')
                        }}
                      >
                        Enable 2FA
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Danger Zone */}
              {activeSection === 'danger' && (
                <div className={`${cardStyles.base} ${cardStyles.padding.md} border-red-500/20`}>
                  <div className="mb-6">
                    <h2 className={typography.h3}>Danger Zone</h2>
                    <p className="text-sm text-white/50 mt-1">Irreversible actions</p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <h3 className="text-sm font-semibold text-white mb-2">Delete Account</h3>
                      <p className="text-xs text-white/60 mb-3">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <button
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                        onClick={() => {
                          setError('Account deletion coming soon')
                        }}
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Error Modal */}
        <ErrorModal
          isOpen={error !== null}
          title="Error"
          message={error || ''}
          onClose={() => setError(null)}
        />
      </div>
    </ProtectedRoute>
  )
}
