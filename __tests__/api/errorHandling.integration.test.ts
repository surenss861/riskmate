/**
 * Integration tests for enhanced error response format
 *
 * Tests error response shape and headers when API routes return errors.
 * These tests can run against a local server or mock the route handlers.
 *
 * Expected behavior:
 * - 4xx errors return retry_strategy: "none"
 * - 5xx errors return retry_strategy: "exponential_backoff"
 * - 429 errors return retry_strategy: "after_retry_after"
 * - All errors include X-Error-ID header
 * - All errors include X-Request-ID header
 */

import { createErrorResponse } from '@/lib/utils/apiResponse'

describe('Error Response Format Integration', () => {
  describe('createErrorResponse return shape', () => {
    it('4xx errors should have retry_strategy "none"', () => {
      const { response } = createErrorResponse('Bad request', 'VALIDATION_ERROR', {
        requestId: 'test-req-1',
        statusCode: 400,
      })

      expect(response.retry_strategy).toBe('none')
      expect(response.retryable).toBe(false)
    })

    it('5xx errors should have retry_strategy "exponential_backoff"', () => {
      const { response } = createErrorResponse('Server error', 'QUERY_ERROR', {
        requestId: 'test-req-1',
        statusCode: 500,
      })

      expect(response.retry_strategy).toBe('exponential_backoff')
      expect(response.retryable).toBe(true)
    })

    it('429 errors with retry_after should have retry_strategy "after_retry_after"', () => {
      const { response } = createErrorResponse('Rate limited', 'RATE_LIMIT_EXCEEDED', {
        requestId: 'test-req-1',
        statusCode: 429,
        retry_after_seconds: 120,
      })

      expect(response.retry_strategy).toBe('after_retry_after')
      expect(response.retryable).toBe(true)
      expect(response.retry_after_seconds).toBe(120)
    })

    it('all error responses should include error_id', () => {
      const { response } = createErrorResponse('Test', 'INTERNAL_ERROR', {
        statusCode: 500,
      })

      expect(response.error_id).toBeDefined()
      expect(typeof response.error_id).toBe('string')
      expect((response.error_id ?? '').length).toBe(36) // UUID format
    })

    it('error responses should include request_id when provided', () => {
      const { response } = createErrorResponse('Test', 'UNAUTHORIZED', {
        requestId: 'req-abc-123',
        statusCode: 401,
      })

      expect(response.request_id).toBe('req-abc-123')
      expect(response.requestId).toBe('req-abc-123')
    })
  })

  describe('Structured logging format', () => {
    it('error response should have fields needed for logApiError', () => {
      const { response, errorId } = createErrorResponse('Test error', 'EXPORT_ERROR', {
        requestId: 'req-1',
        statusCode: 500,
      })

      // These are the fields logApiError expects
      expect(errorId).toBeDefined()
      expect(response.message).toBeDefined()
      expect(response.code).toBe('EXPORT_ERROR')
      expect(response.severity).toBe('error')
      expect(response.category).toBeDefined()
    })

    it('5xx errors should have error_budget-compatible structure', () => {
      const { response } = createErrorResponse('DB error', 'QUERY_ERROR', {
        requestId: 'req-1',
        statusCode: 500,
      })

      expect(response.severity).toBe('error')
      expect(response.retryable).toBe(true)
    })
  })
})
