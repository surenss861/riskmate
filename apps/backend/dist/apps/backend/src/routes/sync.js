"use strict";
/**
 * Sync API - Batch upload, incremental download, conflict resolution for offline-first iOS
 * POST /api/sync/batch - Upload pending operations
 * GET /api/sync/changes?since={timestamp} - Incremental sync
 * POST /api/sync/resolve-conflict - Submit conflict resolution
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const requireWriteAccess_1 = require("../middleware/requireWriteAccess");
const audit_1 = require("../middleware/audit");
const audit_2 = require("../middleware/audit");
exports.syncRouter = express_1.default.Router();
const MAX_BATCH_SIZE = 200; // Support 100+ as per ticket, allow up to 200
// POST /api/sync/batch - Upload pending operations
exports.syncRouter.post("/batch", auth_1.authenticate, requireWriteAccess_1.requireWriteAccess, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id, id: userId } = authReq.user;
        const { operations } = req.body;
        if (!Array.isArray(operations) || operations.length === 0) {
            return res.status(400).json({
                message: "operations array is required and must not be empty",
            });
        }
        if (operations.length > MAX_BATCH_SIZE) {
            return res.status(400).json({
                message: `Maximum ${MAX_BATCH_SIZE} operations per batch`,
                code: "BATCH_TOO_LARGE",
            });
        }
        const results = [];
        for (const op of operations) {
            const baseResult = {
                operation_id: op.id,
                status: "success",
            };
            try {
                switch (op.type) {
                    case "create_job": {
                        const data = op.data || {};
                        const client_name = data.client_name ?? data.clientName;
                        const client_type = data.client_type ?? data.clientType ?? "other";
                        const job_type = data.job_type ?? data.jobType;
                        const location = data.location;
                        if (!client_name || !job_type || !location) {
                            baseResult.status = "error";
                            baseResult.error = "Missing required fields: client_name, job_type, location";
                            results.push(baseResult);
                            continue;
                        }
                        const { data: job, error: jobError } = await supabaseClient_1.supabase
                            .from("jobs")
                            .insert({
                            organization_id,
                            created_by: userId,
                            client_name,
                            client_type: client_type || "other",
                            job_type,
                            location,
                            description: data.description ?? null,
                            start_date: data.start_date ?? null,
                            end_date: data.end_date ?? null,
                            status: data.status ?? "draft",
                            has_subcontractors: data.has_subcontractors ?? false,
                            subcontractor_count: data.subcontractor_count ?? 0,
                            insurance_status: data.insurance_status ?? "pending",
                        })
                            .select("id")
                            .single();
                        if (jobError) {
                            if (jobError.code === "23505") {
                                const { data: existingJob } = await supabaseClient_1.supabase
                                    .from("jobs")
                                    .select("created_by")
                                    .eq("id", op.entity_id)
                                    .eq("organization_id", organization_id)
                                    .single();
                                baseResult.status = "conflict";
                                baseResult.conflict = {
                                    field: "id",
                                    server_value: "exists",
                                    local_value: op.entity_id,
                                    server_actor: existingJob?.created_by ?? undefined,
                                    local_actor: userId,
                                };
                            }
                            else {
                                baseResult.status = "error";
                                baseResult.error = jobError.message;
                            }
                        }
                        else if (job) {
                            baseResult.server_id = job.id;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "job.created",
                                targetType: "job",
                                targetId: job.id,
                                metadata: { sync_batch: true, operation_id: op.id },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "update_job": {
                        const jobId = op.entity_id;
                        const data = op.data || {};
                        const { data: existing, error: fetchError } = await supabaseClient_1.supabase
                            .from("jobs")
                            .select("id, updated_at, created_by")
                            .eq("id", jobId)
                            .eq("organization_id", organization_id)
                            .single();
                        if (fetchError || !existing) {
                            baseResult.status = "error";
                            baseResult.error = "Job not found";
                            results.push(baseResult);
                            continue;
                        }
                        const localUpdated = data.updated_at ?? data.updatedAt;
                        if (localUpdated && existing.updated_at && localUpdated !== existing.updated_at) {
                            baseResult.status = "conflict";
                            baseResult.conflict = {
                                entity_type: "job",
                                entity_id: jobId,
                                field: "updated_at",
                                server_value: existing.updated_at,
                                local_value: localUpdated,
                                server_timestamp: existing.updated_at,
                                local_timestamp: localUpdated,
                                server_actor: existing.created_by ?? undefined,
                                local_actor: userId,
                            };
                            results.push(baseResult);
                            continue;
                        }
                        const updates = {};
                        const keyMap = {
                            client_name: "client_name",
                            clientName: "client_name",
                            client_type: "client_type",
                            clientType: "client_type",
                            job_type: "job_type",
                            jobType: "job_type",
                            location: "location",
                            description: "description",
                            status: "status",
                            start_date: "start_date",
                            startDate: "start_date",
                            end_date: "end_date",
                            endDate: "end_date",
                            has_subcontractors: "has_subcontractors",
                            subcontractor_count: "subcontractor_count",
                            insurance_status: "insurance_status",
                        };
                        for (const [src, dest] of Object.entries(keyMap)) {
                            if (data[src] !== undefined)
                                updates[dest] = data[src];
                        }
                        if (Object.keys(updates).length === 0) {
                            baseResult.server_id = jobId;
                            results.push(baseResult);
                            continue;
                        }
                        const { error: updateError } = await supabaseClient_1.supabase
                            .from("jobs")
                            .update(updates)
                            .eq("id", jobId)
                            .eq("organization_id", organization_id);
                        if (updateError) {
                            baseResult.status = "error";
                            baseResult.error = updateError.message;
                        }
                        else {
                            baseResult.server_id = jobId;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "job.updated",
                                targetType: "job",
                                targetId: jobId,
                                metadata: { sync_batch: true, operation_id: op.id },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "delete_job": {
                        const jobId = op.entity_id;
                        const { data: existing, error: fetchError } = await supabaseClient_1.supabase
                            .from("jobs")
                            .select("id, status, created_by")
                            .eq("id", jobId)
                            .eq("organization_id", organization_id)
                            .single();
                        if (fetchError || !existing) {
                            baseResult.status = "error";
                            baseResult.error = "Job not found";
                            results.push(baseResult);
                            continue;
                        }
                        if (existing.status !== "draft") {
                            baseResult.status = "conflict";
                            baseResult.conflict = {
                                entity_type: "job",
                                entity_id: jobId,
                                field: "status",
                                server_value: existing.status,
                                local_value: "deleted",
                                server_actor: existing.created_by ?? undefined,
                                local_actor: userId,
                            };
                            results.push(baseResult);
                            continue;
                        }
                        const { error: deleteError } = await supabaseClient_1.supabase
                            .from("jobs")
                            .update({ deleted_at: new Date().toISOString() })
                            .eq("id", jobId)
                            .eq("organization_id", organization_id);
                        if (deleteError) {
                            baseResult.status = "error";
                            baseResult.error = deleteError.message;
                        }
                        else {
                            baseResult.server_id = jobId;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "job.deleted",
                                targetType: "job",
                                targetId: jobId,
                                metadata: { sync_batch: true, operation_id: op.id },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "create_hazard": {
                        const data = op.data || {};
                        const jobId = data.job_id ?? data.jobId;
                        if (!jobId) {
                            baseResult.status = "error";
                            baseResult.error = "job_id required for create hazard";
                            results.push(baseResult);
                            break;
                        }
                        const { data: job } = await supabaseClient_1.supabase
                            .from("jobs")
                            .select("id")
                            .eq("id", jobId)
                            .eq("organization_id", organization_id)
                            .single();
                        if (!job) {
                            baseResult.status = "error";
                            baseResult.error = "Job not found or does not belong to your organization";
                            results.push(baseResult);
                            break;
                        }
                        const title = data.title ?? data.name ?? "Untitled";
                        const description = data.description ?? "";
                        const { data: riskFactors } = await supabaseClient_1.supabase
                            .from("risk_factors")
                            .select("id")
                            .eq("is_active", true)
                            .limit(1);
                        const riskFactorId = riskFactors?.[0]?.id ?? null;
                        const insertPayload = {
                            job_id: jobId,
                            title,
                            description: description || null,
                            done: false,
                            is_completed: false,
                            organization_id: organization_id,
                        };
                        if (riskFactorId)
                            insertPayload.risk_factor_id = riskFactorId;
                        const { data: inserted, error: insertErr } = await supabaseClient_1.supabase
                            .from("mitigation_items")
                            .insert(insertPayload)
                            .select("id")
                            .single();
                        if (insertErr) {
                            baseResult.status = "error";
                            baseResult.error = insertErr.message;
                        }
                        else if (inserted) {
                            baseResult.server_id = inserted.id;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "hazard.created",
                                targetType: "hazard",
                                targetId: inserted.id,
                                metadata: { job_id: jobId, sync_batch: true, operation_id: op.id },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "create_control": {
                        const data = op.data || {};
                        const jobId = data.job_id ?? data.jobId;
                        const hazardId = data.hazard_id ?? data.hazardId;
                        if (!jobId) {
                            baseResult.status = "error";
                            baseResult.error = "job_id required for create control";
                            results.push(baseResult);
                            break;
                        }
                        if (!hazardId) {
                            baseResult.status = "error";
                            baseResult.error = "hazard_id required for create control";
                            results.push(baseResult);
                            break;
                        }
                        const { data: job } = await supabaseClient_1.supabase
                            .from("jobs")
                            .select("id")
                            .eq("id", jobId)
                            .eq("organization_id", organization_id)
                            .single();
                        if (!job) {
                            baseResult.status = "error";
                            baseResult.error = "Job not found or does not belong to your organization";
                            results.push(baseResult);
                            break;
                        }
                        const { data: hazard } = await supabaseClient_1.supabase
                            .from("mitigation_items")
                            .select("id")
                            .eq("id", hazardId)
                            .eq("job_id", jobId)
                            .eq("organization_id", organization_id)
                            .single();
                        if (!hazard) {
                            baseResult.status = "error";
                            baseResult.error = "Hazard not found or does not belong to this job and organization";
                            results.push(baseResult);
                            break;
                        }
                        const title = data.title ?? data.name ?? "Untitled";
                        const description = data.description ?? "";
                        const { data: riskFactors } = await supabaseClient_1.supabase
                            .from("risk_factors")
                            .select("id")
                            .eq("is_active", true)
                            .limit(1);
                        const riskFactorId = riskFactors?.[0]?.id ?? null;
                        const insertPayload = {
                            job_id: jobId,
                            hazard_id: hazardId,
                            title,
                            description: description || null,
                            done: false,
                            is_completed: false,
                            organization_id: organization_id,
                        };
                        if (riskFactorId)
                            insertPayload.risk_factor_id = riskFactorId;
                        const { data: inserted, error: insertErr } = await supabaseClient_1.supabase
                            .from("mitigation_items")
                            .insert(insertPayload)
                            .select("id")
                            .single();
                        if (insertErr) {
                            baseResult.status = "error";
                            baseResult.error = insertErr.message;
                        }
                        else if (inserted) {
                            baseResult.server_id = inserted.id;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "control.created",
                                targetType: "control",
                                targetId: inserted.id,
                                metadata: { job_id: jobId, hazard_id: hazardId, sync_batch: true, operation_id: op.id },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "update_hazard": {
                        const mitigationId = op.entity_id;
                        const data = op.data || {};
                        const jobId = data.job_id ?? data.jobId;
                        if (!jobId) {
                            baseResult.status = "error";
                            baseResult.error = "job_id required for hazard update";
                            results.push(baseResult);
                            break;
                        }
                        const hasCompletion = data.done !== undefined || data.is_completed !== undefined || data.isCompleted !== undefined;
                        let done;
                        if (hasCompletion) {
                            done = data.done ?? data.is_completed ?? data.isCompleted ?? false;
                        }
                        else {
                            const { data: existing, error: fetchErr } = await supabaseClient_1.supabase
                                .from("mitigation_items")
                                .select("done, is_completed")
                                .eq("id", mitigationId)
                                .eq("job_id", jobId)
                                .eq("organization_id", organization_id)
                                .single();
                            if (fetchErr || !existing) {
                                baseResult.status = "error";
                                baseResult.error = fetchErr?.message ?? "Hazard not found";
                                results.push(baseResult);
                                break;
                            }
                            done = existing.done ?? existing.is_completed ?? false;
                        }
                        const updates = {
                            done,
                            is_completed: done,
                        };
                        if (done) {
                            updates.completed_at = data.completed_at ?? data.completedAt ?? new Date().toISOString();
                        }
                        // when done is false, omit completed_at to preserve existing timestamp
                        if (data.title !== undefined)
                            updates.title = data.title;
                        else if (data.name !== undefined)
                            updates.title = data.name;
                        if (data.description !== undefined)
                            updates.description = data.description;
                        const { data: updated, error: updateErr } = await supabaseClient_1.supabase
                            .from("mitigation_items")
                            .update(updates)
                            .eq("id", mitigationId)
                            .eq("job_id", jobId)
                            .eq("organization_id", organization_id)
                            .select("id")
                            .single();
                        if (updateErr) {
                            baseResult.status = "error";
                            baseResult.error = updateErr.message;
                        }
                        else {
                            baseResult.server_id = mitigationId;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "hazard.updated",
                                targetType: "hazard",
                                targetId: mitigationId,
                                metadata: { job_id: jobId, sync_batch: true, operation_id: op.id },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "update_control": {
                        const mitigationId = op.entity_id;
                        const data = op.data || {};
                        const jobId = data.job_id ?? data.jobId;
                        const hazardId = data.hazard_id ?? data.hazardId;
                        if (!jobId) {
                            baseResult.status = "error";
                            baseResult.error = "job_id required for control update";
                            results.push(baseResult);
                            break;
                        }
                        if (!hazardId) {
                            baseResult.status = "error";
                            baseResult.error = "hazard_id required for control update";
                            results.push(baseResult);
                            break;
                        }
                        const hasCompletion = data.done !== undefined || data.is_completed !== undefined || data.isCompleted !== undefined;
                        let done;
                        if (hasCompletion) {
                            done = data.done ?? data.is_completed ?? data.isCompleted ?? false;
                        }
                        else {
                            const { data: existing, error: fetchErr } = await supabaseClient_1.supabase
                                .from("mitigation_items")
                                .select("done, is_completed")
                                .eq("id", mitigationId)
                                .eq("job_id", jobId)
                                .eq("hazard_id", hazardId)
                                .eq("organization_id", organization_id)
                                .single();
                            if (fetchErr || !existing) {
                                baseResult.status = "error";
                                baseResult.error = fetchErr?.message ?? "Control not found";
                                results.push(baseResult);
                                break;
                            }
                            done = existing.done ?? existing.is_completed ?? false;
                        }
                        const updates = {
                            done,
                            is_completed: done,
                        };
                        if (done) {
                            updates.completed_at = data.completed_at ?? data.completedAt ?? new Date().toISOString();
                        }
                        // when done is false, omit completed_at to preserve existing timestamp
                        if (data.title !== undefined)
                            updates.title = data.title;
                        else if (data.name !== undefined)
                            updates.title = data.name;
                        if (data.description !== undefined)
                            updates.description = data.description;
                        const { data: updated, error: updateErr } = await supabaseClient_1.supabase
                            .from("mitigation_items")
                            .update(updates)
                            .eq("id", mitigationId)
                            .eq("job_id", jobId)
                            .eq("hazard_id", hazardId)
                            .eq("organization_id", organization_id)
                            .select("id")
                            .single();
                        if (updateErr) {
                            baseResult.status = "error";
                            baseResult.error = updateErr.message;
                        }
                        else {
                            baseResult.server_id = mitigationId;
                            const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                            await (0, audit_2.recordAuditLog)({
                                organizationId: organization_id,
                                actorId: userId,
                                eventName: "control.updated",
                                targetType: "control",
                                targetId: mitigationId,
                                metadata: {
                                    job_id: jobId,
                                    hazard_id: hazardId,
                                    sync_batch: true,
                                    operation_id: op.id,
                                },
                                ...clientMetadata,
                            });
                        }
                        results.push(baseResult);
                        break;
                    }
                    case "delete_hazard": {
                        const mitigationId = op.entity_id;
                        const data = op.data || {};
                        const jobId = data.job_id ?? data.jobId;
                        if (!jobId) {
                            baseResult.status = "error";
                            baseResult.error = "job_id required for hazard delete";
                            results.push(baseResult);
                            break;
                        }
                        // Atomic: deletes first, tombstones only after deletes succeed (transaction via RPC)
                        const { data: rpcResult, error: rpcErr } = await supabaseClient_1.supabase.rpc("sync_delete_hazard", {
                            p_organization_id: organization_id,
                            p_job_id: jobId,
                            p_hazard_id: mitigationId,
                        });
                        if (rpcErr) {
                            baseResult.status = "error";
                            baseResult.error = rpcErr.message;
                            results.push(baseResult);
                            break;
                        }
                        baseResult.server_id = mitigationId;
                        const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                        await (0, audit_2.recordAuditLog)({
                            organizationId: organization_id,
                            actorId: userId,
                            eventName: "hazard.deleted",
                            targetType: "hazard",
                            targetId: mitigationId,
                            metadata: { job_id: jobId, sync_batch: true, operation_id: op.id },
                            ...clientMetadata,
                        });
                        results.push(baseResult);
                        break;
                    }
                    case "delete_control": {
                        const mitigationId = op.entity_id;
                        const data = op.data || {};
                        const jobId = data.job_id ?? data.jobId;
                        const hazardId = data.hazard_id ?? data.hazardId;
                        if (!jobId) {
                            baseResult.status = "error";
                            baseResult.error = "job_id required for control delete";
                            results.push(baseResult);
                            break;
                        }
                        if (!hazardId) {
                            baseResult.status = "error";
                            baseResult.error = "hazard_id required for control delete";
                            results.push(baseResult);
                            break;
                        }
                        // Delete first; treat missing/already-deleted control as success (idempotent).
                        const { data: deletedRows, error: deleteErr } = await supabaseClient_1.supabase
                            .from("mitigation_items")
                            .delete()
                            .eq("id", mitigationId)
                            .eq("job_id", jobId)
                            .eq("hazard_id", hazardId)
                            .eq("organization_id", organization_id)
                            .select("id");
                        if (deleteErr) {
                            baseResult.status = "error";
                            baseResult.error = deleteErr.message;
                            results.push(baseResult);
                            break;
                        }
                        // Missing or already-deleted control: treat as success, still write tombstone and audit.
                        const { error: tombstoneErr } = await supabaseClient_1.supabase.from("sync_mitigation_deletions").insert({
                            mitigation_item_id: mitigationId,
                            job_id: jobId,
                            hazard_id: hazardId,
                            organization_id: organization_id,
                        });
                        if (tombstoneErr) {
                            // Duplicate tombstone (already deleted) is idempotent success
                            if (tombstoneErr.code !== "23505") {
                                baseResult.status = "error";
                                baseResult.error = tombstoneErr.message;
                                results.push(baseResult);
                                break;
                            }
                        }
                        baseResult.server_id = mitigationId;
                        const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                        await (0, audit_2.recordAuditLog)({
                            organizationId: organization_id,
                            actorId: userId,
                            eventName: "control.deleted",
                            targetType: "control",
                            targetId: mitigationId,
                            metadata: {
                                job_id: jobId,
                                hazard_id: hazardId,
                                sync_batch: true,
                                operation_id: op.id,
                            },
                            ...clientMetadata,
                        });
                        results.push(baseResult);
                        break;
                    }
                    default:
                        baseResult.status = "error";
                        baseResult.error = `Unknown operation type: ${op.type}`;
                        results.push(baseResult);
                }
            }
            catch (err) {
                baseResult.status = "error";
                baseResult.error = err?.message ?? String(err);
                results.push(baseResult);
            }
        }
        res.json({ results });
    }
    catch (err) {
        console.error("[Sync] Batch failed:", err);
        res.status(500).json({ message: "Sync batch failed" });
    }
});
// GET /api/sync/changes?since={ts}&limit={n}&jobs_offset={n}&mitigation_offset={n}&entity={jobs|mitigation_items}
// entity=jobs: jobs only. entity=mitigation_items: hazards/controls only. Omit for both.
// Jobs and mitigation_items are paginated independently. Use jobs_offset and mitigation_offset
// (or offset as fallback when entity is specific) so clients never skip items when one entity fills a page.
exports.syncRouter.get("/changes", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id } = authReq.user;
        const sinceStr = req.query.since;
        const entity = req.query.entity || "all";
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);
        const fallbackOffset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const jobsOffsetParam = parseInt(req.query.jobs_offset, 10);
        const mitigationOffsetParam = parseInt(req.query.mitigation_offset, 10);
        const jobsOffset = Math.max(Number.isNaN(jobsOffsetParam) ? fallbackOffset : jobsOffsetParam, 0);
        const mitigationOffset = Math.max(Number.isNaN(mitigationOffsetParam) ? fallbackOffset : mitigationOffsetParam, 0);
        if (!sinceStr) {
            return res.status(400).json({
                message: "since query parameter (ISO8601 timestamp) is required",
            });
        }
        const since = new Date(sinceStr);
        if (isNaN(since.getTime())) {
            return res.status(400).json({
                message: "Invalid since timestamp format",
            });
        }
        const fetchJobs = entity === "all" || entity === "jobs";
        const fetchMitigation = entity === "all" || entity === "mitigation_items";
        let jobs = [];
        let mitigationItems = [];
        let deletedJobIds = [];
        if (fetchJobs) {
            const { data, error } = await supabaseClient_1.supabase
                .from("jobs")
                .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, created_by")
                .eq("organization_id", organization_id)
                .is("deleted_at", null)
                .gte("updated_at", since.toISOString())
                .order("updated_at", { ascending: true })
                .range(jobsOffset, jobsOffset + limit - 1);
            if (error)
                throw error;
            jobs = data || [];
            // Tombstones: jobs deleted since sync timestamp so offline clients can purge them
            const { data: deletedJobs } = await supabaseClient_1.supabase
                .from("jobs")
                .select("id")
                .eq("organization_id", organization_id)
                .not("deleted_at", "is", null)
                .gte("deleted_at", since.toISOString());
            deletedJobIds = (deletedJobs || []).map((d) => d.id);
        }
        let deletedMitigationIds = [];
        if (fetchMitigation) {
            const { data, error } = await supabaseClient_1.supabase
                .from("mitigation_items")
                .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                .eq("organization_id", organization_id)
                .gte("updated_at", since.toISOString())
                .order("updated_at", { ascending: true })
                .range(mitigationOffset, mitigationOffset + limit - 1);
            if (error)
                throw error;
            mitigationItems = data || [];
            // Fetch deletion tombstones so offline caches can remove deleted hazards/controls
            const { data: deletions } = await supabaseClient_1.supabase
                .from("sync_mitigation_deletions")
                .select("mitigation_item_id")
                .eq("organization_id", organization_id)
                .gte("deleted_at", since.toISOString());
            deletedMitigationIds = (deletions || []).map((d) => d.mitigation_item_id);
        }
        const normalizedJobs = jobs.map((j) => ({
            id: j.id,
            client_name: j.client_name,
            job_type: j.job_type,
            location: j.location,
            status: j.status,
            risk_score: j.risk_score,
            risk_level: j.risk_level,
            created_at: j.created_at,
            updated_at: j.updated_at ?? j.created_at,
            created_by: j.created_by,
        }));
        const normalizeMitigationItem = (item) => {
            const isHazard = item.hazard_id == null;
            const match = item.title ? item.title.match(/^([A-Z0-9_]+)/) : null;
            const code = match && match[1] ? match[1] : (item.title ? item.title.substring(0, 10).toUpperCase().replace(/\s+/g, "_") : "UNKNOWN");
            const status = item.done || item.is_completed ? (isHazard ? "resolved" : "Completed") : (isHazard ? "open" : "Pending");
            if (isHazard) {
                return {
                    entity_type: "hazard",
                    job_id: item.job_id,
                    data: {
                        id: item.id,
                        code,
                        name: item.title || "Unknown Hazard",
                        description: item.description || "",
                        severity: "medium",
                        status,
                        created_at: item.created_at || new Date().toISOString(),
                        updated_at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
                    },
                };
            }
            return {
                entity_type: "control",
                job_id: item.job_id,
                data: {
                    id: item.id,
                    title: item.title || "Unknown Control",
                    description: item.description || "",
                    status,
                    done: item.done || item.is_completed || false,
                    isCompleted: item.is_completed ?? item.done ?? false,
                    hazardId: item.hazard_id,
                    createdAt: item.created_at || new Date().toISOString(),
                    updatedAt: item.updated_at ?? item.created_at ?? new Date().toISOString(),
                },
            };
        };
        const normalizedMitigation = mitigationItems.map(normalizeMitigationItem);
        const jobsHasMore = fetchJobs && jobs.length === limit;
        const mitigationHasMore = fetchMitigation && mitigationItems.length === limit;
        const jobsNextOffset = jobsHasMore ? jobsOffset + limit : null;
        const mitigationNextOffset = mitigationHasMore ? mitigationOffset + limit : null;
        const pagination = {
            limit,
            offset: entity === "jobs" ? jobsOffset : (entity === "mitigation_items" ? mitigationOffset : 0),
            jobs: {
                limit,
                offset: jobsOffset,
                has_more: jobsHasMore,
                next_offset: jobsNextOffset,
            },
            mitigation_items: {
                limit,
                offset: mitigationOffset,
                has_more: mitigationHasMore,
                next_offset: mitigationNextOffset,
            },
        };
        // Top-level for backward compat (entity=jobs uses jobs pagination, entity=mitigation_items uses mitigation)
        pagination.has_more = entity === "jobs" ? jobsHasMore : entity === "mitigation_items" ? mitigationHasMore : jobsHasMore || mitigationHasMore;
        pagination.next_offset = entity === "jobs" ? jobsNextOffset : (entity === "mitigation_items" ? mitigationNextOffset : null);
        res.json({
            data: normalizedJobs,
            mitigation_items: normalizedMitigation,
            deleted_mitigation_ids: deletedMitigationIds,
            deleted_job_ids: deletedJobIds,
            pagination,
        });
    }
    catch (err) {
        console.error("[Sync] Changes failed:", err);
        res.status(500).json({ message: "Failed to fetch changes" });
    }
});
// POST /api/sync/resolve-conflict - Submit conflict resolution
exports.syncRouter.post("/resolve-conflict", auth_1.authenticate, requireWriteAccess_1.requireWriteAccess, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id, id: userId } = authReq.user;
        const { operation_id, strategy, resolved_value, entity_type, entity_id, operation_type } = req.body;
        if (!operation_id || !strategy) {
            return res.status(400).json({
                message: "operation_id and strategy are required",
            });
        }
        // Only concrete resolution strategies are permitted; ask_user would clear conflicts/ops without applying a resolution.
        const allowedStrategies = ["server_wins", "local_wins", "merge"];
        if (!allowedStrategies.includes(strategy)) {
            return res.status(400).json({
                message: `Invalid strategy. Only server_wins, local_wins, and merge are permitted for resolution. Got: ${strategy}`,
                code: "INVALID_STRATEGY",
            });
        }
        if ((strategy === "local_wins" || strategy === "merge") && resolved_value === undefined) {
            return res.status(400).json({
                message: "resolved_value required when strategy is local_wins or merge",
            });
        }
        // For server_wins or divergent conflicts, operation_type is optional. For divergent + local_wins/merge, derive from entity_type.
        const isDivergent = typeof operation_id === "string" && operation_id.startsWith("divergent:");
        let effectiveOperationType = operation_type;
        if ((strategy === "local_wins" || strategy === "merge") && !effectiveOperationType && isDivergent && entity_type) {
            effectiveOperationType =
                entity_type === "job"
                    ? "update_job"
                    : entity_type === "hazard"
                        ? "update_hazard"
                        : entity_type === "control"
                            ? "update_control"
                            : undefined;
        }
        if ((strategy === "local_wins" || strategy === "merge") && (!entity_type || !entity_id)) {
            return res.status(400).json({
                message: "entity_type and entity_id are required when strategy is local_wins or merge",
            });
        }
        if ((strategy === "local_wins" || strategy === "merge") && !effectiveOperationType && entity_type !== "evidence" && entity_type !== "photo") {
            return res.status(400).json({
                message: "operation_type required when strategy is local_wins or merge (or use divergent: prefix with entity_type job/hazard/control)",
            });
        }
        let updatedJob = null;
        let updatedMitigationItem = null;
        if (strategy === "server_wins") {
            if (entity_type && entity_id) {
                if (entity_type === "job") {
                    const { data } = await supabaseClient_1.supabase
                        .from("jobs")
                        .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, created_by")
                        .eq("id", entity_id)
                        .eq("organization_id", organization_id)
                        .is("deleted_at", null)
                        .single();
                    if (data)
                        updatedJob = data;
                }
                else if (entity_type === "hazard" || entity_type === "control") {
                    const { data } = await supabaseClient_1.supabase
                        .from("mitigation_items")
                        .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                        .eq("id", entity_id)
                        .eq("organization_id", organization_id)
                        .single();
                    if (data)
                        updatedMitigationItem = data;
                }
            }
        }
        else if ((strategy === "local_wins" || strategy === "merge") && entity_type !== "evidence" && entity_type !== "photo") {
            const data = resolved_value;
            const targetId = entity_id;
            const opType = effectiveOperationType;
            if (opType === "create_job") {
                const client_name = data.client_name ?? data.clientName;
                const client_type = data.client_type ?? data.clientType ?? "other";
                const job_type = data.job_type ?? data.jobType;
                const location = data.location;
                if (!client_name || !job_type || !location) {
                    return res.status(400).json({
                        message: "resolved_value must include client_name, job_type, and location for create_job",
                    });
                }
                const { data: job, error: jobError } = await supabaseClient_1.supabase
                    .from("jobs")
                    .insert({
                    organization_id,
                    created_by: userId,
                    client_name,
                    client_type: client_type || "other",
                    job_type,
                    location,
                    description: data.description ?? null,
                    start_date: data.start_date ?? data.startDate ?? null,
                    end_date: data.end_date ?? data.endDate ?? null,
                    status: data.status ?? "draft",
                    has_subcontractors: data.has_subcontractors ?? false,
                    subcontractor_count: data.subcontractor_count ?? 0,
                    insurance_status: data.insurance_status ?? "pending",
                })
                    .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, created_by")
                    .single();
                if (jobError) {
                    return res.status(500).json({ message: jobError.message });
                }
                updatedJob = job;
                const clientMetadataJob = (0, audit_1.extractClientMetadata)(req);
                await (0, audit_2.recordAuditLog)({
                    organizationId: organization_id,
                    actorId: userId,
                    eventName: "job.created",
                    targetType: "job",
                    targetId: job.id,
                    metadata: { sync_resolve_conflict: true, operation_id: operation_id },
                    ...clientMetadataJob,
                });
            }
            else if (opType === "create_hazard") {
                const jobId = data.job_id ?? data.jobId;
                if (!jobId) {
                    return res.status(400).json({
                        message: "resolved_value must include job_id for create_hazard",
                    });
                }
                const { data: job } = await supabaseClient_1.supabase
                    .from("jobs")
                    .select("id")
                    .eq("id", jobId)
                    .eq("organization_id", organization_id)
                    .single();
                if (!job) {
                    return res.status(400).json({
                        message: "Job not found or does not belong to your organization",
                    });
                }
                const title = data.title ?? data.name ?? "Untitled";
                const description = data.description ?? "";
                const { data: riskFactors } = await supabaseClient_1.supabase
                    .from("risk_factors")
                    .select("id")
                    .eq("is_active", true)
                    .limit(1);
                const riskFactorId = riskFactors?.[0]?.id ?? null;
                // Reconcile with server record when it exists: update instead of insert to avoid duplicates
                const { data: existing } = await supabaseClient_1.supabase
                    .from("mitigation_items")
                    .select("id")
                    .eq("id", targetId)
                    .eq("job_id", jobId)
                    .is("hazard_id", null)
                    .eq("organization_id", organization_id)
                    .single();
                if (existing) {
                    const updatePayload = {
                        title,
                        description: description || null,
                        done: data.done ?? data.is_completed ?? data.isCompleted ?? false,
                        is_completed: data.done ?? data.is_completed ?? data.isCompleted ?? false,
                    };
                    if (riskFactorId)
                        updatePayload.risk_factor_id = riskFactorId;
                    if (updatePayload.done) {
                        updatePayload.completed_at = data.completed_at ?? data.completedAt ?? new Date().toISOString();
                    }
                    const { data: updated, error: updateErr } = await supabaseClient_1.supabase
                        .from("mitigation_items")
                        .update(updatePayload)
                        .eq("id", targetId)
                        .eq("job_id", jobId)
                        .is("hazard_id", null)
                        .eq("organization_id", organization_id)
                        .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                        .single();
                    if (updateErr) {
                        return res.status(500).json({ message: updateErr.message });
                    }
                    updatedMitigationItem = updated;
                    const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                    await (0, audit_2.recordAuditLog)({
                        organizationId: organization_id,
                        actorId: userId,
                        eventName: "hazard.updated",
                        targetType: "hazard",
                        targetId: targetId,
                        metadata: { job_id: jobId, sync_resolve_conflict: true, operation_id: operation_id, reconciled: true },
                        ...clientMetadata,
                    });
                }
                else {
                    const insertPayload = {
                        job_id: jobId,
                        title,
                        description: description || null,
                        done: false,
                        is_completed: false,
                        organization_id: organization_id,
                    };
                    if (riskFactorId)
                        insertPayload.risk_factor_id = riskFactorId;
                    const { data: inserted, error: insertErr } = await supabaseClient_1.supabase
                        .from("mitigation_items")
                        .insert(insertPayload)
                        .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                        .single();
                    if (insertErr) {
                        return res.status(500).json({ message: insertErr.message });
                    }
                    updatedMitigationItem = inserted;
                    const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                    await (0, audit_2.recordAuditLog)({
                        organizationId: organization_id,
                        actorId: userId,
                        eventName: "hazard.created",
                        targetType: "hazard",
                        targetId: inserted.id,
                        metadata: { job_id: jobId, sync_resolve_conflict: true, operation_id: operation_id },
                        ...clientMetadata,
                    });
                }
            }
            else if (opType === "create_control") {
                const jobId = data.job_id ?? data.jobId;
                const hazardId = data.hazard_id ?? data.hazardId;
                if (!jobId) {
                    return res.status(400).json({
                        message: "resolved_value must include job_id for create_control",
                    });
                }
                if (!hazardId) {
                    return res.status(400).json({
                        message: "resolved_value must include hazard_id for create_control",
                    });
                }
                const { data: job } = await supabaseClient_1.supabase
                    .from("jobs")
                    .select("id")
                    .eq("id", jobId)
                    .eq("organization_id", organization_id)
                    .single();
                if (!job) {
                    return res.status(400).json({
                        message: "Job not found or does not belong to your organization",
                    });
                }
                const { data: hazard } = await supabaseClient_1.supabase
                    .from("mitigation_items")
                    .select("id")
                    .eq("id", hazardId)
                    .eq("job_id", jobId)
                    .eq("organization_id", organization_id)
                    .single();
                if (!hazard) {
                    return res.status(400).json({
                        message: "Hazard not found or does not belong to this job and organization",
                    });
                }
                const title = data.title ?? data.name ?? "Untitled";
                const description = data.description ?? "";
                const { data: riskFactors } = await supabaseClient_1.supabase
                    .from("risk_factors")
                    .select("id")
                    .eq("is_active", true)
                    .limit(1);
                const riskFactorId = riskFactors?.[0]?.id ?? null;
                // Reconcile with server record when it exists: update instead of insert to avoid duplicates
                const { data: existing } = await supabaseClient_1.supabase
                    .from("mitigation_items")
                    .select("id")
                    .eq("id", targetId)
                    .eq("job_id", jobId)
                    .eq("hazard_id", hazardId)
                    .eq("organization_id", organization_id)
                    .single();
                if (existing) {
                    const updatePayload = {
                        title,
                        description: description || null,
                        done: data.done ?? data.is_completed ?? data.isCompleted ?? false,
                        is_completed: data.done ?? data.is_completed ?? data.isCompleted ?? false,
                    };
                    if (riskFactorId)
                        updatePayload.risk_factor_id = riskFactorId;
                    if (updatePayload.done) {
                        updatePayload.completed_at = data.completed_at ?? data.completedAt ?? new Date().toISOString();
                    }
                    const { data: updated, error: updateErr } = await supabaseClient_1.supabase
                        .from("mitigation_items")
                        .update(updatePayload)
                        .eq("id", targetId)
                        .eq("job_id", jobId)
                        .eq("hazard_id", hazardId)
                        .eq("organization_id", organization_id)
                        .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                        .single();
                    if (updateErr) {
                        return res.status(500).json({ message: updateErr.message });
                    }
                    updatedMitigationItem = updated;
                    const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                    await (0, audit_2.recordAuditLog)({
                        organizationId: organization_id,
                        actorId: userId,
                        eventName: "control.updated",
                        targetType: "control",
                        targetId: targetId,
                        metadata: { job_id: jobId, hazard_id: hazardId, sync_resolve_conflict: true, operation_id: operation_id, reconciled: true },
                        ...clientMetadata,
                    });
                }
                else {
                    const insertPayload = {
                        job_id: jobId,
                        hazard_id: hazardId,
                        title,
                        description: description || null,
                        done: false,
                        is_completed: false,
                        organization_id: organization_id,
                    };
                    if (riskFactorId)
                        insertPayload.risk_factor_id = riskFactorId;
                    const { data: inserted, error: insertErr } = await supabaseClient_1.supabase
                        .from("mitigation_items")
                        .insert(insertPayload)
                        .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                        .single();
                    if (insertErr) {
                        return res.status(500).json({ message: insertErr.message });
                    }
                    updatedMitigationItem = inserted;
                    const clientMetadata = (0, audit_1.extractClientMetadata)(req);
                    await (0, audit_2.recordAuditLog)({
                        organizationId: organization_id,
                        actorId: userId,
                        eventName: "control.created",
                        targetType: "control",
                        targetId: inserted.id,
                        metadata: { job_id: jobId, hazard_id: hazardId, sync_resolve_conflict: true, operation_id: operation_id },
                        ...clientMetadata,
                    });
                }
            }
            else if (opType === "update_job") {
                const keyMap = {
                    client_name: "client_name",
                    clientName: "client_name",
                    client_type: "client_type",
                    clientType: "client_type",
                    job_type: "job_type",
                    jobType: "job_type",
                    location: "location",
                    description: "description",
                    status: "status",
                    start_date: "start_date",
                    startDate: "start_date",
                    end_date: "end_date",
                    endDate: "end_date",
                    has_subcontractors: "has_subcontractors",
                    subcontractor_count: "subcontractor_count",
                    insurance_status: "insurance_status",
                    risk_score: "risk_score",
                    riskScore: "risk_score",
                    risk_level: "risk_level",
                    riskLevel: "risk_level",
                };
                const updates = {};
                for (const [src, dest] of Object.entries(keyMap)) {
                    if (data[src] !== undefined)
                        updates[dest] = data[src];
                }
                if (Object.keys(updates).length > 0) {
                    const { data: job, error } = await supabaseClient_1.supabase
                        .from("jobs")
                        .update(updates)
                        .eq("id", targetId)
                        .eq("organization_id", organization_id)
                        .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, created_by")
                        .single();
                    if (!error)
                        updatedJob = job;
                }
            }
            else if (opType === "update_hazard") {
                const jobId = data.job_id ?? data.jobId;
                if (!jobId) {
                    return res.status(400).json({ message: "job_id required for hazard update" });
                }
                const updates = {};
                const hasCompletion = data.done !== undefined || data.is_completed !== undefined || data.isCompleted !== undefined;
                if (hasCompletion) {
                    const done = data.done ?? data.is_completed ?? data.isCompleted ?? false;
                    updates.done = done;
                    updates.is_completed = done;
                    if (done) {
                        updates.completed_at = data.completed_at ?? data.completedAt ?? new Date().toISOString();
                    }
                    // when done is false, omit completed_at to preserve existing timestamp
                }
                if (data.title !== undefined)
                    updates.title = data.title;
                else if (data.name !== undefined)
                    updates.title = data.name;
                if (data.description !== undefined)
                    updates.description = data.description;
                const { data: mit, error } = await supabaseClient_1.supabase
                    .from("mitigation_items")
                    .update(updates)
                    .eq("id", targetId)
                    .eq("job_id", jobId)
                    .is("hazard_id", null)
                    .eq("organization_id", organization_id)
                    .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                    .single();
                if (!error)
                    updatedMitigationItem = mit;
            }
            else if (opType === "update_control") {
                const jobId = data.job_id ?? data.jobId;
                const hazardId = data.hazard_id ?? data.hazardId;
                if (!jobId || !hazardId) {
                    return res.status(400).json({ message: "job_id and hazard_id required for control update" });
                }
                const updates = {};
                const hasCompletion = data.done !== undefined || data.is_completed !== undefined || data.isCompleted !== undefined;
                if (hasCompletion) {
                    const done = data.done ?? data.is_completed ?? data.isCompleted ?? false;
                    updates.done = done;
                    updates.is_completed = done;
                    if (done) {
                        updates.completed_at = data.completed_at ?? data.completedAt ?? new Date().toISOString();
                    }
                    // when done is false, omit completed_at to preserve existing timestamp
                }
                if (data.title !== undefined)
                    updates.title = data.title;
                else if (data.name !== undefined)
                    updates.title = data.name;
                if (data.description !== undefined)
                    updates.description = data.description;
                const { data: mit, error } = await supabaseClient_1.supabase
                    .from("mitigation_items")
                    .update(updates)
                    .eq("id", targetId)
                    .eq("job_id", jobId)
                    .eq("hazard_id", hazardId)
                    .eq("organization_id", organization_id)
                    .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
                    .single();
                if (!error)
                    updatedMitigationItem = mit;
            }
            else if (opType === "delete_job") {
                const { data: existing } = await supabaseClient_1.supabase
                    .from("jobs")
                    .select("id, status")
                    .eq("id", targetId)
                    .eq("organization_id", organization_id)
                    .single();
                if (existing?.status !== "draft") {
                    return res.status(409).json({
                        ok: false,
                        message: "Cannot delete job: job is not in draft status",
                        code: "DELETION_REJECTED",
                        deletion_performed: false,
                    });
                }
                const { error: deleteErr } = await supabaseClient_1.supabase
                    .from("jobs")
                    .update({ deleted_at: new Date().toISOString() })
                    .eq("id", targetId)
                    .eq("organization_id", organization_id);
                if (deleteErr) {
                    return res.status(500).json({ message: deleteErr.message });
                }
            }
            else if (opType === "delete_hazard" || opType === "delete_control") {
                const jobId = data.job_id ?? data.jobId;
                const hazardId = opType === "delete_control" ? (data.hazard_id ?? data.hazardId) : null;
                if (!jobId) {
                    return res.status(400).json({ message: "job_id required for delete" });
                }
                if (opType === "delete_hazard") {
                    const { error } = await supabaseClient_1.supabase.rpc("sync_delete_hazard", {
                        p_organization_id: organization_id,
                        p_job_id: jobId,
                        p_hazard_id: targetId,
                    });
                    if (error) {
                        return res.status(500).json({ message: error.message });
                    }
                }
                else {
                    if (!hazardId) {
                        return res.status(400).json({ message: "hazard_id required for control delete" });
                    }
                    // Treat missing/already-deleted control as success (idempotent).
                    const { data: deletedRows, error: deleteErr } = await supabaseClient_1.supabase
                        .from("mitigation_items")
                        .delete()
                        .eq("id", targetId)
                        .eq("job_id", jobId)
                        .eq("hazard_id", hazardId)
                        .eq("organization_id", organization_id)
                        .select("id");
                    if (deleteErr) {
                        return res.status(500).json({ message: deleteErr.message });
                    }
                    // Still write tombstone so operation is idempotent and clears from queue.
                    const { error: tombstoneErr } = await supabaseClient_1.supabase.from("sync_mitigation_deletions").insert({
                        mitigation_item_id: targetId,
                        job_id: jobId,
                        hazard_id: hazardId,
                        organization_id: organization_id,
                    });
                    if (tombstoneErr && tombstoneErr.code !== "23505") {
                        return res.status(500).json({ message: tombstoneErr.message });
                    }
                }
            }
            else {
                return res.status(400).json({
                    message: `Unsupported or missing operation_type for resolve: ${opType}. Supported: create_job, create_hazard, create_control, update_job, update_hazard, update_control, delete_job, delete_hazard, delete_control`,
                });
            }
        }
        const clientMetadata = (0, audit_1.extractClientMetadata)(req);
        await (0, audit_2.recordAuditLog)({
            organizationId: organization_id,
            actorId: userId,
            eventName: "sync.conflict_resolved",
            targetType: "system",
            targetId: operation_id,
            metadata: { strategy, resolved_value, entity_type, entity_id, operation_type: effectiveOperationType ?? operation_type },
            ...clientMetadata,
        });
        res.json({
            ok: true,
            operation_id,
            strategy,
            ...(updatedJob && { updated_job: updatedJob }),
            ...(updatedMitigationItem && { updated_mitigation_item: updatedMitigationItem }),
        });
    }
    catch (err) {
        console.error("[Sync] Resolve conflict failed:", err);
        res.status(500).json({ message: "Failed to resolve conflict" });
    }
});
//# sourceMappingURL=sync.js.map