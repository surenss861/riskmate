/**
 * Canary Validation Test
 * 
 * Ensures critical invariants are always maintained:
 * 1. Every endpoint returns X-Request-ID always
 * 2. Errors always have X-Error-ID header
 * 3. Errors always have error_id in body
 * 4. Errors always have retryable and retry_strategy
 * 
 * This is a "canary" test - if it fails, something fundamental broke.
 */

import { describe, it, expect } from '@jest/globals'

// Note: This test requires a running backend and test database
// For now, this is a test structure that can be run with proper setup

describe('Canary Validation: Header and Error Response Invariants', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3001'
  let authToken: string

  beforeAll(async () => {
    // Setup: Create test user, get auth token
    // This would require actual test setup - placeholder for now
  })

  describe('X-Request-ID header invariant', () => {
    it('should always return X-Request-ID header on success responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      expect(response.ok).toBe(true)
      
      const requestIdHeader = response.headers.get('X-Request-ID')
      expect(requestIdHeader).toBeDefined()
      expect(requestIdHeader).not.toBe('')
      
      const data = await response.json()
      expect(data.request_id).toBeDefined()
      expect(data.request_id).toBe(requestIdHeader)
    })

    it('should always return X-Request-ID header on error responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs/invalid-id-that-does-not-exist`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      expect(response.status).toBeGreaterThanOrEqual(400)
      
      const requestIdHeader = response.headers.get('X-Request-ID')
      expect(requestIdHeader).toBeDefined()
      expect(requestIdHeader).not.toBe('')
      
      const data = await response.json()
      expect(data.request_id).toBeDefined()
      expect(data.request_id).toBe(requestIdHeader)
    })

    it('should echo X-Request-ID if provided by client', async () => {
      const clientRequestId = 'client-provided-request-id-12345'
      
      const response = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Request-ID': clientRequestId,
        },
      })
      
      const requestIdHeader = response.headers.get('X-Request-ID')
      expect(requestIdHeader).toBe(clientRequestId)
      
      const data = await response.json()
      expect(data.request_id).toBe(clientRequestId)
    })
  })

  describe('X-Error-ID header invariant', () => {
    it('should always return X-Error-ID header on error responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs?sort=status_asc&cursor=invalid`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      expect(response.status).toBeGreaterThanOrEqual(400)
      
      const errorIdHeader = response.headers.get('X-Error-ID')
      expect(errorIdHeader).toBeDefined()
      expect(errorIdHeader).not.toBe('')
      
      const data = await response.json()
      expect(data.error_id).toBeDefined()
      expect(data.error_id).toBe(errorIdHeader)
    })

    it('should NOT return X-Error-ID header on success responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      expect(response.ok).toBe(true)
      
      const errorIdHeader = response.headers.get('X-Error-ID')
      expect(errorIdHeader).toBeNull()
    })
  })

  describe('Error response body invariants', () => {
    it('should always include error_id, retryable, and retry_strategy in error responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs?sort=status_asc&cursor=invalid`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      expect(response.status).toBeGreaterThanOrEqual(400)
      
      const data = await response.json()
      
      // Required fields
      expect(data.error_id).toBeDefined()
      expect(typeof data.error_id).toBe('string')
      expect(data.error_id.length).toBeGreaterThan(0)
      
      expect(data.request_id).toBeDefined()
      expect(typeof data.request_id).toBe('string')
      
      expect(data.retryable).toBeDefined()
      expect(typeof data.retryable).toBe('boolean')
      
      expect(data.retry_strategy).toBeDefined()
      expect(['none', 'immediate', 'exponential_backoff', 'after_retry_after']).toContain(data.retry_strategy)
      
      // Verify retryable matches retry_strategy
      if (data.retryable) {
        expect(data.retry_strategy).not.toBe('none')
      } else {
        expect(data.retry_strategy).toBe('none')
      }
    })

    it('should always include classification in error responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs?sort=status_asc&cursor=invalid`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      expect(response.status).toBeGreaterThanOrEqual(400)
      
      const data = await response.json()
      
      expect(data.classification).toBeDefined()
      expect(['user_action_required', 'system_transient', 'developer_bug']).toContain(data.classification)
    })
  })

  describe('W3C Trace Context propagation', () => {
    it('should echo traceparent header if provided', async () => {
      const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      
      const response = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'traceparent': traceParent,
        },
      })
      
      // Should echo both traceparent and X-Traceparent
      const traceParentHeader = response.headers.get('traceparent')
      const xTraceParentHeader = response.headers.get('X-Traceparent')
      
      expect(traceParentHeader).toBe(traceParent)
      expect(xTraceParentHeader).toBe(traceParent)
    })

    it('should not set traceparent headers if not provided', async () => {
      const response = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      
      const traceParentHeader = response.headers.get('traceparent')
      const xTraceParentHeader = response.headers.get('X-Traceparent')
      
      // Both should be null if not provided
      expect(traceParentHeader).toBeNull()
      expect(xTraceParentHeader).toBeNull()
    })
  })
})

