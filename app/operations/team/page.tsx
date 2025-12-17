'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { InviteSuccessModal } from '@/components/dashboard/InviteSuccessModal'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { teamApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { buttonStyles, cardStyles, typography, badgeStyles, emptyStateStyles, spacing } from '@/lib/styles/design-system'

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
  risk_coverage?: {
    owner: number
    admin: number
    safety_lead: number
    executive: number
    member: number
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
  const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'safety_lead' | 'executive' | 'owner'>('member')
  const [error, setError] = useState<string | null>(null)
  const [showInviteSuccess, setShowInviteSuccess] = useState(false)
  const [inviteSuccessData, setInviteSuccessData] = useState<{ email: string; password: string } | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)

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
          router.push('/operations')
          return
        }
      } catch (err: any) {
        console.error('Failed to load team:', err)
        setError('We couldn\'t load your team. Refresh the page to try again. Your data is safe.')
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

      // Show temporary password modal
      if (response.temporary_password) {
        setInviteSuccessData({
          email: inviteEmail.trim(),
          password: response.temporary_password,
        })
        setShowInviteSuccess(true)
      }

      setInviteEmail('')
      setInviteRole('member')
    } catch (err: any) {
      console.error('Failed to invite:', err)
      setError('We couldn\'t send that invite. Check the email address and try again. Make sure the email is valid and not already on your team.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setMemberToRemove(memberId)
    setShowRemoveConfirm(true)
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return

    setRemoving(memberToRemove)
    setError(null)
    setShowRemoveConfirm(false)
    try {
      await teamApi.removeMember(memberToRemove)
      const data = await teamApi.get()
      setTeam(data)
    } catch (err: any) {
      console.error('Failed to remove member:', err)
      setError('We couldn\'t remove that member. Try again in a moment. If this continues, they may have active assignments that need to be handled first.')
    } finally {
      setRemoving(null)
      setMemberToRemove(null)
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
      setError('We couldn\'t revoke that invite. Try again in a moment. If the invite was already accepted, you\'ll need to remove the member instead.')
    } finally {
      setRevoking(null)
    }
  }

  const seatLimitReached = useMemo(() => {
    if (!team) return false
    const { limit, used } = team.seats
    return limit !== null && used >= limit
  }, [team])

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      safety_lead: 'Safety Lead',
      executive: 'Executive',
      member: 'Member',
    }
    return labels[role] || role.toUpperCase()
  }

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      owner: 'Org-level authority, billing, deletion',
      admin: 'Team management, no org-level authority',
      safety_lead: 'Owns operational risk, sees all flagged jobs',
      executive: 'Read-only visibility into risk & trends',
      member: 'Can create/update jobs, no governance authority',
    }
    return descriptions[role] || ''
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0A0A0A] text-white">
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
        <div className="min-h-screen bg-[#0A0A0A] text-white">
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <p className="text-white/70">{error || 'Failed to load team'}</p>
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
          <div className={spacing.gap.relaxed}>
            {/* Header */}
            <div>
              <h1 className={`${typography.h1} ${spacing.tight}`}>Access & Accountability</h1>
              <p className="text-white/60">Define who can view, manage, and approve risk</p>
            </div>

            {/* Risk Coverage */}
            {team.risk_coverage && (
              <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
                <div className={`flex items-center justify-between ${spacing.normal} mb-4`}>
                  <h2 className="text-xl font-semibold text-white">Risk Coverage</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Owners</div>
                    <div className="text-2xl font-semibold text-white">{team.risk_coverage.owner}</div>
                    <div className="text-xs text-white/40 mt-1">Org authority</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Safety Leads</div>
                    <div className="text-2xl font-semibold text-white">{team.risk_coverage.safety_lead}</div>
                    <div className="text-xs text-white/40 mt-1">Operational risk</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Executives</div>
                    <div className="text-2xl font-semibold text-white">{team.risk_coverage.executive}</div>
                    <div className="text-xs text-white/40 mt-1">Read-only visibility</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Admins</div>
                    <div className="text-2xl font-semibold text-white">{team.risk_coverage.admin}</div>
                    <div className="text-xs text-white/40 mt-1">Team management</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Members</div>
                    <div className="text-2xl font-semibold text-white">{team.risk_coverage.member}</div>
                    <div className="text-xs text-white/40 mt-1">Job creation</div>
                  </div>
                </div>
                {team.seats.limit !== null && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Seat usage</span>
                      <span className="text-white">
                        {team.seats.used} / {team.seats.limit}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Invite Form */}
            <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
              <h2 className={`${typography.h3} ${spacing.normal}`}>Invite Team Member</h2>
              <p className="text-xs text-white/50 mb-4">
                Invited users inherit visibility based on role. All access is logged.
              </p>
              <form onSubmit={handleInvite} className={spacing.gap.normal}>
                <div className={`grid grid-cols-1 md:grid-cols-3 ${spacing.gap.normal}`}>
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
                      onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin' | 'safety_lead' | 'executive')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#F97316]"
                      disabled={inviting}
                    >
                      <option value="member">Member</option>
                      <option value="safety_lead">Safety Lead</option>
                      <option value="executive">Executive</option>
                      <option value="admin">Admin</option>
                      {(team.current_user_role === 'owner') && (
                        <option value="owner">Owner</option>
                      )}
                    </select>
                    <p className="text-xs text-white/40 mt-1">
                      {inviteRole === 'safety_lead' && 'Sees all flagged-for-review jobs automatically'}
                      {inviteRole === 'executive' && 'Read-only visibility into risk & trends'}
                      {inviteRole === 'member' && 'Can create/update jobs, no governance authority'}
                      {inviteRole === 'admin' && 'Team management, no org-level authority'}
                      {inviteRole === 'owner' && 'Org-level authority, billing, deletion'}
                    </p>
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
            <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
              <h2 className={`${typography.h3} ${spacing.normal}`}>Team Members</h2>
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
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white/70" title={getRoleDescription(member.role)}>
                            {getRoleLabel(member.role)}
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
                          className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {removing === member.id ? 'Deactivating...' : 'Deactivate Access'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Invites */}
            {team.invites.length > 0 && (
              <div className={`${cardStyles.base} ${cardStyles.padding.md}`}>
                <h2 className={`${typography.h3} ${spacing.normal}`}>Pending Invites</h2>
                <div className="space-y-3">
                  {team.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-white">{invite.email}</div>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white/70" title={getRoleDescription(invite.role)}>
                            {getRoleLabel(invite.role)}
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

        {/* Invite Success Modal */}
        <InviteSuccessModal
          isOpen={showInviteSuccess}
          email={inviteSuccessData?.email || ''}
          temporaryPassword={inviteSuccessData?.password || ''}
          onClose={() => {
            setShowInviteSuccess(false)
            setInviteSuccessData(null)
          }}
        />

        {/* Remove Member Confirmation Modal */}
        <ConfirmModal
          isOpen={showRemoveConfirm}
          title="Deactivate Access"
          message="This user will lose access immediately. All actions remain in the audit log."
          consequence="This action is logged and cannot be undone. The user's account will be deactivated."
          confirmLabel="Deactivate Access"
          destructive={true}
          onConfirm={confirmRemoveMember}
          onCancel={() => {
            setShowRemoveConfirm(false)
            setMemberToRemove(null)
          }}
        />
      </div>
    </ProtectedRoute>
  )
}

