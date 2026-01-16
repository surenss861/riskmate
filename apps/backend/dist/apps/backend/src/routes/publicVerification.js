"use strict";
/**
 * Public Verification Endpoints
 *
 * Token-based verification that doesn't require authentication
 * Rate-limited heavily to prevent abuse
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicVerificationRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const errorResponse_1 = require("../utils/errorResponse");
const rateLimiter_1 = require("../middleware/rateLimiter");
const crypto_1 = __importDefault(require("crypto"));
exports.publicVerificationRouter = express_1.default.Router();
// Verification tokens are stored in exports table (verification_token column)
// Tokens are generated when export is created and expire after 30 days
/**
 * Verify a proof pack using a public token
 * GET /api/public/verify/:token
 */
exports.publicVerificationRouter.get('/verify/:token', rateLimiter_1.verificationRateLimiter, async (req, res) => {
    const { token } = req.params;
    try {
        // Find export by verification token
        const { data: exportJob, error: fetchError } = await supabaseClient_1.supabase
            .from('exports')
            .select('*')
            .eq('verification_token', token)
            .eq('state', 'ready')
            .single();
        if (fetchError || !exportJob) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: 'Verification token not found or export not ready',
                internalMessage: `Token ${token} not found`,
                code: 'VERIFICATION_TOKEN_INVALID',
                requestId: req.headers['x-request-id'],
                statusCode: 404,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(404).json(errorResponse);
        }
        // Check token expiry (30 days)
        const createdAt = new Date(exportJob.created_at);
        const expiresAt = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (new Date() > expiresAt) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: 'Verification token has expired',
                internalMessage: `Token ${token} expired at ${expiresAt.toISOString()}`,
                code: 'VERIFICATION_TOKEN_EXPIRED',
                requestId: req.headers['x-request-id'],
                statusCode: 410,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(410).json(errorResponse);
        }
        // Fetch manifest
        if (!exportJob.manifest) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: 'Export manifest not found',
                internalMessage: `Export ${exportJob.id} has no manifest`,
                code: 'MANIFEST_MISSING',
                requestId: req.headers['x-request-id'],
                statusCode: 500,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(500).json(errorResponse);
        }
        const manifest = exportJob.manifest;
        // Verify manifest hash
        const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort());
        const computedHash = crypto_1.default.createHash('sha256').update(manifestJson).digest('hex');
        const hashMatches = computedHash === exportJob.manifest_hash;
        // Fetch ledger root for the export date
        const exportDate = new Date(exportJob.created_at).toISOString().split('T')[0];
        const { data: ledgerRoot } = await supabaseClient_1.supabase
            .from('ledger_roots')
            .select('*')
            .eq('organization_id', exportJob.organization_id)
            .eq('date', exportDate)
            .single();
        // Verify ledger contains export.completed event
        const { data: ledgerEvent } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('id, hash, ledger_seq')
            .eq('organization_id', exportJob.organization_id)
            .eq('target_type', 'export')
            .eq('target_id', exportJob.id)
            .like('event_name', 'export.%completed')
            .maybeSingle();
        const ledgerMatch = ledgerEvent &&
            ledgerEvent.metadata?.manifest_hash === exportJob.manifest_hash;
        res.json({
            data: {
                export_id: exportJob.id,
                export_type: exportJob.export_type,
                generated_at: exportJob.created_at,
                manifest_hash: exportJob.manifest_hash,
                manifest_hash_valid: hashMatches,
                ledger_root: ledgerRoot ? {
                    date: ledgerRoot.date,
                    root_hash: ledgerRoot.root_hash,
                    event_count: ledgerRoot.event_count,
                } : null,
                ledger_match: ledgerMatch,
                verified_at: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        console.error('[Public Verification] Error:', err);
        const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: 'Failed to verify export',
            internalMessage: err?.message || String(err),
            code: 'VERIFICATION_ERROR',
            requestId: req.headers['x-request-id'],
            statusCode: 500,
        });
        res.setHeader('X-Error-ID', errorId);
        res.status(500).json(errorResponse);
    }
});
//# sourceMappingURL=publicVerification.js.map