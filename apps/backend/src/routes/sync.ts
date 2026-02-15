/**
 * Sync API - Batch upload, incremental download, conflict resolution for offline-first iOS
 * POST /api/sync/batch - Upload pending operations
 * GET /api/sync/changes?since={timestamp} - Incremental sync
 * POST /api/sync/resolve-conflict - Submit conflict resolution
 */

import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { requireWriteAccess } from "../middleware/requireWriteAccess";
import { extractClientMetadata } from "../middleware/audit";
import { recordAuditLog } from "../middleware/audit";

export const syncRouter: ExpressRouter = express.Router();

const MAX_BATCH_SIZE = 200; // Support 100+ as per ticket, allow up to 200

interface SyncOperationInput {
  id: string;
  type: string;
  entity_id: string;
  data: Record<string, any>;
  client_timestamp: string;
}

interface BatchOperationResult {
  operation_id: string;
  status: "success" | "conflict" | "error";
  server_id?: string;
  error?: string;
  conflict?: {
    entity_type?: string;
    entity_id?: string;
    field: string;
    server_value: any;
    local_value: any;
    server_timestamp?: string;
    local_timestamp?: string;
  };
}

// POST /api/sync/batch - Upload pending operations
syncRouter.post(
  "/batch",
  authenticate,
  requireWriteAccess,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id, id: userId } = authReq.user;
      const { operations } = req.body as { operations: SyncOperationInput[] };

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

      const results: BatchOperationResult[] = [];

      for (const op of operations) {
        const baseResult: BatchOperationResult = {
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

              const { data: job, error: jobError } = await supabase
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
                  baseResult.status = "conflict";
                  baseResult.conflict = {
                    field: "id",
                    server_value: "exists",
                    local_value: op.entity_id,
                  };
                } else {
                  baseResult.status = "error";
                  baseResult.error = jobError.message;
                }
              } else if (job) {
                baseResult.server_id = job.id;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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

              const { data: existing, error: fetchError } = await supabase
                .from("jobs")
                .select("id, updated_at")
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
                };
                results.push(baseResult);
                continue;
              }

              const updates: Record<string, any> = {};
              const keyMap: Record<string, string> = {
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
                if (data[src] !== undefined) updates[dest] = data[src];
              }
              if (Object.keys(updates).length === 0) {
                baseResult.server_id = jobId;
                results.push(baseResult);
                continue;
              }

              const { error: updateError } = await supabase
                .from("jobs")
                .update(updates)
                .eq("id", jobId)
                .eq("organization_id", organization_id);

              if (updateError) {
                baseResult.status = "error";
                baseResult.error = updateError.message;
              } else {
                baseResult.server_id = jobId;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              const { data: existing, error: fetchError } = await supabase
                .from("jobs")
                .select("id, status")
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
                };
                results.push(baseResult);
                continue;
              }

              const { error: deleteError } = await supabase
                .from("jobs")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", jobId)
                .eq("organization_id", organization_id);

              if (deleteError) {
                baseResult.status = "error";
                baseResult.error = deleteError.message;
              } else {
                baseResult.server_id = jobId;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              const { data: job } = await supabase
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
              const { data: riskFactors } = await supabase
                .from("risk_factors")
                .select("id")
                .eq("is_active", true)
                .limit(1);
              const riskFactorId = riskFactors?.[0]?.id ?? null;
              const insertPayload: Record<string, any> = {
                job_id: jobId,
                title,
                description: description || null,
                done: false,
                is_completed: false,
                organization_id: organization_id,
              };
              if (riskFactorId) insertPayload.risk_factor_id = riskFactorId;
              const { data: inserted, error: insertErr } = await supabase
                .from("mitigation_items")
                .insert(insertPayload)
                .select("id")
                .single();
              if (insertErr) {
                baseResult.status = "error";
                baseResult.error = insertErr.message;
              } else if (inserted) {
                baseResult.server_id = inserted.id;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              const { data: job } = await supabase
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
              const { data: hazard } = await supabase
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
              const { data: riskFactors } = await supabase
                .from("risk_factors")
                .select("id")
                .eq("is_active", true)
                .limit(1);
              const riskFactorId = riskFactors?.[0]?.id ?? null;
              const insertPayload: Record<string, any> = {
                job_id: jobId,
                hazard_id: hazardId,
                title,
                description: description || null,
                done: false,
                is_completed: false,
                organization_id: organization_id,
              };
              if (riskFactorId) insertPayload.risk_factor_id = riskFactorId;
              const { data: inserted, error: insertErr } = await supabase
                .from("mitigation_items")
                .insert(insertPayload)
                .select("id")
                .single();
              if (insertErr) {
                baseResult.status = "error";
                baseResult.error = insertErr.message;
              } else if (inserted) {
                baseResult.server_id = inserted.id;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              const hasCompletion =
                data.done !== undefined || data.is_completed !== undefined || data.isCompleted !== undefined;
              let done: boolean;
              if (hasCompletion) {
                done = data.done ?? data.is_completed ?? data.isCompleted ?? false;
              } else {
                const { data: existing, error: fetchErr } = await supabase
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
              const { data: updated, error: updateErr } = await supabase
                .from("mitigation_items")
                .update({ done, is_completed: done, completed_at: done ? new Date().toISOString() : null })
                .eq("id", mitigationId)
                .eq("job_id", jobId)
                .eq("organization_id", organization_id)
                .select("id")
                .single();
              if (updateErr) {
                baseResult.status = "error";
                baseResult.error = updateErr.message;
              } else {
                baseResult.server_id = mitigationId;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              const hasCompletion =
                data.done !== undefined || data.is_completed !== undefined || data.isCompleted !== undefined;
              let done: boolean;
              if (hasCompletion) {
                done = data.done ?? data.is_completed ?? data.isCompleted ?? false;
              } else {
                const { data: existing, error: fetchErr } = await supabase
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
              const { data: updated, error: updateErr } = await supabase
                .from("mitigation_items")
                .update({ done, is_completed: done, completed_at: done ? new Date().toISOString() : null })
                .eq("id", mitigationId)
                .eq("job_id", jobId)
                .eq("hazard_id", hazardId)
                .eq("organization_id", organization_id)
                .select("id")
                .single();
              if (updateErr) {
                baseResult.status = "error";
                baseResult.error = updateErr.message;
              } else {
                baseResult.server_id = mitigationId;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              const { data: rpcResult, error: rpcErr } = await supabase.rpc("sync_delete_hazard", {
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
              const clientMetadata = extractClientMetadata(req);
              await recordAuditLog({
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
              // Record deletion for offline sync tombstones
              await supabase.from("sync_mitigation_deletions").insert({
                mitigation_item_id: mitigationId,
                job_id: jobId,
                hazard_id: hazardId,
                organization_id: organization_id,
              });
              const { error: deleteErr } = await supabase
                .from("mitigation_items")
                .delete()
                .eq("id", mitigationId)
                .eq("job_id", jobId)
                .eq("hazard_id", hazardId)
                .eq("organization_id", organization_id);
              if (deleteErr) {
                baseResult.status = "error";
                baseResult.error = deleteErr.message;
              } else {
                baseResult.server_id = mitigationId;
                const clientMetadata = extractClientMetadata(req);
                await recordAuditLog({
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
              }
              results.push(baseResult);
              break;
            }

            default:
              baseResult.status = "error";
              baseResult.error = `Unknown operation type: ${op.type}`;
              results.push(baseResult);
          }
        } catch (err: any) {
          baseResult.status = "error";
          baseResult.error = err?.message ?? String(err);
          results.push(baseResult);
        }
      }

      res.json({ results });
    } catch (err: any) {
      console.error("[Sync] Batch failed:", err);
      res.status(500).json({ message: "Sync batch failed" });
    }
  }
);

// GET /api/sync/changes?since={ts}&limit={n}&jobs_offset={n}&mitigation_offset={n}&entity={jobs|mitigation_items}
// entity=jobs: jobs only. entity=mitigation_items: hazards/controls only. Omit for both.
// Jobs and mitigation_items are paginated independently. Use jobs_offset and mitigation_offset
// (or offset as fallback when entity is specific) so clients never skip items when one entity fills a page.
syncRouter.get(
  "/changes",
  authenticate,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id } = authReq.user;
      const sinceStr = req.query.since as string;
      const entity = (req.query.entity as string) || "all";
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 500, 1), 1000);
      const fallbackOffset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
      const jobsOffsetParam = parseInt(req.query.jobs_offset as string, 10);
      const mitigationOffsetParam = parseInt(req.query.mitigation_offset as string, 10);
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

      let jobs: any[] = [];
      let mitigationItems: any[] = [];

      let deletedJobIds: string[] = [];
      if (fetchJobs) {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, created_by")
          .eq("organization_id", organization_id)
          .is("deleted_at", null)
          .gte("updated_at", since.toISOString())
          .order("updated_at", { ascending: true })
          .range(jobsOffset, jobsOffset + limit - 1);
        if (error) throw error;
        jobs = data || [];

        // Tombstones: jobs deleted since sync timestamp so offline clients can purge them
        const { data: deletedJobs } = await supabase
          .from("jobs")
          .select("id")
          .eq("organization_id", organization_id)
          .not("deleted_at", "is", null)
          .gte("deleted_at", since.toISOString());
        deletedJobIds = (deletedJobs || []).map((d: { id: string }) => d.id);
      }

      let deletedMitigationIds: string[] = [];
      if (fetchMitigation) {
        const { data, error } = await supabase
          .from("mitigation_items")
          .select("id, job_id, hazard_id, title, description, done, is_completed, created_at, updated_at")
          .eq("organization_id", organization_id)
          .gte("updated_at", since.toISOString())
          .order("updated_at", { ascending: true })
          .range(mitigationOffset, mitigationOffset + limit - 1);
        if (error) throw error;
        mitigationItems = data || [];

        // Fetch deletion tombstones so offline caches can remove deleted hazards/controls
        const { data: deletions } = await supabase
          .from("sync_mitigation_deletions")
          .select("mitigation_item_id")
          .eq("organization_id", organization_id)
          .gte("deleted_at", since.toISOString());
        deletedMitigationIds = (deletions || []).map((d: { mitigation_item_id: string }) => d.mitigation_item_id);
      }

      const normalizedJobs = jobs.map((j: any) => ({
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

      const normalizeMitigationItem = (item: any) => {
        const isHazard = item.hazard_id == null;
        const match = item.title ? item.title.match(/^([A-Z0-9_]+)/) : null;
        const code = match && match[1] ? match[1] : (item.title ? item.title.substring(0, 10).toUpperCase().replace(/\s+/g, "_") : "UNKNOWN");
        const status = item.done || item.is_completed ? (isHazard ? "resolved" : "Completed") : (isHazard ? "open" : "Pending");
        if (isHazard) {
          return {
            entity_type: "hazard" as const,
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
          entity_type: "control" as const,
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
      const pagination: Record<string, any> = {
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
    } catch (err: any) {
      console.error("[Sync] Changes failed:", err);
      res.status(500).json({ message: "Failed to fetch changes" });
    }
  }
);

// POST /api/sync/resolve-conflict - Submit conflict resolution
syncRouter.post(
  "/resolve-conflict",
  authenticate,
  requireWriteAccess,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id, id: userId } = authReq.user;
      const { operation_id, strategy, resolved_value } = req.body as {
        operation_id: string;
        strategy: "server_wins" | "local_wins" | "merge" | "ask_user";
        resolved_value?: any;
      };

      if (!operation_id || !strategy) {
        return res.status(400).json({
          message: "operation_id and strategy are required",
        });
      }

      const validStrategies = ["server_wins", "local_wins", "merge", "ask_user"];
      if (!validStrategies.includes(strategy)) {
        return res.status(400).json({
          message: `Invalid strategy. Must be one of: ${validStrategies.join(", ")}`,
        });
      }

      if (strategy === "local_wins" && resolved_value === undefined) {
        return res.status(400).json({
          message: "resolved_value required when strategy is local_wins",
        });
      }

      const clientMetadata = extractClientMetadata(req);
      await recordAuditLog({
        organizationId: organization_id,
        actorId: userId,
        eventName: "sync.conflict_resolved",
        targetType: "system",
        targetId: operation_id,
        metadata: { strategy, resolved_value },
        ...clientMetadata,
      });

      res.json({
        ok: true,
        operation_id,
        strategy,
      });
    } catch (err: any) {
      console.error("[Sync] Resolve conflict failed:", err);
      res.status(500).json({ message: "Failed to resolve conflict" });
    }
  }
);
