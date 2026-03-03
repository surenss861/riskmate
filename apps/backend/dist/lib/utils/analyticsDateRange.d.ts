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
export declare function parseSinceUntil(sinceParam?: string | null, untilParam?: string | null): {
    since: string;
    until: string;
} | null;
export declare function dateRangeForDays(days: number): {
    since: string;
    until: string;
};
/**
 * Derive effective span in days from explicit since/until (covers full calendar days in range).
 * Used for period metadata and MV eligibility when callers send explicit range instead of period.
 */
export declare function effectiveDaysFromRange(since: string, until: string): number;
/**
 * Period label for response metadata: "1y" when span >= 365 days, otherwise "{days}d".
 */
export declare function periodLabelFromDays(days: number): string;
//# sourceMappingURL=analyticsDateRange.d.ts.map