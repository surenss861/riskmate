/**
 * Unit tests for Before/After Photo Distinction (spec: bad0c55c-a7e3-4f0f-ae2c-9a5ac41c3c38)
 * - getDefaultPhotoCategory: auto-selection based on job status
 * - categorizePhotos: prioritizes explicit category, falls back to timestamp for legacy photos
 */

import { getDefaultPhotoCategory, getEffectivePhotoCategory } from '@/lib/utils/photoCategory'
import { categorizePhotos } from '@/lib/utils/pdf/utils'
import type { JobDocumentAsset } from '@/lib/utils/pdf/types'

describe('getDefaultPhotoCategory', () => {
  it('returns "before" when job status is draft', () => {
    expect(getDefaultPhotoCategory('draft')).toBe('before')
  })

  it('returns "during" when job status is in_progress', () => {
    expect(getDefaultPhotoCategory('in_progress')).toBe('during')
  })

  it('returns "after" when job status is completed', () => {
    expect(getDefaultPhotoCategory('completed')).toBe('after')
  })

  it('returns "after" when job status is archived', () => {
    expect(getDefaultPhotoCategory('archived')).toBe('after')
  })

  it('returns "during" for unknown status', () => {
    expect(getDefaultPhotoCategory('unknown')).toBe('during')
  })
})

describe('getEffectivePhotoCategory', () => {
  const jobStart = '2026-01-15T09:00:00Z'
  const jobEnd = '2026-01-15T17:00:00Z'

  it('returns explicit category when set', () => {
    expect(getEffectivePhotoCategory({ category: 'before' }, jobStart, jobEnd)).toBe('before')
    expect(getEffectivePhotoCategory({ category: 'during' }, jobStart, jobEnd)).toBe('during')
    expect(getEffectivePhotoCategory({ category: 'after' }, jobStart, jobEnd)).toBe('after')
  })

  it('falls back to timestamp: before job start', () => {
    expect(
      getEffectivePhotoCategory({ created_at: '2026-01-15T08:00:00Z' }, jobStart, jobEnd)
    ).toBe('before')
  })

  it('falls back to timestamp: during job', () => {
    expect(
      getEffectivePhotoCategory({ created_at: '2026-01-15T12:00:00Z' }, jobStart, jobEnd)
    ).toBe('during')
  })

  it('falls back to timestamp: after job end', () => {
    expect(
      getEffectivePhotoCategory({ created_at: '2026-01-15T18:00:00Z' }, jobStart, jobEnd)
    ).toBe('after')
  })

  it('returns during when no dates available', () => {
    expect(getEffectivePhotoCategory({})).toBe('during')
    expect(getEffectivePhotoCategory({ created_at: null })).toBe('during')
  })
})

describe('categorizePhotos', () => {
  const jobStart = '2026-01-15T09:00:00Z'
  const jobEnd = '2026-01-15T17:00:00Z'

  const mockPhoto = (overrides: Partial<JobDocumentAsset> = {}): JobDocumentAsset => ({
    name: 'photo.jpg',
    file_path: 'path/photo.jpg',
    buffer: Buffer.from(''),
    ...overrides,
  })

  it('prioritizes explicit category over timestamp', () => {
    const photos = [
      mockPhoto({ category: 'after', created_at: '2026-01-15T08:00:00Z' }),
      mockPhoto({ category: 'before', created_at: '2026-01-15T18:00:00Z' }),
    ]
    const { before, during, after } = categorizePhotos(photos, jobStart, jobEnd)
    expect(before).toHaveLength(1)
    expect(before[0].category).toBe('before')
    expect(after).toHaveLength(1)
    expect(after[0].category).toBe('after')
  })

  it('falls back to timestamp for legacy photos without category', () => {
    const photos = [
      mockPhoto({ created_at: '2026-01-15T08:00:00Z' }),
      mockPhoto({ created_at: '2026-01-15T12:00:00Z' }),
      mockPhoto({ created_at: '2026-01-15T18:00:00Z' }),
    ]
    const { before, during, after } = categorizePhotos(photos, jobStart, jobEnd)
    expect(before).toHaveLength(1)
    expect(during).toHaveLength(1)
    expect(after).toHaveLength(1)
  })

  it('defaults to during when job start date is missing', () => {
    const photos = [mockPhoto({ created_at: '2026-01-15T12:00:00Z' })]
    const { before, during, after } = categorizePhotos(photos, null, jobEnd)
    expect(before).toHaveLength(0)
    expect(during).toHaveLength(1)
    expect(after).toHaveLength(0)
  })
})
