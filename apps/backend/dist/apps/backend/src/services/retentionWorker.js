"use strict";
/**
 * Retention and Cleanup Worker
 *
 * Handles:
 * - Export artifact retention (per plan tier)
 * - Failed/canceled export cleanup
 * - Orphaned evidence blob cleanup
 * - Storage lifecycle management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRetentionWorker = startRetentionWorker;
exports.stopRetentionWorker = stopRetentionWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const structuredLog_1 = require("../utils/structuredLog");
const RETENTION_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
// Retention periods (in days) per plan tier
const RETENTION_PERIODS = {
    starter: 30,
    pro: 90,
    business: 365,
    enterprise: 730, // 2 years
};
let retentionWorkerRunning = false;
let retentionWorkerInterval = null;
/**
 * Start the retention worker
 */
function startRetentionWorker() {
    if (retentionWorkerRunning) {
        console.log('[RetentionWorker] Already running');
        return;
    }
    console.log('[RetentionWorker] Starting...');
    retentionWorkerRunning = true;
    // Process immediately, then on interval
    processRetention();
    retentionWorkerInterval = setInterval(processRetention, RETENTION_INTERVAL_MS);
}
/**
 * Stop the retention worker
 */
function stopRetentionWorker() {
    if (retentionWorkerInterval) {
        clearInterval(retentionWorkerInterval);
        retentionWorkerInterval = null;
    }
    retentionWorkerRunning = false;
    console.log('[RetentionWorker] Stopped');
}
/**
 * Process retention and cleanup
 */
async function processRetention() {
    try {
        await cleanupExpiredExports();
        await cleanupFailedExports();
        await cleanupOrphanedEvidence();
    }
    catch (err) {
        (0, structuredLog_1.logStructured)('error', 'Retention worker error', {
            error: err.message,
        });
    }
}
/**
 * Clean up expired exports based on plan retention period
 */
async function cleanupExpiredExports() {
    // Get all orgs with their plan tiers
    const { data: orgs } = await supabaseClient_1.supabase
        .from('organizations')
        .select('id, plan_tier');
    if (!orgs)
        return;
    for (const org of orgs) {
        const retentionDays = RETENTION_PERIODS[org.plan_tier || 'starter'] || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        // Find expired exports
        const { data: expiredExports } = await supabaseClient_1.supabase
            .from('exports')
            .select('id, storage_path, manifest_path, organization_id')
            .eq('organization_id', org.id)
            .eq('state', 'ready')
            .lt('completed_at', cutoffDate.toISOString());
        if (!expiredExports || expiredExports.length === 0)
            continue;
        (0, structuredLog_1.logStructured)('info', `Cleaning up ${expiredExports.length} expired exports`, {
            org_id: org.id,
            retention_days: retentionDays,
        });
        // Delete from storage
        for (const exp of expiredExports) {
            try {
                if (exp.storage_path) {
                    await supabaseClient_1.supabase.storage
                        .from('exports')
                        .remove([exp.storage_path]);
                }
                if (exp.manifest_path) {
                    await supabaseClient_1.supabase.storage
                        .from('exports')
                        .remove([exp.manifest_path]);
                }
                // Mark as expired in DB
                await supabaseClient_1.supabase
                    .from('exports')
                    .update({ state: 'expired' })
                    .eq('id', exp.id);
            }
            catch (err) {
                (0, structuredLog_1.logStructured)('error', 'Failed to cleanup export', {
                    export_id: exp.id,
                    org_id: org.id,
                    error: err.message,
                });
            }
        }
    }
}
/**
 * Clean up failed/canceled exports (immediate cleanup)
 */
async function cleanupFailedExports() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep failed exports for 7 days for debugging
    const { data: failedExports } = await supabaseClient_1.supabase
        .from('exports')
        .select('id, storage_path, manifest_path, organization_id')
        .in('state', ['failed', 'canceled'])
        .lt('created_at', cutoffDate.toISOString());
    if (!failedExports || failedExports.length === 0)
        return;
    (0, structuredLog_1.logStructured)('info', `Cleaning up ${failedExports.length} failed/canceled exports`, {});
    for (const exp of failedExports) {
        try {
            if (exp.storage_path) {
                await supabaseClient_1.supabase.storage
                    .from('exports')
                    .remove([exp.storage_path]);
            }
            if (exp.manifest_path) {
                await supabaseClient_1.supabase.storage
                    .from('exports')
                    .remove([exp.manifest_path]);
            }
            // Delete DB row
            await supabaseClient_1.supabase
                .from('exports')
                .delete()
                .eq('id', exp.id);
        }
        catch (err) {
            (0, structuredLog_1.logStructured)('error', 'Failed to cleanup failed export', {
                export_id: exp.id,
                org_id: exp.organization_id,
                error: err.message,
            });
        }
    }
}
/**
 * Clean up orphaned evidence blobs (evidence in storage but no DB row)
 * This is rare but can happen if DB insert fails after storage upload
 */
async function cleanupOrphanedEvidence() {
    // This is expensive, so we only run it once per day
    const lastRunKey = 'last_orphan_cleanup';
    const lastRun = await supabaseClient_1.supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();
    // For now, skip orphaned cleanup (would need to list all storage files)
    // Can be implemented later if needed
    (0, structuredLog_1.logStructured)('debug', 'Orphaned evidence cleanup skipped (not implemented)', {});
}
//# sourceMappingURL=retentionWorker.js.map