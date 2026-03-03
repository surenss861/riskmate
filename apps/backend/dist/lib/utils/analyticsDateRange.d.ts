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
//# sourceMappingURL=analyticsDateRange.d.ts.map