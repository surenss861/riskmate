import express from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { recordAuditLog } from "../middleware/audit";
import { calculateRiskScore, generateMitigationItems } from "../utils/riskScoring";
import { notifyHighRiskJob } from "../services/notifications";
import { buildJobReport } from "../utils/jobReport";
import { enforceJobLimit } from "../middleware/limits";
import { RequestWithId } from "../middleware/requestId";

export const jobsRouter = express.Router();

// Rate-limited logging for cursor misuse (once per organization per hour)
// This helps identify client misconfigurations without spamming logs
const cursorMisuseLogs = new Map<string, number>();
const CURSOR_MISUSE_LOG_TTL_MS = 60 * 60 * 1000; // 1 hour

const logCursorMisuse = (organizationId: string, sortMode: string): number => {
  const key = `${organizationId}:${sortMode}`;
  const lastLogged = cursorMisuseLogs.get(key);
  const now = Date.now();
  
  if (!lastLogged || (now - lastLogged) > CURSOR_MISUSE_LOG_TTL_MS) {
    console.warn(`[Cursor Misuse] Organization ${organizationId} attempted cursor pagination with sort=${sortMode}. This indicates a client misconfiguration.`);
    cursorMisuseLogs.set(key, now);
    
    // Clean up old entries (simple cleanup, runs on every log)
    if (cursorMisuseLogs.size > 1000) {
      const cutoff = now - CURSOR_MISUSE_LOG_TTL_MS;
      for (const [k, v] of cursorMisuseLogs.entries()) {
        if (v < cutoff) {
          cursorMisuseLogs.delete(k);
        }
      }
    }
  }
  
  return lastLogged || 0;
};

