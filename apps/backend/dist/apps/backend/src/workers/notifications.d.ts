/** Weekly digest emails are enqueued only by the weeklyDigest worker. This job only sends in-app weekly summary. */
export declare function runWeeklySummaryJob(): Promise<void>;
/** Notify job owners about deadlines in the next 24 hours. Run daily (e.g. cron). */
export declare function runDeadlineCheck(): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map