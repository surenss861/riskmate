/**
 * Effective photo category for before/during/after.
 * Single source of truth for categorization used by PDF generators (lib + backend), EvidencePhotosSection, and upload defaults.
 */
export type PhotoCategory = 'before' | 'during' | 'after';
export interface PhotoForCategory {
    category?: PhotoCategory | null;
    created_at?: string | null;
}
/**
 * Returns the default photo category based on job status.
 * Used when uploading photos to pre-select the most likely category.
 */
export declare function getDefaultPhotoCategory(jobStatus: string): PhotoCategory;
/**
 * Returns the effective category for a photo. Uses explicit category when set;
 * when missing, derives before/during/after from created_at vs job start/end.
 * Only classifies as 'after' when a valid end date exists and photoTime > jobEnd.
 * When end date is missing, photos after start date remain in 'during'.
 * Defaults to 'during' when dates are unavailable.
 */
export declare function getEffectivePhotoCategory(photo: PhotoForCategory, jobStartDate?: string | null, jobEndDate?: string | null): PhotoCategory;
/**
 * Categorize photos into before/during/after for PDF sections and UI.
 * Honors explicit category first; when missing, compares timestamps to job start/end;
 * defaults to during when dates are unavailable.
 * Single exported helper consumed by lib PDF utils, backend PDF utils, and EvidencePhotosSection.
 */
export declare function categorizePhotos<T extends PhotoForCategory>(photos: T[], jobStartDate?: string | null, jobEndDate?: string | null): {
    before: T[];
    during: T[];
    after: T[];
};
//# sourceMappingURL=photoCategory.d.ts.map