// GET /api/jobs
// Returns paginated list of jobs for organization
jobsRouter.get("/", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id } = authReq.user;
    const { page = 1, limit = 20, status, risk_level, include_archived, sort } = authReq.query;
    const includeArchived = include_archived === 'true' || include_archived === '1';
    
    // Parse sort parameter (e.g., "risk_desc", "created_desc", "status_asc")
    let sortField = 'created_at';
    let sortDirection: 'asc' | 'desc' = 'desc';
    let useStatusOrdering = false;
    let sortMode: 'created_desc' | 'created_asc' | 'risk_desc' | 'risk_asc' | 'status_asc' | 'status_desc' = 'created_desc';
    
    if (sort) {
      const sortStr = String(sort);
      if (sortStr.includes('_')) {
        const [field, dir] = sortStr.split('_');
        sortMode = `${field}_${dir}` as any;
        if (field === 'status') {
          useStatusOrdering = true;
          sortDirection = dir === 'asc' ? 'asc' : 'desc';
        } else {
          sortField = field === 'risk' ? 'risk_score' : field === 'created' ? 'created_at' : 'created_at';
          sortDirection = dir === 'asc' ? 'asc' : 'desc';
        }
      }
    }

    // Parse cursor pagination
    // Cursor format varies by sort mode:
    // - created_desc/created_asc: "created_at|id"
    // - risk_desc/risk_asc: "risk_score|created_at|id"
    // - status_asc/status_desc: DISABLED (use offset only - in-memory sort incompatible with cursor)
    const { cursor, limit: limitParam } = authReq.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = limitParam ? parseInt(limitParam as string, 10) : parseInt(limit as string, 10) || 20;
    
    // Cursor pagination is only safe for sorts that match SQL ordering
    // status_asc uses in-memory sorting, so cursor pagination would be inconsistent
    const supportsCursorPagination = !useStatusOrdering;
    
    // Hardening: Explicitly reject cursor param when sort=status_* (prevents misuse)
    if (cursor && useStatusOrdering) {
      // Log misuse once per organization per hour (helps identify client misconfigurations)
      const lastLogged = logCursorMisuse(organization_id, sortMode);
      const retryAfterSeconds = lastLogged ? Math.ceil((CURSOR_MISUSE_LOG_TTL_MS - (Date.now() - lastLogged)) / 1000) : 0;
      
      return res.status(400).json({
        message: "Cursor pagination is not supported for status sorting. Use offset pagination (page parameter) instead.",
        code: "CURSOR_NOT_SUPPORTED_FOR_SORT",
        sort: sortMode,
        reason: "Status sorting uses in-memory ordering which is incompatible with cursor pagination",
        documentation_url: "/docs/pagination#status-sorting",
        allowed_pagination_modes: ["offset"],
        request_id: requestId,
        ...(retryAfterSeconds > 0 && { retry_after_seconds: retryAfterSeconds }),
      });
    }
    
    const useCursor = cursor && supportsCursorPagination;
    
    // Deterministic status order: draft → in_progress → completed → archived
    const statusOrder = ['draft', 'in_progress', 'completed', 'archived', 'cancelled', 'on_hold'];
    const getStatusOrder = (status: string) => {
      const index = statusOrder.indexOf(status);
      return index >= 0 ? index : statusOrder.length; // Unknown statuses go last
    };

    let query = supabase
      .from("jobs")
      .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, applied_template_id, applied_template_type")
      .eq("organization_id", organization_id)
      .is("deleted_at", null); // Always exclude deleted
    
    // Cursor-based pagination (per-sort cursor keys for consistency)
    if (useCursor) {
      try {
        const cursorStr = String(cursor);
        
        if (sortField === 'created_at') {
          // created_desc/created_asc: cursor = "created_at|id"
          const [cursorTimestamp, cursorId] = cursorStr.split('|');
          if (cursorTimestamp && cursorId) {
            if (sortDirection === 'desc') {
              // created_desc: jobs created before cursor, or same timestamp but id < cursorId
              query = query.or(`created_at.lt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.lt.${cursorId})`);
            } else {
              // created_asc: jobs created after cursor, or same timestamp but id > cursorId
              query = query.or(`created_at.gt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.gt.${cursorId})`);
            }
          }
        } else if (sortField === 'risk_score') {
          // risk_desc/risk_asc: cursor = "risk_score|created_at|id"
          const parts = cursorStr.split('|');
          if (parts.length === 3) {
            const [cursorRisk, cursorTimestamp, cursorId] = parts;
            const cursorRiskNum = parseFloat(cursorRisk);
            if (!isNaN(cursorRiskNum) && cursorTimestamp && cursorId) {
              if (sortDirection === 'desc') {
                // risk_desc: risk < cursor OR (risk = cursor AND created < cursor) OR (risk = cursor AND created = cursor AND id < cursorId)
                query = query.or(
                  `risk_score.lt.${cursorRiskNum},and(risk_score.eq.${cursorRiskNum},created_at.lt.${cursorTimestamp}),and(risk_score.eq.${cursorRiskNum},created_at.eq.${cursorTimestamp},id.lt.${cursorId})`
                );
              } else {
                // risk_asc: risk > cursor OR (risk = cursor AND created > cursor) OR (risk = cursor AND created = cursor AND id > cursorId)
                query = query.or(
                  `risk_score.gt.${cursorRiskNum},and(risk_score.eq.${cursorRiskNum},created_at.gt.${cursorTimestamp}),and(risk_score.eq.${cursorRiskNum},created_at.eq.${cursorTimestamp},id.gt.${cursorId})`
                );
              }
            }
          }
        }
      } catch (e) {
        // Invalid cursor format, fall back to offset pagination
        console.warn('Invalid cursor format, using offset pagination:', e);
      }
    }
    
    // Apply sorting (SQL-based for cursor-compatible sorts)
    if (useStatusOrdering) {
      // For status sorting, we'll sort in memory after fetching
      // Cursor pagination is disabled for status_asc to prevent drift
      query = query.order("created_at", { ascending: false }); // Pre-sort by created_at DESC for consistency
    } else {
      // For created_at and risk_score, use SQL ordering (cursor-compatible)
      if (sortField === 'risk_score') {
        // Multi-column sort: risk_score, then created_at, then id (for deterministic cursor)
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
        query = query.order("created_at", { ascending: sortDirection === 'asc' });
        query = query.order("id", { ascending: sortDirection === 'asc' });
      } else {
        // Single-column sort: created_at, then id (for deterministic cursor)
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
        query = query.order("id", { ascending: sortDirection === 'asc' });
      }
    }
    
    // Apply pagination
    if (!useCursor) {
      // Offset pagination (used for status_asc or when cursor is not provided)
      const offset = (pageNum - 1) * limitNum;
      query = query.range(offset, offset + limitNum - 1);
    } else {
      // Cursor pagination (for created_desc, created_asc, risk_desc, risk_asc)
      query = query.limit(limitNum);
    }
    
    // Only exclude archived if not explicitly including them
    if (!includeArchived) {
      query = query.is("archived_at", null);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (risk_level) {
      query = query.eq("risk_level", risk_level);
    }

    let { data: jobs, error } = await query;
    
    // If error is due to missing columns (migration not applied), retry without archive/delete filters
    if (error && (error.message?.includes('archived_at') || error.message?.includes('deleted_at') || (error as any).code === 'PGRST116')) {
      console.warn('Archive/delete columns not found - retrying without filters (migration may not be applied yet)');
      let fallbackQuery = supabase
        .from("jobs")
        .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, applied_template_id, applied_template_type")
        .eq("organization_id", organization_id);
      
      // Apply cursor or offset pagination (fallback mode - simplified)
      if (useCursor) {
        try {
          const cursorStr = String(cursor);
          if (sortField === 'created_at') {
            const [cursorTimestamp, cursorId] = cursorStr.split('|');
            if (cursorTimestamp && cursorId) {
              if (sortDirection === 'desc') {
                fallbackQuery = fallbackQuery.or(`created_at.lt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.lt.${cursorId})`);
              } else {
                fallbackQuery = fallbackQuery.or(`created_at.gt.${cursorTimestamp},and(created_at.eq.${cursorTimestamp},id.gt.${cursorId})`);
              }
            }
          } else if (sortField === 'risk_score') {
            const parts = cursorStr.split('|');
            if (parts.length === 3) {
              const [cursorRisk, cursorTimestamp, cursorId] = parts;
              const cursorRiskNum = parseFloat(cursorRisk);
              if (!isNaN(cursorRiskNum) && cursorTimestamp && cursorId) {
                if (sortDirection === 'desc') {
                  fallbackQuery = fallbackQuery.or(
                    `risk_score.lt.${cursorRiskNum},and(risk_score.eq.${cursorRiskNum},created_at.lt.${cursorTimestamp}),and(risk_score.eq.${cursorRiskNum},created_at.eq.${cursorTimestamp},id.lt.${cursorId})`
                  );
                } else {
                  fallbackQuery = fallbackQuery.or(
                    `risk_score.gt.${cursorRiskNum},and(risk_score.eq.${cursorRiskNum},created_at.gt.${cursorTimestamp}),and(risk_score.eq.${cursorRiskNum},created_at.eq.${cursorTimestamp},id.gt.${cursorId})`
                  );
                }
              }
            }
          }
        } catch (e) {
          // Invalid cursor, fall back to offset
        }
      }
      
      if (useStatusOrdering) {
        fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
      } else {
        if (sortField === 'risk_score') {
          fallbackQuery = fallbackQuery.order(sortField, { ascending: sortDirection === 'asc' });
          fallbackQuery = fallbackQuery.order("created_at", { ascending: sortDirection === 'asc' });
          fallbackQuery = fallbackQuery.order("id", { ascending: sortDirection === 'asc' });
        } else {
          fallbackQuery = fallbackQuery.order(sortField, { ascending: sortDirection === 'asc' });
          fallbackQuery = fallbackQuery.order("id", { ascending: sortDirection === 'asc' });
        }
      }
      
      if (!useCursor) {
        const offset = (pageNum - 1) * limitNum;
        fallbackQuery = fallbackQuery.range(offset, offset + limitNum - 1);
      } else {
        fallbackQuery = fallbackQuery.limit(limitNum);
      }
      
      // Only exclude archived if not explicitly including them (fallback mode)
      if (!includeArchived) {
        // Try to filter archived, but if column doesn't exist, continue without filter
        try {
          fallbackQuery = fallbackQuery.is("archived_at", null);
        } catch (e) {
          // Column doesn't exist, continue without filter
        }
      }
      
      if (status) {
        fallbackQuery = fallbackQuery.eq("status", status);
      }
      if (risk_level) {
        fallbackQuery = fallbackQuery.eq("risk_level", risk_level);
      }
      
      const fallbackResult = await fallbackQuery;
      jobs = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) throw error;
    
    // Apply deterministic status ordering if requested (in-memory sort)
    if (useStatusOrdering && jobs) {
      jobs = [...jobs].sort((a, b) => {
        const aOrder = getStatusOrder(a.status);
        const bOrder = getStatusOrder(b.status);
        if (aOrder !== bOrder) {
          return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder;
        }
        // If same status, sort by created_at as tiebreaker
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      });
    }
    
    // Ensure template fields are never undefined (always null if missing)
    if (jobs) {
      jobs = jobs.map((job: any) => ({
        ...job,
        applied_template_id: job.applied_template_id ?? null,
        applied_template_type: job.applied_template_type ?? null,
      }));
    }
    
    // Generate next cursor for cursor pagination (per-sort cursor keys)
    let nextCursor: string | null = null;
    if (useCursor && jobs && jobs.length === limitNum) {
      const lastJob = jobs[jobs.length - 1];
      
      if (sortField === 'created_at') {
        // created_desc/created_asc: cursor = "created_at|id"
        nextCursor = `${lastJob.created_at}|${lastJob.id}`;
      } else if (sortField === 'risk_score') {
        // risk_desc/risk_asc: cursor = "risk_score|created_at|id"
        const riskScore = lastJob.risk_score ?? 0;
        nextCursor = `${riskScore}|${lastJob.created_at}|${lastJob.id}`;
      }
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .is("deleted_at", null); // Always exclude deleted
    
    // Only exclude archived if not explicitly including them
    if (!includeArchived) {
      countQuery = countQuery.is("archived_at", null);
    }

    if (status) {
      countQuery = countQuery.eq("status", status);
    }

    if (risk_level) {
      countQuery = countQuery.eq("risk_level", risk_level);
    }

    let { count, error: countError } = await countQuery;
    
    // If error is due to missing columns, retry without archive/delete filters
    if (countError && (countError.message?.includes('archived_at') || countError.message?.includes('deleted_at') || (countError as any).code === 'PGRST116')) {
      let fallbackCountQuery = supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organization_id);
      
      if (status) {
        fallbackCountQuery = fallbackCountQuery.eq("status", status);
      }
      if (risk_level) {
        fallbackCountQuery = fallbackCountQuery.eq("risk_level", risk_level);
      }
      
      const fallbackCountResult = await fallbackCountQuery;
      count = fallbackCountResult.count;
      countError = fallbackCountResult.error;
    }

    if (countError) throw countError;

    res.json({
      data: jobs || [],
      pagination: {
        page: cursor ? undefined : pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: cursor ? undefined : Math.ceil((count || 0) / limitNum),
        cursor: nextCursor || undefined,
        hasMore: nextCursor !== null,
      },
      request_id: requestId,
      // Dev-only: indicate source of truth and pagination mode (requires both NODE_ENV and debug flag)
      ...(process.env.NODE_ENV === 'development' && authReq.query.debug === '1' && {
        _meta: {
          source: 'authenticated_api',
          include_archived: includeArchived,
          organization_id: organization_id,
          sort: sortMode,
          sort_field: useStatusOrdering ? 'status' : sortField,
          sort_direction: sortDirection,
          pagination_mode: useCursor ? 'cursor' : 'offset',
          cursor_supported: supportsCursorPagination,
        },
      }),
    });
  } catch (err: any) {
    console.error("Jobs fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch jobs" });
  }
});

