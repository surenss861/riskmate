/**
 * Time-of-day window check using server local time.
 * Used so digest/reminder workers only run in the intended morning window (e.g. 08:00–08:10),
 * avoiding off-hour email blasts on restart.
 */
export declare function isWithinTimeWindow(now: Date, startHour: number, startMinute: number, durationMinutes: number): boolean;
//# sourceMappingURL=timeWindow.d.ts.map