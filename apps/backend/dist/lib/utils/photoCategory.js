"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultPhotoCategory = getDefaultPhotoCategory;
exports.getEffectivePhotoCategory = getEffectivePhotoCategory;
exports.categorizePhotos = categorizePhotos;
/**
 * Returns the default photo category based on job status.
 * Used when uploading photos to pre-select the most likely category.
 */
function getDefaultPhotoCategory(jobStatus) {
    if (jobStatus === 'draft')
        return 'before';
    if (jobStatus === 'completed' || jobStatus === 'archived')
        return 'after';
    return 'during';
}
/**
 * Returns the effective category for a photo. Uses explicit category when set;
 * when missing, derives before/during/after from created_at vs job start/end.
 * Only classifies as 'after' when a valid end date exists and photoTime > jobEnd.
 * When end date is missing, photos after start date remain in 'during'.
 * Defaults to 'during' when dates are unavailable.
 */
function getEffectivePhotoCategory(photo, jobStartDate, jobEndDate) {
    if (photo.category === 'before' || photo.category === 'during' || photo.category === 'after') {
        return photo.category;
    }
    const jobStart = jobStartDate ? new Date(jobStartDate).getTime() : NaN;
    const jobEnd = jobEndDate ? new Date(jobEndDate).getTime() : NaN;
    if (!Number.isFinite(jobStart) || !photo.created_at) {
        return 'during';
    }
    const photoTime = new Date(photo.created_at).getTime();
    if (photoTime < jobStart)
        return 'before';
    if (Number.isFinite(jobEnd) && photoTime > jobEnd)
        return 'after';
    return 'during';
}
/**
 * Categorize photos into before/during/after for PDF sections and UI.
 * Honors explicit category first; when missing, compares timestamps to job start/end;
 * defaults to during when dates are unavailable.
 * Single exported helper consumed by lib PDF utils, backend PDF utils, and EvidencePhotosSection.
 */
function categorizePhotos(photos, jobStartDate, jobEndDate) {
    const jobStart = jobStartDate ? new Date(jobStartDate).getTime() : NaN;
    const jobEnd = jobEndDate ? new Date(jobEndDate).getTime() : NaN;
    const before = [];
    const during = [];
    const after = [];
    photos.forEach((photo) => {
        if (photo.category === 'before' || photo.category === 'during' || photo.category === 'after') {
            if (photo.category === 'before')
                before.push(photo);
            else if (photo.category === 'during')
                during.push(photo);
            else
                after.push(photo);
            return;
        }
        if (!Number.isFinite(jobStart)) {
            during.push(photo);
            return;
        }
        if (!photo.created_at) {
            during.push(photo);
            return;
        }
        const photoTime = new Date(photo.created_at).getTime();
        if (photoTime < jobStart) {
            before.push(photo);
        }
        else if (Number.isFinite(jobEnd) && photoTime > jobEnd) {
            after.push(photo);
        }
        else {
            during.push(photo);
        }
    });
    return { before, during, after };
}
//# sourceMappingURL=photoCategory.js.map