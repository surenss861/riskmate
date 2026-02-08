/**
 * Unit tests for enhanced error handling utilities
 *
 * Tests:
 * - createErrorResponse generates unique error_id
 * - Retry strategy determination for different status codes
 * - Error hints and support URLs from registry
 * - Category and classification mapping
 * - Backward compatibility (existing fields present)
 * - Error code registry completeness
 */

import { createErrorResponse } from '@/lib/utils/apiResponse'
import {
  ERROR_CODE_REGISTRY,
  ERROR_CATEGORIES,
  ERROR_CLASSIFICATIONS,
} from '@/lib/utils/errorCodes'
import { ApiError } from '@/lib/utils/apiErrors'

describe('createErrorResponse', () => {
  it('should generate unique error_id for each call', () => {
    const { response: r1 } = createErrorResponse('msg1', 'UNAUTHORIZED', {
      requestId: 'req-1',
      statusCode: 401,
    })
    const { response: r2 } = createErrorResponse('msg2', 'UNAUTHORIZED', {
      requestId: 'req-2',
      statusCode: 401,
    })

    expect(r1.error_id).toBeDefined()
    expect(r2.error_id).toBeDefined()
    expect(r1.error_id).not.toBe(r2.error_id)
    expect(typeof r1.error_id).toBe('string')
    expect((r1.error_id ?? '').length).toBeGreaterThan(0)
  })

  it('should return both response and errorId', () => {
    const result = createErrorResponse('test', 'VALIDATION_ERROR', {
      requestId: 'req-1',
      statusCode: 400,
    })

    expect(result).toHaveProperty('response')
    expect(result).toHaveProperty('errorId')
    expect(result.errorId).toBe(result.response.error_id)
  })

  it('should set retry_strategy to exponential_backoff for 5xx errors', () => {
    const { response } = createErrorResponse('Server error', 'QUERY_ERROR', {
      requestId: 'req-1',
      statusCode: 500,
    })

    expect(response.retryable).toBe(true)
    expect(response.retry_strategy).toBe('exponential_backoff')
  })

  it('should set retry_strategy to after_retry_after for 429 with retry_after_seconds', () => {
    const { response } = createErrorResponse('Rate limited', 'RATE_LIMIT_EXCEEDED', {
      requestId: 'req-1',
      statusCode: 429,
      retry_after_seconds: 60,
    })

    expect(response.retryable).toBe(true)
    expect(response.retry_strategy).toBe('after_retry_after')
    expect(response.retry_after_seconds).toBe(60)
  })

  it('should set retry_strategy to none for 4xx errors', () => {
    const { response } = createErrorResponse('Bad request', 'VALIDATION_ERROR', {
      requestId: 'req-1',
      statusCode: 400,
    })

    expect(response.retryable).toBe(false)
    expect(response.retry_strategy).toBe('none')
  })

  it('should include error_hint from registry', () => {
    const { response } = createErrorResponse('Unauthorized', 'UNAUTHORIZED', {
      requestId: 'req-1',
      statusCode: 401,
    })

    expect(response.error_hint).toBe(ERROR_CODE_REGISTRY.UNAUTHORIZED.hint)
    expect(response.error_hint).toBeTruthy()
  })

  it('should include support_url when available in registry', () => {
    const { response } = createErrorResponse('Unauthorized', 'UNAUTHORIZED', {
      requestId: 'req-1',
      statusCode: 401,
    })

    expect(response.support_url).toBeDefined()
    expect(response.support_url).toContain('/support/')
  })

  it('should include category and classification from registry', () => {
    const { response } = createErrorResponse('Unauthorized', 'UNAUTHORIZED', {
      requestId: 'req-1',
      statusCode: 401,
    })

    expect(response.category).toBe(ERROR_CATEGORIES.AUTH)
    expect(response.classification).toBe(ERROR_CLASSIFICATIONS.USER_ACTION_REQUIRED)
  })

  it('should set severity based on status code', () => {
    const { response: r400 } = createErrorResponse('Bad', 'VALIDATION_ERROR', {
      statusCode: 400,
    })
    const { response: r500 } = createErrorResponse('Server', 'QUERY_ERROR', {
      statusCode: 500,
    })

    expect(r400.severity).toBe('warn')
    expect(r500.severity).toBe('error')
  })

  it('should maintain backward compatibility with ok, message, code, requestId, details', () => {
    const { response } = createErrorResponse('Test message', 'NOT_FOUND', {
      requestId: 'req-123',
      statusCode: 404,
      details: { resource: 'job' },
    })

    expect(response.ok).toBe(false)
    expect(response.message).toBe('Test message')
    expect(response.code).toBe('NOT_FOUND')
    expect(response.requestId).toBe('req-123')
    expect(response.request_id).toBe('req-123')
    expect(response.details).toEqual({ resource: 'job' })
  })
})

describe('ERROR_CODE_REGISTRY', () => {
  const requiredCodes = [
    'UNAUTHORIZED',
    'AUTH_INVALID_TOKEN',
    'AUTH_ROLE_FORBIDDEN',
    'VALIDATION_ERROR',
    'MISSING_REQUIRED_FIELD',
    'INVALID_FORMAT',
    'QUERY_ERROR',
    'RLS_RECURSION_ERROR',
    'CONNECTION_ERROR',
    'RATE_LIMIT_EXCEEDED',
    'EXPORT_ERROR',
    'PDF_GENERATION_ERROR',
  ]

  requiredCodes.forEach((code) => {
    it(`should have ${code} with hint, category, and classification`, () => {
      const entry = ERROR_CODE_REGISTRY[code]
      expect(entry).toBeDefined()
      expect(entry).toHaveProperty('hint')
      expect(typeof entry.category).toBe('string')
      expect(typeof entry.classification).toBe('string')
      expect(Object.values(ERROR_CATEGORIES)).toContain(entry.category)
      expect(Object.values(ERROR_CLASSIFICATIONS)).toContain(entry.classification)
    })
  })
})

describe('ApiError', () => {
  it('should include X-Error-ID header in toNextResponse', () => {
    const apiError = new ApiError('UNAUTHORIZED', {
      message: 'Unauthorized',
      statusCode: 401,
    })
    const response = apiError.toNextResponse('req-123')

    expect(response.headers.get('X-Error-ID')).toBeTruthy()
    expect(response.headers.get('X-Error-ID')?.length).toBeGreaterThan(0)
    expect(response.headers.get('X-Request-ID')).toBe('req-123')
  })

  it('toJson should return enhanced response with error_id', () => {
    const apiError = new ApiError('VALIDATION_ERROR', {
      message: 'Invalid input',
      statusCode: 400,
    })
    const json = apiError.toJson()

    expect(json.ok).toBe(false)
    expect(json.message).toBe('Invalid input')
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.error_id).toBeDefined()
    expect(json.retry_strategy).toBe('none')
  })
})
