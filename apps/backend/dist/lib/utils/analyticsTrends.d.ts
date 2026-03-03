/**
 * Shared analytics trends computation helpers (period/date bucketing, pagination).
 * Used by app/api/analytics/trends/route.ts and apps/backend/src/routes/analytics.ts
 * to keep MV bucketing and fallback logic in sync.
 */
export declare const PAGE_SIZE = 500;
export declare const MV_COVERAGE_DAYS = 730;
export declare function calendarYearBounds(): {
    since: string;
    until: string;
};
export declare function weekStart(d: Date): string;
export declare function monthStart(d: Date): string;
export declare function toDateKey(value: string): string;
export declare function fetchAllPages<T>(fetchPage: (offset: number, limit: number) => Promise<{
    data: T[] | null;
    error: unknown;
}>): Promise<{
    data: T[];
    error: unknown;
}>;
//# sourceMappingURL=analyticsTrends.d.ts.map