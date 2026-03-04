"use strict";
/**
 * Shared analytics trends computation helpers (period/date bucketing, pagination).
 * Used by app/api/analytics/trends/route.ts and apps/backend/src/routes/analytics.ts
 * to keep MV bucketing and fallback logic in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MV_COVERAGE_DAYS = exports.PAGE_SIZE = void 0;
exports.calendarYearBounds = calendarYearBounds;
exports.weekStart = weekStart;
exports.monthStart = monthStart;
exports.toDateKey = toDateKey;
exports.fetchAllPages = fetchAllPages;
exports.PAGE_SIZE = 500;
exports.MV_COVERAGE_DAYS = 730;
function calendarYearBounds() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const since = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const until = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { since: since.toISOString(), until: until.toISOString() };
}
function weekStart(d) {
    const x = new Date(d);
    const day = x.getUTCDay();
    const diff = x.getUTCDate() - day + (day === 0 ? -6 : 1);
    x.setUTCDate(diff);
    x.setUTCHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
}
function monthStart(d) {
    const x = new Date(d);
    x.setUTCDate(1);
    x.setUTCHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
}
function toDateKey(value) {
    return value.slice(0, 10);
}
async function fetchAllPages(fetchPage) {
    const out = [];
    let offset = 0;
    let hasMore = true;
    let lastError = null;
    while (hasMore) {
        const { data, error } = await fetchPage(offset, exports.PAGE_SIZE);
        if (error)
            return { data: out, error };
        lastError = error;
        const chunkData = data ?? [];
        out.push(...chunkData);
        hasMore = chunkData.length === exports.PAGE_SIZE;
        offset += chunkData.length;
    }
    return { data: out, error: lastError };
}
//# sourceMappingURL=analyticsTrends.js.map