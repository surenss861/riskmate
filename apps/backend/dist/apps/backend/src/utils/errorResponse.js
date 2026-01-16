"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORT_URLS = exports.SUPPORT_HINTS = exports.ERROR_CLASSIFICATIONS = exports.ERROR_CATEGORIES = void 0;
exports.createErrorResponse = createErrorResponse;
exports.logErrorForSupport = logErrorForSupport;
const crypto_1 = require("crypto");
/**
 * Error code categories for grouping and dashboards
 */
exports.ERROR_CATEGORIES = {
    PAGINATION: "pagination",
    ENTITLEMENTS: "entitlements",
    AUTH: "auth",
    VALIDATION: "validation",
    INTERNAL: "internal",
};
/**
 * Error classifications for compliance and triage
 */
exports.ERROR_CLASSIFICATIONS = {
    USER_ACTION_REQUIRED: "user_action_required", // User must take action (payment, upgrade, etc.)
    SYSTEM_TRANSIENT: "system_transient", // Temporary system issue (retryable)
    DEVELOPER_BUG: "developer_bug", // Client misconfiguration or bug
};
/**
 * Support hints for common error codes
 * Short, actionable guidance (documentation_url does the heavy lifting)
 * NOTE: All error codes must be registered here (even if hint is null)
 */
exports.SUPPORT_HINTS = {
    // Pagination errors
    PAGINATION_CURSOR_NOT_SUPPORTED: "Remove cursor param or switch to page-based pagination",
    // Entitlement errors
    ENTITLEMENTS_JOB_LIMIT_REACHED: "Upgrade plan or wait for monthly limit reset",
    ENTITLEMENTS_PLAN_PAST_DUE: "Update payment method in billing settings",
    ENTITLEMENTS_PLAN_INACTIVE: "Reactivate subscription or upgrade plan",
    ENTITLEMENTS_FEATURE_NOT_ALLOWED: "Upgrade plan to access this feature",
    // Auth errors
    AUTH_ROLE_FORBIDDEN: "This action requires owner role. Contact your organization owner",
    AUTH_UNAUTHORIZED: "Log in again and retry",
    AUTH_INVALID_TOKEN: "Log in again and retry",
    AUTH_INVALID_TOKEN_FORMAT: "Use a real session access token (JWT), not anon key/UUID",
    // CORS errors
    CORS_FORBIDDEN: "Request must come from riskmate.dev or www.riskmate.dev",
    // Backend config errors
    BACKEND_CONFIG_ERROR: "Server env vars missing/misconfigured (SUPABASE_URL / keys)",
    // Legacy codes (for backward compatibility during migration)
    CURSOR_NOT_SUPPORTED_FOR_SORT: "Remove cursor param or switch to page-based pagination",
    JOB_LIMIT_REACHED: "Upgrade plan or wait for monthly limit reset",
    PLAN_PAST_DUE: "Update payment method in billing settings",
    PLAN_INACTIVE: "Reactivate subscription or upgrade plan",
    ROLE_FORBIDDEN: "This action requires owner role. Contact your organization owner",
    FEATURE_NOT_ALLOWED: "Upgrade plan to access this feature",
};
/**
 * Support URLs (runbook links) for error codes
 * Points directly to the exact runbook section for that code
 * Procurement/security folks love "documented incident response"
 */
exports.SUPPORT_URLS = {
    // Pagination errors
    PAGINATION_CURSOR_NOT_SUPPORTED: "/support/runbooks/pagination#cursor-not-supported",
    // Entitlement errors
    ENTITLEMENTS_JOB_LIMIT_REACHED: "/support/runbooks/entitlements#job-limit-reached",
    ENTITLEMENTS_PLAN_PAST_DUE: "/support/runbooks/entitlements#plan-past-due",
    ENTITLEMENTS_PLAN_INACTIVE: "/support/runbooks/entitlements#plan-inactive",
    ENTITLEMENTS_FEATURE_NOT_ALLOWED: "/support/runbooks/entitlements#feature-not-allowed",
    // Auth errors
    AUTH_ROLE_FORBIDDEN: "/support/runbooks/auth#role-forbidden",
    AUTH_UNAUTHORIZED: "/support/runbooks/auth#unauthorized",
    AUTH_INVALID_TOKEN: "/support/runbooks/auth#invalid-token",
    AUTH_INVALID_TOKEN_FORMAT: "/support/runbooks/auth#invalid-token-format",
    // CORS errors
    CORS_FORBIDDEN: "/support/runbooks/cors#forbidden",
    // Backend config errors
    BACKEND_CONFIG_ERROR: "/support/runbooks/backend#config-error",
};
/**
 * Error code to classification mapping
 */
