'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { ErrorModal } from '@/components/dashboard/ErrorModal'
import { subscriptionsApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
}

interface Organization {
  id: string
  name: string
}

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingOrg, setEditingOrg] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [orgForm, setOrgForm] = useState({ name: '' })
  const [error, setError] = useState<string | null>(null)

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
          .select('id, email, full_name, phone, role, organization_id')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        setProfile({
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone,
          role: userData.role,
        })

        // Redirect members to dashboard
        if (userData.role === 'member') {
          router.push('/dashboard')
          return
        }

        // Load organization
        if (userData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', userData.organization_id)
            .single()

          if (!orgError && orgData) {
            setOrganization(orgData)
            setOrgForm({ name: orgData.name })
          }
        }

        // Load subscription
        try {
          const subData = await subscriptionsApi.get()
          setSubscription(subData.data)
        } catch (subError) {
          console.warn('Failed to load subscription:', subError)
        }

        // Initialize profile form
        setProfileForm({
          full_name: userData.full_name || '',
          phone: userData.phone || '',
        })
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

  const handleUpdateProfile = async () => {
    if (!profile) return

    setUpdating(true)
    setError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: profileForm.full_name || null,
          phone: profileForm.phone || null,
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({
        ...profile,
        full_name: profileForm.full_name || null,
        phone: profileForm.phone || null,
      })
      setEditingProfile(false)
    } catch (err: any) {
      console.error('Failed to update profile:', err)
      setError(err?.message || 'Failed to update profile')
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateOrganization = async () => {
    if (!organization) return

    setUpdating(true)
    setError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: orgForm.name,
        })
        .eq('id', organization.id)

      if (updateError) throw updateError

      setOrganization({
        ...organization,
        name: orgForm.name,
      })
      setEditingOrg(false)
    } catch (err: any) {
      console.error('Failed to update organization:', err)
      setError(err?.message || 'Failed to update organization')
    } finally {
      setUpdating(false)
    }
  }

  const formatStatus = (status: string | null) => {
    if (!status) return 'No Plan'
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white">
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
        <div className="min-h-screen bg-[#050505] text-white">
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <p className="text-white/70">{error || 'Failed to load account'}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C]"
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
      <div className="min-h-screen bg-[#050505] text-white">
        <DashboardNavbar email={userEmail} onLogout={handleLogout} />

        <main className="mx-auto max-w-7xl px-6 py-14">
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Account Settings</h1>
              <p className="text-white/60">Manage your profile and organization settings</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Profile Section */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Profile</h2>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="px-4 py-2 text-sm text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                      placeholder="Enter your phone number"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdateProfile}
                      disabled={updating}
                      className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProfile(false)
                        setProfileForm({
                          full_name: profile.full_name || '',
                          phone: profile.phone || '',
                        })
                      }}
                      disabled={updating}
                      className="rounded-lg border border-white/10 px-6 py-3 text-white font-semibold hover:border-white/30 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-white/60">Email</div>
                    <div className="text-white">{profile.email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Full Name</div>
                    <div className="text-white">{profile.full_name || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Phone</div>
                    <div className="text-white">{profile.phone || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Role</div>
                    <div className="text-white">{profile.role.toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Organization Section */}
            {organization && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Organization</h2>
                  {!editingOrg && (
                    <button
                      onClick={() => setEditingOrg(true)}
                      className="px-4 py-2 text-sm text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingOrg ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-2">Organization Name</label>
                      <input
                        type="text"
                        value={orgForm.name}
                        onChange={(e) => setOrgForm({ name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                        placeholder="Enter organization name"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleUpdateOrganization}
                        disabled={updating}
                        className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingOrg(false)
                          setOrgForm({ name: organization.name })
                        }}
                        disabled={updating}
                        className="rounded-lg border border-white/10 px-6 py-3 text-white font-semibold hover:border-white/30 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-white/60">Organization Name</div>
                    <div className="text-white">{organization.name}</div>
                  </div>
                )}
              </div>
            )}

            {/* Plan & Billing Section */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Plan & Billing</h2>
              {subscription ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-white/60">Current Plan</div>
                    <div className="text-white font-semibold">
                      {subscription.tier ? subscription.tier.toUpperCase() : 'No Plan'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Status</div>
                    <div className="text-white">{formatStatus(subscription.status)}</div>
                  </div>
                  {subscription.current_period_end && (
                    <div>
                      <div className="text-sm text-white/60">Renewal Date</div>
                      <div className="text-white">
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {subscription.jobsLimit !== null && (
                    <div>
                      <div className="text-sm text-white/60">Monthly Job Limit</div>
                      <div className="text-white">
                        {subscription.jobsLimit === null ? 'Unlimited' : subscription.jobsLimit}
                      </div>
                    </div>
                  )}
                  <div className="space-y-4 pt-4">
                    <div>
                      <div className="text-sm text-white/60 mb-2">Switch Plan</div>
                      <div className="flex flex-wrap gap-2">
                        {subscription.tier !== 'starter' && (
                          <button
                            onClick={async () => {
                              if (!confirm('Switch to Starter (free) plan? Your subscription will be cancelled.')) return
                              try {
                                const response = await subscriptionsApi.switchPlan('starter')
                                if (response.url) {
                                  window.location.href = response.url
                                } else {
                                  // Plan switched successfully
                                  window.location.reload()
                                }
                              } catch (err: any) {
                                setError(err?.message || 'Failed to switch plan')
                              }
                            }}
                            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            Switch to Starter
                          </button>
                        )}
                        {subscription.tier !== 'pro' && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await subscriptionsApi.switchPlan('pro')
                                if (response.url) {
                                  window.location.href = response.url
                                } else {
                                  window.location.reload()
                                }
                              } catch (err: any) {
                                setError(err?.message || 'Failed to switch plan')
                              }
                            }}
                            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm text-black font-semibold hover:bg-[#FB923C] transition-colors"
                          >
                            {subscription.tier === 'starter' ? 'Upgrade to Pro' : 'Switch to Pro'}
                          </button>
                        )}
                        {subscription.tier !== 'business' && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await subscriptionsApi.switchPlan('business')
                                if (response.url) {
                                  window.location.href = response.url
                                } else {
                                  window.location.reload()
                                }
                              } catch (err: any) {
                                setError(err?.message || 'Failed to switch plan')
                              }
                            }}
                            className="rounded-lg border border-[#F97316] text-[#F97316] px-4 py-2 text-sm font-semibold hover:bg-[#F97316]/10 transition-colors"
                          >
                            {subscription.tier === 'starter' ? 'Upgrade to Business' : 'Switch to Business'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-white/10">
                      <button
                        onClick={() => router.push('/pricing')}
                        className="rounded-lg border border-white/10 px-6 py-3 text-white font-semibold hover:border-white/30"
                      >
                        View All Plans
                      </button>
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
                          className="rounded-lg border border-white/10 px-6 py-3 text-white font-semibold hover:border-white/30"
                        >
                          Manage Billing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-white/60">No active subscription</p>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C]"
                  >
                    View Pricing Plans
                  </button>
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


