import type { WeeklyDigestData } from '../emails/WeeklyDigestEmail';
export declare function buildDigestForUser(userId: string, organizationId: string): Promise<WeeklyDigestData>;
export declare function startWeeklyDigestWorker(): void;
export declare function stopWeeklyDigestWorker(): void;
//# sourceMappingURL=weeklyDigest.d.ts.map