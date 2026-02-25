import { type Router as ExpressRouter } from "express";
export declare const analyticsRouter: ExpressRouter;
/** Analytics observability: cache hit rates and entry count for metrics endpoint. */
export declare function getAnalyticsObservability(): {
    insights_cache: {
        hits: number;
        misses: number;
        hit_rate: number;
        entries: number;
    };
};
//# sourceMappingURL=analytics.d.ts.map