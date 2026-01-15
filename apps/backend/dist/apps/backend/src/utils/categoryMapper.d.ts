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
export type CategoryTab = 'governance' | 'operations' | 'access';
export type EventCategory = 'governance' | 'operations' | 'access' | 'review_queue' | 'incident_review' | 'attestations' | 'system' | 'access_review' | 'governance_enforcement' | 'operational_actions' | 'access_security';
/**
 * Map any category (including old/legacy values) to the main Compliance Ledger tab
 */
export declare function mapCategoryToTab(category: string | null | undefined, eventName?: string): CategoryTab;
/**
 * Check if an event belongs to a specific tab (for filtering)
 */
export declare function eventBelongsToTab(category: string | null | undefined, eventName: string | null | undefined, tab: CategoryTab): boolean;
//# sourceMappingURL=categoryMapper.d.ts.map