// GET /api/jobs/:id
// Returns full job details with risk score and mitigation items
jobsRouter.get("/:id", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const { organization_id } = authReq.user;

    // Get job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Get risk score
    const { data: riskScore } = await supabase
      .from("job_risk_scores")
      .select("*")
      .eq("job_id", jobId)
      .single();

    // Get mitigation items
    const { data: mitigationItems } = await supabase
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
  } catch (err: any) {
    console.error("Job fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch job" });
  }
});

// POST /api/jobs
// Creates a new job and calculates risk score
jobsRouter.post("/", authenticate as unknown as express.RequestHandler, enforceJobLimit as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id, id: userId } = authReq.user;
    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      risk_factor_codes = [], // Array of risk factor codes (e.g., ['HEIGHT_WORK', 'ELECTRICAL_WORK'])
      has_subcontractors = false,
      subcontractor_count = 0,
      insurance_status = 'pending',
    } = authReq.body;

    // Validate required fields
    if (!client_name || !client_type || !job_type || !location) {
      return res.status(400).json({
        message: "Missing required fields: client_name, client_type, job_type, location",
      });
    }

    // Check subscription limits (Starter: 10 jobs/month)
    const { data: subscription } = await supabase
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
      const { count } = await supabase
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
    const { data: job, error: jobError } = await supabase
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

    recordAuditLog({
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
        riskScoreResult = await calculateRiskScore(risk_factor_codes);

        // Save risk score
        await supabase.from("job_risk_scores").insert({
          job_id: job.id,
          overall_score: riskScoreResult.overall_score,
          risk_level: riskScoreResult.risk_level,
          factors: riskScoreResult.factors,
        });

        // Update job with risk score
        await supabase
          .from("jobs")
          .update({
            risk_score: riskScoreResult.overall_score,
            risk_level: riskScoreResult.risk_level,
          })
          .eq("id", job.id);

        // Generate mitigation items
        await generateMitigationItems(job.id, risk_factor_codes);

        await notifyHighRiskJob({
          organizationId: organization_id,
          jobId: job.id,
          clientName: client_name,
          riskScore: riskScoreResult.overall_score,
        });
      } catch (riskError: any) {
        console.error("Risk scoring failed:", riskError);
        // Continue without risk score - job is still created
      }
    }

    // Fetch complete job with risk details
    const { data: completeJob } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job.id)
      .single();

    const { data: mitigationItems } = await supabase
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
  } catch (err: any) {
    console.error("Job creation error:", err);
    res.status(500).json({ message: err.message || "Failed to create job" });
  }
});

