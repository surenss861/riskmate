import { supabase } from "../lib/supabaseClient";

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

export async function recordAuditLog(entry: AuditLogEntry) {
  try {
    const payload = truncateMetadata(entry.metadata);
    const { error } = await supabase.from("audit_logs").insert({
      organization_id: entry.organizationId,
      actor_id: entry.actorId ?? null,
      event_name: entry.eventName,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      metadata: payload ?? {},
    });

    if (error) {
      console.error("Audit log insert failed:", error);
    }
  } catch (err) {
    console.error("Audit log exception:", err);
  }
}

