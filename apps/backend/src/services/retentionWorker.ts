/**
 * Retention and Cleanup Worker
 * 
 * Handles:
 * - Export artifact retention (per plan tier)
 * - Failed/canceled export cleanup
 * - Orphaned evidence blob cleanup
 * - Storage lifecycle management
 */

import { supabase } from '../lib/supabaseClient'
import { logStructured } from '../utils/structuredLog'

const RETENTION_INTERVAL_MS = 60 * 60 * 1000 // Run every hour

// Retention periods (in days) per plan tier
const RETENTION_PERIODS: Record<string, number> = {
  starter: 30,
  pro: 90,
  business: 365,
  enterprise: 730, // 2 years
}

let retentionWorkerRunning = false
let retentionWorkerInterval: NodeJS.Timeout | null = null

/**
 * Start the retention worker
 */
export function startRetentionWorker() {
  if (retentionWorkerRunning) {
    console.log('[RetentionWorker] Already running')
    return
  }

  console.log('[RetentionWorker] Starting...')
  retentionWorkerRunning = true

  // Process immediately, then on interval
  processRetention()
  retentionWorkerInterval = setInterval(processRetention, RETENTION_INTERVAL_MS)
}

/**
 * Stop the retention worker
 */
export function stopRetentionWorker() {
  if (retentionWorkerInterval) {
    clearInterval(retentionWorkerInterval)
    retentionWorkerInterval = null
  }
  retentionWorkerRunning = false
  console.log('[RetentionWorker] Stopped')
}

/**
 * Process retention and cleanup
 */
async function processRetention() {
  try {
    await cleanupExpiredExports()
    await cleanupFailedExports()
    await cleanupOrphanedEvidence()
  } catch (err: any) {
    logStructured('error', 'Retention worker error', {
      error: err.message,
    })
  }
}

/**
 * Clean up expired exports based on plan retention period
 */
async function cleanupExpiredExports() {
  // Get all orgs with their plan tiers
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, plan_tier')

  if (!orgs) return

  for (const org of orgs) {
    const retentionDays = RETENTION_PERIODS[org.plan_tier || 'starter'] || 30
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // Find expired exports
    const { data: expiredExports } = await supabase
      .from('exports')
      .select('id, storage_path, manifest_path, organization_id')
      .eq('organization_id', org.id)
      .eq('state', 'ready')
      .lt('completed_at', cutoffDate.toISOString())

    if (!expiredExports || expiredExports.length === 0) continue

    logStructured('info', `Cleaning up ${expiredExports.length} expired exports`, {
      org_id: org.id,
      retention_days: retentionDays,
    })

    // Delete from storage
    for (const exp of expiredExports) {
      try {
        if (exp.storage_path) {
          await supabase.storage
            .from('exports')
            .remove([exp.storage_path])
        }
        if (exp.manifest_path) {
          await supabase.storage
            .from('exports')
            .remove([exp.manifest_path])
        }

        // Mark as expired in DB
        await supabase
          .from('exports')
          .update({ state: 'expired' })
          .eq('id', exp.id)
      } catch (err: any) {
        logStructured('error', 'Failed to cleanup export', {
          export_id: exp.id,
          org_id: org.id,
          error: err.message,
        })
      }
    }
  }
}

/**
 * Clean up failed/canceled exports (immediate cleanup)
 */
async function cleanupFailedExports() {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7) // Keep failed exports for 7 days for debugging

  const { data: failedExports } = await supabase
    .from('exports')
    .select('id, storage_path, manifest_path, organization_id')
    .in('state', ['failed', 'canceled'])
    .lt('created_at', cutoffDate.toISOString())

  if (!failedExports || failedExports.length === 0) return

  logStructured('info', `Cleaning up ${failedExports.length} failed/canceled exports`, {})

  for (const exp of failedExports) {
    try {
      if (exp.storage_path) {
        await supabase.storage
          .from('exports')
          .remove([exp.storage_path])
      }
      if (exp.manifest_path) {
        await supabase.storage
          .from('exports')
          .remove([exp.manifest_path])
      }

      // Delete DB row
      await supabase
        .from('exports')
        .delete()
        .eq('id', exp.id)
    } catch (err: any) {
      logStructured('error', 'Failed to cleanup failed export', {
        export_id: exp.id,
        org_id: exp.organization_id,
        error: err.message,
      })
    }
  }
}

/**
 * Clean up orphaned evidence blobs (evidence in storage but no DB row)
 * This is rare but can happen if DB insert fails after storage upload
 */
async function cleanupOrphanedEvidence() {
  // This is expensive, so we only run it once per day
  const lastRunKey = 'last_orphan_cleanup'
  const lastRun = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .single()

  // For now, skip orphaned cleanup (would need to list all storage files)
  // Can be implemented later if needed
  logStructured('debug', 'Orphaned evidence cleanup skipped (not implemented)', {})
}
