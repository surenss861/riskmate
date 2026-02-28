"use strict";
/**
 * Internal webhook emit: called by backend when it creates/updates resources.
 * POST /api/webhooks/emit { organization_id, event_type, data }
 * Requires internal credential (WEBHOOK_EMIT_SECRET); not callable by standard end-user JWTs.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhooksRouter = void 0;
const express_1 = __importDefault(require("express"));
const webhookDelivery_1 = require("../workers/webhookDelivery");
exports.webhooksRouter = express_1.default.Router();
const ALLOWED_SET = new Set(webhookDelivery_1.ALLOWED_WEBHOOK_EVENT_TYPES);
/**
 * Middleware: require internal service-to-service secret. Rejects standard JWT auth for /emit
 * so that only trusted server code (or callers with WEBHOOK_EMIT_SECRET) can trigger deliveries.
 */
function requireWebhookEmitSecret(req, res, next) {
    const secret = process.env.WEBHOOK_EMIT_SECRET;
    if (!secret) {
        res.status(503).json({
            message: 'Webhook emit is not configured (WEBHOOK_EMIT_SECRET missing)',
            code: 'EMIT_NOT_CONFIGURED',
        });
        return;
    }
    const headerSecret = req.headers['x-webhook-internal-secret'] ?? (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : null);
    if (!headerSecret || headerSecret !== secret) {
        res.status(403).json({
            message: 'Forbidden: invalid or missing internal credential',
            code: 'FORBIDDEN',
        });
        return;
    }
    next();
}
exports.webhooksRouter.post('/emit', requireWebhookEmitSecret, async (req, res) => {
    try {
        const { organization_id, event_type, data } = req.body || {};
        if (!organization_id || typeof organization_id !== 'string') {
            return res.status(400).json({
                message: 'Missing or invalid organization_id',
                code: 'VALIDATION_ERROR',
            });
        }
        if (!event_type || typeof event_type !== 'string') {
            return res.status(400).json({
                message: 'Missing or invalid event_type',
                code: 'VALIDATION_ERROR',
            });
        }
        if (!ALLOWED_SET.has(event_type)) {
            return res.status(400).json({
                message: `event_type not allowed: ${event_type}`,
                code: 'VALIDATION_ERROR',
            });
        }
        const payloadCheck = (0, webhookDelivery_1.validateWebhookEmitPayload)(event_type, data);
        if (!payloadCheck.valid) {
            return res.status(400).json({
                message: payloadCheck.message,
                code: 'VALIDATION_ERROR',
            });
        }
        const dataObj = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        await (0, webhookDelivery_1.deliverEvent)(organization_id, event_type, dataObj);
        return res.status(202).json({ ok: true });
    }
    catch (err) {
        console.error('[Webhooks] Emit error:', err);
        return res.status(500).json({
            message: err instanceof Error ? err.message : 'Internal error',
            code: 'INTERNAL_ERROR',
        });
    }
});
//# sourceMappingURL=webhooks.js.map