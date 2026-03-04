/**
 * Shared date/period helpers for analytics routes (trends, risk-heatmap, team-performance).
 */
export declare const PERIOD_DAYS: {
    readonly '7d': 7;
    readonly '30d': 30;
    readonly '90d': 90;
    readonly '1y': 365;
};
export type PeriodKey = keyof typeof PERIOD_DAYS;
export declare function parsePeriod(value?: string | null): {
    days: number;
    key: PeriodKey;
};
export type ParseSinceUntilResult = {
    since: string;
    until: string;
} | {
    error: 'invalid_order';
} | {
    error: 'invalid_format';
} | {
    error: 'missing_bound';
} | null;
/** Type guard: true when the result is a valid date range (not null and not an error object). Use before accessing since/until. */
export declare function isSinceUntilRange(r: ParseSinceUntilResult): r is {
    since: string;
    until: string;
};
export declare function parseSinceUntil(sinceParam?: string | null, untilParam?: string | null): ParseSinceUntilResult;
/** Returns a date range in UTC: since at 00:00:00.000Z, until at 23:59:59.999Z. Safe across timezones. */
export declare function dateRangeForDays(days: number): {
    since: string;
    until: string;
};
/**
 * Derive effective span in days from explicit since/until (inclusive calendar-day span).
 * Normalizes both timestamps to UTC day boundaries; minimum 1 day when since <= until.
 * Used for period metadata and MV eligibility when callers send explicit range instead of period.
 */
export declare function effectiveDaysFromRange(since: string, until: string): number;
/**
 * Period label for response metadata: "1y" when span >= 365 days, otherwise "{days}d".
 */
export declare function periodLabelFromDays(days: number): string;
//# sourceMappingURL=analyticsDateRange.d.ts.map