// PATCH /api/jobs/:id
// Updates a job and optionally recalculates risk score
jobsRouter.patch("/:id", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const { organization_id, id: userId } = authReq.user;
    const updateData = authReq.body;
    const { risk_factor_codes, ...jobUpdates } = updateData;
    let updatedRiskScore: number | null = null;
    let updatedClientName: string | null = null;

    // Verify job belongs to organization
    const { data: existingJob, error: jobError } = await supabase
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
      const { error: updateError } = await supabase
        .from("jobs")
        .update(jobUpdates)
        .eq("id", jobId);

      if (updateError) throw updateError;
    }

    // Recalculate risk if risk factors changed
    if (risk_factor_codes !== undefined) {
      try {
        // Delete existing risk score and mitigation items
        await supabase.from("job_risk_scores").delete().eq("job_id", jobId);
        await supabase.from("mitigation_items").delete().eq("job_id", jobId);

        if (risk_factor_codes && risk_factor_codes.length > 0) {
          const riskScoreResult = await calculateRiskScore(risk_factor_codes);

          // Save new risk score
          await supabase.from("job_risk_scores").insert({
            job_id: jobId,
            overall_score: riskScoreResult.overall_score,
            risk_level: riskScoreResult.risk_level,
            factors: riskScoreResult.factors,
          });

          // Update job
          await supabase
            .from("jobs")
            .update({
              risk_score: riskScoreResult.overall_score,
              risk_level: riskScoreResult.risk_level,
            })
            .eq("id", jobId);

          // Generate new mitigation items
          await generateMitigationItems(jobId, risk_factor_codes);

          updatedRiskScore = riskScoreResult.overall_score;
        } else {
          // Clear risk score if no factors
          await supabase
            .from("jobs")
            .update({
              risk_score: null,
              risk_level: null,
            })
            .eq("id", jobId);
        }
      } catch (riskError: any) {
        console.error("Risk recalculation failed:", riskError);
        // Continue - job update succeeded
      }
    }

    // Fetch updated job
    const { data: updatedJob } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    updatedClientName = updatedJob?.client_name ?? null;

    if (updatedRiskScore !== null) {
      await notifyHighRiskJob({
        organizationId: organization_id,
        jobId,
        clientName: updatedClientName ?? "Job",
        riskScore: updatedRiskScore,
      });
    }

    recordAuditLog({
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
  } catch (err: any) {
    console.error("Job update failed:", err);
    res.status(500).json({ message: "Failed to update job" });
  }
});

