import { supabase } from "../lib/supabaseClient";
import { invalidateExecutiveCache } from "../routes/executive";

export type AuditTargetType =
  | "job"
  | "mitigation"
  | "document"
  | "report"
  | "subscription"
  | "legal"
  | "system";

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
function getCategoryFromEventName(eventName: string): 'governance' | 'operations' | 'access' {
  if (eventName.includes('auth.') || eventName.includes('violation')) return 'governance'
  if (eventName.includes('team.') || eventName.includes('security.') || eventName.includes('account.')) return 'access'
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

    // Extract job_id if target is a job
    const jobId = entry.targetType === 'job' ? entry.targetId : null

    // Build summary
    const summary = entry.metadata?.summary as string || 
      `${entry.eventName.replace(/\./g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}${entry.targetId ? ` for ${entry.targetType}` : ''}`

    const insertData: any = {
      organization_id: entry.organizationId,
      actor_id: entry.actorId ?? null,
      event_name: entry.eventName,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      metadata: payload ?? {},
      // New standardized fields
      category: getCategoryFromEventName(entry.eventName),
      action: action,
      outcome: getOutcomeFromEventName(entry.eventName),
      severity: getSeverityFromEventName(entry.eventName),
      resource_type: resourceType,
      resource_id: resourceId,
      job_id: jobId,
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

