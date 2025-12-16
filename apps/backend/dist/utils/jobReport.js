"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildJobReport = buildJobReport;
const supabaseClient_1 = require("../lib/supabaseClient");
async function buildJobReport(organizationId, jobId) {
    const { data: job, error: jobError } = await supabaseClient_1.supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("organization_id", organizationId)
        .single();
    if (jobError || !job) {
        throw jobError ?? new Error("Job not found");
    }
    const { data: riskScore } = await supabaseClient_1.supabase
        .from("job_risk_scores")
        .select("*")
        .eq("job_id", jobId)
        .single();
    const { data: mitigationItems } = await supabaseClient_1.supabase
        .from("mitigation_items")
        .select("id, title, description, done, is_completed, completed_at, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
    const { data: documentsData } = await supabaseClient_1.supabase
        .from("documents")
        .select("id, name, type, file_path, mime_type, description, created_at, uploaded_by")
        .eq("job_id", jobId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });
    // Generate signed URLs for documents
    const documents = await Promise.all((documentsData || []).map(async (doc) => {
        try {
            const { data: signed } = await supabaseClient_1.supabase.storage
                .from("documents")
                .createSignedUrl(doc.file_path, 60 * 60); // 1 hour expiry
            return {
                ...doc,
                url: signed?.signedUrl || null,
            };
        }
        catch (error) {
            console.warn("Failed to generate document signed URL", error);
            return {
                ...doc,
                url: null,
            };
        }
    }));
    // Fetch audit logs with user names
    const { data: auditLogsData } = await supabaseClient_1.supabase
        .from("audit_logs")
        .select("id, event_name, target_type, target_id, actor_id, metadata, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(250);
    // Get unique actor IDs
    const actorIds = [...new Set((auditLogsData || []).map((log) => log.actor_id).filter(Boolean))];
    // Fetch user names
    let usersMap = new Map();
    if (actorIds.length > 0) {
        const { data: usersData } = await supabaseClient_1.supabase
            .from("users")
            .select("id, full_name, email")
            .in("id", actorIds);
        usersMap = new Map((usersData || []).map((u) => [u.id, u]));
    }
    // Enrich audit logs with user names
    const auditLogs = (auditLogsData || []).map((log) => {
        const user = log.actor_id ? usersMap.get(log.actor_id) : null;
        return {
            ...log,
            actor_name: user?.full_name || null,
            actor_email: user?.email || null,
        };
    });
    const { data: organization } = await supabaseClient_1.supabase
        .from("organizations")
        .select("id, name, logo_url, accent_color, subscription_tier")
        .eq("id", organizationId)
        .single();
    const filteredAudit = (auditLogs || []).filter((log) => {
        if (log.target_id === jobId)
            return true;
        const metadata = (log.metadata || {});
        return metadata?.job_id === jobId;
    });
    return {
        job,
        risk_score: riskScore ?? null,
        risk_factors: riskScore?.factors ?? [],
        mitigations: mitigationItems ?? [],
        documents: documents ?? [],
        audit: filteredAudit,
        organization: organization ?? null,
    };
}
//# sourceMappingURL=jobReport.js.map