"use strict";
/**
 * Worker Metrics Endpoint
 *
 * Provides observability into export queue, worker health, and system state
 * Useful for monitoring and debugging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const errorResponse_1 = require("../utils/errorResponse");
exports.metricsRouter = express_1.default.Router();
// GET /api/metrics/exports
// Returns export queue metrics
exports.metricsRouter.get('/exports', auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const requestId = authReq.requestId || 'unknown';
    try {
        const { organization_id } = authReq.user;
        // Get queue depth by state
        const { data: queueByState } = await supabaseClient_1.supabase
            .from('exports')
            .select('state')
            .eq('organization_id', organization_id);
        const queueDepth = {};
        if (queueByState) {
            for (const exp of queueByState) {
                queueDepth[exp.state] = (queueDepth[exp.state] || 0) + 1;
            }
        }
        // Get average time in each state (for completed exports)
        const { data: completedExports } = await supabaseClient_1.supabase
            .from('exports')
            .select('created_at, started_at, completed_at')
            .eq('organization_id', organization_id)
            .eq('state', 'ready')
            .not('completed_at', 'is', null)
            .not('started_at', 'is', null)
            .limit(100); // Sample last 100
        let avgTimeQueued = 0;
        let avgTimeGenerating = 0;
        let avgTimeTotal = 0;
        if (completedExports && completedExports.length > 0) {
            const times = completedExports.map(exp => {
                const created = new Date(exp.created_at).getTime();
                const started = exp.started_at ? new Date(exp.started_at).getTime() : created;
                const completed = exp.completed_at ? new Date(exp.completed_at).getTime() : started;
                return {
                    queued: started - created,
                    generating: completed - started,
                    total: completed - created,
                };
            });
            avgTimeQueued = times.reduce((sum, t) => sum + t.queued, 0) / times.length;
            avgTimeGenerating = times.reduce((sum, t) => sum + t.generating, 0) / times.length;
            avgTimeTotal = times.reduce((sum, t) => sum + t.total, 0) / times.length;
        }
        // Get failure rate by error category
        const { data: failedExports } = await supabaseClient_1.supabase
            .from('exports')
            .select('error_code, failure_count')
            .eq('organization_id', organization_id)
            .eq('state', 'failed');
        const failureRate = {};
        if (failedExports) {
            for (const exp of failedExports) {
                const code = exp.error_code || 'UNKNOWN';
                failureRate[code] = (failureRate[code] || 0) + 1;
            }
        }
        res.json({
            data: {
                queue_depth: queueDepth,
                average_times: {
                    queued_ms: Math.round(avgTimeQueued),
                    generating_ms: Math.round(avgTimeGenerating),
                    total_ms: Math.round(avgTimeTotal),
                },
                failure_rate: failureRate,
                total_failures: failedExports?.length || 0,
            },
        });
    }
    catch (err) {
        console.error('[Metrics] Error:', err);
        const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
            message: 'Failed to fetch metrics',
            internalMessage: err?.message || String(err),
            code: 'METRICS_ERROR',
            requestId,
            statusCode: 500,
        });
        res.setHeader('X-Error-ID', errorId);
        res.status(500).json(errorResponse);
    }
});
//# sourceMappingURL=metrics.js.map