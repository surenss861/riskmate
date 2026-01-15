/**
 * Ledger Projections
 *
 * Precomputed views for fast UI queries.
 * These are disposable - if projections are wrong, rebuild from ledger.
 *
 * Ledger stays immutable; projections are just performance optimizations.
 */
export interface ReadinessProjection {
    organization_id: string;
    total_events: number;
    violations: number;
    jobs_touched: number;
    proof_packs: number;
    signoffs: number;
    access_changes: number;
    open_incidents: number;
    overdue_controls: number;
    missing_evidence: number;
    unsigned_items: number;
    last_updated: string;
}
export interface CategoryProjection {
    organization_id: string;
    category: string;
    event_count: number;
    last_event_at: string;
    last_updated: string;
}
/**
 * Compute readiness projection for an organization
 *
 * This aggregates ledger events to provide fast "audit readiness" metrics
 */
export declare function computeReadinessProjection(organizationId: string): Promise<ReadinessProjection | null>;
/**
 * Compute category projections for an organization
 */
export declare function computeCategoryProjections(organizationId: string): Promise<CategoryProjection[]>;
/**
 * Invalidate projections for an organization
 *
 * Called when material events occur (violations, flags, sign-offs, etc.)
 */
export declare function invalidateProjections(organizationId: string): Promise<void>;
//# sourceMappingURL=projections.d.ts.map