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

function getCategoryFromEventName(eventName: string): 'governance' | 'operations' | 'access' | 'review_queue' | 'incident_review' | 'attestations' | 'access_review' | 'system' {
  if (eventName.includes('auth.') || eventName.includes('violation')) return 'governance'
  if (eventName.includes('review.')) return 'review_queue'
  if (eventName.includes('incident.')) return 'incident_review'
  if (eventName.includes('access.') || eventName.includes('team.') || eventName.includes('security.')) return 'access'
  if (eventName.includes('attestation.')) return 'attestations'
  if (eventName.includes('export.') || eventName.includes('system.')) return 'system'
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

