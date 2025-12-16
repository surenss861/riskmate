"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const riskScoring_1 = require("../utils/riskScoring");
const notifications_1 = require("../services/notifications");
const jobReport_1 = require("../utils/jobReport");
const limits_1 = require("../middleware/limits");
exports.jobsRouter = express_1.default.Router();
// GET /api/jobs
// Returns paginated list of jobs for organization
exports.jobsRouter.get("/", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id } = authReq.user;
        const { page = 1, limit = 20, status, risk_level } = authReq.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        let query = supabaseClient_1.supabase
            .from("jobs")
            .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at")
            .eq("organization_id", organization_id)
            .is("archived_at", null)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .range(offset, offset + limitNum - 1);
        if (status) {
            query = query.eq("status", status);
        }
        if (risk_level) {
            query = query.eq("risk_level", risk_level);
        }
        const { data: jobs, error } = await query;
        if (error)
            throw error;
        // Get total count for pagination
        let countQuery = supabaseClient_1.supabase
            .from("jobs")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organization_id)
            .is("archived_at", null)
            .is("deleted_at", null);
        if (status) {
            countQuery = countQuery.eq("status", status);
        }
        if (risk_level) {
            countQuery = countQuery.eq("risk_level", risk_level);
        }
        const { count, error: countError } = await countQuery;
        if (countError)
            throw countError;
        res.json({
            data: jobs || [],
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limitNum),
            },
        });
    }
    catch (err) {
        console.error("Jobs fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch jobs" });
    }
});
// GET /api/jobs/:id
// Returns full job details with risk score and mitigation items
exports.jobsRouter.get("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const { organization_id } = authReq.user;
        // Get job
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("*")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        // Get risk score
        const { data: riskScore } = await supabaseClient_1.supabase
            .from("job_risk_scores")
            .select("*")
            .eq("job_id", jobId)
            .single();
        // Get mitigation items
        const { data: mitigationItems } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("id, title, description, done, is_completed, completed_at, created_at")
            .eq("job_id", jobId)
            .order("created_at", { ascending: true });
        res.json({
            data: {
                ...job,
                risk_score_detail: riskScore || null,
                mitigation_items: mitigationItems || [],
            },
        });
    }
    catch (err) {
        console.error("Job fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch job" });
    }
});
// POST /api/jobs
// Creates a new job and calculates risk score
exports.jobsRouter.post("/", auth_1.authenticate, limits_1.enforceJobLimit, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id, id: userId } = authReq.user;
        const { client_name, client_type, job_type, location, description, start_date, end_date, risk_factor_codes = [], // Array of risk factor codes (e.g., ['HEIGHT_WORK', 'ELECTRICAL_WORK'])
        has_subcontractors = false, subcontractor_count = 0, insurance_status = 'pending', } = authReq.body;
        // Validate required fields
        if (!client_name || !client_type || !job_type || !location) {
            return res.status(400).json({
                message: "Missing required fields: client_name, client_type, job_type, location",
            });
        }
        // Check subscription limits (Starter: 10 jobs/month)
        const { data: subscription } = await supabaseClient_1.supabase
            .from("subscriptions")
            .select("tier, current_period_start")
            .eq("organization_id", organization_id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        const tier = subscription?.tier || 'starter';
        const periodStart = subscription?.current_period_start
            ? new Date(subscription.current_period_start)
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (tier === 'starter') {
            const { count } = await supabaseClient_1.supabase
                .from("jobs")
                .select("*", { count: "exact", head: true })
                .eq("organization_id", organization_id)
                .gte("created_at", periodStart.toISOString());
            if ((count || 0) >= 10) {
                return res.status(403).json({
                    code: 'JOB_LIMIT',
                    message: "Starter plan limit reached (10 jobs/month). Upgrade to Pro for unlimited jobs.",
                });
            }
        }
        // Create job
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .insert({
            organization_id,
            created_by: userId,
            client_name,
            client_type,
            job_type,
            location,
            description,
            start_date: start_date || null,
            end_date: end_date || null,
            status: 'draft',
            has_subcontractors,
            subcontractor_count,
            insurance_status,
        })
            .select()
            .single();
        if (jobError) {
            console.error("Job creation failed:", jobError);
            return res.status(500).json({ message: "Failed to create job" });
        }
        (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "job.created",
            targetType: "job",
            targetId: job.id,
            metadata: {
                client_name,
                job_type,
                location,
                start_date,
                risk_factor_codes: risk_factor_codes?.length ?? 0,
            },
        });
        // Calculate risk score if risk factors provided
        let riskScoreResult = null;
        if (risk_factor_codes && risk_factor_codes.length > 0) {
            try {
                riskScoreResult = await (0, riskScoring_1.calculateRiskScore)(risk_factor_codes);
                // Save risk score
                await supabaseClient_1.supabase.from("job_risk_scores").insert({
                    job_id: job.id,
                    overall_score: riskScoreResult.overall_score,
                    risk_level: riskScoreResult.risk_level,
                    factors: riskScoreResult.factors,
                });
                // Update job with risk score
                await supabaseClient_1.supabase
                    .from("jobs")
                    .update({
                    risk_score: riskScoreResult.overall_score,
                    risk_level: riskScoreResult.risk_level,
                })
                    .eq("id", job.id);
                // Generate mitigation items
                await (0, riskScoring_1.generateMitigationItems)(job.id, risk_factor_codes);
                await (0, notifications_1.notifyHighRiskJob)({
                    organizationId: organization_id,
                    jobId: job.id,
                    clientName: client_name,
                    riskScore: riskScoreResult.overall_score,
                });
            }
            catch (riskError) {
                console.error("Risk scoring failed:", riskError);
                // Continue without risk score - job is still created
            }
        }
        // Fetch complete job with risk details
        const { data: completeJob } = await supabaseClient_1.supabase
            .from("jobs")
            .select("*")
            .eq("id", job.id)
            .single();
        const { data: mitigationItems } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("id, title, description, done, is_completed")
            .eq("job_id", job.id);
        res.status(201).json({
            data: {
                ...completeJob,
                risk_score_detail: riskScoreResult,
                mitigation_items: mitigationItems || [],
            },
        });
    }
    catch (err) {
        console.error("Job creation error:", err);
        res.status(500).json({ message: err.message || "Failed to create job" });
    }
});
// PATCH /api/jobs/:id
// Updates a job and optionally recalculates risk score
exports.jobsRouter.patch("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const { organization_id, id: userId } = authReq.user;
        const updateData = authReq.body;
        const { risk_factor_codes, ...jobUpdates } = updateData;
        let updatedRiskScore = null;
        let updatedClientName = null;
        // Verify job belongs to organization
        const { data: existingJob, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, organization_id")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !existingJob) {
            return res.status(404).json({ message: "Job not found" });
        }
        // Update job fields
        if (Object.keys(jobUpdates).length > 0) {
            const { error: updateError } = await supabaseClient_1.supabase
                .from("jobs")
                .update(jobUpdates)
                .eq("id", jobId);
            if (updateError)
                throw updateError;
        }
        // Recalculate risk if risk factors changed
        if (risk_factor_codes !== undefined) {
            try {
                // Delete existing risk score and mitigation items
                await supabaseClient_1.supabase.from("job_risk_scores").delete().eq("job_id", jobId);
                await supabaseClient_1.supabase.from("mitigation_items").delete().eq("job_id", jobId);
                if (risk_factor_codes && risk_factor_codes.length > 0) {
                    const riskScoreResult = await (0, riskScoring_1.calculateRiskScore)(risk_factor_codes);
                    // Save new risk score
                    await supabaseClient_1.supabase.from("job_risk_scores").insert({
                        job_id: jobId,
                        overall_score: riskScoreResult.overall_score,
                        risk_level: riskScoreResult.risk_level,
                        factors: riskScoreResult.factors,
                    });
                    // Update job
                    await supabaseClient_1.supabase
                        .from("jobs")
                        .update({
                        risk_score: riskScoreResult.overall_score,
                        risk_level: riskScoreResult.risk_level,
                    })
                        .eq("id", jobId);
                    // Generate new mitigation items
                    await (0, riskScoring_1.generateMitigationItems)(jobId, risk_factor_codes);
                    updatedRiskScore = riskScoreResult.overall_score;
                }
                else {
                    // Clear risk score if no factors
                    await supabaseClient_1.supabase
                        .from("jobs")
                        .update({
                        risk_score: null,
                        risk_level: null,
                    })
                        .eq("id", jobId);
                }
            }
            catch (riskError) {
                console.error("Risk recalculation failed:", riskError);
                // Continue - job update succeeded
            }
        }
        // Fetch updated job
        const { data: updatedJob } = await supabaseClient_1.supabase
            .from("jobs")
            .select("*")
            .eq("id", jobId)
            .single();
        updatedClientName = updatedJob?.client_name ?? null;
        if (updatedRiskScore !== null) {
            await (0, notifications_1.notifyHighRiskJob)({
                organizationId: organization_id,
                jobId,
                clientName: updatedClientName ?? "Job",
                riskScore: updatedRiskScore,
            });
        }
        (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "job.updated",
            targetType: "job",
            targetId: jobId,
            metadata: {
                updates: jobUpdates,
                risk_factor_codes: Array.isArray(risk_factor_codes)
                    ? risk_factor_codes.length
                    : undefined,
            },
        });
        invalidateJobReportCache(organization_id, jobId);
        res.json({ data: updatedJob });
    }
    catch (err) {
        console.error("Job update failed:", err);
        res.status(500).json({ message: "Failed to update job" });
    }
});
// PATCH /api/jobs/:id/mitigations/:mitigationId
exports.jobsRouter.patch("/:id/mitigations/:mitigationId", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const mitigationId = authReq.params.mitigationId;
        const { organization_id } = authReq.user;
        const { done } = authReq.body;
        if (typeof done !== "boolean") {
            return res.status(400).json({ message: "'done' boolean field is required" });
        }
        // Verify job belongs to organization
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        const updatePayload = {
            done,
            is_completed: done,
            completed_at: done ? new Date().toISOString() : null,
        };
        const { data: updatedItem, error: updateError } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .update(updatePayload)
            .eq("id", mitigationId)
            .eq("job_id", jobId)
            .select("id, title, description, done, is_completed, completed_at, created_at")
            .single();
        if (updateError) {
            if (updateError.code === "PGRST116") {
                return res.status(404).json({ message: "Mitigation item not found" });
            }
            throw updateError;
        }
        if (!updatedItem) {
            return res.status(404).json({ message: "Mitigation item not found" });
        }
        (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: authReq.user.id,
            eventName: done ? "mitigation.completed" : "mitigation.reopened",
            targetType: "mitigation",
            targetId: mitigationId,
            metadata: {
                job_id: jobId,
                done,
            },
        });
        invalidateJobReportCache(organization_id, jobId);
        res.json({ data: updatedItem });
    }
    catch (err) {
        console.error("Mitigation update failed:", err);
        res.status(500).json({ message: "Failed to update mitigation item" });
    }
});
const jobReportCache = new Map();
const JOB_REPORT_TTL_MS = 60 * 1000;
const getCachedJobReport = (key) => {
    const cached = jobReportCache.get(key);
    if (!cached)
        return null;
    if (cached.expiresAt < Date.now()) {
        jobReportCache.delete(key);
        return null;
    }
    return cached.data;
};
const setCachedJobReport = (key, data) => {
    jobReportCache.set(key, { data, expiresAt: Date.now() + JOB_REPORT_TTL_MS });
};
const invalidateJobReportCache = (organizationId, jobId) => {
    jobReportCache.delete(`${organizationId}:${jobId}`);
};
exports.jobsRouter.get("/:id/full", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const { organization_id } = authReq.user;
        const cacheKey = `${organization_id}:${jobId}`;
        const cached = getCachedJobReport(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const payload = await (0, jobReport_1.buildJobReport)(organization_id, jobId);
        setCachedJobReport(cacheKey, payload);
        res.json(payload);
    }
    catch (err) {
        console.error("Job full fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch job report data" });
    }
});
// GET /api/jobs/:id/documents
// Returns all uploaded documents for a specific job
exports.jobsRouter.get("/:id/documents", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const { organization_id } = authReq.user;
        // Verify job belongs to organization
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, organization_id")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        // Get documents for this job
        const { data, error } = await supabaseClient_1.supabase
            .from("documents")
            .select("id, name, type, file_size, file_path, mime_type, description, created_at, uploaded_by")
            .eq("job_id", jobId)
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: true });
        if (error)
            throw error;
        const documentsWithUrls = await Promise.all((data || []).map(async (doc) => {
            try {
                const { data: signed } = await supabaseClient_1.supabase.storage
                    .from("documents")
                    .createSignedUrl(doc.file_path, 60 * 10);
                return {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    size: doc.file_size,
                    storage_path: doc.file_path,
                    mime_type: doc.mime_type,
                    description: doc.description,
                    created_at: doc.created_at,
                    uploaded_by: doc.uploaded_by,
                    url: signed?.signedUrl || null,
                };
            }
            catch (error) {
                console.warn("Failed to generate document signed URL", error);
                return {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    size: doc.file_size,
                    storage_path: doc.file_path,
                    mime_type: doc.mime_type,
                    description: doc.description,
                    created_at: doc.created_at,
                    uploaded_by: doc.uploaded_by,
                    url: null,
                };
            }
        }));
        res.json({ data: documentsWithUrls });
    }
    catch (err) {
        console.error("Docs fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch documents" });
    }
});
// POST /api/jobs/:id/documents
// Persists document metadata after upload to storage
exports.jobsRouter.post("/:id/documents", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const { organization_id, id: userId } = authReq.user;
        const { name, type = "photo", file_path, file_size, mime_type, description } = authReq.body || {};
        if (!name || !file_path || file_size === undefined || !mime_type) {
            return res.status(400).json({
                message: "Missing required metadata: name, file_path, file_size, mime_type",
            });
        }
        const parsedFileSize = Number(file_size);
        if (!Number.isFinite(parsedFileSize) || parsedFileSize <= 0) {
            return res.status(400).json({ message: "file_size must be a positive number" });
        }
        // Verify job belongs to organization
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        const { data: inserted, error: insertError } = await supabaseClient_1.supabase
            .from("documents")
            .insert({
            job_id: jobId,
            organization_id,
            name,
            type,
            file_path,
            file_size: Math.round(parsedFileSize),
            mime_type,
            uploaded_by: userId,
            description: description ?? null,
        })
            .select("id, name, type, file_size, file_path, mime_type, description, created_at, uploaded_by")
            .single();
        if (insertError) {
            throw insertError;
        }
        const { data: signed } = await supabaseClient_1.supabase.storage
            .from("documents")
            .createSignedUrl(inserted.file_path, 60 * 10);
        (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "document.uploaded",
            targetType: "document",
            targetId: inserted.id,
            metadata: {
                job_id: jobId,
                name,
                type,
                file_path,
                file_size: Math.round(parsedFileSize),
            },
        });
        invalidateJobReportCache(organization_id, jobId);
        res.status(201).json({
            data: {
                id: inserted.id,
                name: inserted.name,
                type: inserted.type,
                size: inserted.file_size,
                storage_path: inserted.file_path,
                mime_type: inserted.mime_type,
                description: inserted.description,
                created_at: inserted.created_at,
                uploaded_by: inserted.uploaded_by,
                url: signed?.signedUrl || null,
            },
        });
    }
    catch (err) {
        console.error("Document metadata save failed:", err);
        res.status(500).json({ message: "Failed to save document metadata" });
    }
});
// GET /api/jobs/:id/audit
// Returns recent audit entries for a specific job
exports.jobsRouter.get("/:id/audit", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const jobId = authReq.params.id;
        const { organization_id } = authReq.user;
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        const { data: logs, error } = await supabaseClient_1.supabase
            .from("audit_logs")
            .select("id, event_name, target_type, target_id, actor_id, metadata, created_at")
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: false })
            .limit(250);
        if (error) {
            throw error;
        }
        const filtered = (logs || []).filter((log) => {
            if (log.target_id === jobId)
                return true;
            const metadata = (log.metadata || {});
            if (metadata?.job_id === jobId)
                return true;
            return false;
        }) ?? [];
        res.json({
            data: filtered.slice(0, 100),
        });
    }
    catch (err) {
        console.error("Audit fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch audit log" });
    }
});
// POST /api/jobs/:id/archive
// Archives a job (soft delete, read-only, preserves for audit)
exports.jobsRouter.post("/:id/archive", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { id: userId, organization_id } = authReq.user;
        const jobId = authReq.params.id;
        // Get job and verify ownership
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, status, archived_at, deleted_at")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        if (job.archived_at) {
            return res.status(400).json({ message: "Job is already archived" });
        }
        if (job.deleted_at) {
            return res.status(400).json({ message: "Job has been deleted" });
        }
        // Archive the job
        const { error: updateError } = await supabaseClient_1.supabase
            .from("jobs")
            .update({
            status: "archived",
            archived_at: new Date().toISOString(),
        })
            .eq("id", jobId);
        if (updateError) {
            throw updateError;
        }
        // Log archive event
        await (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "job.archived",
            targetType: "job",
            targetId: jobId,
            metadata: {
                previous_status: job.status,
            },
        });
        res.json({
            data: {
                id: jobId,
                archived_at: new Date().toISOString(),
                status: "archived",
            },
        });
    }
    catch (err) {
        console.error("Job archive failed:", err);
        res.status(500).json({ message: "Failed to archive job" });
    }
});
// DELETE /api/jobs/:id
// Hard deletes a job (admin-only, strict eligibility checks)
exports.jobsRouter.delete("/:id", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { id: userId, organization_id, role } = authReq.user;
        const jobId = authReq.params.id;
        // Only owners can delete jobs
        if (role !== "owner") {
            return res.status(403).json({ message: "Only organization owners can delete jobs" });
        }
        // Get job and verify ownership
        const { data: job, error: jobError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, status, archived_at, deleted_at")
            .eq("id", jobId)
            .eq("organization_id", organization_id)
            .single();
        if (jobError || !job) {
            return res.status(404).json({ message: "Job not found" });
        }
        if (job.deleted_at) {
            return res.status(400).json({ message: "Job has already been deleted" });
        }
        // Strict eligibility checks
        if (job.status !== "draft") {
            return res.status(400).json({
                message: "Only draft jobs can be deleted",
                code: "NOT_ELIGIBLE_FOR_DELETE",
            });
        }
        // Check for audit logs
        const { data: auditLogs, error: auditError } = await supabaseClient_1.supabase
            .from("audit_logs")
            .select("id")
            .eq("organization_id", organization_id)
            .or(`target_id.eq.${jobId},metadata->>job_id.eq.${jobId}`)
            .limit(1);
        if (auditError) {
            console.error("Audit check failed:", auditError);
        }
        if (auditLogs && auditLogs.length > 0) {
            return res.status(400).json({
                message: "Jobs with audit history cannot be deleted",
                code: "HAS_AUDIT_HISTORY",
            });
        }
        // Check for evidence/documents
        const { data: documents, error: docError } = await supabaseClient_1.supabase
            .from("documents")
            .select("id")
            .eq("job_id", jobId)
            .limit(1);
        if (docError) {
            console.error("Document check failed:", docError);
        }
        if (documents && documents.length > 0) {
            return res.status(400).json({
                message: "Jobs with uploaded evidence cannot be deleted",
                code: "HAS_EVIDENCE",
            });
        }
        // Check for risk assessments
        const { data: riskScore, error: riskError } = await supabaseClient_1.supabase
            .from("job_risk_scores")
            .select("id")
            .eq("job_id", jobId)
            .limit(1);
        if (riskError) {
            console.error("Risk score check failed:", riskError);
        }
        if (riskScore && riskScore.length > 0) {
            return res.status(400).json({
                message: "Jobs with finalized risk assessments cannot be deleted",
                code: "HAS_RISK_ASSESSMENT",
            });
        }
        // Check for generated reports
        const { data: reports, error: reportError } = await supabaseClient_1.supabase
            .from("reports")
            .select("id")
            .eq("job_id", jobId)
            .limit(1);
        if (reportError) {
            console.error("Report check failed:", reportError);
        }
        if (reports && reports.length > 0) {
            return res.status(400).json({
                message: "Jobs with generated reports cannot be deleted",
                code: "HAS_REPORTS",
            });
        }
        // Soft delete the job
        const { error: deleteError } = await supabaseClient_1.supabase
            .from("jobs")
            .update({
            deleted_at: new Date().toISOString(),
        })
            .eq("id", jobId);
        if (deleteError) {
            throw deleteError;
        }
        // Log deletion event
        await (0, audit_1.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "job.deleted",
            targetType: "job",
            targetId: jobId,
            metadata: {
                previous_status: job.status,
                deletion_reason: "admin_hard_delete",
            },
        });
        res.json({
            data: {
                id: jobId,
                deleted_at: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        console.error("Job deletion failed:", err);
        res.status(500).json({ message: "Failed to delete job" });
    }
});
//# sourceMappingURL=jobs.js.map