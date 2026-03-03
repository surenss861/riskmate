"use strict";
/**
 * Shared date/period helpers for analytics routes (trends, risk-heatmap, team-performance).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERIOD_DAYS = void 0;
exports.parsePeriod = parsePeriod;
exports.parseSinceUntil = parseSinceUntil;
exports.dateRangeForDays = dateRangeForDays;
exports.effectiveDaysFromRange = effectiveDaysFromRange;
exports.periodLabelFromDays = periodLabelFromDays;
exports.PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
function parsePeriod(value) {
    const str = value ? String(value).trim() : '30d';
    const key = (str === '7d' || str === '30d' || str === '90d' || str === '1y' ? str : '30d');
    return { days: exports.PERIOD_DAYS[key], key };
}
function parseSinceUntil(sinceParam, untilParam) {
    const since = sinceParam?.trim() ?? '';
    const until = untilParam?.trim() ?? '';
    if (!since || !until)
        return null;
    const sinceDate = new Date(since);
    const untilDate = new Date(until);
    if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime()))
        return null;
    return { since: sinceDate.toISOString(), until: untilDate.toISOString() };
}
function dateRangeForDays(days) {
    const until = new Date();
    until.setHours(23, 59, 59, 999);
    const since = new Date(until.getTime());
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);
    return { since: since.toISOString(), until: until.toISOString() };
}
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/**
 * Derive effective span in days from explicit since/until (covers full calendar days in range).
 * Used for period metadata and MV eligibility when callers send explicit range instead of period.
 */
function effectiveDaysFromRange(since, until) {
    const sinceMs = new Date(since).getTime();
    const untilMs = new Date(until).getTime();
    if (Number.isNaN(sinceMs) || Number.isNaN(untilMs) || untilMs < sinceMs)
        return 30;
    return Math.ceil((untilMs - sinceMs) / MS_PER_DAY);
}
/**
 * Period label for response metadata: "1y" when span >= 365 days, otherwise "{days}d".
 */
function periodLabelFromDays(days) {
    return days >= 365 ? '1y' : `${days}d`;
}
//# sourceMappingURL=analyticsDateRange.js.map