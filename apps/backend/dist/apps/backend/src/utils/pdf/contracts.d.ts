/**
 * Formal PDF Generation Contracts
 * Defines inputs, business rules, and outputs for each proof pack PDF
 */
import type { LedgerEvent, ControlRow, AttestationRow, PackFilters } from './packContext';
export interface LedgerExportInput {
    ledgerEvents: LedgerEvent[];
    filters: PackFilters;
    packMetadata: {
        packId: string;
        organizationName: string;
        generatedBy: string;
        generatedByRole: string;
        generatedAt: string;
        timeRange: string;
    };
}
export interface LedgerExportKPIs {
    totalEvents: number;
    displayed: number;
    activeFilters: number;
    hashVerified: boolean;
}
export interface LedgerExportContract {
    inputs: LedgerExportInput;
    rules: {
        sorting: 'newest-first';
        kpiFormulas: {
            totalEvents: (events: LedgerEvent[]) => number;
            displayed: (events: LedgerEvent[]) => number;
            activeFilters: (filters: PackFilters) => number;
            hashVerified: () => boolean;
        };
        tableColumns: readonly ['Timestamp', 'Event', 'Category', 'Outcome', 'Severity', 'Actor', 'Role', 'Target'];
        evidenceHandling: {
            embedGatedEvidence: false;
            includeWorkRecordIds: true;
            includeInstructions: true;
        };
    };
    outputs: {
        sections: readonly ['header', 'kpi-row', 'event-table', 'evidence-reference-note'];
        requiredFields: readonly ['timestamp', 'event_name', 'category', 'outcome', 'severity', 'actor_name', 'actor_role', 'target_type'];
    };
}
export interface ControlsInput {
    controls: ControlRow[];
    filters: PackFilters;
    packMetadata: {
        packId: string;
        organizationName: string;
        generatedBy: string;
        generatedByRole: string;
        generatedAt: string;
        timeRange: string;
    };
}
export interface ControlsKPIs {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    highSeverity: number;
}
export interface ControlsContract {
    inputs: ControlsInput;
    rules: {
        statusNormalization: {
            completed: (status: string) => boolean;
            pending: (status: string) => boolean;
            overdue: (status: string, dueDate?: string) => boolean;
        };
        kpiFormulas: {
            total: (controls: ControlRow[]) => number;
            completed: (controls: ControlRow[]) => number;
            pending: (controls: ControlRow[]) => number;
            overdue: (controls: ControlRow[]) => number;
            highSeverity: (controls: ControlRow[]) => number;
        };
        sorting: {
            priority: readonly ['overdue', 'high-severity', 'due-date-asc'];
            compare: (a: ControlRow, b: ControlRow) => number;
        };
        tableColumns: readonly ['Control ID', 'Title', 'Status', 'Severity', 'Owner', 'Due Date', 'Last Updated'];
        emptyState: {
            required: true;
            includeFilterContext: true;
            includeActionHint: true;
        };
    };
    outputs: {
        sections: readonly ['header', 'kpi-row', 'controls-table', 'empty-state'];
        requiredFields: readonly ['control_id', 'title', 'status_at_export', 'severity', 'owner_email', 'due_date', 'updated_at'];
    };
}
export interface AttestationsInput {
    attestations: AttestationRow[];
    filters: PackFilters;
    packMetadata: {
        packId: string;
        organizationName: string;
        generatedBy: string;
        generatedByRole: string;
        generatedAt: string;
        timeRange: string;
    };
}
export interface AttestationsKPIs {
    total: number;
    completed: number;
    pending: number;
}
export interface AttestationsContract {
    inputs: AttestationsInput;
    rules: {
        statusNormalization: {
            completed: (status: string) => boolean;
            pending: (status: string) => boolean;
        };
        kpiFormulas: {
            total: (attestations: AttestationRow[]) => number;
            completed: (attestations: AttestationRow[]) => number;
            pending: (attestations: AttestationRow[]) => number;
        };
        sorting: {
            priority: readonly ['pending-first', 'most-recent-completed'];
            compare: (a: AttestationRow, b: AttestationRow) => number;
        };
        tableColumns: readonly ['Attestation ID', 'Title', 'Status', 'Attested By', 'Attested At'];
        emptyState: {
            required: true;
            includeFilterContext: true;
            includeActionHint: true;
        };
    };
    outputs: {
        sections: readonly ['header', 'kpi-row', 'attestations-table', 'empty-state'];
        requiredFields: readonly ['attestation_id', 'title', 'status_at_export', 'attested_by_email', 'attested_at'];
    };
}
export interface EvidenceIndexInput {
    payloadFiles: Array<{
        name: string;
        sha256: string;
        bytes: number;
    }>;
    packMetadata: {
        packId: string;
        organizationName: string;
        generatedBy: string;
        generatedByRole: string;
        generatedAt: string;
        timeRange: string;
    };
    filters: PackFilters;
    counts: {
        ledger_events: number;
        controls: number;
        attestations: number;
    };
}
export interface EvidenceIndexContract {
    inputs: EvidenceIndexInput;
    rules: {
        totalPdfCount: (payloadCount: number) => number;
        integrityVerification: {
            hashPayloadPdfs: true;
            hashIndexPdf: false;
        };
        sections: readonly [
            'header',
            'kpi-row',
            'contents-summary',
            'payload-files-table',
            'index-pdf-listing',
            'full-hashes-appendix',
            'applied-filters'
        ];
    };
    outputs: {
        requiredFields: readonly ['packId', 'totalPdfCount', 'payloadFileCount', 'hashes'];
        alwaysGenerate: true;
    };
}
export declare function validateLedgerExportInput(input: LedgerExportInput): {
    valid: boolean;
    errors: string[];
};
export declare function validateControlsInput(input: ControlsInput): {
    valid: boolean;
    errors: string[];
};
export declare function validateAttestationsInput(input: AttestationsInput): {
    valid: boolean;
    errors: string[];
};
export declare function validateEvidenceIndexInput(input: EvidenceIndexInput): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=contracts.d.ts.map