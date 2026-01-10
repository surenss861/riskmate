'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { InviteSuccessModal } from '@/components/dashboard/InviteSuccessModal'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { teamApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { typography, emptyStateStyles, spacing } from '@/lib/styles/design-system'
import { AppBackground, AppShell, PageSection, GlassCard, Button, Input, Select, PageHeader, Badge } from '@/components/shared'

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
      // Refresh team data
      const data = await teamApi.get()
      setTeam(data)
      // Clear any previous errors on success
      setError(null)
    } catch (err: any) {
      console.error('Failed to remove member:', err)
      // Show actual error message from API if available
      const errorMessage = err?.message || err?.detail || 'We couldn\'t remove that member. Try again in a moment.'
      
      // Provide more specific error messages based on error code or message
      if (errorMessage.includes('last owner') || errorMessage.includes('Cannot remove')) {
        setError(errorMessage)
      } else if (errorMessage.includes('active assignments') || errorMessage.includes('assignments')) {
        setError('This member has active job assignments. Please reassign or complete those jobs first.')
      } else if (errorMessage.includes('cannot remove yourself')) {
        setError('You cannot remove yourself. Ask another owner or admin to remove you.')
      } else if (errorMessage.includes('Only owners')) {
        setError('Only owners can remove other owners. Contact an owner to remove this member.')
      } else {
        setError(errorMessage)
      }
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

  const getRiskVisibility = (role: string) => {
    const visibility: Record<string, string> = {
      safety_lead: 'Flagged jobs, Executive view',
      executive: 'Executive view, read-only',
      owner: 'All access',
      admin: 'Team management',
      member: 'Job creation',
    }
    return visibility[role] || ''
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <AppShell>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto" />
                <p className="text-white/60">Loading team...</p>
              </div>
            </div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    )
  }

  if (!team) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <DashboardNavbar email={userEmail} onLogout={handleLogout} />
          <AppShell>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-4">
                <p className="text-white/70">{error || 'Failed to load team'}</p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.push('/operations')}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar email={userEmail} onLogout={handleLogout} />
        <AppShell>
          <PageSection>
            <PageHeader
              title="Access & Accountability"
              subtitle="Define who can view, manage, and approve risk"
            />
          </PageSection>

          {/* Risk Coverage */}
          {team.risk_coverage && (
          <PageSection>
            <GlassCard className="p-6">
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
            </GlassCard>
          </PageSection>
          )}

          {/* Error Message */}
          {error && (
            <PageSection>
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            </PageSection>
          )}

          {/* Invite Form */}
          <PageSection>
            <GlassCard className="p-6">
              <h2 className={`${typography.h3} ${spacing.normal}`}>Invite Team Member</h2>
              <p className="text-xs text-white/50 mb-4">
                Invited users inherit visibility based on role. All access is logged.
              </p>
              <form onSubmit={handleInvite} className={spacing.gap.normal}>
                <div className={`grid grid-cols-1 md:grid-cols-3 ${spacing.gap.normal}`}>
                  <div className="md:col-span-2">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      required
                      disabled={inviting || seatLimitReached}
                    />
                  </div>
                  <div>
                    <Select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin' | 'safety_lead' | 'executive' | 'owner')}
                      disabled={inviting || seatLimitReached}
                    >
                      <option value="member">Member</option>
                      <option value="safety_lead">Safety Lead</option>
                      <option value="executive">Executive</option>
                      <option value="admin">Admin</option>
                      {team?.current_user_role === 'owner' && (
                        <option value="owner">Owner</option>
                      )}
                    </Select>
                    <p className="text-xs text-white/40 mt-1">
                      {inviteRole === 'member' && 'Can create/update jobs, no governance authority'}
                      {inviteRole === 'safety_lead' && 'Sees all flagged-for-review jobs automatically'}
                      {inviteRole === 'executive' && 'Read-only visibility into risk & trends'}
                      {inviteRole === 'admin' && 'Team management, no org-level authority'}
                      {inviteRole === 'owner' && 'Org-level authority, billing, deletion'}
                    </p>
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={inviting || seatLimitReached}
                >
                  {inviting ? 'Sending...' : 'Send Invite'}
                </Button>
              </form>
            </GlassCard>
          </PageSection>

          {/* Team Members */}
          <PageSection>
            <GlassCard className="p-6">
              <h2 className={`${typography.h3} ${spacing.normal}`}>Team Members</h2>
              {!team.members || team.members.length === 0 ? (
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
                          <span title={getRoleDescription(member.role)}>
                            <Badge variant="neutral">
                              {getRoleLabel(member.role)}
                            </Badge>
                          </span>
                          {member.must_reset_password && (
                            <Badge variant="warning">
                              RESET REQUIRED
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-white/60 mt-1">{member.email}</div>
                        {(member.role === 'safety_lead' || member.role === 'executive') && (
                          <div className="text-xs text-white/40 mt-1">
                            Risk visibility: {getRiskVisibility(member.role)}
                          </div>
                        )}
                      </div>
                      {(team.current_user_role === 'owner' || team.current_user_role === 'admin') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removing === member.id}
                        >
                          {removing === member.id ? 'Deactivating...' : 'Deactivate Access'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </PageSection>

          {/* Pending Invites */}
          {team.invites && team.invites.length > 0 && (
          <PageSection>
            <GlassCard className="p-6">
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
                          <span title={getRoleDescription(invite.role)}>
                            <Badge variant="neutral">
                              {getRoleLabel(invite.role)}
                            </Badge>
                          </span>
                          <Badge variant="neutral" className="bg-blue-500/20 text-blue-400">
                            PENDING
                          </Badge>
                        </div>
                        <div className="text-sm text-white/60 mt-1">
                          Invited {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {(team.current_user_role === 'owner' || team.current_user_role === 'admin') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revoking === invite.id}
                          className="text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50"
                        >
                          {revoking === invite.id ? 'Revoking...' : 'Revoke'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
            </GlassCard>
          </PageSection>
          )}

          {/* Audit Reassurance Footer */}
          <PageSection>
            <div className="pt-6 border-t border-white/10">
              <p className="text-xs text-white/40 text-center">
                All access changes are recorded for compliance and audit review.
              </p>
            </div>
          </PageSection>
        </AppShell>

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
          message="This will revoke access immediately. This action will be logged as auth.access_revoked in the compliance ledger."
          consequence="This action creates an immutable ledger event and cannot be undone. The user's account will be deactivated, but all historical actions remain in the chain of custody."
          confirmLabel="Deactivate Access"
          destructive={true}
          onConfirm={confirmRemoveMember}
          onCancel={() => {
            setShowRemoveConfirm(false)
            setMemberToRemove(null)
          }}
        />
      </AppBackground>
    </ProtectedRoute>
  )
}

