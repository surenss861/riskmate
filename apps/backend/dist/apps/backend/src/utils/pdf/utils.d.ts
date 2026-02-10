import { categorizePhotos as categorizePhotosFromCategory } from '../../../../../lib/utils/photoCategory';
export declare function fetchLogoBuffer(logoUrl?: string | null): Promise<Buffer | null>;
export declare function formatDate(dateString?: string | null): string;
export declare function formatTime(dateString?: string | null): string;
export declare function formatShortDate(dateString?: string | null): string;
export declare function truncateText(text: string, maxLength: number): string;
export declare function getRiskColor(level: string | null): string;
export declare function getSeverityColor(severity: string): string;
/** Re-export from shared photoCategory for backend PDF consumers. */
export declare const categorizePhotos: typeof categorizePhotosFromCategory;
//# sourceMappingURL=utils.d.ts.map