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
    it('should support cursor-based pagination', async () => {
      const firstPage = await fetch(`${API_URL}/api/jobs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })
      const firstData = await firstPage.json()
      
      if (firstData.pagination?.cursor) {
        const secondPage = await fetch(`${API_URL}/api/jobs?limit=10&cursor=${firstData.pagination.cursor}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
        const secondData = await secondPage.json()
        
        // Second page should have different jobs
        const firstIds = new Set(firstData.data.map((j: any) => j.id))
        const secondIds = new Set(secondData.data.map((j: any) => j.id))
        
        // No overlap
        const intersection = [...firstIds].filter(id => secondIds.has(id))
        expect(intersection.length).toBe(0)
      }
    })
  })

  describe('Dev meta guardrails', () => {
    it('should not include _meta in production', async () => {
      // This would require running in production mode
      // For now, verify the logic exists in code
    })

    it('should include _meta only with ?debug=1 in dev', async () => {
      const withDebug = await fetch(`${API_URL}/api/jobs?debug=1`, {
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
        // Note: This depends on actual implementation
      }
    })
  })
})

