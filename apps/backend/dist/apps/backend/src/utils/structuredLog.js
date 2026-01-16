"use strict";
/**
 * Structured Logging
 *
 * Consistent log format with org_id, user_id, job_id, export_id, evidence_id, ledger_seq, request_id
 * Makes debugging and support tickets trivial
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStructured = logStructured;
exports.logWithRequest = logWithRequest;
/**
 * Structured log helper
 */
function logStructured(level, message, context = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context,
    };
    // Use console methods (can be replaced with proper logging library)
    switch (level) {
        case 'error':
            console.error(JSON.stringify(logEntry));
            break;
        case 'warn':
            console.warn(JSON.stringify(logEntry));
            break;
        case 'debug':
            if (process.env.NODE_ENV !== 'production') {
                console.debug(JSON.stringify(logEntry));
            }
            break;
        default:
            console.log(JSON.stringify(logEntry));
    }
}
/**
 * Log with request context
 */
function logWithRequest(level, message, requestId, context = {}) {
    logStructured(level, message, {
        ...context,
        request_id: requestId,
    });
}
//# sourceMappingURL=structuredLog.js.map