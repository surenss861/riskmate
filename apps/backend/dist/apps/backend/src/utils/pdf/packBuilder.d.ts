/**
 * Pack Builder - Centralized logic for building proof pack data
 * Ensures all PDFs use the same source of truth
 */
import type { PackData, PackFilters } from './packContext';
/**
 * Build pack data from organization and filters
 * This is the single source of truth for all pack PDFs
 */
export declare function buildPackData(organizationId: string, userId: string, packId: string, filters: PackFilters, requestId: string): Promise<PackData>;
//# sourceMappingURL=packBuilder.d.ts.map