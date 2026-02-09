import { supabase } from "../lib/supabaseClient";

export interface OrganizationBranding {
  id: string;
  name: string;
  logo_url?: string | null;
  accent_color?: string | null;
  subscription_tier?: string | null;
}

export interface JobReportPayload {
  job: any;
  risk_score: any | null;
  risk_factors: any[];
  mitigations: any[];
  documents: any[];
  audit: any[];
  organization: OrganizationBranding | null;
}

export async function buildJobReport(
  organizationId: string,
  jobId: string
): Promise<JobReportPayload> {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single();

  if (jobError || !job) {
    throw jobError ?? new Error("Job not found");
  }

  const { data: riskScore } = await supabase
    .from("job_risk_scores")
    .select("*")
    .eq("job_id", jobId)
    .single();

  const { data: mitigationItems } = await supabase
    .from("mitigation_items")
    .select("id, title, description, done, is_completed, completed_at, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  const { data: documentsData } = await supabase
    .from("documents")
    .select("id, name, type, file_path, mime_type, description, created_at, uploaded_by")
    .eq("job_id", jobId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  // Fetch job_photos for category (before/during/after) to attach to photo documents
  const { data: jobPhotos } = await supabase
    .from("job_photos")
    .select("file_path, category")
    .eq("job_id", jobId)
    .eq("organization_id", organizationId);

  const categoryByPath = new Map(
    (jobPhotos || []).map((p) => [p.file_path, p.category as "before" | "during" | "after"])
  );

  // Image evidence: pull storage paths and join with job_photos for category, then merge into documents for PDF/reports
  const IMAGE_MIME_PREFIX = "image/";
  const { data: imageEvidence } = await supabase
    .from("evidence")
    .select("id, storage_path, file_name, mime_type, phase, evidence_type, created_at, uploaded_by")
    .eq("work_record_id", jobId)
    .eq("organization_id", organizationId)
    .eq("state", "sealed");

  const PHOTO_CATEGORIES = ["before", "during", "after"] as const;
  const evidencePhotoItems =
    (imageEvidence || [])
      .filter((ev) => ev.mime_type?.toLowerCase().startsWith(IMAGE_MIME_PREFIX))
      .map((ev) => {
        const fromJobPhotos = categoryByPath.get(ev.storage_path ?? "");
        const fromPhase =
          ev.phase && PHOTO_CATEGORIES.includes(ev.phase as (typeof PHOTO_CATEGORIES)[number])
            ? (ev.phase as (typeof PHOTO_CATEGORIES)[number])
            : null;
        const category = fromJobPhotos ?? fromPhase ?? null;
        return {
          id: ev.id,
          file_path: ev.storage_path ?? "",
          name: ev.file_name ?? "Evidence",
          type: "photo" as const,
          mime_type: ev.mime_type ?? null,
          description: ev.evidence_type || ev.file_name || null,
          created_at: ev.created_at ?? null,
          uploaded_by: ev.uploaded_by ?? null,
          ...(category != null ? { category } : {}),
          source_bucket: "evidence" as const,
        };
      });

  // Generate signed URLs for evidence photos (url for exports)
  const evidencePhotosWithUrl = await Promise.all(
    evidencePhotoItems.map(async (item) => {
      try {
        const { data: signed } = await supabase.storage
          .from("evidence")
          .createSignedUrl(item.file_path, 60 * 60);
        return { ...item, url: signed?.signedUrl ?? null };
      } catch (error) {
        console.warn("Failed to generate evidence photo signed URL", error);
        return { ...item, url: null };
      }
    })
  );

  // Generate signed URLs for documents
  const documentsFromTable = await Promise.all(
    (documentsData || []).map(async (doc) => {
      try {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 60 * 60); // 1 hour expiry

        return {
          ...doc,
          ...(doc.type === "photo" ? { category: categoryByPath.get(doc.file_path) ?? null } : {}),
          url: signed?.signedUrl || null,
        };
      } catch (error) {
        console.warn("Failed to generate document signed URL", error);
        return {
          ...doc,
          ...(doc.type === "photo" ? { category: categoryByPath.get(doc.file_path) ?? null } : {}),
          url: null,
        };
      }
    })
  );

  // Merge evidence photos into documents so PDF/reports receive categorized evidence alongside document photos
  const documents = [...documentsFromTable, ...evidencePhotosWithUrl].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );

  // Fetch audit logs with user names
  const { data: auditLogsData } = await supabase
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
    const { data: usersData } = await supabase
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

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, logo_url, accent_color, subscription_tier")
    .eq("id", organizationId)
    .single();

  const filteredAudit = (auditLogs || []).filter((log) => {
    if (log.target_id === jobId) return true;
    const metadata = (log.metadata || {}) as Record<string, any>;
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
