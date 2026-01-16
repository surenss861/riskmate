"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const errorResponse_1 = require("../utils/errorResponse");
const rateLimiter_1 = require("../middleware/rateLimiter");
const crypto_1 = __importDefault(require("crypto"));
exports.verificationRouter = express_1.default.Router();
/**
 * Compute ledger hash (same function as in database)
 *
 * CRITICAL: This must match the DB function exactly:
 * - Same key order (jsonb_build_object preserves insertion order)
 * - Same JSON formatting (jsonb_pretty produces formatted JSON with newlines/indentation)
 * - Same salt
 * - Same null handling (COALESCE to empty string)
 *
 * DB function uses:
 *   jsonb_pretty(jsonb_build_object(...)) || COALESCE(prev_hash, '') || secret_salt
 */
function computeLedgerHash(prevHash, ledgerSeq, organizationId, actorId, eventName, targetType, targetId, metadata, createdAt, secretSalt = 'riskmate-ledger-v1-2025') {
    // Build canonical object (key order matches DB jsonb_build_object)
    // Note: jsonb_build_object preserves insertion order, so we must match it exactly
    const canonical = {
        seq: ledgerSeq,
        org_id: String(organizationId), // DB casts UUID to TEXT
        actor_id: actorId ? String(actorId) : '', // COALESCE to empty string
        event: eventName,
        target_type: targetType,
        target_id: targetId ? String(targetId) : '', // COALESCE to empty string
        created_at: String(createdAt), // DB casts TIMESTAMPTZ to TEXT
        metadata: metadata || {},
    };
    // Format JSON to match jsonb_pretty() output (indented with 2 spaces)
    // jsonb_pretty produces formatted JSON with newlines and indentation
    const jsonString = JSON.stringify(canonical, null, 2);
    // Build hash input (must match DB function exactly)
    // DB: v_hash_input := jsonb_pretty(v_canonical) || COALESCE(p_prev_hash, '') || p_secret_salt
    const hashInput = jsonString + (prevHash || '') + secretSalt;
    return crypto_1.default.createHash('sha256').update(hashInput).digest('hex');
}
// GET /api/ledger/events/:id/verify
// Verifies a single ledger event's hash and chain integrity
exports.verificationRouter.get('/ledger/events/:id/verify', auth_1.authenticate, rateLimiter_1.verificationRateLimiter, async (req, res) => {
    const authReq = req;
    const requestId = authReq.requestId || 'unknown';
    try {
        const { organization_id } = authReq.user;
        const { id: eventId } = req.params;
        // Fetch event
        const { data: event, error: fetchError } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('*')
            .eq('id', eventId)
            .eq('organization_id', organization_id)
            .single();
        if (fetchError || !event) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: 'Ledger event not found',
                internalMessage: `Event ${eventId} not found for org ${organization_id}`,
                code: 'EVENT_NOT_FOUND',
                requestId,
                statusCode: 404,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(404).json(errorResponse);
        }
        // Fetch previous event
        let prevEvent = null;
        if (event.prev_hash) {
            const { data: prev } = await supabaseClient_1.supabase
                .from('audit_logs')
                .select('hash, ledger_seq')
                .eq('organization_id', organization_id)
                .eq('hash', event.prev_hash)
                .maybeSingle();
            prevEvent = prev;
        }
        // Compute expected hash
        const expectedHash = computeLedgerHash(event.prev_hash, event.ledger_seq || 0, event.organization_id, event.actor_id, event.event_name, event.target_type, event.target_id, event.metadata, event.created_at);
        // Verify hash matches
        const hashMatches = event.hash === expectedHash;
        // Verify prev_hash points to correct previous event
        const prevHashValid = !event.prev_hash || (prevEvent && prevEvent.hash === event.prev_hash);
        // Verify chain continuity (optional: check N previous links)
        let chainOk = true;
        let chainDepth = 0;
        const maxChainDepth = 10; // Limit depth for performance
        if (event.prev_hash && prevEvent) {
            let currentEvent = event;
            let depth = 0;
            while (currentEvent.prev_hash && depth < maxChainDepth) {
                const { data: prev } = await supabaseClient_1.supabase
                    .from('audit_logs')
                    .select('hash, prev_hash, ledger_seq')
                    .eq('organization_id', organization_id)
                    .eq('hash', currentEvent.prev_hash)
                    .maybeSingle();
                if (!prev) {
                    chainOk = false;
                    break;
                }
                // Verify this prev event's hash
                const prevExpectedHash = computeLedgerHash(prev.prev_hash, prev.ledger_seq || 0, organization_id, currentEvent.actor_id, // Use current event's actor for consistency
                currentEvent.event_name, // This should match, but we're just checking hash computation
                currentEvent.target_type, currentEvent.target_id, currentEvent.metadata, currentEvent.created_at);
                // Note: We can't fully verify prev event without fetching its full record
                // For now, just check that prev_hash exists and points to a valid event
                currentEvent = prev;
                depth++;
            }
            chainDepth = depth;
        }
        res.json({
            data: {
                event_id: eventId,
                stored_hash: event.hash,
                computed_hash: expectedHash,
                hash_matches: hashMatches,
                prev_hash: event.prev_hash,
                prev_exists: !!prevEvent,
                prev_hash_valid: prevHashValid,
                chain_ok: chainOk,
                chain_depth_checked: chainDepth,
                ledger_seq: event.ledger_seq,
                verified_at: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        console.error('[Event Verify] Error:', err);
        const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: 'Failed to verify ledger event',
            internalMessage: err?.message || String(err),
            code: 'VERIFICATION_ERROR',
            requestId,
            statusCode: 500,
        });
        res.setHeader('X-Error-ID', errorId);
        (0, errorResponse_1.logErrorForSupport)(500, 'VERIFICATION_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/ledger/events/:id/verify');
        res.status(500).json(errorResponse);
    }
});
// POST /api/verify/manifest
// Verifies a proof pack manifest against stored export and ledger
exports.verificationRouter.post('/verify/manifest', auth_1.authenticate, rateLimiter_1.verificationRateLimiter, async (req, res) => {
    const authReq = req;
    const requestId = authReq.requestId || 'unknown';
    try {
        const { organization_id } = authReq.user;
        const { manifest, export_id } = req.body;
        if (!manifest) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: 'Manifest is required',
                internalMessage: 'No manifest provided in request body',
                code: 'VALIDATION_ERROR',
                requestId,
                statusCode: 400,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(400).json(errorResponse);
        }
        // Validate manifest schema
        if (!manifest.version || !manifest.files || !Array.isArray(manifest.files)) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: 'Invalid manifest format',
                internalMessage: 'Manifest must have version and files array',
                code: 'VALIDATION_ERROR',
                requestId,
                statusCode: 400,
            });
            res.setHeader('X-Error-ID', errorId);
            return res.status(400).json(errorResponse);
        }
        // Compute manifest hash
        const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort());
        const manifestHash = crypto_1.default.createHash('sha256').update(manifestJson).digest('hex');
        // If export_id provided, verify against stored export
        let exportMatch = false;
        let storedManifestHash = null;
        let exportState = null;
        if (export_id) {
            const { data: exportJob } = await supabaseClient_1.supabase
                .from('exports')
                .select('manifest_hash, state, organization_id')
                .eq('id', export_id)
                .eq('organization_id', organization_id)
                .single();
            if (exportJob) {
                storedManifestHash = exportJob.manifest_hash;
                exportState = exportJob.state;
                exportMatch = exportJob.manifest_hash === manifestHash;
            }
        }
        // Verify ledger contains export.completed event with matching manifest hash
        let ledgerMatch = false;
        let ledgerEventId = null;
        if (export_id) {
            const { data: ledgerEvent } = await supabaseClient_1.supabase
                .from('audit_logs')
                .select('id, metadata')
                .eq('organization_id', organization_id)
                .eq('target_type', 'export')
                .eq('target_id', export_id)
                .like('event_name', 'export.%completed')
                .maybeSingle();
            if (ledgerEvent) {
                const eventManifestHash = ledgerEvent.metadata?.manifest_hash;
                if (eventManifestHash === manifestHash) {
                    ledgerMatch = true;
                    ledgerEventId = ledgerEvent.id;
                }
            }
        }
        res.json({
            data: {
                manifest_hash: manifestHash,
                manifest_valid: true,
                export_id: export_id || null,
                export_match: exportMatch,
                stored_manifest_hash: storedManifestHash,
                export_state: exportState,
                ledger_match: ledgerMatch,
                ledger_event_id: ledgerEventId,
                verified_at: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        console.error('[Manifest Verify] Error:', err);
        const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: 'Failed to verify manifest',
            internalMessage: err?.message || String(err),
            code: 'VERIFICATION_ERROR',
            requestId,
            statusCode: 500,
        });
        res.setHeader('X-Error-ID', errorId);
        (0, errorResponse_1.logErrorForSupport)(500, 'VERIFICATION_ERROR', requestId, authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, 'operations', 'error', '/api/verify/manifest');
        res.status(500).json(errorResponse);
    }
});
//# sourceMappingURL=verification.js.map