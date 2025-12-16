import { randomUUID } from "crypto";

/**
 * Error response utilities
 * Provides consistent error formatting with error_id, support_hint, severity, category, and request_id
 */

export interface ErrorResponseOptions {
  message: string; // User-safe message (always shown)
  internalMessage?: string; // Internal-only message (dev mode or logs only)
  code: string;
  requestId?: string;
  statusCode?: number;
  supportHint?: string;
  severity?: "error" | "warn" | "info";
  category?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Error code categories for grouping and dashboards
 */
export const ERROR_CATEGORIES = {
  PAGINATION: "pagination",
  ENTITLEMENTS: "entitlements",
  AUTH: "auth",
  VALIDATION: "validation",
  INTERNAL: "internal",
} as const;

/**
 * Error classifications for compliance and triage
 */
export const ERROR_CLASSIFICATIONS = {
  USER_ACTION_REQUIRED: "user_action_required", // User must take action (payment, upgrade, etc.)
  SYSTEM_TRANSIENT: "system_transient", // Temporary system issue (retryable)
  DEVELOPER_BUG: "developer_bug", // Client misconfiguration or bug
} as const;

/**
 * Support hints for common error codes
 * Short, actionable guidance (documentation_url does the heavy lifting)
 * NOTE: All error codes must be registered here (even if hint is null)
 */
export const SUPPORT_HINTS: Record<string, string | null> = {
  // Pagination errors
  PAGINATION_CURSOR_NOT_SUPPORTED: "Remove cursor param or switch to page-based pagination",
  
  // Entitlement errors
  ENTITLEMENTS_JOB_LIMIT_REACHED: "Upgrade plan or wait for monthly limit reset",
  ENTITLEMENTS_PLAN_PAST_DUE: "Update payment method in billing settings",
  ENTITLEMENTS_PLAN_INACTIVE: "Reactivate subscription or upgrade plan",
  ENTITLEMENTS_FEATURE_NOT_ALLOWED: "Upgrade plan to access this feature",
  
  // Auth errors
  AUTH_ROLE_FORBIDDEN: "This action requires owner role. Contact your organization owner",
  
  // Legacy codes (for backward compatibility during migration)
  CURSOR_NOT_SUPPORTED_FOR_SORT: "Remove cursor param or switch to page-based pagination",
  JOB_LIMIT_REACHED: "Upgrade plan or wait for monthly limit reset",
  PLAN_PAST_DUE: "Update payment method in billing settings",
  PLAN_INACTIVE: "Reactivate subscription or upgrade plan",
  ROLE_FORBIDDEN: "This action requires owner role. Contact your organization owner",
  FEATURE_NOT_ALLOWED: "Upgrade plan to access this feature",
} as const;

/**
 * Support URLs (runbook links) for error codes
 * Points directly to the exact runbook section for that code
 * Procurement/security folks love "documented incident response"
 */
export const SUPPORT_URLS: Record<string, string> = {
  // Pagination errors
  PAGINATION_CURSOR_NOT_SUPPORTED: "/support/runbooks/pagination#cursor-not-supported",
  
  // Entitlement errors
  ENTITLEMENTS_JOB_LIMIT_REACHED: "/support/runbooks/entitlements#job-limit-reached",
  ENTITLEMENTS_PLAN_PAST_DUE: "/support/runbooks/entitlements#plan-past-due",
  ENTITLEMENTS_PLAN_INACTIVE: "/support/runbooks/entitlements#plan-inactive",
  ENTITLEMENTS_FEATURE_NOT_ALLOWED: "/support/runbooks/entitlements#feature-not-allowed",
  
  // Auth errors
  AUTH_ROLE_FORBIDDEN: "/support/runbooks/auth#role-forbidden",
} as const;

/**
 * Error code to classification mapping
 */
const ERROR_CLASSIFICATION_MAP: Record<string, string> = {
  // User action required
  ENTITLEMENTS_JOB_LIMIT_REACHED: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  ENTITLEMENTS_PLAN_PAST_DUE: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  ENTITLEMENTS_PLAN_INACTIVE: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  ENTITLEMENTS_FEATURE_NOT_ALLOWED: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  AUTH_ROLE_FORBIDDEN: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  JOB_LIMIT_REACHED: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  PLAN_PAST_DUE: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  PLAN_INACTIVE: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  ROLE_FORBIDDEN: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  FEATURE_NOT_ALLOWED: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  
  // Developer bug (client misconfiguration)
  PAGINATION_CURSOR_NOT_SUPPORTED: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  CURSOR_NOT_SUPPORTED_FOR_SORT: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  
  // System transient (default for 5xx)
  INTERNAL_SERVER_ERROR: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
  UNKNOWN_ERROR: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
} as const;

/**
 * Error code to category mapping
 */
const ERROR_CATEGORY_MAP: Record<string, string> = {
  // Pagination
  PAGINATION_CURSOR_NOT_SUPPORTED: ERROR_CATEGORIES.PAGINATION,
  CURSOR_NOT_SUPPORTED_FOR_SORT: ERROR_CATEGORIES.PAGINATION,
  
  // Entitlements
  ENTITLEMENTS_JOB_LIMIT_REACHED: ERROR_CATEGORIES.ENTITLEMENTS,
  ENTITLEMENTS_PLAN_PAST_DUE: ERROR_CATEGORIES.ENTITLEMENTS,
  ENTITLEMENTS_PLAN_INACTIVE: ERROR_CATEGORIES.ENTITLEMENTS,
  ENTITLEMENTS_FEATURE_NOT_ALLOWED: ERROR_CATEGORIES.ENTITLEMENTS,
  JOB_LIMIT_REACHED: ERROR_CATEGORIES.ENTITLEMENTS,
  PLAN_PAST_DUE: ERROR_CATEGORIES.ENTITLEMENTS,
  PLAN_INACTIVE: ERROR_CATEGORIES.ENTITLEMENTS,
  FEATURE_NOT_ALLOWED: ERROR_CATEGORIES.ENTITLEMENTS,
  
  // Auth
  AUTH_ROLE_FORBIDDEN: ERROR_CATEGORIES.AUTH,
  ROLE_FORBIDDEN: ERROR_CATEGORIES.AUTH,
} as const;

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
function getRetryStrategy(
  statusCode: number,
  code: string,
  hasRetryAfter?: boolean
): { retryable: boolean; retry_strategy: "none" | "immediate" | "exponential_backoff" | "after_retry_after" } {
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
export function createErrorResponse(options: ErrorResponseOptions): { response: any; errorId: string } {
  const {
    message,
    internalMessage,
    code,
    requestId,
    statusCode = 400,
    supportHint,
    severity,
    category,
    retry_after_seconds,
    ...additionalFields
  } = options;

  // Generate error_id (unique per error instance)
  const errorId = randomUUID();

  // Get support hint from map or use provided one
  const hint = supportHint !== undefined ? supportHint : SUPPORT_HINTS[code];

  // Determine severity if not provided
  const errorSeverity = severity || (statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info");

  // Get category from map or use provided one
  const errorCategory = category || ERROR_CATEGORY_MAP[code] || ERROR_CATEGORIES.INTERNAL;

  // Determine retry strategy
  const { retryable, retry_strategy } = getRetryStrategy(statusCode, code, retry_after_seconds !== undefined);

  // Get classification for compliance and triage
  const classification = ERROR_CLASSIFICATION_MAP[code] || 
    (statusCode >= 500 ? ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT : ERROR_CLASSIFICATIONS.DEVELOPER_BUG);

  // Get support URL (runbook link)
  const supportUrl = SUPPORT_URLS[code];

  // Build response (user-safe message only in production)
  const response: any = {
    message, // Always user-safe
    code,
    error_id: errorId,
    request_id: requestId,
    severity: errorSeverity,
    category: errorCategory,
    classification,
    retryable,
    retry_strategy,
    ...(hint && { support_hint: hint }),
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
export function logErrorForSupport(
  statusCode: number,
  code: string,
  requestId: string | undefined,
  organizationId: string | undefined,
  message: string,
  internalMessage?: string,
  category?: string,
  severity?: "error" | "warn" | "info",
  route?: string
) {
  // Only log 4xx and 5xx
  if (statusCode >= 400) {
    const errorCategory = category || ERROR_CATEGORY_MAP[code] || ERROR_CATEGORIES.INTERNAL;
    const errorSeverity = severity || (statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info");
    
    const logEntry: any = {
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

