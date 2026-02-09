/**
 * Effective photo category for before/during/after.
 * Matches the fallback used in categorizePhotos (lib/utils/pdf/utils.ts):
 * honor explicit category, otherwise compare created_at to job start/end.
 */
export type PhotoCategory = 'before' | 'during' | 'after'

export interface PhotoForCategory {
  category?: PhotoCategory | null
  created_at?: string | null
}

/**
 * Returns the effective category for a photo. Uses explicit category when set;
 * when missing, derives before/during/after from created_at vs job start/end.
 * Only classifies as 'after' when a valid end date exists and photoTime > jobEnd.
 * When end date is missing, photos after start date remain in 'during'.
 * Defaults to 'during' when dates are unavailable.
 */
/**
 * Returns the default photo category based on job status.
 * Used when uploading photos to pre-select the most likely category.
 */
export function getDefaultPhotoCategory(jobStatus: string): PhotoCategory {
  if (jobStatus === 'draft') return 'before'
  if (jobStatus === 'completed' || jobStatus === 'archived') return 'after'
  return 'during'
}

export function getEffectivePhotoCategory(
  photo: PhotoForCategory,
  jobStartDate?: string | null,
  jobEndDate?: string | null
): PhotoCategory {
  if (photo.category === 'before' || photo.category === 'during' || photo.category === 'after') {
    return photo.category
  }
  const jobStart = jobStartDate ? new Date(jobStartDate).getTime() : NaN
  const jobEnd = jobEndDate ? new Date(jobEndDate).getTime() : NaN
  if (!Number.isFinite(jobStart) || !photo.created_at) {
    return 'during'
  }
  const photoTime = new Date(photo.created_at).getTime()
  if (photoTime < jobStart) return 'before'
  if (Number.isFinite(jobEnd) && photoTime > jobEnd) return 'after'
  return 'during'
}
