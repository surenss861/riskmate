"use strict";
/**
 * Internal endpoints for server-to-server calls (e.g. Next.js → backend).
 * Require X-Internal-Secret header matching INTERNAL_API_KEY.
 * When INTERNAL_API_KEY is unset, returns 503 so the endpoint is not usable (no passthrough).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalRouter = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const errorResponse_1 = require("../utils/errorResponse");
const webhookDelivery_1 = require("../workers/webhookDelivery");
exports.internalRouter = express_1.default.Router();
function requireInternalSecret(req, res, next) {
    const secret = process.env.INTERNAL_API_KEY;
    if (!secret || secret === '') {
        res.status(503).json((0, errorResponse_1.createErrorResponse)({
            message: 'Internal API not configured',
            code: 'SERVICE_UNAVAILABLE',
            status: 503,
        }).response);
        return;
    }
    const headerSecret = req.headers['x-internal-secret'];
    const expected = node_crypto_1.default.createHash('sha256').update(secret, 'utf8').digest();
    const received = node_crypto_1.default.createHash('sha256').update(String(headerSecret ?? ''), 'utf8').digest();
    if (expected.length !== received.length || !node_crypto_1.default.timingSafeEqual(expected, received)) {
        res.status(401).json((0, errorResponse_1.createErrorResponse)({
            message: 'Unauthorized',
            code: 'AUTH_UNAUTHORIZED',
            status: 401,
        }).response);
        return;
    }
    next();
}
/** POST /api/internal/wake-webhook-worker — wake delivery worker after enqueue (e.g. from Next.js triggerWebhookEvent). */
exports.internalRouter.post('/wake-webhook-worker', requireInternalSecret, (_req, res) => {
    (0, webhookDelivery_1.wakeWebhookWorker)();
    res.status(204).end();
});
//# sourceMappingURL=internal.js.map