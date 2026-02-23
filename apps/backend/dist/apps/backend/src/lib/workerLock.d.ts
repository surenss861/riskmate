/**
 * Distributed worker lease: only one instance runs each scheduled worker cycle.
 * Uses Postgres worker_leases table via try_acquire_worker_lease RPC.
 */
/** Lease key constants — must match single-instance semantics per worker type. */
export declare const WORKER_LEASE_KEYS: {
    readonly weekly_digest: "worker:weekly_digest";
    readonly deadline_reminder: "worker:deadline_reminder";
    readonly task_reminder: "worker:task_reminder";
    readonly email_queue: "worker:email_queue";
};
/**
 * Try to acquire the lease for the given key. Returns true if this process has the lease
 * (acquired or renewed); false if another instance holds it. Call once at the start of
 * a worker cycle; skip processing if false.
 */
export declare function tryAcquireWorkerLease(leaseKey: string, ttlSec?: number): Promise<boolean>;
//# sourceMappingURL=workerLock.d.ts.map