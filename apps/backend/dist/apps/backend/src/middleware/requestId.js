"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const crypto_1 = require("crypto");
/**
 * Parse W3C Trace Context header (trace_parent)
 * Format: 00-{trace_id}-{parent_id}-{flags}
 * We propagate it but don't modify it (let upstream services handle trace creation)
 */
function parseTraceParent(header) {
    if (!header)
        return null;
    // Basic validation: should be 55 chars (00-{32 hex}-{16 hex}-{2 hex})
    if (header.length !== 55 || !header.match(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/i)) {
        return null;
    }
    return header;
}
const requestIdMiddleware = (req, res, next) => {
    // Generate request ID (use existing header if present, otherwise generate new)
    const requestId = req.headers['x-request-id'] || (0, crypto_1.randomUUID)();
    req.requestId = requestId;
    // Propagate W3C Trace Context if present (for enterprise observability stacks)
    // Explicitly echo traceparent header for correlation (some tracing systems grab headers faster than body fields)
    const traceParent = parseTraceParent(req.headers['traceparent']);
    if (traceParent) {
        req.traceParent = traceParent;
        res.setHeader('traceparent', traceParent); // Explicit echo for correlation
        res.setHeader('X-Traceparent', traceParent); // Also set X-Traceparent for systems that prefer X- prefix
    }
    // Attach to response header for client correlation
    res.setHeader('X-Request-ID', requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
//# sourceMappingURL=requestId.js.map