const ERROR_CLASSIFICATION_MAP = {
    // User action required
    ENTITLEMENTS_JOB_LIMIT_REACHED: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    ENTITLEMENTS_PLAN_PAST_DUE: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    ENTITLEMENTS_PLAN_INACTIVE: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    ENTITLEMENTS_FEATURE_NOT_ALLOWED: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    AUTH_ROLE_FORBIDDEN: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    AUTH_UNAUTHORIZED: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    AUTH_INVALID_TOKEN: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    AUTH_INVALID_TOKEN_FORMAT: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    JOB_LIMIT_REACHED: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    PLAN_PAST_DUE: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    PLAN_INACTIVE: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    ROLE_FORBIDDEN: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    FEATURE_NOT_ALLOWED: exports.ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
    // Developer bug (client misconfiguration)
    PAGINATION_CURSOR_NOT_SUPPORTED: exports.ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
    CURSOR_NOT_SUPPORTED_FOR_SORT: exports.ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
    CORS_FORBIDDEN: exports.ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
    BACKEND_CONFIG_ERROR: exports.ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
    // System transient (default for 5xx)
    INTERNAL_SERVER_ERROR: exports.ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
    UNKNOWN_ERROR: exports.ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
};
/**
 * Error code to category mapping
 */
const ERROR_CATEGORY_MAP = {
    // Pagination
    PAGINATION_CURSOR_NOT_SUPPORTED: exports.ERROR_CATEGORIES.PAGINATION,
    CURSOR_NOT_SUPPORTED_FOR_SORT: exports.ERROR_CATEGORIES.PAGINATION,
    // Entitlements
    ENTITLEMENTS_JOB_LIMIT_REACHED: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    ENTITLEMENTS_PLAN_PAST_DUE: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    ENTITLEMENTS_PLAN_INACTIVE: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    ENTITLEMENTS_FEATURE_NOT_ALLOWED: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    JOB_LIMIT_REACHED: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    PLAN_PAST_DUE: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    PLAN_INACTIVE: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    FEATURE_NOT_ALLOWED: exports.ERROR_CATEGORIES.ENTITLEMENTS,
    // Auth
    AUTH_ROLE_FORBIDDEN: exports.ERROR_CATEGORIES.AUTH,
    AUTH_UNAUTHORIZED: exports.ERROR_CATEGORIES.AUTH,
    AUTH_INVALID_TOKEN: exports.ERROR_CATEGORIES.AUTH,
    AUTH_INVALID_TOKEN_FORMAT: exports.ERROR_CATEGORIES.AUTH,
    ROLE_FORBIDDEN: exports.ERROR_CATEGORIES.AUTH,
    // Validation
    CORS_FORBIDDEN: exports.ERROR_CATEGORIES.VALIDATION,
    // Internal
    BACKEND_CONFIG_ERROR: exports.ERROR_CATEGORIES.INTERNAL,
};
/**
 * Error codes that are retryable (client can retry the request)
 * Generally: 5xx errors and rate-limited 4xx errors are retryable
 * 4xx client errors (validation, auth, entitlements) are NOT retryable
 */
const RETRYABLE_ERROR_CODES = new Set([
    "INTERNAL_SERVER_ERROR",
    "UNKNOWN_ERROR",
    // Rate-limited errors (if retry_after_seconds is provided, it's retryable)
]);
/**
 * Determine retry strategy based on status code, error code, and retry_after_seconds
 */
