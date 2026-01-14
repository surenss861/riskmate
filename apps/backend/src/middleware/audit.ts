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
  | "site"
  | "user"
  | "signoff"
  | "organization"
  | "proof_pack";

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
// Maps to DB-allowed categories: 'governance', 'operations', 'access'
// The constraint only allows these three values, so we normalize all internal categories to these
function getCategoryFromEventName(eventName: string): 'governance' | 'operations' | 'access' {
  // Governance enforcement events (policy violations, auth blocks)
  if (eventName.includes('auth.') || eventName.includes('violation') || eventName.includes('policy.')) {
    return 'governance'
  }
  
  // Access/security events (logins, role changes, team/account management)
  if (eventName.includes('access.') || eventName.includes('security.') || eventName.includes('role_change') || 
      eventName.includes('login') || eventName.includes('team.') || eventName.includes('account.')) {
    return 'access'
  }
  
  // Review queue, incidents, attestations, exports, system events → operations
  // (These are all operational activities)
  if (eventName.includes('review.') || eventName.includes('incident.') || eventName.includes('corrective_action') ||
      eventName.includes('attestation.') || eventName.includes('export.') || eventName.includes('system.')) {
    return 'operations'
  }
  
  // Default to operations (most events are operational)
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

export type AuditWriteResult = {
  data: { id: string } | null
  error: { message: string } | null
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<AuditWriteResult> {
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

    // Build summary (humanize event name)
    const humanizeEventName = (name: string): string => {
      return name
        .replace(/\./g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
    }
    
    const summary = entry.metadata?.summary as string || 
      `${humanizeEventName(entry.eventName)}${entry.targetId ? ` for ${entry.targetType}` : ''}`

    // Get actor info for normalized fields
    const { data: actorData } = entry.actorId
      ? await supabase.from('users').select('email, role, full_name').eq('id', entry.actorId).single()
      : { data: null }

    // Helper to safely coerce values to objects for spreading
    const asObject = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

    // Build metadata with all extra fields (endpoint, request_id, ip, user_agent, etc.)
    // This prevents schema mismatches - everything goes into the JSONB metadata column
    const payloadObj = asObject(payload)
    const entryMetaObj = asObject(entry.metadata)
    
    // Build subject object safely
    const subjectObj: Record<string, unknown> = {
      type: entry.targetType,
      id: entry.targetId,
    }
    if (entryMetaObj.related_event_id) {
      subjectObj.related_event_id = entryMetaObj.related_event_id
    }
    
    // Build enriched metadata object
    const enrichedMetadata: Record<string, unknown> = {
      ...payloadObj,
      ...entryMetaObj,
      subject: subjectObj,
    }
    
    // Add request context fields if they exist (not as top-level columns)
    if (entryMetaObj.request_id) enrichedMetadata.request_id = entryMetaObj.request_id
    if (entryMetaObj.endpoint) enrichedMetadata.endpoint = entryMetaObj.endpoint
    if (entryMetaObj.ip) enrichedMetadata.ip = entryMetaObj.ip
    if (entryMetaObj.user_agent) enrichedMetadata.user_agent = entryMetaObj.user_agent
    if (entryMetaObj.related_event_id) enrichedMetadata.related_event_id = entryMetaObj.related_event_id

    // Only insert columns that actually exist in the audit_logs table
    // Extra fields go into metadata JSONB column
    const insertData: any = {
      organization_id: entry.organizationId,
      actor_id: entry.actorId ?? null,
      event_name: entry.eventName,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      metadata: enrichedMetadata,
      // Standardized fields (from enterprise upgrade migration)
      category: getCategoryFromEventName(entry.eventName),
      action: action,
      outcome: getOutcomeFromEventName(entry.eventName),
      severity: getSeverityFromEventName(entry.eventName),
      resource_type: resourceType,
      resource_id: resourceId,
      job_id: workRecordId ?? null,
      site_id: siteId ?? null,
      // Enriched actor fields (from enterprise upgrade migration)
      actor_email: actorData?.email || null,
      actor_role: actorData?.role || null,
      actor_name: (actorData && typeof actorData === 'object' && 'full_name' in actorData && typeof actorData.full_name === 'string')
        ? actorData.full_name
        : (actorData?.email || null),
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
      return { data: null, error: { message: error.message } }
    }

    // Invalidate executive cache only on material events
    const severity = getSeverityFromEventName(entry.eventName)
    if (isMaterialEvent(entry.eventName, severity)) {
      invalidateExecutiveCache(entry.organizationId);
    }

    return { data: insertedData ? { id: insertedData.id } : null, error: null }
  } catch (err: any) {
    console.error("Audit log exception:", err);
    return { data: null, error: { message: err?.message ?? 'Unknown audit log error' } }
  }
}

