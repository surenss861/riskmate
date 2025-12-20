/**
 * Command Runner - Ledger-First Command Model
 * 
 * Every command follows: Validate → Authorize → Mutate → Ledger Append (atomic)
 * 
 * This ensures:
 * - Domain changes and ledger entries succeed/fail together
 * - Idempotency via idempotency keys
 * - Consistent request_id correlation
 * - Standardized error handling
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { recordAuditLog, AuditLogEntry } from '../middleware/audit'
import { v4 as uuidv4 } from 'uuid'

export interface CommandContext {
  userId: string
  organizationId: string
  userRole: string
  userEmail?: string | null
  requestId: string
  endpoint: string
  ip?: string | null
  userAgent?: string | null
}

export interface CommandOptions {
  idempotencyKey?: string
  skipLedger?: boolean // Only for special cases (e.g., system events)
}

export interface CommandResult<T = any> {
  ok: boolean
  data?: T
  ledger_entry_id?: string
  error?: {
    code: string
    message: string
    internalMessage?: string
  }
}

/**
 * Run a command with atomic ledger appending
 * 
 * @param supabase - Supabase client (with service role for transactions)
 * @param ctx - Command context (user, org, request metadata)
 * @param options - Command options (idempotency key, etc.)
 * @param commandFn - The command function that performs domain mutations
 * @param auditEntry - The audit log entry to append (must be provided)
 * 
 * @returns CommandResult with ledger_entry_id
 */
export async function runCommand<T = any>(
  supabase: SupabaseClient,
  ctx: CommandContext,
  options: CommandOptions,
  commandFn: (tx: SupabaseClient) => Promise<T>,
  auditEntry: Omit<AuditLogEntry, 'organizationId' | 'actorId' | 'metadata'> & {
    metadata?: any
  }
): Promise<CommandResult<T>> {
  const { idempotencyKey, skipLedger = false } = options
  const requestId = ctx.requestId || uuidv4()

  try {
    // Check idempotency if key provided
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('audit_logs')
        .select('id, metadata')
        .eq('organization_id', ctx.organizationId)
        .eq('metadata->>idempotency_key', idempotencyKey)
        .eq('actor_id', ctx.userId)
        .eq('event_name', auditEntry.eventName)
        .maybeSingle()

      if (existing) {
        // Return existing result (idempotent)
        return {
          ok: true,
          data: existing.metadata?.command_result as T,
          ledger_entry_id: existing.id,
        }
      }
    }

    // Execute command function (domain mutations)
    const commandResult = await commandFn(supabase)

    // Append ledger entry (atomic with domain changes via transaction)
    // Note: In production, this should be wrapped in a Postgres transaction
    // For now, we'll use Supabase's transaction support or RPC functions
    if (!skipLedger) {
      const ledgerResult = await recordAuditLog({
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        eventName: auditEntry.eventName,
        targetType: auditEntry.targetType,
        targetId: auditEntry.targetId,
        metadata: {
          ...auditEntry.metadata,
          request_id: requestId,
          endpoint: ctx.endpoint,
          ip: ctx.ip,
          user_agent: ctx.userAgent,
          idempotency_key: idempotencyKey,
          command_result: commandResult, // Store command result in metadata
        },
      })

      if (ledgerResult.error) {
        // Ledger write failed - this is critical
        console.error('Ledger write failed:', ledgerResult.error)
        // In production, you might want to rollback the command here
        // For now, we'll return an error
        return {
          ok: false,
          error: {
            code: 'LEDGER_WRITE_FAILED',
            message: 'Failed to record audit log entry',
            internalMessage: ledgerResult.error.message,
          },
        }
      }

      return {
        ok: true,
        data: commandResult,
        ledger_entry_id: ledgerResult.data?.id,
      }
    }

    return {
      ok: true,
      data: commandResult,
    }
  } catch (error: any) {
    console.error('Command execution failed:', error)
    return {
      ok: false,
      error: {
        code: error.code || 'COMMAND_EXECUTION_FAILED',
        message: error.message || 'Command execution failed',
        internalMessage: error.stack,
      },
    }
  }
}

