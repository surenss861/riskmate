/**
 * Shared Normalization Layer
 * Ensures consistent data transformation across all PDF generators
 */
interface FlexibleControlRow {
    control_id?: string;
    status_at_export?: string;
    severity?: string;
    due_date?: string;
    [key: string]: any;
}
interface FlexibleAttestationRow {
    attestation_id?: string;
    status_at_export?: string;
    attested_at?: string;
    [key: string]: any;
}
export declare function normalizeControlStatus(status: string | undefined | null): 'completed' | 'pending' | 'overdue';
export declare function normalizeAttestationStatus(status: string | undefined | null): 'completed' | 'pending';
export declare function isControlOverdue(status: string | undefined | null, dueDate: string | undefined | null): boolean;
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export declare function normalizeSeverity(severity: string | undefined | null): SeverityLevel;
export declare function isHighSeverity(severity: string | undefined | null): boolean;
export declare function compareSeverity(a: string | undefined | null, b: string | undefined | null): number;
export declare function formatDate(date: string | undefined | null, format?: 'short' | 'long' | 'iso'): string;
export declare function formatDateTime(date: string | undefined | null): string;
export declare function truncateText(text: string | undefined | null, maxLength: number): string;
/**
 * Hard-fail guard: throws if text contains forbidden characters
 * CRITICAL: Always runs in production for PDF exports - we cannot ship corrupted PDFs
 */
export declare function assertNoBadChars(text: string, context?: string): void;
/**
 * Bulletproof text sanitization using Unicode property escapes and noncharacter filtering
 * Removes all Control, Format, and Private-use characters, plus Unicode noncharacters
 */
export declare function sanitizeText(text: string | undefined | null): string;
/**
 * Safe text renderer: sanitizes and validates text before PDF rendering
 * Use this as the final step before any doc.text() call
 */
export declare function safeTextForPdf(text: string | undefined | null, context?: string): string;
export declare function sortControls(controls: FlexibleControlRow[]): FlexibleControlRow[];
export declare function sortAttestations(attestations: FlexibleAttestationRow[]): FlexibleAttestationRow[];
export declare function calculateControlKPIs(controls: FlexibleControlRow[]): {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    highSeverity: number;
};
export declare function calculateAttestationKPIs(attestations: FlexibleAttestationRow[]): {
    total: number;
    completed: number;
    pending: number;
};
export declare function countActiveFilters(filters: Record<string, any>): number;
export declare function formatFilterContext(filters: Record<string, any>): string;
export {};
//# sourceMappingURL=normalize.d.ts.map