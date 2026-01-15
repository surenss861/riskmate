/**
 * Ledger Event Contracts
 *
 * This file defines the canonical event types and their required fields.
 * Every ledger event must conform to one of these contracts.
 *
 * This prevents drift and ensures audit-grade consistency.
 */
export type LedgerEventType = 'review.assigned' | 'review.resolved' | 'review.waived' | 'incident.corrective_action.created' | 'incident.closed' | 'attestation.created' | 'access.revoked' | 'security.suspicious_access.flagged' | 'security.incident.opened' | 'auth.role_violation' | 'policy.denied' | 'export.pack.generated' | 'export.ledger.pdf' | 'export.controls.csv' | 'export.attestations.csv' | 'job.created' | 'job.updated' | 'job.completed' | 'control.created' | 'control.updated' | 'control.verified' | 'evidence.uploaded' | 'evidence.deleted';
export type LedgerCategory = 'governance' | 'operations' | 'access' | 'review_queue' | 'incident_review' | 'attestations' | 'access_review' | 'system';
export type LedgerSeverity = 'info' | 'material' | 'critical';
export type LedgerOutcome = 'allowed' | 'blocked' | 'success' | 'failed';
export interface LedgerEventContract {
    event_type: LedgerEventType;
    category: LedgerCategory;
    severity: LedgerSeverity;
    outcome: LedgerOutcome;
    required_fields: {
        organization_id: true;
        actor_id: true;
        target_type: true;
        work_record_id?: boolean;
        site_id?: boolean;
        target_user_id?: boolean;
        control_id?: boolean;
        attestation_id?: boolean;
    };
    required_metadata: string[];
    optional_metadata?: string[];
    description: string;
}
/**
 * Event Contracts Registry
 *
 * Defines the canonical structure for each event type.
 * Used for validation, documentation, and type safety.
 */
export declare const LEDGER_EVENT_CONTRACTS: Record<LedgerEventType, LedgerEventContract>;
/**
 * Validate ledger event metadata against contract
 */
export declare function validateLedgerEvent(eventType: LedgerEventType, metadata: Record<string, any>): {
    valid: boolean;
    errors: string[];
};
/**
 * Get event contract for a given event type
 */
export declare function getEventContract(eventType: LedgerEventType): LedgerEventContract | null;
/**
 * Get all event types for a given category
 */
export declare function getEventsByCategory(category: LedgerCategory): LedgerEventType[];
//# sourceMappingURL=contracts.d.ts.map