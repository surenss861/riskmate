/**
 * Category Mapper - Maps event categories to Compliance Ledger tabs
 * 
 * Handles both new canonical categories and old category values for backward compatibility.
 * 
 * Main Tabs:
 * - governance: Blocked actions, policy enforcement, violations
 * - operations: Human actions (assign/resolve/waive, corrective actions, incident closures, exports)
 * - access: Identity + permissions (access changes, logins, security events)
 * 
 * Sub-categories map to main tabs:
 * - review_queue, incident_review, attestations, system → operations
 * - access_review → access
 * - governance → governance
 */

export type CategoryTab = 'governance' | 'operations' | 'access'

export type EventCategory = 
  | 'governance' 
  | 'operations' 
  | 'access' 
  | 'review_queue' 
  | 'incident_review' 
  | 'attestations' 
  | 'system' 
  | 'access_review'
  // Legacy/old categories for backward compatibility
  | 'governance_enforcement'
  | 'operational_actions'
  | 'access_security'

/**
 * Map any category (including old/legacy values) to the main Compliance Ledger tab
 */
export function mapCategoryToTab(category: string | null | undefined, eventName?: string): CategoryTab {
  if (!category) {
    // Fallback: compute from event_name if category is missing
    return computeCategoryFromEventName(eventName || '')
  }

  const cat = category.toLowerCase()

  // Governance tab: blocked actions, policy enforcement, violations
  if (
    cat === 'governance' ||
    cat === 'governance_enforcement' ||
    cat === 'enforcement'
  ) {
    return 'governance'
  }

  // Access tab: identity + permissions
  if (
    cat === 'access' ||
    cat === 'access_review' ||
    cat === 'access_security' ||
    cat === 'security'
  ) {
    return 'access'
  }

  // Operations tab: human actions (default)
  // Includes: operations, review_queue, incident_review, attestations, system
  if (
    cat === 'operations' ||
    cat === 'operational_actions' ||
    cat === 'review_queue' ||
    cat === 'incident_review' ||
    cat === 'attestations' ||
    cat === 'system' ||
    cat === 'work' ||
    cat === 'job'
  ) {
    return 'operations'
  }

  // Fallback: compute from event_name
  return computeCategoryFromEventName(eventName || '')
}

/**
 * Compute category tab from event name (fallback when category is missing)
 */
function computeCategoryFromEventName(eventName: string): CategoryTab {
  const name = eventName.toLowerCase()

  // Governance Enforcement: blocked actions, policy enforcement, violations
  if (
    name.includes('auth.role_violation') ||
    name.includes('policy.denied') ||
    name.includes('rls.denied') ||
    name.includes('enforcement.blocked') ||
    name.includes('governance.enforcement') ||
    name.includes('violation')
  ) {
    return 'governance'
  }

  // Access & Security: identity + permissions changes
  if (
    name.includes('access.') ||
    name.includes('role.changed') ||
    name.includes('permission.') ||
    name.includes('login.') ||
    name.includes('session.terminated') ||
    name.includes('team.') ||
    name.includes('security.')
  ) {
    return 'access'
  }

  // Default to operations (human actions)
  return 'operations'
}

/**
 * Check if an event belongs to a specific tab (for filtering)
 */
export function eventBelongsToTab(
  category: string | null | undefined,
  eventName: string | null | undefined,
  tab: CategoryTab
): boolean {
  const computedTab = mapCategoryToTab(category, eventName || undefined)
  return computedTab === tab
}

