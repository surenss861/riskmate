"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAuditLog = recordAuditLog;
const supabaseClient_1 = require("../lib/supabaseClient");
const MAX_METADATA_SIZE = 8000;
const truncateMetadata = (metadata) => {
    if (!metadata)
        return metadata;
    const json = JSON.stringify(metadata);
    if (json.length <= MAX_METADATA_SIZE) {
        return metadata;
    }
    const truncated = json.slice(0, MAX_METADATA_SIZE);
    try {
        return JSON.parse(truncated);
    }
    catch {
        return { truncated: true };
    }
};
async function recordAuditLog(entry) {
    try {
        const payload = truncateMetadata(entry.metadata);
        const { error } = await supabaseClient_1.supabase.from("audit_logs").insert({
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
    }
    catch (err) {
        console.error("Audit log exception:", err);
    }
}
//# sourceMappingURL=audit.js.map