// PATCH /api/jobs/:id/mitigations/:mitigationId
jobsRouter.patch("/:id/mitigations/:mitigationId", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const mitigationId = authReq.params.mitigationId;
    const { organization_id } = authReq.user;
    const { done } = authReq.body;

    if (typeof done !== "boolean") {
      return res.status(400).json({ message: "'done' boolean field is required" });
    }

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
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

    const { data: updatedItem, error: updateError } = await supabase
      .from("mitigation_items")
      .update(updatePayload)
      .eq("id", mitigationId)
      .eq("job_id", jobId)
      .select("id, title, description, done, is_completed, completed_at, created_at")
      .single();

    if (updateError) {
      if ((updateError as any).code === "PGRST116") {
        return res.status(404).json({ message: "Mitigation item not found" });
      }

      throw updateError;
    }

    if (!updatedItem) {
      return res.status(404).json({ message: "Mitigation item not found" });
    }

    recordAuditLog({
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
  } catch (err: any) {
    console.error("Mitigation update failed:", err);
    res.status(500).json({ message: "Failed to update mitigation item" });
  }
});

type CachedJobReport = {
  data: any;
  expiresAt: number;
};

const jobReportCache = new Map<string, CachedJobReport>();
const JOB_REPORT_TTL_MS = 60 * 1000;

