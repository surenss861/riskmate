/**
 * Session bootstrap for selected organization.
 * Called when the user is authenticated to set or validate the shared selected org
 * so analytics/bulk/webhook API calls include X-Organization-Id for multi-membership users.
 */

import { setSelectedOrganizationId, getSelectedOrganizationId } from '@/lib/selectedOrganization'

export interface OrgContextResponse {
  user_role: string
  organization_id: string
  memberships: { id: string; name: string }[]
}

/**
 * Run selected-organization bootstrap: call after session is established.
 * - Single membership: set selected org to that org.
 * - Multi membership: keep current selection only if it's in memberships; otherwise clear.
 * Uses GET /api/me/context (Next.js route with cookie/Bearer auth).
 */
export async function runSelectedOrganizationBootstrap(token: string | null): Promise<void> {
  if (typeof window === 'undefined' || !token) return
  try {
    const res = await fetch('/api/me/context', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as OrgContextResponse
    const memberships = data.memberships ?? []
    if (memberships.length === 0) {
      setSelectedOrganizationId(null)
      return
    }
    if (memberships.length === 1) {
      setSelectedOrganizationId(memberships[0].id)
      return
    }
    const current = getSelectedOrganizationId()
    const validIds = new Set(memberships.map((m) => m.id))
    if (current && validIds.has(current)) return
    setSelectedOrganizationId(null)
  } catch {
    // Non-fatal: leave selection as-is
  }
}
