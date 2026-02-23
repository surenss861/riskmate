"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinTimeWindow = isWithinTimeWindow;
/**
 * Time-of-day window check using server local time.
 * Used so digest/reminder workers only run in the intended morning window (e.g. 08:00–08:10),
 * avoiding off-hour email blasts on restart.
 */
function isWithinTimeWindow(now, startHour, startMinute, durationMinutes) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalStartMinutes = startHour * 60 + startMinute;
    const totalEndMinutes = totalStartMinutes + durationMinutes;
    const currentMinutes = hour * 60 + minute;
    return currentMinutes >= totalStartMinutes && currentMinutes < totalEndMinutes;
}
//# sourceMappingURL=timeWindow.js.map