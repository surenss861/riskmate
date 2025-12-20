import { supabase } from "../lib/supabaseClient";
import { invalidateExecutiveCache } from "../routes/executive";

export type AuditTargetType =
  | "job"
  | "mitigation"
  | "document"
  | "report"
  | "subscription"
  | "legal"
  | "system"
  | "site";

export interface AuditLogEntry {
  organizationId: string;
  actorId?: string | null;
  eventName: string;
  targetType: AuditTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

const MAX_METADATA_SIZE = 8000;

const truncateMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return metadata;
  const json = JSON.stringify(metadata);
  if (json.length <= MAX_METADATA_SIZE) {
    return metadata;
  }

  const truncated = json.slice(0, MAX_METADATA_SIZE);
  try {
    return JSON.parse(truncated);
  } catch {
    return { truncated: true };
  }
};

// Helper to determine category from event name
// Maps to all categories: governance, operations, access, review_queue, incident_review, attestations, access_review, system
function getCategoryFromEventName(eventName: string): 'governance' | 'operations' | 'access' | 'review_queue' | 'incident_review' | 'attestations' | 'access_review' | 'system' {
  // Review queue events
  if (eventName.includes('review.')) return 'review_queue'
  
  // Incident review events
  if (eventName.includes('incident.') || eventName.includes('corrective_action')) return 'incident_review'
  
  // Attestation events
  if (eventName.includes('attestation.')) return 'attestations'
  
  // Access review events
  if (eventName.includes('access.') || eventName.includes('security.') || eventName.includes('role_change') || eventName.includes('login')) return 'access_review'
  
  // Governance enforcement events
  if (eventName.includes('auth.') || eventName.includes('violation') || eventName.includes('policy.')) return 'governance'
  
  // System/export events
  if (eventName.includes('export.') || eventName.includes('system.')) return 'system'
  
  // Team/account management (legacy)
  if (eventName.includes('team.') || eventName.includes('account.')) return 'access_review'
  
  // Default to operations
  return 'operations'
}

// Helper to determine outcome from event name
function getOutcomeFromEventName(eventName: string): 'allowed' | 'blocked' {
  if (eventName.includes('violation') || eventName.includes('blocked') || eventName.includes('denied')) return 'blocked'
  return 'allowed'
}

// Helper to determine severity from event name
function getSeverityFromEventName(eventName: string): 'info' | 'material' | 'critical' {
  if (eventName.includes('violation') || eventName.includes('critical')) return 'critical'
  if (eventName.includes('flag') || eventName.includes('change') || eventName.includes('remove')) return 'material'
  return 'info'
}

// Helper to determine if an event is material (should invalidate executive cache)
function isMaterialEvent(eventName: string, severity: 'info' | 'material' | 'critical'): boolean {
  // Material events: violations, flags, sign-offs, risk score threshold crossings
  if (severity === 'critical' || severity === 'material') return true
  if (eventName.includes('violation')) return true
  if (eventName.includes('flag')) return true
  if (eventName.includes('signoff')) return true
  if (eventName.includes('risk_score_changed')) return true
  return false
}

export async function recordAuditLog(entry: AuditLogEntry) {
  try {
    const payload = truncateMetadata(entry.metadata);
    
    // Extract action from event name (e.g., "job.created" -> "job.create")
    const action = entry.eventName.replace(/\.(created|updated|deleted|flagged|unflagged)$/, (match) => {
      if (match.includes('created')) return '.create'
      if (match.includes('updated')) return '.update'
      if (match.includes('deleted')) return '.delete'
      if (match.includes('flagged')) return '.flag'
      if (match.includes('unflagged')) return '.unflag'
      return match
    })

    // Determine resource type and ID
    const resourceType = entry.targetType
    const resourceId = entry.targetId

    // Extract normalized fields from metadata or target type
    const workRecordId = (entry.metadata?.work_record_id as string) || (entry.targetType === 'job' ? entry.targetId : null)
    const siteId = entry.metadata?.site_id as string || null

    // Build summary
    const summary = entry.metadata?.summary as string || 
      `${entry.eventName.replace(/\./g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}${entry.targetId ? ` for ${entry.targetType}` : ''}`

    // Get actor info for normalized fields
    const { data: actorData } = entry.actorId
      ? await supabase.from('users').select('email, role').eq('id', entry.actorId).single()
      : { data: null }

    const insertData: any = {
      organization_id: entry.organizationId,
      actor_id: entry.actorId ?? null,
      event_name: entry.eventName,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      metadata: payload ?? {},
      // Standardized fields for easier querying
      category: getCategoryFromEventName(entry.eventName),
      action: action,
      outcome: getOutcomeFromEventName(entry.eventName),
      severity: getSeverityFromEventName(entry.eventName),
      resource_type: resourceType,
      resource_id: resourceId,
      job_id: workRecordId, // Use work_record_id from metadata if available
      work_record_id: workRecordId, // Normalized field name
      site_id: siteId,
      actor_user_id: entry.actorId ?? null,
      actor_email: actorData?.email || null,
      actor_role: actorData?.role || null,
      request_id: entry.metadata?.request_id as string || null,
      endpoint: entry.metadata?.endpoint as string || null,
      ip: entry.metadata?.ip as string || null,
      user_agent: entry.metadata?.user_agent as string || null,
      subject: {
        type: entry.targetType,
        id: entry.targetId,
        related_event_id: entry.metadata?.related_event_id as string || null,
      },
      summary: summary,
    }

    // Add policy fields for violations
    if (entry.eventName.includes('violation')) {
      insertData.policy_statement = entry.metadata?.policy_statement as string || 
        'Role-based access control prevents unauthorized actions'
    }

    const { error, data: insertedData } = await supabase.from("audit_logs").insert(insertData).select('id').single();

    if (error) {
      console.error("Audit log insert failed:", error);
    } else {
      // Invalidate executive cache only on material events
      const severity = getSeverityFromEventName(entry.eventName)
      if (isMaterialEvent(entry.eventName, severity)) {
        invalidateExecutiveCache(entry.organizationId);
      }
    }
  } catch (err) {
    console.error("Audit log exception:", err);
  }
}

