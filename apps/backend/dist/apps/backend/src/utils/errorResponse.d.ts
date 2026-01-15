/**
 * Error response utilities
 * Provides consistent error formatting with error_id, support_hint, severity, category, and request_id
 */
export interface ErrorResponseOptions {
    message: string;
    internalMessage?: string;
    code: string;
    requestId?: string;
    statusCode?: number;
    supportHint?: string;
    severity?: "error" | "warn" | "info";
    category?: string;
    retry_after_seconds?: number;
    [key: string]: any;
}
/**
 * Error code categories for grouping and dashboards
 */
export declare const ERROR_CATEGORIES: {
    readonly PAGINATION: "pagination";
    readonly ENTITLEMENTS: "entitlements";
    readonly AUTH: "auth";
    readonly VALIDATION: "validation";
    readonly INTERNAL: "internal";
};
/**
 * Error classifications for compliance and triage
 */
export declare const ERROR_CLASSIFICATIONS: {
    readonly USER_ACTION_REQUIRED: "user_action_required";
    readonly SYSTEM_TRANSIENT: "system_transient";
    readonly DEVELOPER_BUG: "developer_bug";
};
/**
 * Support hints for common error codes
 * Short, actionable guidance (documentation_url does the heavy lifting)
 * NOTE: All error codes must be registered here (even if hint is null)
 */
export declare const SUPPORT_HINTS: Record<string, string | null>;
/**
 * Support URLs (runbook links) for error codes
 * Points directly to the exact runbook section for that code
 * Procurement/security folks love "documented incident response"
 */
export declare const SUPPORT_URLS: Record<string, string>;
/**
 * Generate a formatted error response
 * Returns both the response object and errorId for header setting
 */
export declare function createErrorResponse(options: ErrorResponseOptions): {
    response: any;
    errorId: string;
};
/**
 * Log error for support console (4xx/5xx)
 * Includes both user-safe message and internal message (if provided)
 * Also includes error budget metrics (route, org, status) for monitoring
 */
export declare function logErrorForSupport(statusCode: number, code: string, requestId: string | undefined, organizationId: string | undefined, message: string, internalMessage?: string, category?: string, severity?: "error" | "warn" | "info", route?: string): void;
//# sourceMappingURL=errorResponse.d.ts.map