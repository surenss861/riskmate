/**
 * Structured Logging
 *
 * Consistent log format with org_id, user_id, job_id, export_id, evidence_id, ledger_seq, request_id
 * Makes debugging and support tickets trivial
 */
interface StructuredLogContext {
    org_id?: string;
    user_id?: string;
    job_id?: string;
    export_id?: string;
    evidence_id?: string;
    ledger_seq?: number;
    request_id?: string;
    [key: string]: any;
}
/**
 * Structured log helper
 */
export declare function logStructured(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: StructuredLogContext): void;
/**
 * Log with request context
 */
export declare function logWithRequest(level: 'info' | 'warn' | 'error' | 'debug', message: string, requestId: string | undefined, context?: Omit<StructuredLogContext, 'request_id'>): void;
export {};
//# sourceMappingURL=structuredLog.d.ts.map