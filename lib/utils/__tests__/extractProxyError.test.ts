/**
 * Unit tests for extractProxyError helper
 * 
 * Ensures consistent error extraction across all proxy responses.
 */

import { extractProxyError } from '../extractProxyError'

// Mock Response object helper
function createMockResponse(
  status: number,
  body: any,
  headers: Record<string, string> = {}
): Response {
  const headersObj = new Headers(headers)
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersObj,
    clone: () => createMockResponse(status, body, headers),
    text: async () => bodyStr,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  } as any as Response
}

describe('extractProxyError', () => {
  it('should extract error_id from JSON body', async () => {
    const response = createMockResponse(500, {
      error_id: 'test-error-id-123',
      code: 'TEST_ERROR',
      message: 'Test error message',
      support_hint: 'Test hint',
    })

    const result = await extractProxyError(response)

    expect(result.errorId).toBe('test-error-id-123')
    expect(result.code).toBe('TEST_ERROR')
    expect(result.message).toBe('Test error message')
    expect(result.hint).toBe('Test hint')
  })

  it('should extract error_id from X-Error-ID header when JSON lacks it', async () => {
    const response = createMockResponse(
      500,
      {
        code: 'TEST_ERROR',
        message: 'Test error message',
      },
      { 'X-Error-ID': 'header-error-id-456' }
    )

    const result = await extractProxyError(response)

    expect(result.errorId).toBe('header-error-id-456')
    expect(result.code).toBe('TEST_ERROR')
    expect(result.message).toBe('Test error message')
  })

  it('should prefer JSON error_id over header', async () => {
    const response = createMockResponse(
      500,
      {
        error_id: 'json-error-id-789',
        code: 'TEST_ERROR',
        message: 'Test error message',
      },
      { 'X-Error-ID': 'header-error-id-456' }
    )

    const result = await extractProxyError(response)

    expect(result.errorId).toBe('json-error-id-789') // JSON takes precedence
    expect(result.code).toBe('TEST_ERROR')
  })

  it('should handle HTML/plaintext body with X-Error-ID header', async () => {
    const htmlBody = '<html><body>Error 500: Internal Server Error</body></html>'
    const response = createMockResponse(
      500,
      htmlBody,
      { 'X-Error-ID': 'html-error-id-999', 'Content-Type': 'text/html' }
    )

    const result = await extractProxyError(response)

    expect(result.errorId).toBe('html-error-id-999')
    expect(result.message).toContain('Internal Server Error') // Should extract from HTML text
  })

  it('should handle non-JSON response without header', async () => {
    const plaintextBody = 'Connection refused'
    const response = createMockResponse(
      503,
      plaintextBody,
      { 'Content-Type': 'text/plain' }
    )

    const result = await extractProxyError(response)

    expect(result.errorId).toBeUndefined() // No header, no JSON error_id
    expect(result.message).toContain('Connection refused') // Should extract from text
  })

  it('should extract hint from support_hint field', async () => {
    const response = createMockResponse(500, {
      error_id: 'test-id',
      message: 'Error message',
      support_hint: 'Support hint text',
    })

    const result = await extractProxyError(response)

    expect(result.hint).toBe('Support hint text')
  })

  it('should extract hint from hint field', async () => {
    const response = createMockResponse(500, {
      error_id: 'test-id',
      message: 'Error message',
      hint: 'Hint text',
    })

    const result = await extractProxyError(response)

    expect(result.hint).toBe('Hint text')
  })

  it('should handle error object with nested error field', async () => {
    const response = createMockResponse(500, {
      error: {
        message: 'Nested error message',
        hint: 'Nested hint',
      },
    })

    const result = await extractProxyError(response)

    expect(result.message).toBe('Nested error message')
    expect(result.hint).toBe('Nested hint')
  })

  it('should return default message when JSON has no message field', async () => {
    const response = createMockResponse(500, {
      error_id: 'test-id',
      code: 'TEST_ERROR',
    })

    const result = await extractProxyError(response)

    expect(result.message).toBe('Request failed') // Default message
    expect(result.code).toBe('TEST_ERROR')
  })

  it('should handle x-error-id header (lowercase)', async () => {
    const response = createMockResponse(
      500,
      { message: 'Test error' },
      { 'x-error-id': 'lowercase-header-id' }
    )

    const result = await extractProxyError(response)

    expect(result.errorId).toBe('lowercase-header-id')
  })

  it('should extract errorId field (camelCase variant)', async () => {
    const response = createMockResponse(500, {
      errorId: 'camel-case-id',
      message: 'Test error',
    })

    const result = await extractProxyError(response)

    expect(result.errorId).toBe('camel-case-id')
  })
})

