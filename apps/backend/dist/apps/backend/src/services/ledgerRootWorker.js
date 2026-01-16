"use strict";
/**
 * Daily Ledger Root Computation Worker
 *
 * Computes Merkle roots for each organization's ledger events per day
 * Stores in ledger_roots table for auditor-proof chain-of-custody
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLedgerRootWorker = startLedgerRootWorker;
exports.stopLedgerRootWorker = stopLedgerRootWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const structuredLog_1 = require("../utils/structuredLog");
const crypto_1 = __importDefault(require("crypto"));
const ROOT_COMPUTE_INTERVAL_MS = 24 * 60 * 60 * 1000; // Run daily
const ROOT_COMPUTE_HOUR = 2; // Run at 2 AM UTC
let rootWorkerRunning = false;
let rootWorkerInterval = null;
/**
 * Start the ledger root worker
 */
function startLedgerRootWorker() {
    if (rootWorkerRunning) {
        console.log('[LedgerRootWorker] Already running');
        return;
    }
    console.log('[LedgerRootWorker] Starting...');
    rootWorkerRunning = true;
    // Schedule first run
    scheduleNextRun();
    // Then run daily
    rootWorkerInterval = setInterval(() => {
        computeDailyRoots();
        scheduleNextRun();
    }, ROOT_COMPUTE_INTERVAL_MS);
}
/**
 * Stop the ledger root worker
 */
function stopLedgerRootWorker() {
    if (rootWorkerInterval) {
        clearInterval(rootWorkerInterval);
        rootWorkerInterval = null;
    }
    rootWorkerRunning = false;
    console.log('[LedgerRootWorker] Stopped');
}
/**
 * Schedule next run at 2 AM UTC
 */
function scheduleNextRun() {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setUTCHours(ROOT_COMPUTE_HOUR, 0, 0, 0);
    if (nextRun <= now) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
    const msUntilRun = nextRun.getTime() - now.getTime();
    setTimeout(() => {
        computeDailyRoots();
    }, msUntilRun);
}
/**
 * Compute daily ledger roots for all organizations
 */
async function computeDailyRoots() {
    try {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
        (0, structuredLog_1.logStructured)('info', 'Computing daily ledger roots', {
            date: dateStr,
        });
        // Get all organizations
        const { data: orgs } = await supabaseClient_1.supabase
            .from('organizations')
            .select('id');
        if (!orgs)
            return;
        for (const org of orgs) {
            await computeOrgRoot(org.id, dateStr, yesterday, today);
        }
        (0, structuredLog_1.logStructured)('info', 'Daily ledger roots computed', {
            date: dateStr,
            org_count: orgs.length,
        });
    }
    catch (err) {
        (0, structuredLog_1.logStructured)('error', 'Failed to compute daily ledger roots', {
            error: err.message,
        });
    }
}
/**
 * Compute ledger root for a single organization for a specific date
 */
async function computeOrgRoot(organizationId, dateStr, startDate, endDate) {
    try {
        // Get all ledger events for this org on this date
        const { data: events } = await supabaseClient_1.supabase
            .from('audit_logs')
            .select('id, hash, ledger_seq')
            .eq('organization_id', organizationId)
            .gte('created_at', startDate.toISOString())
            .lt('created_at', endDate.toISOString())
            .order('ledger_seq', { ascending: true });
        if (!events || events.length === 0) {
            // No events for this date, skip
            return;
        }
        // Compute Merkle root (simple: hash of all hashes concatenated)
        // For production, use proper Merkle tree, but this is sufficient for now
        const hashes = events.map(e => e.hash).sort(); // Sort for determinism
        const rootHash = crypto_1.default
            .createHash('sha256')
            .update(hashes.join(''))
            .digest('hex');
        // Store in ledger_roots table
        const { error: insertError } = await supabaseClient_1.supabase
            .from('ledger_roots')
            .upsert({
            organization_id: organizationId,
            date: dateStr,
            root_hash: rootHash,
            event_count: events.length,
            first_event_id: events[0].id,
            last_event_id: events[events.length - 1].id,
            first_seq: events[0].ledger_seq,
            last_seq: events[events.length - 1].ledger_seq,
            computed_at: new Date().toISOString(),
        }, {
            onConflict: 'organization_id,date',
        });
        if (insertError) {
            throw insertError;
        }
        (0, structuredLog_1.logStructured)('info', 'Computed ledger root for org', {
            org_id: organizationId,
            date: dateStr,
            event_count: events.length,
            root_hash: rootHash.substring(0, 16) + '...',
        });
    }
    catch (err) {
        (0, structuredLog_1.logStructured)('error', 'Failed to compute org ledger root', {
            org_id: organizationId,
            date: dateStr,
            error: err.message,
        });
    }
}
//# sourceMappingURL=ledgerRootWorker.js.map