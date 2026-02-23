"use strict";
/**
 * Distributed worker lease: only one instance runs each scheduled worker cycle.
 * Uses Postgres worker_leases table via try_acquire_worker_lease RPC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKER_LEASE_KEYS = void 0;
exports.tryAcquireWorkerLease = tryAcquireWorkerLease;
const supabaseClient_1 = require("./supabaseClient");
/** Lease key constants — must match single-instance semantics per worker type. */
exports.WORKER_LEASE_KEYS = {
    weekly_digest: 'worker:weekly_digest',
    deadline_reminder: 'worker:deadline_reminder',
    task_reminder: 'worker:task_reminder',
    email_queue: 'worker:email_queue',
};
const DEFAULT_TTL_SEC = 300; // 5 minutes — covers one cycle run
/** Unique holder id for this process (instance + pid). */
function getHolderId() {
    const deployment = process.env.RAILWAY_DEPLOYMENT_ID ?? process.env.HOSTNAME ?? 'local';
    return `${deployment}:${process.pid}`;
}
/**
 * Try to acquire the lease for the given key. Returns true if this process has the lease
 * (acquired or renewed); false if another instance holds it. Call once at the start of
 * a worker cycle; skip processing if false.
 */
async function tryAcquireWorkerLease(leaseKey, ttlSec = DEFAULT_TTL_SEC) {
    try {
        const { data, error } = await supabaseClient_1.supabase.rpc('try_acquire_worker_lease', {
            p_key: leaseKey,
            p_holder: getHolderId(),
            p_ttl_sec: ttlSec,
        });
        if (error) {
            console.warn('[WorkerLock] try_acquire_worker_lease failed:', error.message);
            return false;
        }
        return data === true;
    }
    catch (e) {
        console.warn('[WorkerLock] tryAcquireWorkerLease error:', e);
        return false;
    }
}
//# sourceMappingURL=workerLock.js.map