const getCachedJobReport = (key: string) => {
  const cached = jobReportCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    jobReportCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCachedJobReport = (key: string, data: any) => {
  jobReportCache.set(key, { data, expiresAt: Date.now() + JOB_REPORT_TTL_MS });
};

const invalidateJobReportCache = (organizationId: string, jobId: string) => {
  jobReportCache.delete(`${organizationId}:${jobId}`);
};

jobsRouter.get("/:id/full", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const { organization_id } = authReq.user;
    const cacheKey = `${organization_id}:${jobId}`;
    const cached = getCachedJobReport(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const payload = await buildJobReport(organization_id, jobId);

    setCachedJobReport(cacheKey, payload);

    res.json(payload);
  } catch (err: any) {
    console.error("Job full fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch job report data" });
  }
});

// GET /api/jobs/:id/documents
// Returns all uploaded documents for a specific job
jobsRouter.get("/:id/documents", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const { organization_id } = authReq.user;

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, organization_id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Get documents for this job
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, type, file_size, file_path, mime_type, description, created_at, uploaded_by")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const documentsWithUrls = await Promise.all(
      (data || []).map(async (doc) => {
        try {
          const { data: signed } = await supabase.storage
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
        } catch (error) {
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
      })
    );

    res.json({ data: documentsWithUrls });
  } catch (err: any) {
    console.error("Docs fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// POST /api/jobs/:id/documents
// Persists document metadata after upload to storage
jobsRouter.post("/:id/documents", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
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
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const { data: inserted, error: insertError } = await supabase
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

    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(inserted.file_path, 60 * 10);

    recordAuditLog({
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

  } catch (err: any) {
    console.error("Document metadata save failed:", err);
    res.status(500).json({ message: "Failed to save document metadata" });
  }
});

// GET /api/jobs/:id/audit
// Returns recent audit entries for a specific job
jobsRouter.get("/:id/audit", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const { organization_id } = authReq.user;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("id, event_name, target_type, target_id, actor_id, metadata, created_at")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) {
      throw error;
    }

    const filtered =
      (logs || []).filter((log) => {
        if (log.target_id === jobId) return true;
        const metadata = (log.metadata || {}) as Record<string, any>;
        if (metadata?.job_id === jobId) return true;
        return false;
      }) ?? [];

    res.json({
      data: filtered.slice(0, 100),
    });
  } catch (err: any) {
    console.error("Audit fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch audit log" });
  }
});

// POST /api/jobs/:id/archive
// Archives a job (soft delete, read-only, preserves for audit)
jobsRouter.post("/:id/archive", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id: userId, organization_id } = authReq.user;
    const jobId = authReq.params.id;

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
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
    const { error: updateError } = await supabase
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
    await recordAuditLog({
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
  } catch (err: any) {
    console.error("Job archive failed:", err);
    res.status(500).json({ message: "Failed to archive job" });
  }
});

// DELETE /api/jobs/:id
// Hard deletes a job (admin-only, strict eligibility checks)
jobsRouter.delete("/:id", authenticate as unknown as express.RequestHandler, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id: userId, organization_id, role } = authReq.user;
    const jobId = authReq.params.id;

    // Only owners can delete jobs
    if (role !== "owner") {
      return res.status(403).json({ message: "Only organization owners can delete jobs" });
    }

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
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
    const { data: auditLogs, error: auditError } = await supabase
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
    const { data: documents, error: docError } = await supabase
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
    const { data: riskScore, error: riskError } = await supabase
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
    const { data: reports, error: reportError } = await supabase
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
    const { error: deleteError } = await supabase
      .from("jobs")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (deleteError) {
      throw deleteError;
    }

    // Log deletion event
    await recordAuditLog({
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
  } catch (err: any) {
    console.error("Job deletion failed:", err);
    res.status(500).json({ message: "Failed to delete job" });
  }
});

