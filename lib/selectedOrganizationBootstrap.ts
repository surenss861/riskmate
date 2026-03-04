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

export type BootstrapResult = { ok: true } | { ok: false; error?: unknown }

/**
 * Run selected-organization bootstrap: call after session is established.
 * - Single membership: set selected org to that org.
 * - Multi membership: keep current selection only if it's in memberships; otherwise clear.
 * Uses GET /api/me/context (Next.js route with cookie/Bearer auth).
 * Returns success/failure so the caller can decide retry behavior; does not swallow failures.
 */
export async function runSelectedOrganizationBootstrap(token: string | null): Promise<BootstrapResult> {
  if (typeof window === 'undefined' || !token) {
    return { ok: true }
  }
  try {
    const res = await fetch('/api/me/context', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) {
      return { ok: false, error: new Error(`context returned ${res.status}`) }
    }
    const data = (await res.json()) as OrgContextResponse
    const memberships = data.memberships ?? []
    if (memberships.length === 0) {
      setSelectedOrganizationId(null)
      return { ok: true }
    }
    if (memberships.length === 1) {
      setSelectedOrganizationId(memberships[0].id)
      return { ok: true }
    }
    const current = getSelectedOrganizationId()
    const validIds = new Set(memberships.map((m) => m.id))
    if (current && validIds.has(current)) return { ok: true }
    setSelectedOrganizationId(null)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err }
  }
}
