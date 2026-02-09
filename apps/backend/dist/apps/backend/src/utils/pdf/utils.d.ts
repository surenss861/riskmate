import type { JobDocumentAsset } from './types';
export declare function fetchLogoBuffer(logoUrl?: string | null): Promise<Buffer | null>;
export declare function formatDate(dateString?: string | null): string;
export declare function formatTime(dateString?: string | null): string;
export declare function formatShortDate(dateString?: string | null): string;
export declare function truncateText(text: string, maxLength: number): string;
export declare function getRiskColor(level: string | null): string;
export declare function getSeverityColor(severity: string): string;
export declare function categorizePhotos(photos: JobDocumentAsset[], jobStartDate?: string | null, jobEndDate?: string | null): {
    before: JobDocumentAsset[];
    during: JobDocumentAsset[];
    after: JobDocumentAsset[];
};
//# sourceMappingURL=utils.d.ts.map