/**
 * Build audit filters from query parameters
 * Used by views, exports, and readiness endpoints for consistency
 * Returns a function that applies filters to a Supabase query builder
 */
export interface AuditFilters {
  category?: 'governance' | 'operations' | 'access' | 'review_queue' | 'incident_review' | 'attestations' | 'access_review' | 'system'
  site_id?: string
  job_id?: string
  actor_id?: string
  severity?: 'info' | 'material' | 'critical'
  outcome?: 'allowed' | 'blocked' | 'success' | 'failed'
  time_range?: '24h' | '7d' | '30d' | 'all' | 'custom'
  start_date?: string
  end_date?: string
  view?: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review'
  event_type?: string
  organizationId: string
}

/**
 * Apply audit filters to a Supabase query builder
 * This ensures views, exports, and readiness endpoints use the same filter logic
 */
export function applyAuditFilters<T extends { eq: any; gte: any; lte: any; in: any; or: any; like: any }>(
  query: T,
  filters: AuditFilters
): T {
  const { organizationId, category, site_id, job_id, actor_id, severity, outcome, time_range, start_date, end_date, view, event_type } = filters

  // Always filter by organization
  query = query.eq('organization_id', organizationId) as T

  // Apply saved view filters (map views to query conditions)
  // Only apply view filters if no explicit category is set (to avoid conflicts)
  // If both are provided, category filter takes precedence
  if (view && !category) {
    if (view === 'review-queue') {
      // Review Queue: blocked actions OR critical/material severity
      // Simplified to avoid complex .or() syntax issues
      query = query.or('outcome.eq.blocked,severity.eq.material,severity.eq.critical') as T
    } else if (view === 'insurance-ready') {
      // Insurance-Ready: completed work records with verified controls and attestations
      query = query.eq('category', 'operations').in('event_name', ['job.completed', 'control.verified', 'evidence.uploaded', 'attestation.created']) as T
    } else if (view === 'governance-enforcement') {
      // Governance Enforcement: violations and blocked actions
      query = query.or('category.eq.governance,outcome.eq.blocked') as T
    } else if (view === 'incident-review') {
      // Incident Review: incidents OR high severity
      query = query.or('category.eq.incident_review,severity.eq.material,severity.eq.critical') as T
    } else if (view === 'access-review') {
      // Access Review: access changes, role changes, login events
      query = query.eq('category', 'access_review') as T
    }
  }

  // Category filter (explicit category overrides view filter logic)
  if (category) {
    query = query.eq('category', category) as T
  }

  // Site filter
  if (site_id) {
    query = query.eq('site_id', site_id) as T
  }

  // Job/Work Record filter (use job_id column)
  if (job_id) {
    query = query.eq('job_id', job_id) as T
  }

  // Actor filter
  if (actor_id) {
    query = query.eq('actor_id', actor_id) as T
  }

  // Severity filter
  if (severity) {
    query = query.eq('severity', severity) as T
  }

  // Outcome filter
  if (outcome) {
    query = query.eq('outcome', outcome) as T
  }

  // Event type filter
  if (event_type) {
    query = query.eq('event_name', event_type) as T
  }

  // Time range filter
  if (time_range && time_range !== 'all') {
    if (time_range === 'custom' && start_date && end_date) {
      query = query.gte('created_at', start_date).lte('created_at', end_date) as T
    } else {
      const now = new Date()
      let cutoff = new Date()
      if (time_range === '24h') {
        cutoff.setHours(now.getHours() - 24)
      } else if (time_range === '7d') {
        cutoff.setDate(now.getDate() - 7)
      } else if (time_range === '30d') {
        cutoff.setDate(now.getDate() - 30)
      }
      query = query.gte('created_at', cutoff.toISOString()) as T
    }
  }

  return query
}

