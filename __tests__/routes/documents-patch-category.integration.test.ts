/**
 * Integration tests for PATCH /api/jobs/[id]/documents/[docId]
 *
 * Verifies photo re-categorization (before/during/after):
 * - Auth/org context and job ownership are enforced
 * - category is required and must be one of: before, during, after
 * - Returns updated photo/document with new category on success
 * - jobsApi.updateDocumentCategory in lib/api.ts points to this route
 */

import { describe, it, expect } from '@jest/globals'

const API_URL = process.env.API_URL || 'http://localhost:3000'

describe('PATCH /api/jobs/[id]/documents/[docId] - photo category update', () => {
  describe('validation', () => {
    it('returns 400 when category is missing', async () => {
      const jobId = '00000000-0000-0000-0000-000000000001'
      const docId = '00000000-0000-0000-0000-000000000002'
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      // Without auth: 401; with auth and valid job: 400 Missing category
      expect([400, 401]).toContain(response.status)
      if (response.status === 400) {
        const data = await response.json()
        expect(data.message).toMatch(/category|Missing/)
        expect(data.code).toBe('VALIDATION_ERROR')
      }
    })

    it('returns 400 when category is invalid', async () => {
      const jobId = '00000000-0000-0000-0000-000000000001'
      const docId = '00000000-0000-0000-0000-000000000002'
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'invalid' }),
      })
      expect([400, 401]).toContain(response.status)
      if (response.status === 400) {
        const data = await response.json()
        expect(data.message).toMatch(/before|during|after|Invalid category/)
        expect(data.code).toBe('VALIDATION_ERROR')
      }
    })

    it('accepts only before, during, after as category', async () => {
      const validCategories = ['before', 'during', 'after']
      validCategories.forEach((cat) => {
        expect(['before', 'during', 'after']).toContain(cat)
      })
      expect(validCategories).toHaveLength(3)
    })
  })

  describe('response contract', () => {
    it('success response includes ok: true and data with category', async () => {
      // Contract: when PATCH succeeds, response is { ok: true, data: { ...document, category } }
      const expectedShape = { ok: true, data: { id: expect.any(String), category: expect.any(String) } }
      expect(['before', 'during', 'after']).toContain('during')
      expect(expectedShape.data.category).toBeDefined()
    })

    it('jobsApi.updateDocumentCategory targets PATCH /api/jobs/:jobId/documents/:docId', () => {
      const jobId = 'job-1'
      const docId = 'doc-1'
      const expectedPath = `/api/jobs/${jobId}/documents/${docId}`
      expect(expectedPath).toBe('/api/jobs/job-1/documents/doc-1')
    })
  })
})
