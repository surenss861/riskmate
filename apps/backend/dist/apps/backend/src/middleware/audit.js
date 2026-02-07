"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractClientMetadata = extractClientMetadata;
exports.recordAuditLog = recordAuditLog;
const supabaseClient_1 = require("../lib/supabaseClient");
const executive_1 = require("../routes/executive");
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
// Helper to determine category from event name
// Maps to DB-allowed categories: 'governance', 'operations', 'access'
// The constraint only allows these three values, so we normalize all internal categories to these
function getCategoryFromEventName(eventName) {
    // Governance enforcement events (policy violations, auth blocks)
    if (eventName.includes('auth.') || eventName.includes('violation') || eventName.includes('policy.')) {
        return 'governance';
    }
    // Role changes → governance (immutable audit trail for who changed whom)
    if (eventName === 'user_role_changed' || eventName.includes('user_role_changed')) {
        return 'governance';
    }
    // Access/security events (logins, team/account management)
    if (eventName.includes('access.') || eventName.includes('security.') ||
        eventName.includes('login') || eventName.includes('team.') || eventName.includes('account.')) {
        return 'access';
    }
    // Review queue, incidents, attestations, exports, system events → operations
    // (These are all operational activities)
    if (eventName.includes('review.') || eventName.includes('incident.') || eventName.includes('corrective_action') ||
        eventName.includes('attestation.') || eventName.includes('export.') || eventName.includes('system.')) {
        return 'operations';
    }
    // Default to operations (most events are operational)
    return 'operations';
}
// Helper to determine outcome from event name
function getOutcomeFromEventName(eventName) {
    if (eventName.includes('violation') || eventName.includes('blocked') || eventName.includes('denied'))
        return 'blocked';
    return 'allowed';
}
// Helper to determine severity from event name
function getSeverityFromEventName(eventName) {
    if (eventName.includes('violation') || eventName.includes('critical'))
        return 'critical';
    if (eventName.includes('flag') || eventName.includes('change') || eventName.includes('remove'))
        return 'material';
    return 'info';
}
// Helper to determine if an event is material (should invalidate executive cache)
function isMaterialEvent(eventName, severity) {
    // Material events: violations, flags, sign-offs, risk score threshold crossings
    if (severity === 'critical' || severity === 'material')
        return true;
    if (eventName.includes('violation'))
        return true;
    if (eventName.includes('flag'))
        return true;
    if (eventName.includes('signoff'))
        return true;
    if (eventName.includes('risk_score_changed'))
        return true;
    return false;
}
/**
 * Extract client metadata from request (for audit logging)
 * Looks for client, app_version, device_id in headers or body.
 * Defaults to 'unknown' when header exists but value missing so audit rows are never missing these.
 */
function extractClientMetadata(req) {
    if (!req)
        return { client: 'unknown', appVersion: 'unknown', deviceId: 'unknown' };
    const client = req.headers?.['x-client'] || req.headers?.['client'] || req.body?.client || 'web';
    const appVersion = req.headers?.['x-app-version'] || req.headers?.['app-version'] || req.body?.app_version || 'unknown';
    const deviceId = req.headers?.['x-device-id'] || req.headers?.['device-id'] || req.body?.device_id || 'unknown';
    return {
        client: client || 'web',
        appVersion: appVersion || 'unknown',
        deviceId: deviceId || 'unknown',
    };
}
async function recordAuditLog(entry) {
    try {
        // Always attach client, app_version, device_id (default 'unknown' when missing)
        const clientMetadata = {
            client: entry.client ?? 'unknown',
            app_version: entry.appVersion ?? 'unknown',
            device_id: entry.deviceId ?? 'unknown',
        };
        const payload = truncateMetadata({
            ...entry.metadata,
            ...clientMetadata,
        });
        // Extract action from event name (e.g., "job.created" -> "job.create")
        const action = entry.eventName.replace(/\.(created|updated|deleted|flagged|unflagged)$/, (match) => {
            if (match.includes('created'))
                return '.create';
            if (match.includes('updated'))
                return '.update';
            if (match.includes('deleted'))
                return '.delete';
            if (match.includes('flagged'))
                return '.flag';
            if (match.includes('unflagged'))
                return '.unflag';
            return match;
        });
        // Determine resource type and ID
        const resourceType = entry.targetType;
        const resourceId = entry.targetId;
        // Extract normalized fields from metadata or target type
        const workRecordId = entry.metadata?.work_record_id || (entry.targetType === 'job' ? entry.targetId : null);
        const siteId = entry.metadata?.site_id || null;
        // Build summary (humanize event name)
        const humanizeEventName = (name) => {
            return name
                .replace(/\./g, ' ')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase());
        };
        const summary = entry.metadata?.summary ||
            `${humanizeEventName(entry.eventName)}${entry.targetId ? ` for ${entry.targetType}` : ''}`;
        // Get actor info for normalized fields
        const { data: actorData } = entry.actorId
            ? await supabaseClient_1.supabase.from('users').select('email, role, full_name').eq('id', entry.actorId).single()
            : { data: null };
        // Helper to safely coerce values to objects for spreading
        const asObject = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        // Build metadata with all extra fields (endpoint, request_id, ip, user_agent, etc.)
        // This prevents schema mismatches - everything goes into the JSONB metadata column
        const payloadObj = asObject(payload);
        const entryMetaObj = asObject(entry.metadata);
        // Build subject object safely
        const subjectObj = {
            type: entry.targetType,
            id: entry.targetId,
        };
        if (entryMetaObj.related_event_id) {
            subjectObj.related_event_id = entryMetaObj.related_event_id;
        }
        // Build enriched metadata object
        const enrichedMetadata = {
            ...payloadObj,
            ...entryMetaObj,
            subject: subjectObj,
        };
        // Add request context fields if they exist (not as top-level columns)
        if (entryMetaObj.request_id)
            enrichedMetadata.request_id = entryMetaObj.request_id;
        if (entryMetaObj.endpoint)
            enrichedMetadata.endpoint = entryMetaObj.endpoint;
        if (entryMetaObj.ip)
            enrichedMetadata.ip = entryMetaObj.ip;
        if (entryMetaObj.user_agent)
            enrichedMetadata.user_agent = entryMetaObj.user_agent;
        if (entryMetaObj.related_event_id)
            enrichedMetadata.related_event_id = entryMetaObj.related_event_id;
        // Only insert columns that actually exist in the audit_logs table
        // Extra fields go into metadata JSONB column
        const insertData = {
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
        };
        // Add policy fields for violations
        if (entry.eventName.includes('violation')) {
            insertData.policy_statement = entry.metadata?.policy_statement ||
                'Role-based access control prevents unauthorized actions';
        }
        const { error, data: insertedData } = await supabaseClient_1.supabase.from("audit_logs").insert(insertData).select('id').single();
        if (error) {
            console.error("Audit log insert failed:", error);
            return { data: null, error: { message: error.message } };
        }
        // Invalidate executive cache only on material events
        const severity = getSeverityFromEventName(entry.eventName);
        if (isMaterialEvent(entry.eventName, severity)) {
            (0, executive_1.invalidateExecutiveCache)(entry.organizationId);
        }
        return { data: insertedData ? { id: insertedData.id } : null, error: null };
    }
    catch (err) {
        console.error("Audit log exception:", err);
        return { data: null, error: { message: err?.message ?? 'Unknown audit log error' } };
    }
}
//# sourceMappingURL=audit.js.map