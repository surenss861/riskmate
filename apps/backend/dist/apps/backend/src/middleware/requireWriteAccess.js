"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireWriteAccess = void 0;
const audit_1 = require("./audit");
const errorResponse_1 = require("../utils/errorResponse");
const READ_ONLY_ROLES = new Set(["auditor", "executive"]);
/**
 * Middleware to enforce read-only access for auditors and executives
 * Blocks all write operations (POST, PATCH, DELETE) for read-only roles
 *
 * Fails closed: Returns 401 if auth context is missing
 * Uses consistent error format with X-Error-ID header
 * Logs violations to audit trail
 */
const requireWriteAccess = (req, res, next) => {
    const authReq = req;
    const requestId = authReq.requestId || "unknown";
    // Fail closed if auth middleware didn't attach a user
    if (!authReq.user) {
        const { response, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: "Unauthorized",
            internalMessage: "requireWriteAccess called without authenticated user",
            code: "AUTH_REQUIRED",
            requestId,
            statusCode: 401,
        });
        res.setHeader("X-Error-ID", errorId);
        return res.status(401).json(response);
    }
    const { role, organization_id, id: userId } = authReq.user;
    if (!role || !organization_id || !userId) {
        const { response, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: "Unauthorized",
            internalMessage: "Authenticated user missing required fields (role/org/userId)",
            code: "AUTH_INVALID_CONTEXT",
            requestId,
            statusCode: 401,
        });
        res.setHeader("X-Error-ID", errorId);
        return res.status(401).json(response);
    }
    if (READ_ONLY_ROLES.has(role)) {
        const endpoint = req.originalUrl || req.url;
        const method = req.method;
        // Log violation (non-blocking)
        (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "auth.role_violation",
            targetType: "system",
            targetId: null,
            metadata: {
                attempted_action: `${method} ${endpoint}`,
                policy_statement: role === "auditor"
                    ? "Auditors have read-only access"
                    : "Executives have read-only access",
                endpoint,
                method,
                role,
            },
        }).catch((err) => {
            console.warn("[requireWriteAccess] Audit log failed:", err);
        });
        const { response, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: role === "auditor"
                ? "Auditors have read-only access"
                : "Executives have read-only access",
            internalMessage: `Write blocked for role=${role} at ${method} ${endpoint}`,
            code: "AUTH_ROLE_READ_ONLY",
            requestId,
            statusCode: 403,
        });
        res.setHeader("X-Error-ID", errorId);
        (0, errorResponse_1.logErrorForSupport)(403, "AUTH_ROLE_READ_ONLY", requestId, organization_id, response.message, response.internal_message, response.category, response.severity, endpoint);
        return res.status(403).json(response);
    }
    next();
};
exports.requireWriteAccess = requireWriteAccess;
//# sourceMappingURL=requireWriteAccess.js.map