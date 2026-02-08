/**
 * Error code registry with enhanced metadata.
 * Provides hints, support URLs, categories, and classifications for consistent error handling.
 */

export const ERROR_CATEGORIES = {
  AUTH: 'auth',
  VALIDATION: 'validation',
  ENTITLEMENTS: 'entitlements',
  INTERNAL: 'internal',
  PAGINATION: 'pagination',
} as const

export const ERROR_CLASSIFICATIONS = {
  USER_ACTION_REQUIRED: 'user_action_required',
  DEVELOPER_BUG: 'developer_bug',
  SYSTEM_TRANSIENT: 'system_transient',
} as const

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES]
export type ErrorClassification =
  (typeof ERROR_CLASSIFICATIONS)[keyof typeof ERROR_CLASSIFICATIONS]
export type ErrorCode = keyof typeof ERROR_CODE_REGISTRY

export interface ErrorCodeMetadata {
  hint: string | null
  supportUrl?: string
  category: ErrorCategory
  classification: ErrorClassification
}

export const ERROR_CODE_REGISTRY: Record<string, ErrorCodeMetadata> = {
  // Auth errors
  UNAUTHORIZED: {
    hint: 'Log in again and retry',
    supportUrl: '/support/runbooks/auth#unauthorized',
    category: ERROR_CATEGORIES.AUTH,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },
  AUTH_INVALID_TOKEN: {
    hint: 'Log in again and retry',
    supportUrl: '/support/runbooks/auth#invalid-token',
    category: ERROR_CATEGORIES.AUTH,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },
  AUTH_ROLE_FORBIDDEN: {
    hint: 'This action requires owner role. Contact your organization owner',
    supportUrl: '/support/runbooks/auth#role-forbidden',
    category: ERROR_CATEGORIES.AUTH,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },
  FORBIDDEN: {
    hint: 'You do not have permission to perform this action',
    supportUrl: '/support/runbooks/auth#forbidden',
    category: ERROR_CATEGORIES.AUTH,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },

  // Validation errors
  VALIDATION_ERROR: {
    hint: 'Check request parameters and retry',
    supportUrl: '/support/runbooks/validation#validation-error',
    category: ERROR_CATEGORIES.VALIDATION,
    classification: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  },
  MISSING_REQUIRED_FIELD: {
    hint: 'Provide all required fields and retry',
    supportUrl: '/support/runbooks/validation#missing-field',
    category: ERROR_CATEGORIES.VALIDATION,
    classification: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  },
  INVALID_FORMAT: {
    hint: 'Check field format and allowed values',
    supportUrl: '/support/runbooks/validation#invalid-format',
    category: ERROR_CATEGORIES.VALIDATION,
    classification: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  },

  // Database errors
  QUERY_ERROR: {
    hint: 'Retry the request. If the problem persists, contact support.',
    supportUrl: '/support/runbooks/database#query-error',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
  },
  RLS_RECURSION_ERROR: {
    hint: 'Database policy configuration issue. Contact support with error ID.',
    supportUrl: '/support/runbooks/database#rls-recursion',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  },
  CONNECTION_ERROR: {
    hint: 'Database connection failed. Retry the request.',
    supportUrl: '/support/runbooks/database#connection',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
  },

  // Rate limit errors
  RATE_LIMIT_EXCEEDED: {
    hint: 'Wait for the rate limit to reset or upgrade your plan.',
    supportUrl: '/support/runbooks/rate-limits#exceeded',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },

  // Export errors
  EXPORT_ERROR: {
    hint: 'Retry the export. If the problem persists, contact support.',
    supportUrl: '/support/runbooks/export#export-error',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
  },
  PDF_GENERATION_ERROR: {
    hint: 'Retry generating the PDF. If the problem persists, contact support.',
    supportUrl: '/support/runbooks/export#pdf-generation',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
  },

  // Not found
  NOT_FOUND: {
    hint: null,
    supportUrl: '/support/runbooks/resources#not-found',
    category: ERROR_CATEGORIES.VALIDATION,
    classification: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  },

  // Entitlement errors
  ENTITLEMENTS_JOB_LIMIT_REACHED: {
    hint: 'Upgrade plan or wait for monthly limit reset',
    supportUrl: '/support/runbooks/entitlements#job-limit-reached',
    category: ERROR_CATEGORIES.ENTITLEMENTS,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },
  ENTITLEMENTS_PLAN_PAST_DUE: {
    hint: 'Update payment method in billing settings',
    supportUrl: '/support/runbooks/entitlements#plan-past-due',
    category: ERROR_CATEGORIES.ENTITLEMENTS,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },
  ENTITLEMENTS_PLAN_INACTIVE: {
    hint: 'Reactivate subscription or upgrade plan',
    supportUrl: '/support/runbooks/entitlements#plan-inactive',
    category: ERROR_CATEGORIES.ENTITLEMENTS,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },
  ENTITLEMENTS_FEATURE_NOT_ALLOWED: {
    hint: 'Upgrade plan to access this feature',
    supportUrl: '/support/runbooks/entitlements#feature-not-allowed',
    category: ERROR_CATEGORIES.ENTITLEMENTS,
    classification: ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED,
  },

  // Pagination errors
  PAGINATION_CURSOR_NOT_SUPPORTED: {
    hint: 'Remove cursor param or switch to page-based pagination',
    supportUrl: '/support/runbooks/pagination#cursor-not-supported',
    category: ERROR_CATEGORIES.PAGINATION,
    classification: ERROR_CLASSIFICATIONS.DEVELOPER_BUG,
  },

  // Internal
  INTERNAL_ERROR: {
    hint: 'Retry the request. If the problem persists, contact support with the error ID.',
    supportUrl: '/support/runbooks/internal#error',
    category: ERROR_CATEGORIES.INTERNAL,
    classification: ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT,
  },
}
