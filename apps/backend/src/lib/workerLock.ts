/**
 * Distributed worker lease: only one instance runs each scheduled worker cycle.
 * Uses Postgres worker_leases table via try_acquire_worker_lease RPC.
 */

import { supabase } from './supabaseClient'

/** Lease key constants — must match single-instance semantics per worker type. */
export const WORKER_LEASE_KEYS = {
  weekly_digest: 'worker:weekly_digest',
  deadline_reminder: 'worker:deadline_reminder',
  task_reminder: 'worker:task_reminder',
  email_queue: 'worker:email_queue',
} as const

const DEFAULT_TTL_SEC = 300 // 5 minutes — covers one cycle run

/** Unique holder id for this process (instance + pid). */
function getHolderId(): string {
  const deployment = process.env.RAILWAY_DEPLOYMENT_ID ?? process.env.HOSTNAME ?? 'local'
  return `${deployment}:${process.pid}`
}

/**
 * Try to acquire the lease for the given key. Returns true if this process has the lease
 * (acquired or renewed); false if another instance holds it. Call once at the start of
 * a worker cycle; skip processing if false.
 */
export async function tryAcquireWorkerLease(leaseKey: string, ttlSec: number = DEFAULT_TTL_SEC): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('try_acquire_worker_lease', {
      p_key: leaseKey,
      p_holder: getHolderId(),
      p_ttl_sec: ttlSec,
    })
    if (error) {
      console.warn('[WorkerLock] try_acquire_worker_lease failed:', error.message)
      return false
    }
    return data === true
  } catch (e) {
    console.warn('[WorkerLock] tryAcquireWorkerLease error:', e)
    return false
  }
}
