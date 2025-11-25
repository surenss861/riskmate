'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { teamApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface TeamMember {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  must_reset_password: boolean
}

interface TeamInvite {
  id: string
  email: string
  role: string
  created_at: string
  invited_by?: string | null
  user_id?: string | null
}

interface TeamData {
  members: TeamMember[]
  invites: TeamInvite[]
  seats: {
    limit: number | null
    used: number
    pending: number
    available: number | null
  }
  current_user_role: string
  plan: string
}

export default function TeamPage() {
  const router = useRouter()
  const [team, setTeam] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUserEmail(user?.email ?? null)

        const data = await teamApi.get()
        setTeam(data)

        // Redirect members to dashboard
        if (data.current_user_role === 'member') {
          router.push('/dashboard')
          return
        }
      } catch (err: any) {
        console.error('Failed to load team:', err)
        setError(err?.message || 'Failed to load team')
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setError(null)
    try {
      const response = await teamApi.invite({
        email: inviteEmail.trim(),
        role: inviteRole,
      })

      // Refresh team data
      const data = await teamApi.get()
      setTeam(data)

      // Show temporary password (in a real app, you'd send this via email)
      if (response.temporary_password) {
        alert(
          `Invite sent! Temporary password: ${response.temporary_password}\n\nShare this with ${inviteEmail} - they'll need to reset it on first login.`
        )
      }

      setInviteEmail('')
      setInviteRole('member')
    } catch (err: any) {
      console.error('Failed to invite:', err)
      setError(err?.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return

    setRemoving(memberId)
    setError(null)
    try {
      await teamApi.removeMember(memberId)
      const data = await teamApi.get()
      setTeam(data)
    } catch (err: any) {
      console.error('Failed to remove member:', err)
      setError(err?.message || 'Failed to remove team member')
    } finally {
      setRemoving(null)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setRevoking(inviteId)
    setError(null)
    try {
      await teamApi.revokeInvite(inviteId)
      const data = await teamApi.get()
      setTeam(data)
    } catch (err: any) {
      console.error('Failed to revoke invite:', err)
      setError(err?.message || 'Failed to revoke invite')
    } finally {
      setRevoking(null)
    }
  }

  const seatLimitReached = useMemo(() => {
    if (!team) return false
    const { limit, used } = team.seats
    return limit !== null && used >= limit
  }, [team])

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white">
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto" />
              <p className="text-white/60">Loading team...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!team) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white">
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <p className="text-white/70">{error || 'Failed to load team'}</p>
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
              <h1 className="text-4xl font-bold text-white mb-2">Team Management</h1>
              <p className="text-white/60">Manage your team members and invites</p>
            </div>

            {/* Seat Usage */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Seat Usage</h2>
                {team.seats.limit !== null && (
                  <span className="text-sm text-white/60">
                    {team.seats.used} / {team.seats.limit} used
                  </span>
                )}
              </div>
              {team.seats.limit !== null ? (
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-[#F97316] h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min((team.seats.used / team.seats.limit) * 100, 100)}%`,
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-white/60">Unlimited seats</p>
              )}
              {seatLimitReached && (
                <div className="mt-4 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                  <p className="text-sm text-orange-400">
                    Seat limit reached. Upgrade your plan to add more team members.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Invite Form */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Invite Team Member</h2>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316]"
                      required
                      disabled={inviting || seatLimitReached}
                    />
                  </div>
                  <div>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                      disabled={inviting}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={inviting || seatLimitReached}
                  className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </form>
            </div>

            {/* Team Members */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Team Members</h2>
              {team.members.length === 0 ? (
                <p className="text-white/60">No team members yet.</p>
              ) : (
                <div className="space-y-3">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-white">
                            {member.full_name || member.email}
                          </div>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white/70">
                            {member.role.toUpperCase()}
                          </span>
                          {member.must_reset_password && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-400">
                              RESET REQUIRED
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/60 mt-1">{member.email}</div>
                      </div>
                      {(team.current_user_role === 'owner' || team.current_user_role === 'admin') && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removing === member.id}
                          className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {removing === member.id ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Invites */}
            {team.invites.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Pending Invites</h2>
                <div className="space-y-3">
                  {team.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-white">{invite.email}</div>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white/70">
                            {invite.role.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400">
                            PENDING
                          </span>
                        </div>
                        <div className="text-sm text-white/60 mt-1">
                          Invited {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {(team.current_user_role === 'owner' || team.current_user_role === 'admin') && (
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revoking === invite.id}
                          className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {revoking === invite.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

