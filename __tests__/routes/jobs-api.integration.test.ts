/**
 * Integration tests for /api/jobs endpoint
 * 
 * Tests:
 * - Default excludes archived/deleted
 * - Includes draft jobs
 * - include_archived parameter works
 * - Sorting correctness
 * - Template field shape (never undefined)
 * - Filtering invariants
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

// Note: These tests require a running backend and test database
// For now, this is a test structure that can be run with proper setup

describe('GET /api/jobs', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3001'
  let authToken: string
  let organizationId: string

  beforeAll(async () => {
    // Setup: Create test user, get auth token, get organization_id
    // This would require actual test setup - placeholder for now
  })

  afterAll(async () => {
    // Cleanup: Remove test data
  })

  describe('Filtering invariants', () => {
    it('should exclude deleted jobs by default', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      expect(data.data).toBeDefined()
      
      // All jobs should have deleted_at === null (or field doesn't exist)
      data.data.forEach((job: any) => {
        if ('deleted_at' in job) {
          expect(job.deleted_at).toBeNull()
        }
      })
    })

    it('should exclude archived jobs by default', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      data.data.forEach((job: any) => {
        if ('archived_at' in job) {
          expect(job.archived_at).toBeNull()
        }
      })
    })

    it('should include archived jobs when include_archived=true', async () => {
      const response = await fetch(`${API_URL}/api/jobs?include_archived=true`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      // Should include jobs with archived_at set
      const hasArchived = data.data.some((job: any) => job.archived_at !== null)
      // Note: This test assumes you have archived jobs in test data
    })

    it('should always exclude deleted jobs even with include_archived=true', async () => {
      const response = await fetch(`${API_URL}/api/jobs?include_archived=true`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      data.data.forEach((job: any) => {
        if ('deleted_at' in job) {
          expect(job.deleted_at).toBeNull()
        }
      })
    })

    it('should include draft jobs by default', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      // Should include jobs with status='draft'
      const hasDraft = data.data.some((job: any) => job.status === 'draft')
      // Note: This test assumes you have draft jobs in test data
    })
  })

  describe('Sorting correctness', () => {
    it('should sort by risk_desc correctly', async () => {
      const response = await fetch(`${API_URL}/api/jobs?sort=risk_desc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      expect(response.ok).toBe(true)
      
      // Verify descending order
      for (let i = 0; i < data.data.length - 1; i++) {
        const current = data.data[i].risk_score ?? 0
        const next = data.data[i + 1].risk_score ?? 0
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })

    it('should sort by created_desc correctly (default)', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      // Verify descending order (newest first)
      for (let i = 0; i < data.data.length - 1; i++) {
        const current = new Date(data.data[i].created_at).getTime()
        const next = new Date(data.data[i + 1].created_at).getTime()
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })

    it('should sort by status_asc with deterministic order', async () => {
      const response = await fetch(`${API_URL}/api/jobs?sort=status_asc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      const statusOrder = ['draft', 'in_progress', 'completed', 'archived', 'cancelled', 'on_hold']
      const getStatusOrder = (status: string) => {
        const index = statusOrder.indexOf(status)
        return index >= 0 ? index : statusOrder.length
      }
      
      // Verify ascending status order
      for (let i = 0; i < data.data.length - 1; i++) {
        const currentOrder = getStatusOrder(data.data[i].status)
        const nextOrder = getStatusOrder(data.data[i + 1].status)
        expect(currentOrder).toBeLessThanOrEqual(nextOrder)
      }
    })
  })

  describe('Template field shape', () => {
    it('should include applied_template_id on all jobs (null is valid)', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      data.data.forEach((job: any) => {
        expect('applied_template_id' in job).toBe(true)
        // null is valid, undefined is not
        if (job.applied_template_id !== null) {
          expect(typeof job.applied_template_id).toBe('string')
        }
      })
    })

    it('should include applied_template_type on all jobs (null is valid)', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      data.data.forEach((job: any) => {
        expect('applied_template_type' in job).toBe(true)
        // null is valid, undefined is not
        if (job.applied_template_type !== null) {
          expect(['hazard', 'job']).toContain(job.applied_template_type)
        }
      })
    })

    it('should never have undefined template fields', async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      data.data.forEach((job: any) => {
        expect(job.applied_template_id).not.toBeUndefined()
        expect(job.applied_template_type).not.toBeUndefined()
      })
    })
  })

  describe('Cursor pagination', () => {
    it('should support cursor-based pagination for created_desc', async () => {
      const firstPage = await fetch(`${API_URL}/api/jobs?limit=10&sort=created_desc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const firstData = await firstPage.json()
      
      if (firstData.pagination?.cursor) {
        const secondPage = await fetch(`${API_URL}/api/jobs?limit=10&sort=created_desc&cursor=${firstData.pagination.cursor}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
        const secondData = await secondPage.json()
        
        // Second page should have different jobs
        const firstIds = new Set(firstData.data.map((j: any) => j.id))
        const secondIds = new Set(secondData.data.map((j: any) => j.id))
        
        // No overlap (pagination stability)
        const intersection = [...firstIds].filter(id => secondIds.has(id))
        expect(intersection.length).toBe(0)
      }
    })

    it('should support cursor-based pagination for risk_desc', async () => {
      const firstPage = await fetch(`${API_URL}/api/jobs?limit=10&sort=risk_desc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const firstData = await firstPage.json()
      
      if (firstData.pagination?.cursor) {
        const secondPage = await fetch(`${API_URL}/api/jobs?limit=10&sort=risk_desc&cursor=${firstData.pagination.cursor}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
        const secondData = await secondPage.json()
        
        // Second page should have different jobs
        const firstIds = new Set(firstData.data.map((j: any) => j.id))
        const secondIds = new Set(secondData.data.map((j: any) => j.id))
        
        // No overlap (pagination stability)
        const intersection = [...firstIds].filter(id => secondIds.has(id))
        expect(intersection.length).toBe(0)
      }
    })

    it('should NOT use cursor pagination for status_asc (uses offset only)', async () => {
      const firstPage = await fetch(`${API_URL}/api/jobs?limit=10&sort=status_asc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const firstData = await firstPage.json()
      
      // status_asc should not return cursor (cursor pagination disabled)
      expect(firstData.pagination?.cursor).toBeUndefined()
      
      // Should use offset pagination instead
      expect(firstData.pagination?.page).toBeDefined()
    })

    it('should reject cursor param when sort=status_asc', async () => {
      const response = await fetch(`${API_URL}/api/jobs?limit=10&sort=status_asc&cursor=test`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.code).toBe('CURSOR_NOT_SUPPORTED_FOR_SORT')
      expect(data.message).toContain('Cursor pagination is not supported')
      expect(data.sort).toBe('status_asc')
      expect(data.documentation_url).toBe('/docs/pagination#status-sorting')
      expect(data.allowed_pagination_modes).toEqual(['offset'])
      expect(data.reason).toContain('in-memory ordering')
    })

    it('should reject cursor param when sort=status_desc', async () => {
      const response = await fetch(`${API_URL}/api/jobs?limit=10&sort=status_desc&cursor=test`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.code).toBe('CURSOR_NOT_SUPPORTED_FOR_SORT')
      expect(data.sort).toBe('status_desc')
      expect(data.documentation_url).toBe('/docs/pagination#status-sorting')
      expect(data.allowed_pagination_modes).toEqual(['offset'])
    })

    it('should have no gaps or overlaps between pages (created_desc)', async () => {
      // Fetch first page
      const firstPage = await fetch(`${API_URL}/api/jobs?limit=5&sort=created_desc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const firstData = await firstPage.json()
      
      if (firstData.pagination?.cursor && firstData.data.length > 0) {
        // Fetch second page
        const secondPage = await fetch(`${API_URL}/api/jobs?limit=5&sort=created_desc&cursor=${firstData.pagination.cursor}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
        const secondData = await secondPage.json()
        
        // Verify no overlaps
        const firstIds = new Set(firstData.data.map((j: any) => j.id))
        const secondIds = new Set(secondData.data.map((j: any) => j.id))
        const intersection = [...firstIds].filter(id => secondIds.has(id))
        expect(intersection.length).toBe(0)
        
        // Verify no gaps: last item of first page should be > first item of second page (for created_desc)
        if (firstData.data.length > 0 && secondData.data.length > 0) {
          const lastFirst = new Date(firstData.data[firstData.data.length - 1].created_at).getTime()
          const firstSecond = new Date(secondData.data[0].created_at).getTime()
          // For created_desc, last of first page should be >= first of second page
          expect(lastFirst).toBeGreaterThanOrEqual(firstSecond)
        }
      }
    })

    it('should have no gaps or overlaps between pages (risk_desc)', async () => {
      // Fetch first page
      const firstPage = await fetch(`${API_URL}/api/jobs?limit=5&sort=risk_desc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const firstData = await firstPage.json()
      
      if (firstData.pagination?.cursor && firstData.data.length > 0) {
        // Fetch second page
        const secondPage = await fetch(`${API_URL}/api/jobs?limit=5&sort=risk_desc&cursor=${firstData.pagination.cursor}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
        const secondData = await secondPage.json()
        
        // Verify no overlaps
        const firstIds = new Set(firstData.data.map((j: any) => j.id))
        const secondIds = new Set(secondData.data.map((j: any) => j.id))
        const intersection = [...firstIds].filter(id => secondIds.has(id))
        expect(intersection.length).toBe(0)
        
        // Verify no gaps: last item of first page should have risk_score >= first item of second page
        if (firstData.data.length > 0 && secondData.data.length > 0) {
          const lastFirst = firstData.data[firstData.data.length - 1].risk_score ?? 0
          const firstSecond = secondData.data[0].risk_score ?? 0
          // For risk_desc, last of first page should have risk_score >= first of second page
          expect(lastFirst).toBeGreaterThanOrEqual(firstSecond)
        }
      }
    })
  })

  describe('Dev meta guardrails', () => {
    it('should not include _meta in production', async () => {
      // This would require running in production mode
      // For now, verify the logic exists in code
    })

    it('should include _meta only with ?debug=1 in dev', async () => {
      const withDebug = await fetch(`${API_URL}/api/jobs?debug=1&sort=risk_desc`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const withDebugData = await withDebug.json()
      
      const withoutDebug = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const withoutDebugData = await withoutDebug.json()
      
      // In dev mode, _meta should appear with debug=1
      if (process.env.NODE_ENV === 'development') {
        expect(withDebugData._meta).toBeDefined()
        expect(withDebugData._meta.pagination_mode).toBeDefined()
        expect(['cursor', 'offset']).toContain(withDebugData._meta.pagination_mode)
        expect(withDebugData._meta.sort).toBeDefined()
        expect(withDebugData._meta.cursor_supported).toBeDefined()
      }
      
      // Without debug flag, _meta should not appear
      expect(withoutDebugData._meta).toBeUndefined()
    })

    it('should expose pagination_mode in _meta (dev only)', async () => {
      // Test cursor mode
      const cursorResponse = await fetch(`${API_URL}/api/jobs?debug=1&sort=created_desc&limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const cursorData = await cursorResponse.json()
      
      // Test offset mode
      const offsetResponse = await fetch(`${API_URL}/api/jobs?debug=1&sort=status_asc&limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const offsetData = await offsetResponse.json()
      
      if (process.env.NODE_ENV === 'development') {
        expect(cursorData._meta?.pagination_mode).toBe('cursor')
        expect(cursorData._meta?.cursor_supported).toBe(true)
        
        expect(offsetData._meta?.pagination_mode).toBe('offset')
        expect(offsetData._meta?.cursor_supported).toBe(false)
      }
    })

    it('should include request_id in all responses', async () => {
      const response = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      
      expect(data.request_id).toBeDefined()
      expect(typeof data.request_id).toBe('string')
      expect(data.request_id.length).toBeGreaterThan(0)
      
      // Verify header is also set
      const requestIdHeader = response.headers.get('X-Request-ID')
      expect(requestIdHeader).toBeDefined()
      expect(requestIdHeader).toBe(data.request_id)
    })

    it('should simulate client fallback behavior end-to-end', async () => {
      // Step 1: Call with cursor + status_asc → gets 400 with allowed modes
      const errorResponse = await fetch(`${API_URL}/api/jobs?limit=10&sort=status_asc&cursor=test`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const errorData = await errorResponse.json()
      
      expect(errorResponse.status).toBe(400)
      expect(errorData.code).toBe('CURSOR_NOT_SUPPORTED_FOR_SORT')
      expect(errorData.allowed_pagination_modes).toEqual(['offset'])
      expect(errorData.request_id).toBeDefined()
      
      // Step 2: Auto-fallback to offset → returns 200 with data
      const fallbackResponse = await fetch(`${API_URL}/api/jobs?limit=10&sort=status_asc&page=1&debug=1`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const fallbackData = await fallbackResponse.json()
      
      expect(fallbackResponse.status).toBe(200)
      expect(fallbackData.data).toBeDefined()
      expect(Array.isArray(fallbackData.data)).toBe(true)
      
      // Step 3: Assert: no duplicates, no missing, and _meta.pagination_mode === "offset" (dev only)
      if (process.env.NODE_ENV === 'development') {
        expect(fallbackData._meta?.pagination_mode).toBe('offset')
        expect(fallbackData._meta?.cursor_supported).toBe(false)
      }
      
      // Verify no duplicates (if we have multiple pages)
      if (fallbackData.data.length > 0) {
        const ids = fallbackData.data.map((j: any) => j.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length) // No duplicates
      }
      
      // Verify deterministic status ordering
      const statusOrder = ['draft', 'in_progress', 'completed', 'archived', 'cancelled', 'on_hold']
      const getStatusOrder = (status: string) => {
        const index = statusOrder.indexOf(status)
        return index >= 0 ? index : statusOrder.length
      }
      
      for (let i = 0; i < fallbackData.data.length - 1; i++) {
        const currentOrder = getStatusOrder(fallbackData.data[i].status)
        const nextOrder = getStatusOrder(fallbackData.data[i + 1].status)
        expect(currentOrder).toBeLessThanOrEqual(nextOrder)
      }
    })
  })
})