function getRetryStrategy(statusCode, code, hasRetryAfter) {
    // 5xx errors: exponential backoff (server errors)
    if (statusCode >= 500) {
        return { retryable: true, retry_strategy: "exponential_backoff" };
    }
    // Rate-limited errors with retry_after: wait for retry_after
    if (hasRetryAfter) {
        return { retryable: true, retry_strategy: "after_retry_after" };
    }
    // Explicitly marked retryable codes: immediate retry
    if (RETRYABLE_ERROR_CODES.has(code)) {
        return { retryable: true, retry_strategy: "immediate" };
    }
    // 4xx client errors: not retryable
    return { retryable: false, retry_strategy: "none" };
}
/**
 * Generate a formatted error response
 * Returns both the response object and errorId for header setting
 */
function createErrorResponse(options) {
    const { message, internalMessage, code, requestId, statusCode = 400, supportHint, severity, category, retry_after_seconds, ...additionalFields } = options;
    // Generate error_id (unique per error instance)
    const errorId = (0, crypto_1.randomUUID)();
    // Get support hint from map or use provided one
    const hint = supportHint !== undefined ? supportHint : exports.SUPPORT_HINTS[code];
    // Determine severity if not provided
    const errorSeverity = severity || (statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info");
    // Get category from map or use provided one
    const errorCategory = category || ERROR_CATEGORY_MAP[code] || exports.ERROR_CATEGORIES.INTERNAL;
    // Determine retry strategy
    const { retryable, retry_strategy } = getRetryStrategy(statusCode, code, retry_after_seconds !== undefined);
    // Get classification for compliance and triage
    const classification = ERROR_CLASSIFICATION_MAP[code] ||
        (statusCode >= 500 ? exports.ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT : exports.ERROR_CLASSIFICATIONS.DEVELOPER_BUG);
    // Get support URL (runbook link)
    const supportUrl = exports.SUPPORT_URLS[code];
    // Build response (user-safe message only in production)
    const response = {
        message, // Always user-safe
        code,
        error_id: errorId,
        request_id: requestId,
        severity: errorSeverity,
        category: errorCategory,
        classification,
        retryable,
        retry_strategy,
        error_hint: hint || null, // Always include hint field (null if none)
        ...(supportUrl && { support_url: supportUrl }),
        ...(retry_after_seconds !== undefined && { retry_after_seconds }),
        ...additionalFields,
    };
    // Include internal message only in development
    if (internalMessage && process.env.NODE_ENV === 'development') {
        response.internal_message = internalMessage;
    }
    return { response, errorId };
}
/**
 * Log error for support console (4xx/5xx)
 * Includes both user-safe message and internal message (if provided)
 * Also includes error budget metrics (route, org, status) for monitoring
 */
function logErrorForSupport(statusCode, code, requestId, organizationId, message, internalMessage, category, severity, route) {
    // Only log 4xx and 5xx
    if (statusCode >= 400) {
        const errorCategory = category || ERROR_CATEGORY_MAP[code] || exports.ERROR_CATEGORIES.INTERNAL;
        const errorSeverity = severity || (statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info");
        const logEntry = {
            level: errorSeverity,
            status: statusCode,
            code,
            category: errorCategory,
            request_id: requestId || "unknown",
            organization_id: organizationId || "unknown",
            message, // User-safe message
            timestamp: new Date().toISOString(),
        };
        // Include internal message in logs (always, for debugging)
        if (internalMessage) {
            logEntry.internal_message = internalMessage;
        }
        // Include route for error budget tracking (helps identify problematic endpoints)
        if (route) {
            logEntry.route = route;
        }
        // Error budget metric: track 5xx errors by route + org
        if (statusCode >= 500) {
            logEntry.error_budget = {
                route: route || "unknown",
                organization_id: organizationId || "unknown",
                status: statusCode,
            };
        }
        console.log(JSON.stringify(logEntry));
    }
}
//# sourceMappingURL=errorResponse.js.map