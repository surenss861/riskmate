/**
 * Selected organization context for multi-membership users.
 * When users.organization_id is null and the user has multiple organization_members rows,
 * the backend requires an explicit selector (X-Organization-Id header or organization_id query).
 * This module stores the frontend's selected org and is used by lib/api.ts and proxy routes.
 */

const STORAGE_KEY = 'riskmate_selected_org_id'

/**
 * Get the currently selected organization ID (for multi-org users).
 * Returns null on server or when none is set.
 */
export function getSelectedOrganizationId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Set the selected organization ID. Call after login/entitlements when the user
 * has multiple memberships or when they switch organization.
 */
export function setSelectedOrganizationId(organizationId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (organizationId == null) {
      sessionStorage.removeItem(STORAGE_KEY)
    } else {
      sessionStorage.setItem(STORAGE_KEY, organizationId)
    }
  } catch {
    // Ignore storage errors
  }
}
