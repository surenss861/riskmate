"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIp = exports.LEGAL_UPDATED_AT = exports.LEGAL_VERSION = void 0;
exports.LEGAL_VERSION = process.env.LEGAL_VERSION || "2025-12-riskmate-terms";
exports.LEGAL_UPDATED_AT = process.env.LEGAL_UPDATED_AT || "2025-12-01T00:00:00.000Z";
const getClientIp = (headers) => {
    const xForwardedFor = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
    if (typeof xForwardedFor === "string") {
        return xForwardedFor.split(",")[0].trim();
    }
    const realIp = headers["x-real-ip"] || headers["X-Real-IP"];
    if (typeof realIp === "string") {
        return realIp.trim();
    }
    return undefined;
};
exports.getClientIp = getClientIp;
//# sourceMappingURL=legal.js.map