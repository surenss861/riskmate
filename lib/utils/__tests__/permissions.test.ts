/**
 * Unit tests for permissions utilities
 */

import { hasJobsDeletePermission, hasPermission } from '../permissions'

describe('hasJobsDeletePermission', () => {
  it('should return true for owner', () => {
    expect(hasJobsDeletePermission('owner')).toBe(true)
  })

  it('should return false for admin', () => {
    expect(hasJobsDeletePermission('admin')).toBe(false)
  })

  it('should return false for member', () => {
    expect(hasJobsDeletePermission('member')).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(hasJobsDeletePermission(undefined)).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(hasJobsDeletePermission('')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('owner should have jobs.delete', () => {
    expect(hasPermission('owner', 'jobs.delete')).toBe(true)
  })

  it('admin should have jobs.delete (single-job delete; bulk delete remains owner-only)', () => {
    expect(hasPermission('admin', 'jobs.delete')).toBe(true)
  })
})
