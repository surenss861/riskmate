import { SupabaseClient } from '@supabase/supabase-js'

interface AuditLogEntry {
  organizationId: string
  actorId: string
  eventName: string
  targetType: 'job' | 'event' | 'user' | 'control' | 'signoff' | 'system' | 'document'
  targetId?: string | null
  metadata?: Record<string, any>
}

/**
 * Record an audit log entry directly to Supabase
 * Simplified version for Next.js API routes (no backend dependency)
 */
export async function recordAuditLog(
  supabase: SupabaseClient,
  entry: AuditLogEntry
): Promise<{ data: { id: string } | null; error: any }> {
  try {
    // Determine category, severity, and outcome from event name
    const category = getCategoryFromEventName(entry.eventName)
    const severity = getSeverityFromEventName(entry.eventName)
    const outcome = getOutcomeFromEventName(entry.eventName)

    // Get actor info
    const { data: actorData } = await supabase
      .from('users')
      .select('email, role')
      .eq('id', entry.actorId)
      .single()

    const insertData: any = {
      organization_id: entry.organizationId,
      actor_id: entry.actorId,
      event_name: entry.eventName,
      target_type: entry.targetType,
      target_id: entry.targetId || null,
      metadata: entry.metadata || {},
      category,
      severity,
      outcome,
      // Normalized fields
      org_id: entry.organizationId,
      site_id: entry.metadata?.site_id || null,
      work_record_id: entry.metadata?.work_record_id || entry.metadata?.job_id || null,
      actor_email: actorData?.email || null,
      actor_role: actorData?.role || null,
      summary: entry.metadata?.summary || `${entry.eventName.replace(/\./g, ' ')}`,
    }

    // Extract job_id if target is a job
    if (entry.targetType === 'job' && entry.targetId) {
      insertData.work_record_id = entry.targetId
      insertData.job_id = entry.targetId
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('Audit log insert failed:', error)
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    console.error('Audit log exception:', err)
    return { data: null, error: err }
  }
}

/**
 * Categorize events into the three main Compliance Ledger tabs:
 * - governance: Blocked actions, policy enforcement, violations (system blocked something + why)
 * - operations: Human actions (assign/resolve/waive, corrective actions, incident closures, exports)
 * - access: Identity + permissions (access changes, logins, security events)
 */
function getCategoryFromEventName(eventName: string): 'governance' | 'operations' | 'access' | 'review_queue' | 'incident_review' | 'attestations' | 'access_review' | 'system' {
  // Governance Enforcement: blocked actions, policy enforcement, violations
  if (
    eventName.includes('auth.role_violation') ||
    eventName.includes('policy.denied') ||
    eventName.includes('rls.denied') ||
    eventName.includes('enforcement.blocked') ||
    eventName.includes('governance.enforcement')
  ) {
    return 'governance'
  }
  
  // Access & Security: identity + permissions changes
  if (
    eventName.includes('access.') ||
    eventName.includes('role.changed') ||
    eventName.includes('permission.') ||
    eventName.includes('login.') ||
    eventName.includes('session.terminated') ||
    eventName.includes('team.') ||
    eventName.includes('security.')
  ) {
    return 'access'
  }
  
  // Operational Actions: human work (default category)
  // Includes: review_queue.*, incident.*, export.*, proof_pack.*, attestation.*
  // Note: review_queue and incident_review are sub-categories but still count as "operations" for tab filtering
  if (eventName.includes('review_queue.') || (eventName.includes('review.') && !eventName.includes('access_review'))) return 'review_queue'
  if (eventName.includes('incident.')) return 'incident_review'
  if (eventName.includes('proof_pack.')) return 'system' // Proof packs are operational actions (exports)
  if (eventName.includes('export.')) return 'system' // Exports are operational actions
  if (eventName.includes('attestation.')) return 'attestations'
  if (eventName.includes('system.')) return 'system'
  
  // Default to operations (human actions)
  return 'operations'
}

function getSeverityFromEventName(eventName: string): 'info' | 'material' | 'critical' {
  if (eventName.includes('critical') || eventName.includes('violation')) return 'critical'
  if (eventName.includes('material') || eventName.includes('blocked')) return 'material'
  return 'info'
}

function getOutcomeFromEventName(eventName: string): 'allowed' | 'blocked' | 'success' | 'failed' {
  if (eventName.includes('violation') || eventName.includes('blocked')) return 'blocked'
  if (eventName.includes('failed') || eventName.includes('error')) return 'failed'
  if (eventName.includes('assigned') || eventName.includes('resolved') || eventName.includes('created')) return 'success'
  return 'allowed'
}

