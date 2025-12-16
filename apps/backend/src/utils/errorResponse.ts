import { randomUUID } from "crypto";

/**
 * Error response utilities
 * Provides consistent error formatting with error_id, support_hint, and request_id
 */

export interface ErrorResponseOptions {
  message: string;
  code: string;
  requestId?: string;
  statusCode?: number;
  supportHint?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Support hints for common error codes
 * Short, actionable guidance (documentation_url does the heavy lifting)
 */
const SUPPORT_HINTS: Record<string, string> = {
  CURSOR_NOT_SUPPORTED_FOR_SORT: "Remove cursor param or switch to page-based pagination",
  JOB_LIMIT_REACHED: "Upgrade plan or wait for monthly limit reset",
  PLAN_PAST_DUE: "Update payment method in billing settings",
  PLAN_INACTIVE: "Reactivate subscription or upgrade plan",
  ROLE_FORBIDDEN: "This action requires owner role. Contact your organization owner",
  FEATURE_NOT_ALLOWED: "Upgrade plan to access this feature",
};

/**
 * Generate a formatted error response
 */
export function createErrorResponse(options: ErrorResponseOptions) {
  const {
    message,
    code,
    requestId,
    statusCode = 400,
    supportHint,
    ...additionalFields
  } = options;

  // Generate error_id (unique per error instance)
  const errorId = randomUUID();

  // Get support hint from map or use provided one
  const hint = supportHint || SUPPORT_HINTS[code];

  return {
    message,
    code,
    error_id: errorId,
    request_id: requestId,
    ...(hint && { support_hint: hint }),
    ...additionalFields,
  };
}

/**
 * Log error for support console (4xx/5xx)
 */
export function logErrorForSupport(
  statusCode: number,
  code: string,
  requestId: string | undefined,
  organizationId: string | undefined,
  message: string
) {
  // Only log 4xx and 5xx
  if (statusCode >= 400) {
    console.log(
      JSON.stringify({
        level: statusCode >= 500 ? "error" : "warn",
        status: statusCode,
        code,
        request_id: requestId || "unknown",
        organization_id: organizationId || "unknown",
        message,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

