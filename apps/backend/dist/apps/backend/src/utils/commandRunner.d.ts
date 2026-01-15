/**
 * Command Runner - Ledger-First Command Model
 *
 * Every command follows: Validate → Authorize → Mutate → Ledger Append (atomic)
 *
 * This ensures:
 * - Domain changes and ledger entries succeed/fail together
 * - Idempotency via idempotency keys
 * - Consistent request_id correlation
 * - Standardized error handling
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { AuditLogEntry } from '../middleware/audit';
export interface CommandContext {
    userId: string;
    organizationId: string;
    userRole: string;
    userEmail?: string | null;
    requestId: string;
    endpoint: string;
    ip?: string | null;
    userAgent?: string | null;
}
export interface CommandOptions {
    idempotencyKey?: string;
    skipLedger?: boolean;
}
export interface CommandResult<T = any> {
    ok: boolean;
    data?: T;
    ledger_entry_id?: string;
    error?: {
        code: string;
        message: string;
        internalMessage?: string;
    };
}
/**
 * Run a command with atomic ledger appending
 *
 * @param supabase - Supabase client (with service role for transactions)
 * @param ctx - Command context (user, org, request metadata)
 * @param options - Command options (idempotency key, etc.)
 * @param commandFn - The command function that performs domain mutations
 * @param auditEntry - The audit log entry to append (must be provided)
 *
 * @returns CommandResult with ledger_entry_id
 */
export declare function runCommand<T = any>(supabase: SupabaseClient, ctx: CommandContext, options: CommandOptions, commandFn: (tx: SupabaseClient) => Promise<T>, auditEntry: Omit<AuditLogEntry, 'organizationId' | 'actorId' | 'metadata'> & {
    metadata?: any;
}): Promise<CommandResult<T>>;
/**
 * Build audit filters from query parameters
 * Used by views, exports, and readiness endpoints for consistency
 * Returns a function that applies filters to a Supabase query builder
 */
export declare const VALID_AUDIT_CATEGORIES: readonly ["governance", "operations", "access", "review_queue", "incident_review", "attestations", "access_review", "system"];
export type AuditCategory = typeof VALID_AUDIT_CATEGORIES[number];
export declare const VALID_TIME_RANGES: readonly ["24h", "7d", "30d", "all", "custom"];
export type TimeRange = typeof VALID_TIME_RANGES[number];
export declare const VALID_SAVED_VIEWS: readonly ["review-queue", "insurance-ready", "governance-enforcement", "incident-review", "access-review"];
export type SavedView = typeof VALID_SAVED_VIEWS[number];
export interface AuditFilters {
    category?: AuditCategory;
    site_id?: string;
    job_id?: string;
    actor_id?: string;
    severity?: 'info' | 'material' | 'critical';
    outcome?: 'allowed' | 'blocked' | 'success' | 'failed';
    time_range?: TimeRange;
    start_date?: string;
    end_date?: string;
    view?: SavedView;
    event_type?: string;
    organizationId: string;
}
/**
 * Validation error for invalid filter parameters
 */
export declare class FilterValidationError extends Error {
    field: string;
    allowedValues?: readonly string[] | undefined;
    constructor(message: string, field: string, allowedValues?: readonly string[] | undefined);
}
/**
 * Apply audit filters to a Supabase query builder
 * This ensures views, exports, and readiness endpoints use the same filter logic
 *
 * @throws {FilterValidationError} If invalid filter values are provided (returns 400)
 */
export declare function applyAuditFilters<T extends {
    eq: any;
    gte: any;
    lte: any;
    in: any;
    or: any;
    like: any;
}>(query: T, filters: AuditFilters): T;
//# sourceMappingURL=commandRunner.d.ts.map