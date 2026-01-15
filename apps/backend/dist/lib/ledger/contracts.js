"use strict";
/**
 * Ledger Event Contracts
 *
 * This file defines the canonical event types and their required fields.
 * Every ledger event must conform to one of these contracts.
 *
 * This prevents drift and ensures audit-grade consistency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEDGER_EVENT_CONTRACTS = void 0;
exports.validateLedgerEvent = validateLedgerEvent;
exports.getEventContract = getEventContract;
exports.getEventsByCategory = getEventsByCategory;
/**
 * Event Contracts Registry
 *
 * Defines the canonical structure for each event type.
 * Used for validation, documentation, and type safety.
 */
exports.LEDGER_EVENT_CONTRACTS = {
    // Review Queue Events
    'review.assigned': {
        event_type: 'review.assigned',
        category: 'review_queue',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: false,
        },
        required_metadata: ['owner_id', 'due_date'],
        optional_metadata: ['severity_override', 'note'],
        description: 'Review item assigned to an owner with due date',
    },
    'review.resolved': {
        event_type: 'review.resolved',
        category: 'review_queue',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['reason'],
        optional_metadata: ['comment', 'requires_followup'],
        description: 'Review item resolved with reason and optional comment',
    },
    'review.waived': {
        event_type: 'review.waived',
        category: 'review_queue',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['reason', 'waiver_reason'],
        optional_metadata: ['comment'],
        description: 'Review item waived with documented reason',
    },
    // Incident Review Events
    'incident.corrective_action.created': {
        event_type: 'incident.corrective_action.created',
        category: 'incident_review',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
            control_id: true,
        },
        required_metadata: ['title', 'owner_id', 'due_date', 'verification_method'],
        optional_metadata: ['incident_event_id', 'notes', 'severity'],
        description: 'Corrective action (control) created for an incident',
    },
    'incident.closed': {
        event_type: 'incident.closed',
        category: 'incident_review',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
            attestation_id: true,
        },
        required_metadata: ['closure_summary', 'root_cause'],
        optional_metadata: [
            'evidence_attached',
            'waived',
            'waiver_reason',
            'no_action_required',
            'no_action_justification',
            'corrective_action_count',
        ],
        description: 'Incident closed with summary, root cause, and attestation',
    },
    // Attestation Events
    'attestation.created': {
        event_type: 'attestation.created',
        category: 'attestations',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            attestation_id: true,
            work_record_id: true,
        },
        required_metadata: ['signer_user_id', 'signer_email', 'signer_role', 'statement'],
        optional_metadata: ['signoff_type'],
        description: 'Attestation created with signer info and statement',
    },
    // Access Review Events
    'access.revoked': {
        event_type: 'access.revoked',
        category: 'access_review',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            target_user_id: true,
        },
        required_metadata: ['action_type', 'reason'],
        optional_metadata: ['new_role', 'prior_role'],
        description: 'User access revoked (disabled, downgraded, or sessions revoked)',
    },
    'security.suspicious_access.flagged': {
        event_type: 'security.suspicious_access.flagged',
        category: 'access_review',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            target_user_id: true,
        },
        required_metadata: ['reason'],
        optional_metadata: ['notes', 'severity', 'login_event_id'],
        description: 'Suspicious access activity flagged for review',
    },
    'security.incident.opened': {
        event_type: 'security.incident.opened',
        category: 'incident_review',
        severity: 'critical',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            target_user_id: true,
        },
        required_metadata: ['reason'],
        optional_metadata: ['notes', 'severity', 'related_flag_ledger_id'],
        description: 'Security incident opened (typically from suspicious access flag)',
    },
    // Governance Enforcement Events
    'auth.role_violation': {
        event_type: 'auth.role_violation',
        category: 'governance',
        severity: 'critical',
        outcome: 'blocked',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['attempted_action', 'policy_statement'],
        optional_metadata: ['endpoint', 'target_id'],
        description: 'Role-based access control violation attempt (blocked and logged)',
    },
    'policy.denied': {
        event_type: 'policy.denied',
        category: 'governance',
        severity: 'material',
        outcome: 'blocked',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['policy_statement'],
        optional_metadata: ['attempted_action', 'reason'],
        description: 'Policy violation - action denied',
    },
    // Export Events
    'export.pack.generated': {
        event_type: 'export.pack.generated',
        category: 'system',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['pack_id', 'format', 'export_type'],
        optional_metadata: [
            'filters',
            'file_hashes',
            'counts',
            'generated_at',
            'generated_by',
            'generated_by_role',
            'generated_by_email',
        ],
        description: 'Audit pack (ZIP) generated with manifest and hashes',
    },
    'export.ledger.pdf': {
        event_type: 'export.ledger.pdf',
        category: 'system',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['export_id', 'filters'],
        optional_metadata: ['event_count', 'generated_at'],
        description: 'Compliance Ledger PDF export generated',
    },
    'export.controls.csv': {
        event_type: 'export.controls.csv',
        category: 'system',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['export_id', 'filters'],
        optional_metadata: ['control_count', 'generated_at'],
        description: 'Controls Report CSV export generated',
    },
    'export.attestations.csv': {
        event_type: 'export.attestations.csv',
        category: 'system',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
        },
        required_metadata: ['export_id', 'filters'],
        optional_metadata: ['attestation_count', 'generated_at'],
        description: 'Attestation Pack CSV export generated',
    },
    // Operational Events (from work records, controls, evidence)
    'job.created': {
        event_type: 'job.created',
        category: 'operations',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
        },
        required_metadata: [],
        optional_metadata: ['client_name', 'job_type', 'site_id', 'risk_score'],
        description: 'Work record (job) created',
    },
    'job.updated': {
        event_type: 'job.updated',
        category: 'operations',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
        },
        required_metadata: [],
        optional_metadata: ['changed_fields'],
        description: 'Work record (job) updated',
    },
    'job.completed': {
        event_type: 'job.completed',
        category: 'operations',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
        },
        required_metadata: [],
        optional_metadata: ['completion_summary'],
        description: 'Work record (job) marked as completed',
    },
    'control.created': {
        event_type: 'control.created',
        category: 'operations',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
            control_id: true,
        },
        required_metadata: ['title'],
        optional_metadata: ['owner_id', 'due_date', 'verification_method'],
        description: 'Control (mitigation item) created',
    },
    'control.updated': {
        event_type: 'control.updated',
        category: 'operations',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            control_id: true,
        },
        required_metadata: [],
        optional_metadata: ['changed_fields', 'status'],
        description: 'Control (mitigation item) updated',
    },
    'control.verified': {
        event_type: 'control.verified',
        category: 'operations',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            control_id: true,
        },
        required_metadata: ['verification_method'],
        optional_metadata: ['verified_by', 'verified_at'],
        description: 'Control verified as completed',
    },
    'evidence.uploaded': {
        event_type: 'evidence.uploaded',
        category: 'operations',
        severity: 'info',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
        },
        required_metadata: ['document_id', 'filename'],
        optional_metadata: ['file_size', 'mime_type'],
        description: 'Evidence document uploaded and linked to work record',
    },
    'evidence.deleted': {
        event_type: 'evidence.deleted',
        category: 'operations',
        severity: 'material',
        outcome: 'success',
        required_fields: {
            organization_id: true,
            actor_id: true,
            target_type: true,
            work_record_id: true,
        },
        required_metadata: ['document_id', 'reason'],
        optional_metadata: [],
        description: 'Evidence document deleted with reason',
    },
};
/**
 * Validate ledger event metadata against contract
 */
function validateLedgerEvent(eventType, metadata) {
    const contract = exports.LEDGER_EVENT_CONTRACTS[eventType];
    if (!contract) {
        return { valid: false, errors: [`Unknown event type: ${eventType}`] };
    }
    const errors = [];
    // Check required metadata fields
    for (const field of contract.required_metadata) {
        if (metadata[field] === undefined || metadata[field] === null) {
            errors.push(`Missing required metadata field: ${field}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Get event contract for a given event type
 */
function getEventContract(eventType) {
    return exports.LEDGER_EVENT_CONTRACTS[eventType] || null;
}
/**
 * Get all event types for a given category
 */
function getEventsByCategory(category) {
    return Object.entries(exports.LEDGER_EVENT_CONTRACTS)
        .filter(([_, contract]) => contract.category === category)
        .map(([eventType]) => eventType);
}
//# sourceMappingURL=contracts.js.map