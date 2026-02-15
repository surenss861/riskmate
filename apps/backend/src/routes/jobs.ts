import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { recordAuditLog, extractClientMetadata } from "../middleware/audit";
import { calculateRiskScore, generateMitigationItems } from "../utils/riskScoring";
import { notifyHighRiskJob } from "../services/notifications";
import { buildJobReport } from "../utils/jobReport";
import { enforceJobLimit, requireFeature } from "../middleware/limits";
import { RequestWithId } from "../middleware/requestId";
import { createErrorResponse, logErrorForSupport } from "../utils/errorResponse";
import { requireWriteAccess } from "../middleware/requireWriteAccess";
import { emitJobEvent, emitEvidenceEvent } from "../utils/realtimeEvents";

export const jobsRouter: ExpressRouter = express.Router();

// Log that jobs routes are being loaded (verification for deployment)
console.log("[ROUTES] ✅ Jobs routes loaded (including /:id/hazards, /:id/controls, /:id/permit-packs)");

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
jobsRouter.get("/", authenticate, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id } = authReq.user;
    const { 
      page = 1, 
      limit: limitParamFromQuery, 
      page_size,
      status, 
      risk_level, 
      include_archived, 
      sort,
      q, // Search query
      time_range,
      missing_evidence,
    } = authReq.query;
    const includeArchived = include_archived === 'true' || include_archived === '1';
    
    // Parse time_range to date cutoff
    let dateCutoff: Date | null = null;
    if (time_range && typeof time_range === 'string' && time_range !== 'all') {
      const match = time_range.match(/(\d+)d/);
      if (match) {
        const days = parseInt(match[1], 10);
        if (!isNaN(days)) {
          dateCutoff = new Date();
          dateCutoff.setDate(dateCutoff.getDate() - days);
          dateCutoff.setHours(0, 0, 0, 0);
        }
      }
    }
    
    // Parse sort parameter (e.g., "risk_desc", "created_desc", "status_asc", "blockers_desc", "readiness_asc")
    let sortField = 'created_at';
    let sortDirection: 'asc' | 'desc' = 'desc';
    let useStatusOrdering = false;
    let useReadinessOrdering = false; // Will sort in-memory after fetching readiness data
    let useBlockersOrdering = false; // Will sort in-memory after fetching blockers data
    let sortMode: string = 'created_desc';
    
    if (sort) {
      const sortStr = String(sort);
      if (sortStr.includes('_')) {
        const [field, dir] = sortStr.split('_');
        sortMode = `${field}_${dir}`;
        if (field === 'status') {
          useStatusOrdering = true;
          sortDirection = dir === 'asc' ? 'asc' : 'desc';
        } else if (field === 'blockers') {
          useBlockersOrdering = true;
          sortDirection = dir === 'asc' ? 'asc' : 'desc';
          // Pre-sort by created_at for consistency, then sort by blockers in memory
          sortField = 'created_at';
        } else if (field === 'readiness') {
          useReadinessOrdering = true;
          sortDirection = dir === 'asc' ? 'asc' : 'desc';
          // Pre-sort by created_at for consistency, then sort by readiness in memory
          sortField = 'created_at';
        } else if (field === 'newest') {
          sortField = 'created_at';
          sortDirection = 'desc';
        } else if (field === 'oldest') {
          sortField = 'created_at';
          sortDirection = 'asc';
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
    const { cursor, limit: limitParamFromCursor } = authReq.query;
    
    // Validate and parse pagination parameters
    let pageNum: number;
    let limitNum: number;
    
    try {
      pageNum = parseInt(String(page), 10);
      if (isNaN(pageNum) || pageNum < 1) {
        pageNum = 1;
      }
    } catch {
      pageNum = 1;
    }
    
    // Support both page_size and limit (page_size takes precedence for offset pagination)
    const pageSizeParam = page_size ? parseInt(String(page_size), 10) : null;
    const limitParam = limitParamFromCursor ? parseInt(String(limitParamFromCursor), 10) : (limitParamFromQuery ? parseInt(String(limitParamFromQuery), 10) : null);
    
    try {
      limitNum = pageSizeParam && !isNaN(pageSizeParam) && pageSizeParam > 0 
        ? pageSizeParam 
        : (limitParam && !isNaN(limitParam) && limitParam > 0 
          ? limitParam 
          : 20);
      
      // Enforce maximum limit to prevent abuse
      if (limitNum > 1000) {
        limitNum = 1000;
      }
    } catch {
      limitNum = 20;
    }
    
    // Cursor pagination is only safe for sorts that match SQL ordering
    // status_asc uses in-memory sorting, so cursor pagination would be inconsistent
    const supportsCursorPagination = !useStatusOrdering;
    
    // Hardening: Explicitly reject cursor param when sort=status_* (prevents misuse)
    if (cursor && useStatusOrdering) {
      // Log misuse once per organization per hour (helps identify client misconfigurations)
      const lastLogged = logCursorMisuse(organization_id, sortMode);
      const retryAfterSeconds = lastLogged ? Math.ceil((CURSOR_MISUSE_LOG_TTL_MS - (Date.now() - lastLogged)) / 1000) : 0;
      
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Cursor pagination is not supported for status sorting. Use offset pagination (page parameter) instead.",
        internalMessage: `Cursor pagination attempted with sort=${sortMode} (in-memory sort incompatible with cursor)`,
        code: "PAGINATION_CURSOR_NOT_SUPPORTED",
        requestId,
        statusCode: 400,
        sort: sortMode,
        reason: "Status sorting uses in-memory ordering which is incompatible with cursor pagination",
        documentation_url: "/docs/pagination#status-sorting",
        allowed_pagination_modes: ["offset"],
        ...(retryAfterSeconds > 0 && { retry_after_seconds: retryAfterSeconds }),
      });
      
      // Set error ID in response header (some clients log headers more reliably)
      res.setHeader('X-Error-ID', errorId);
      
      logErrorForSupport(400, "PAGINATION_CURSOR_NOT_SUPPORTED", requestId, organization_id, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/jobs');
      
      return res.status(400).json(errorResponse);
    }
    
    const useCursor = cursor && supportsCursorPagination;
    
    // Deterministic status order: draft → in_progress → completed → archived
    const statusOrder = ['draft', 'in_progress', 'completed', 'archived', 'cancelled', 'on_hold'];
    const getStatusOrder = (status: string) => {
      const index = statusOrder.indexOf(status);
      return index >= 0 ? index : statusOrder.length; // Unknown statuses go last
    };

    // Type for job rows - optional fields may not exist if migration hasn't run
    type JobRow = {
      id: string;
      client_name: string | null;
      job_type: string | null;
      location: string | null;
      status: string;
      risk_score: number | null;
      risk_level: string | null;
      created_at: string;
      updated_at: string;
      // These may not exist pre-migration, so they MUST be optional
      review_flag?: any;
      flagged_at?: string | null;
      applied_template_id?: string | null;
      applied_template_type?: string | null;
    };
    
    // Base columns (always present)
    const baseColumns = "id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at, review_flag, flagged_at";
    // Optional columns (may not exist if migration hasn't run)
    const optionalColumns = "applied_template_id, applied_template_type";
    
    let query = supabase
      .from("jobs")
      .select(`${baseColumns}, ${optionalColumns}`)
      .eq("organization_id", organization_id)
      .is("deleted_at", null); // Always exclude deleted
    
    // Apply time_range filter
    if (dateCutoff) {
      query = query.gte("created_at", dateCutoff.toISOString());
    }
    
    // Apply search filter (q parameter - search job name, address, or ID)
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      // Validate searchTerm to prevent injection (alphanumeric, spaces, hyphens, underscores only)
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(searchTerm)) {
        return res.status(400).json({ message: 'Invalid search term format' });
      }
      // Escape special characters for LIKE query
      const escapedTerm = searchTerm.replace(/[%_]/g, '\\$&');
      // Search in client_name, location, or id (case-insensitive partial match)
      query = query.or(`client_name.ilike.%${escapedTerm}%,location.ilike.%${escapedTerm}%,id.eq.${escapedTerm}`);
    }
    
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

    // Explicitly type jobs to handle both full and fallback queries
    let jobs: JobRow[] | null = null;
    let error: any = null;
    
    {
      const result = await query;
      jobs = result.data as JobRow[] | null;
      error = result.error;
    }
    
    // If error is due to missing columns (migration not applied), retry with minimal columns
    if (error && (
      error.message?.includes('archived_at') || 
      error.message?.includes('deleted_at') || 
      error.message?.includes('applied_template_id') ||
      error.message?.includes('applied_template_type') ||
      error.message?.includes('review_flag') ||
      error.message?.includes('flagged_at') ||
      (error as any).code === 'PGRST116'
    )) {
      console.warn('[JOBS] Some columns not found - retrying with minimal columns (migration may not be applied yet):', error.message);
      // Fallback: only select columns that definitely exist (core columns only)
      let fallbackQuery = supabase
        .from("jobs")
        .select("id, client_name, job_type, location, status, risk_score, risk_level, created_at, updated_at")
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
      jobs = fallbackResult.data as JobRow[] | null;
      error = fallbackResult.error;
    }

    if (error) throw error;
    
    // Fetch readiness and blockers data for jobs (if needed for sorting or response)
    const jobIds = (jobs || []).map((job: any) => job.id);
    let readinessData: Record<string, { 
      readiness_score: number | null; 
      readiness_basis: string;
      readiness_empty_reason: string | null;
      mitigations_total: number;
      mitigations_complete: number;
      blockers_count: number; 
      missing_evidence: boolean; 
      pending_attestations: number;
      evidence_count: number;
      evidence_required: number;
      controls_completed: number;
      controls_total: number;
    }> = {};
    
    if (jobIds.length > 0 && (useReadinessOrdering || useBlockersOrdering || !useCursor)) {
      // Calculate readiness metrics for each job
      // For now, we'll use mitigation items as a proxy for readiness/blockers
      // In a full implementation, this would query readiness_items table
      const { data: mitigationItems } = await supabase
        .from('mitigation_items')
        .select('job_id, done, is_completed')
        .in('job_id', jobIds);
      
      const { data: documents } = await supabase
        .from('documents')
        .select('job_id')
        .in('job_id', jobIds);

      // evidence_count = uploaded + processed documents only (excludes pending uploads).
      // When we add upload queue UI, pending can be shown separately so meta row stays authoritative.
      const evidenceCountByJob: Record<string, number> = {};
      const documentsByJob: Record<string, boolean> = {};
      documents?.forEach((doc: any) => {
        documentsByJob[doc.job_id] = true;
        evidenceCountByJob[doc.job_id] = (evidenceCountByJob[doc.job_id] || 0) + 1;
      });

      // Default evidence required; can be made per-job-type or org policy later. Fail-safe parse: missing/invalid/empty => 5; allow 1+ only (use >= 0 if you ever want global "no evidence required").
      const parsed = Number.parseInt(process.env.EVIDENCE_REQUIRED_DEFAULT ?? '', 10);
      const EVIDENCE_REQUIRED_DEFAULT = Number.isFinite(parsed) && parsed >= 1 ? parsed : 5;

      // Group by job_id. Controls completed = done || is_completed (N/A can count as complete when we add that flag).
      const mitigationsByJob: Record<string, { total: number; completed: number }> = {};
      mitigationItems?.forEach((item: any) => {
        if (!mitigationsByJob[item.job_id]) {
          mitigationsByJob[item.job_id] = { total: 0, completed: 0 };
        }
        mitigationsByJob[item.job_id].total++;
        if (item.done || item.is_completed) {
          mitigationsByJob[item.job_id].completed++;
        }
      });

      // Calculate readiness_score (0-100) and blockers_count per job
      jobIds.forEach((jobId: string) => {
        const mitigation = mitigationsByJob[jobId] || { total: 0, completed: 0 };
        const hasEvidence = documentsByJob[jobId] || false;
        const evidenceCount = evidenceCountByJob[jobId] || 0;
        
        // Explicit readiness calculation with audit-defensible fields
        const mitigations_total = mitigation.total;
        const mitigations_complete = mitigation.completed;
        
        // readiness_score: null if no mitigations (undefined/not calculated), otherwise 0-100
        let readiness_score: number | null = null;
        let readiness_basis: string = 'not_calculated';
        let readiness_empty_reason: string | null = null;
        
        if (mitigations_total === 0) {
          readiness_empty_reason = 'no_mitigations';
          readiness_basis = 'mitigation_completion_rate_v1';
        } else {
          readiness_score = Math.round((mitigations_complete / mitigations_total) * 100);
          readiness_basis = 'mitigation_completion_rate_v1';
        }
        
        const blockers_count = mitigations_total - mitigations_complete;
        const missing_evidence = !hasEvidence;
        
        // Pending attestations: would need to query attestations table
        // For now, use 0 as placeholder
        const pending_attestations = 0;
        
        readinessData[jobId] = {
          readiness_score,
          readiness_basis,
          readiness_empty_reason,
          mitigations_total,
          mitigations_complete,
          blockers_count,
          missing_evidence,
          pending_attestations,
          evidence_count: evidenceCount,
          evidence_required: EVIDENCE_REQUIRED_DEFAULT,
          controls_completed: mitigations_complete,
          controls_total: mitigations_total,
        };
      });
    }
    
    // Apply missing_evidence filter if specified
    if (missing_evidence === 'true' && jobs) {
      jobs = jobs.filter((job: any) => {
        const data = readinessData[job.id];
        return data?.missing_evidence === true;
      });
    }
    
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
    
    // Apply blockers_desc/blockers_asc ordering (in-memory sort)
    if (useBlockersOrdering && jobs) {
      jobs = [...jobs].sort((a, b) => {
        const aBlockers = readinessData[a.id]?.blockers_count || 0;
        const bBlockers = readinessData[b.id]?.blockers_count || 0;
        if (aBlockers !== bBlockers) {
          return sortDirection === 'asc' ? aBlockers - bBlockers : bBlockers - aBlockers;
        }
        // Tiebreaker: created_at
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime; // Newest first for tiebreaker
      });
    }
    
    // Apply readiness_asc/readiness_desc ordering (in-memory sort)
    // null scores go last (treated as -1 for sorting)
    if (useReadinessOrdering && jobs) {
      jobs = [...jobs].sort((a, b) => {
        const aScore = readinessData[a.id]?.readiness_score ?? -1;
        const bScore = readinessData[b.id]?.readiness_score ?? -1;
        if (aScore !== bScore) {
          return sortDirection === 'asc' ? aScore - bScore : bScore - aScore;
        }
        // Tiebreaker: created_at
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime; // Newest first for tiebreaker
      });
    }
    
    // Enrich jobs with readiness metrics and ensure template fields are never undefined
    if (jobs) {
      jobs = jobs.map((job: any) => {
        const readiness = readinessData[job.id] || {
          readiness_score: 0,
          blockers_count: 0,
          missing_evidence: false,
          pending_attestations: 0,
          evidence_count: 0,
          evidence_required: 5,
          controls_completed: 0,
          controls_total: 0,
        };
        return {
          ...job,
          // Optional fields properly typed (may not exist if migration hasn't run)
          applied_template_id: job.applied_template_id ?? null,
          applied_template_type: job.applied_template_type ?? null,
          review_flag: job.review_flag ?? null,
          flagged_at: job.flagged_at ?? null,
          readiness_score: readiness.readiness_score,
          readiness_basis: readiness.readiness_basis,
          readiness_empty_reason: readiness.readiness_empty_reason,
          mitigations_total: readiness.mitigations_total,
          mitigations_complete: readiness.mitigations_complete,
          blockers_count: readiness.blockers_count,
          missing_evidence: readiness.missing_evidence,
          pending_attestations: readiness.pending_attestations,
          // iOS Operations meta row: "Evidence 0/5 • Controls 3/5"
          evidence_count: readiness.evidence_count,
          evidence_required: readiness.evidence_required,
          controls_completed: readiness.controls_completed,
          controls_total: readiness.controls_total,
        };
      });
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

    // Get total count for pagination (apply same filters as main query)
    let countQuery = supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .is("deleted_at", null); // Always exclude deleted
    
    // Apply same filters as main query
    if (dateCutoff) {
      countQuery = countQuery.gte("created_at", dateCutoff.toISOString());
    }
    
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      countQuery = countQuery.or(`client_name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,id.eq.${searchTerm}`);
    }
    
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
    
    // Note: missing_evidence filter is applied in-memory, so count needs to match
    // For now, we'll count before the missing_evidence filter (approximation)
    // In production, you'd want to do a separate count query that matches the filtered results

    let { count, error: countError } = await countQuery;
    
    // Adjust total count if missing_evidence filter was applied
    let adjustedTotal = count || 0;
    if (missing_evidence === 'true') {
      // Re-count after missing_evidence filter (in-memory filter)
      adjustedTotal = jobs?.length || 0;
    }
    
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
      
      // Re-adjust total if missing_evidence filter was applied
      adjustedTotal = count || 0;
      if (missing_evidence === 'true') {
        adjustedTotal = jobs?.length || 0;
      }
    }

    if (countError) throw countError;

    res.json({
      data: jobs || [],
      pagination: {
        page: cursor ? undefined : pageNum,
        page_size: limitNum,
        limit: limitNum, // Keep for backward compatibility
        total: adjustedTotal,
        total_pages: cursor ? undefined : Math.ceil(adjustedTotal / limitNum),
        totalPages: cursor ? undefined : Math.ceil(adjustedTotal / limitNum), // Keep for backward compatibility
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
    const requestId = authReq.requestId || 'unknown';
    const organizationId = authReq.user?.organization_id;
    
    console.error("[JOBS] Fetch failed:", {
      requestId,
      organizationId,
      error: err.message || String(err),
      stack: err.stack,
      query: authReq.query,
    });
    
    // Use structured error response
    const { response: errorResponse, errorId } = createErrorResponse({
      message: err.message || "Failed to fetch jobs",
      internalMessage: err.stack || String(err),
      code: "JOBS_FETCH_ERROR",
      requestId,
      statusCode: 500,
    });
    
    res.setHeader('X-Error-ID', errorId);
    logErrorForSupport(500, "JOBS_FETCH_ERROR", requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/jobs');
    
    res.status(500).json(errorResponse);
  }
});

// GET /api/jobs/:id/hazards
// Returns all hazards (mitigation items) for a job
// NOTE: Must be before /:id route to match correctly
jobsRouter.get("/:id/hazards", authenticate, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id } = authReq.user;
    const jobId = req.params.id;

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

    // Fetch mitigation items (hazards/controls) for this job
    const { data: mitigationItems, error: mitigationError } = await supabase
      .from("mitigation_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    if (mitigationError) {
      throw mitigationError;
    }

    // Transform mitigation_items to Hazard-like structure
    const hazards = (mitigationItems || []).map((item: any) => {
      // Try to extract a code from the title (first word before space or colon)
      let code = "UNKNOWN";
      if (item.title) {
        const match = item.title.match(/^([A-Z0-9_]+)/);
        if (match) {
          code = match[1];
        } else {
          code = item.title.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
        }
      }
      
      return {
        id: item.id,
        code: item.factor_id || item.code || code,
        name: item.title || item.name || "Unknown Hazard",
        description: item.description || "",
        severity: item.severity || "medium",
        status: item.done || item.is_completed ? "resolved" : "open",
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || item.completed_at || item.created_at || new Date().toISOString(),
      };
    });

    res.json({ data: hazards });
  } catch (err: any) {
    console.error("[Jobs] Hazards fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch hazards" });
  }
});

// POST /api/jobs/:id/hazards
// Create a new hazard (mitigation item) for a job
jobsRouter.post("/:id/hazards", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id, id: userId } = authReq.user;
    const jobId = req.params.id;
    const { title, name, description } = req.body || {};

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found or does not belong to your organization" });
    }

    const displayTitle = title || name || "Untitled";
    const { data: riskFactors } = await supabase
      .from("risk_factors")
      .select("id")
      .eq("is_active", true)
      .limit(1);
    const riskFactorId = riskFactors?.[0]?.id ?? null;

    const insertPayload: Record<string, any> = {
      job_id: jobId,
      title: displayTitle,
      description: description ?? "",
      done: false,
      is_completed: false,
      organization_id: organization_id,
    };
    if (riskFactorId) insertPayload.risk_factor_id = riskFactorId;

    const { data: inserted, error: insertErr } = await supabase
      .from("mitigation_items")
      .insert(insertPayload)
      .select("id, title, description, severity, status, created_at, updated_at")
      .single();

    if (insertErr) {
      console.error("[Jobs] Hazard create failed:", insertErr);
      return res.status(500).json({ message: insertErr.message });
    }

    const clientMetadata = extractClientMetadata(req);
    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "hazard.created",
      targetType: "hazard",
      targetId: inserted.id,
      metadata: { job_id: jobId, sync_direct: true },
      ...clientMetadata,
    });

    res.status(201).json({
      data: {
        id: inserted.id,
        code: (String(inserted?.id ?? "")).substring(0, 8).toUpperCase(),
        name: inserted.title,
        description: inserted.description ?? "",
        severity: "medium",
        status: "open",
        created_at: inserted.created_at,
        updated_at: inserted.updated_at ?? inserted.created_at,
      },
    });
  } catch (err: any) {
    console.error("[Jobs] Hazard create failed:", err);
    res.status(500).json({ message: "Failed to create hazard" });
  }
});

// GET /api/jobs/:id/controls
// Returns all controls (mitigation items) for a job
// NOTE: Must be before /:id route to match correctly
jobsRouter.get("/:id/controls", authenticate, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id } = authReq.user;
    const jobId = req.params.id;

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

    // Fetch mitigation items (controls) for this job
    const { data: mitigationItems, error: mitigationError } = await supabase
      .from("mitigation_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    if (mitigationError) {
      throw mitigationError;
    }

    // Transform mitigation_items to Control-like structure
    const controls = (mitigationItems || []).map((item: any) => ({
      id: item.id,
      title: item.title || "Unknown Control",
      description: item.description || "",
      status: item.done || item.is_completed ? "Completed" : (item.blocked ? "Blocked" : "Pending"),
      done: item.done || item.is_completed || false,
      isCompleted: item.is_completed || item.done || false,
      hazardId: item.hazard_id ?? null,
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || item.completed_at || item.created_at || new Date().toISOString(),
    }));

    res.json({ data: controls });
  } catch (err: any) {
    console.error("[Jobs] Controls fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch controls" });
  }
});

// POST /api/jobs/:id/controls
// Create a new control (mitigation item) for a job, linked to a hazard
jobsRouter.post("/:id/controls", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id, id: userId } = authReq.user;
    const jobId = req.params.id;
    const { title, name, description, hazard_id: hazardId } = req.body || {};

    if (!hazardId) {
      return res.status(400).json({ message: "hazard_id is required for control creation" });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found or does not belong to your organization" });
    }

    const { data: hazard } = await supabase
      .from("mitigation_items")
      .select("id")
      .eq("id", hazardId)
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (!hazard) {
      return res.status(404).json({ message: "Hazard not found or does not belong to this job and organization" });
    }

    const displayTitle = title || name || "Untitled";
    const { data: riskFactors } = await supabase
      .from("risk_factors")
      .select("id")
      .eq("is_active", true)
      .limit(1);
    const riskFactorId = riskFactors?.[0]?.id ?? null;

    const insertPayload: Record<string, any> = {
      job_id: jobId,
      hazard_id: hazardId,
      title: displayTitle,
      description: description ?? "",
      done: false,
      is_completed: false,
      organization_id: organization_id,
    };
    if (riskFactorId) insertPayload.risk_factor_id = riskFactorId;

    const { data: inserted, error: insertErr } = await supabase
      .from("mitigation_items")
      .insert(insertPayload)
      .select("id, title, description, done, is_completed, hazard_id, created_at, updated_at")
      .single();

    if (insertErr) {
      console.error("[Jobs] Control create failed:", insertErr);
      return res.status(500).json({ message: insertErr.message });
    }

    const clientMetadata = extractClientMetadata(req);
    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "control.created",
      targetType: "control",
      targetId: inserted.id,
      metadata: { job_id: jobId, hazard_id: hazardId, sync_direct: true },
      ...clientMetadata,
    });

    res.status(201).json({
      data: {
        id: inserted.id,
        title: inserted.title,
        description: inserted.description ?? "",
        status: "Pending",
        done: false,
        isCompleted: false,
        hazard_id: inserted.hazard_id ?? hazardId,
        hazardId: inserted.hazard_id ?? hazardId,
        created_at: inserted.created_at,
        updated_at: inserted.updated_at ?? inserted.created_at,
      },
    });
  } catch (err: any) {
    console.error("[Jobs] Control create failed:", err);
    res.status(500).json({ message: "Failed to create control" });
  }
});

// POST /api/jobs/:id/permit-pack
// Alias for web client compatibility: redirects to /api/reports/permit-pack/:jobId
jobsRouter.post("/:id/permit-pack", authenticate as unknown as express.RequestHandler, requireFeature("permit_pack") as unknown as express.RequestHandler, (req: express.Request, res: express.Response) => {
  const base = `${req.protocol}://${req.get("host")}`;
  res.redirect(308, `${base}/api/reports/permit-pack/${req.params.id}`);
});

// GET /api/jobs/:id/permit-packs
// Returns list of generated permit packs / proof packs for this job (web parity: no 404)
jobsRouter.get("/:id/permit-packs", authenticate, async (req: express.Request, res: express.Response) => {
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

    // Proof packs are tracked in exports (work_record_id = job id, export_type = proof_pack, state = ready)
    const { data: exports, error: exportsError } = await supabase
      .from("exports")
      .select("id, storage_path, completed_at, created_by")
      .eq("work_record_id", jobId)
      .eq("organization_id", organization_id)
      .eq("export_type", "proof_pack")
      .eq("state", "ready")
      .not("storage_path", "is", null)
      .order("completed_at", { ascending: false });

    if (exportsError) {
      console.error("[Jobs] Permit-packs fetch failed:", exportsError);
      return res.status(500).json({ message: "Failed to fetch permit packs" });
    }

    const packs = (exports || []).map((exp, idx) => ({
      id: exp.id,
      version: (exports?.length ?? 0) - idx,
      file_path: exp.storage_path ?? "",
      generated_at: exp.completed_at ?? "",
      generated_by: exp.created_by ?? null,
      downloadUrl: null as string | null,
    }));

    // Generate signed URLs for each pack (use Promise.allSettled for error resilience)
    const packsWithUrls = await Promise.allSettled(
      packs.map(async (pack) => {
        if (!pack.file_path) return { ...pack, downloadUrl: null };
        try {
          const { data: signed } = await supabase.storage
            .from("exports")
            .createSignedUrl(pack.file_path, 60 * 60);
          return { ...pack, downloadUrl: signed?.signedUrl ?? null };
        } catch (err) {
          console.error("[Jobs] Failed to generate signed URL for pack:", pack.id, err);
          return { ...pack, downloadUrl: null };
        }
      })
    ).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { id: '', version: 0, file_path: '', generated_at: '', generated_by: null, downloadUrl: null }));

    res.json({ data: packsWithUrls });
  } catch (err: any) {
    console.error("[Jobs] Permit-packs failed:", err);
    res.status(500).json({ message: "Failed to fetch permit packs" });
  }
});

// GET /api/jobs/:id
// Returns full job details with risk score and mitigation items
jobsRouter.get("/:id", authenticate, async (req: express.Request, res: express.Response) => {
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
jobsRouter.post("/", authenticate, requireWriteAccess, enforceJobLimit, async (req: express.Request, res: express.Response) => {
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

    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    await recordAuditLog({
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
      ...clientMetadata,
    });

    // Emit realtime event (push signal)
    await emitJobEvent(organization_id, "job.created", job.id, userId);

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
jobsRouter.patch("/:id", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
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
      .select("id, organization_id, risk_score, risk_level")
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

    // Check if risk score changed
    const oldRiskScore = existingJob.risk_score
    const newRiskScore = updatedJob.risk_score
    const riskScoreChanged = oldRiskScore !== newRiskScore

    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    // Log job update
    await recordAuditLog({
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
      ...clientMetadata,
    });

    // Emit realtime event (push signal)
    await emitJobEvent(organization_id, "job.updated", jobId, userId);

    // If risk score changed, log separate event
    if (riskScoreChanged) {
      await recordAuditLog({
        organizationId: organization_id,
        actorId: userId,
        eventName: "job.risk_score_changed",
        targetType: "job",
        targetId: jobId,
        ...clientMetadata,
        metadata: {
          old_risk_score: oldRiskScore,
          new_risk_score: newRiskScore,
          old_risk_level: existingJob.risk_level,
          new_risk_level: updatedJob.risk_level,
          risk_factor_codes: Array.isArray(risk_factor_codes) ? risk_factor_codes : undefined,
          trigger: "risk_factor_update",
        },
      });
    }

    invalidateJobReportCache(organization_id, jobId);

    res.json({ data: updatedJob });
  } catch (err: any) {
    console.error("Job update failed:", err);
    res.status(500).json({ message: "Failed to update job" });
  }
});

// PATCH /api/jobs/:id/mitigations/:mitigationId
jobsRouter.patch("/:id/mitigations/:mitigationId", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
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

    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    await recordAuditLog({
      organizationId: organization_id,
      actorId: authReq.user.id,
      eventName: done ? "mitigation.completed" : "mitigation.reopened",
      targetType: "mitigation",
      targetId: mitigationId,
      ...clientMetadata,
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

// LRU Cache with size limit for job reports
type CachedJobReport = {
  data: any;
  expiresAt: number;
};

const MAX_CACHE_SIZE = 1000; // Limit to 1000 entries
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
  // Implement simple LRU: if cache is full, delete oldest entry
  if (jobReportCache.size >= MAX_CACHE_SIZE) {
    const firstKey = jobReportCache.keys().next().value;
    if (firstKey) jobReportCache.delete(firstKey);
  }
  jobReportCache.set(key, { data, expiresAt: Date.now() + JOB_REPORT_TTL_MS });
};

const invalidateJobReportCache = (organizationId: string, jobId: string) => {
  jobReportCache.delete(`${organizationId}:${jobId}`);
};

jobsRouter.get("/:id/full", authenticate, async (req: express.Request, res: express.Response) => {
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
jobsRouter.get("/:id/documents", authenticate, async (req: express.Request, res: express.Response) => {
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

    // Fetch job_photos for category (before/during/after) to include on photo documents
    const { data: jobPhotos } = await supabase
      .from("job_photos")
      .select("file_path, category")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id);

    const categoryByPath = new Map(
      (jobPhotos || []).map((p) => [p.file_path, p.category as "before" | "during" | "after"])
    );

    // Image evidence from evidence bucket (iOS uploads): same shape as documents for galleries/re-categorization
    const IMAGE_MIME_PREFIX = "image/";
    const DOC_PHOTO_CATEGORIES = ["before", "during", "after"] as const;
    const { data: imageEvidence } = await supabase
      .from("evidence")
      .select("id, storage_path, file_name, mime_type, phase, created_at, uploaded_by")
      .eq("work_record_id", jobId)
      .eq("organization_id", organization_id)
      .eq("state", "sealed");

    const evidenceAsDocuments = await Promise.all(
      (imageEvidence || [])
        .filter((ev) => ev.mime_type?.toLowerCase().startsWith(IMAGE_MIME_PREFIX))
        .map(async (ev) => {
          const fromJobPhotos = categoryByPath.get(ev.storage_path ?? "");
          const fromPhase =
            ev.phase && DOC_PHOTO_CATEGORIES.includes(ev.phase as (typeof DOC_PHOTO_CATEGORIES)[number])
              ? (ev.phase as (typeof DOC_PHOTO_CATEGORIES)[number])
              : null;
          const category = fromJobPhotos ?? fromPhase ?? null;
          try {
            const { data: signed } = await supabase.storage
              .from("evidence")
              .createSignedUrl(ev.storage_path, 60 * 10);
            return {
              id: ev.id,
              name: ev.file_name ?? "Evidence",
              type: "photo" as const,
              size: null as number | null,
              storage_path: ev.storage_path,
              mime_type: ev.mime_type,
              description: null,
              created_at: ev.created_at,
              uploaded_by: ev.uploaded_by ?? null,
              ...(category ? { category } : {}),
              url: signed?.signedUrl ?? null,
            };
          } catch (err) {
            console.warn("Failed to generate evidence signed URL", err);
            return {
              id: ev.id,
              name: ev.file_name ?? "Evidence",
              type: "photo" as const,
              size: null as number | null,
              storage_path: ev.storage_path,
              mime_type: ev.mime_type,
              description: null,
              created_at: ev.created_at,
              uploaded_by: ev.uploaded_by ?? null,
              ...(category ? { category } : {}),
              url: null,
            };
          }
        })
    );

    // Use evidence bucket when file_path indicates evidence storage (e.g. readiness photo uploads)
    const documentsWithUrls = await Promise.all(
      (data || []).map(async (doc) => {
        const bucket = doc.file_path?.startsWith("evidence/") ? "evidence" : "documents";
        try {
          const { data: signed } = await supabase.storage
            .from(bucket)
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
            ...(doc.type === "photo" ? { category: categoryByPath.get(doc.file_path) ?? null } : {}),
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
            ...(doc.type === "photo" ? { category: categoryByPath.get(doc.file_path) ?? null } : {}),
            url: null,
          };
        }
      })
    );

    // Merge documents + evidence bucket images, sort by created_at
    const merged = [...documentsWithUrls, ...evidenceAsDocuments].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    res.json({ data: merged });
  } catch (err: any) {
    console.error("Docs fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// Valid photo categories
const PHOTO_CATEGORIES = ["before", "during", "after"] as const;
type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

// Same logic as frontend getDefaultPhotoCategory: draft→before, completed/archived→after, else during
function getDefaultPhotoCategory(jobStatus: string): PhotoCategory {
  if (jobStatus === "draft") return "before";
  if (jobStatus === "completed" || jobStatus === "archived") return "after";
  return "during";
}

// POST /api/jobs/:id/documents
// Persists document metadata after upload to storage
jobsRouter.post("/:id/documents", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const { organization_id, id: userId } = authReq.user;
    const { name, type = "photo", file_path, file_size, mime_type, description, category } = authReq.body || {};

    if (!name || !file_path || file_size === undefined || !mime_type) {
      return res.status(400).json({
        message: "Missing required metadata: name, file_path, file_size, mime_type",
      });
    }

    if (type === "photo" && category !== undefined && !PHOTO_CATEGORIES.includes(category as (typeof PHOTO_CATEGORIES)[number])) {
      return res.status(400).json({
        message: "Invalid category. Must be one of: before, during, after",
      });
    }

    const parsedFileSize = Number(file_size);
    if (!Number.isFinite(parsedFileSize) || parsedFileSize <= 0) {
      return res.status(400).json({ message: "file_size must be a positive number" });
    }

    // Verify job belongs to organization and fetch status for default photo category
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Photo category: use provided valid category, or derive default from job status (draft→before, completed/archived→after, else during)
    const hasValidCategory = type === "photo" && category && PHOTO_CATEGORIES.includes(category as (typeof PHOTO_CATEGORIES)[number]);
    const photoCategory: PhotoCategory | undefined =
      type === "photo"
        ? (hasValidCategory ? (category as PhotoCategory) : getDefaultPhotoCategory(job.status ?? ""))
        : undefined;

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

    // When type is photo, insert job_photos row with category
    if (type === "photo" && photoCategory) {
      const { error: photoError } = await supabase
        .from("job_photos")
        .insert({
          job_id: jobId,
          organization_id,
          file_path: inserted.file_path,
          description: description ?? null,
          category: photoCategory,
          created_by: userId,
        });

      if (photoError) {
        console.error("job_photos insert failed:", photoError);
        // Delete the document to avoid orphaned metadata without category
        await supabase.from("documents").delete().eq("id", inserted.id);
        return res.status(500).json({ message: "Failed to save photo category" });
      }
    }

    const storageBucket = inserted.file_path?.startsWith("evidence/") ? "evidence" : "documents";
    const { data: signed } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(inserted.file_path, 60 * 10);

    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "document.uploaded",
      targetType: "document",
      targetId: inserted.id,
      ...clientMetadata,
      metadata: {
        job_id: jobId,
        name,
        type,
        file_path,
        file_size: Math.round(parsedFileSize),
      },
    });

    // Emit realtime event (push signal)
    await emitEvidenceEvent(organization_id, "evidence.uploaded", inserted.id, jobId, userId);

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
        ...(type === "photo" && photoCategory ? { category: photoCategory } : {}),
        url: signed?.signedUrl || null,
      },
    });

  } catch (err: any) {
    console.error("Document metadata save failed:", err);
    res.status(500).json({ message: "Failed to save document metadata" });
  }
});

// PATCH /api/jobs/:id/documents/:docId
// Update photo category (before|during|after). Only applies to photos; category is stored in job_photos.
jobsRouter.patch("/:id/documents/:docId", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const jobId = authReq.params.id;
    const docId = authReq.params.docId;
    const { organization_id, id: userId } = authReq.user;
    const { category } = authReq.body || {};

    if (category === undefined) {
      return res.status(400).json({ message: "Missing category in body" });
    }
    if (!PHOTO_CATEGORIES.includes(category as (typeof PHOTO_CATEGORIES)[number])) {
      return res.status(400).json({
        message: "Invalid category. Must be one of: before, during, after",
      });
    }

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

    // Load document and ensure it is a photo
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, file_path, type, name, description, created_at")
      .eq("id", docId)
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (docError) throw docError;

    const categoryValue = category as (typeof PHOTO_CATEGORIES)[number];
    const IMAGE_MIME_PREFIX = "image/";

    // Path 1: document found in documents table — existing behavior unchanged
    if (doc) {
      if (doc.type !== "photo") {
        return res.status(400).json({
          message: "Category can only be updated for photos",
        });
      }

      // Update or insert job_photos row (by job_id, organization_id, file_path)
      const { data: existing } = await supabase
        .from("job_photos")
        .select("id")
        .eq("job_id", jobId)
        .eq("organization_id", organization_id)
        .eq("file_path", doc.file_path)
        .maybeSingle();

      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from("job_photos")
          .update({ category: categoryValue })
          .eq("id", existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        invalidateJobReportCache(organization_id, jobId);
        return res.json({
          ok: true,
          data: {
            id: doc.id,
            file_path: doc.file_path,
            type: doc.type,
            name: doc.name,
            description: doc.description,
            created_at: doc.created_at,
            category: updated?.category ?? categoryValue,
          },
        });
      }

      // No job_photos row: insert one (e.g. legacy photo)
      const { data: inserted, error: insertError } = await supabase
        .from("job_photos")
        .insert({
          job_id: jobId,
          organization_id,
          file_path: doc.file_path,
          category: categoryValue,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      invalidateJobReportCache(organization_id, jobId);
      return res.json({
        ok: true,
        data: {
          id: doc.id,
          file_path: doc.file_path,
          type: doc.type,
          name: doc.name,
          description: doc.description,
          created_at: doc.created_at,
          category: inserted?.category ?? categoryValue,
        },
      });
    }

    // Path 2: no documents row — try evidence table (iOS/evidence photos)
    const { data: ev, error: evError } = await supabase
      .from("evidence")
      .select("id, storage_path, file_name, mime_type, evidence_type, created_at")
      .eq("id", docId)
      .eq("work_record_id", jobId)
      .eq("organization_id", organization_id)
      .eq("state", "sealed")
      .maybeSingle();

    if (evError) throw evError;
    if (!ev) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (!ev.mime_type?.toLowerCase().startsWith(IMAGE_MIME_PREFIX)) {
      return res.status(400).json({
        message: "Category can only be updated for photos",
      });
    }

    const storagePath = ev.storage_path ?? "";
    const { data: existingPhoto } = await supabase
      .from("job_photos")
      .select("id")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .eq("file_path", storagePath)
      .maybeSingle();

    if (existingPhoto) {
      const { data: updated, error: updateError } = await supabase
        .from("job_photos")
        .update({ category: categoryValue })
        .eq("id", existingPhoto.id)
        .select()
        .single();

      if (updateError) throw updateError;
      invalidateJobReportCache(organization_id, jobId);
      return res.json({
        ok: true,
        data: {
          id: ev.id,
          file_path: storagePath,
          type: "photo" as const,
          name: ev.file_name ?? "Evidence",
          description: ev.evidence_type ?? null,
          created_at: ev.created_at,
          category: updated?.category ?? categoryValue,
        },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("job_photos")
      .insert({
        job_id: jobId,
        organization_id,
        file_path: storagePath,
        category: categoryValue,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    invalidateJobReportCache(organization_id, jobId);
    return res.json({
      ok: true,
      data: {
        id: ev.id,
        file_path: storagePath,
        type: "photo" as const,
        name: ev.file_name ?? "Evidence",
        description: ev.evidence_type ?? null,
        created_at: ev.created_at,
        category: inserted?.category ?? categoryValue,
      },
    });
  } catch (err: any) {
    console.error("Document category update failed:", err);
    res.status(500).json({ message: "Failed to update photo category" });
  }
});

// GET /api/jobs/:id/audit
// Returns recent audit entries for a specific job
jobsRouter.get("/:id/audit", authenticate, async (req: express.Request, res: express.Response) => {
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
jobsRouter.post("/:id/archive", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
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
    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "job.archived",
      targetType: "job",
      targetId: jobId,
      ...clientMetadata,
      metadata: {
        previous_status: job.status,
      },
    });

    // Emit realtime event (push signal)
    await emitJobEvent(organization_id, "job.archived", jobId, userId);

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

// PATCH /api/jobs/:id/flag
// Flags a job for review (governance signal, not workflow)
// Note: Auditors cannot flag (governance signal requires write access)
jobsRouter.patch("/:id/flag", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id, id: userId, role } = authReq.user;
    const { id } = authReq.params;
    const { flagged } = authReq.body;

    // Role-based capability: Only Safety Lead, Admin, and Owner can flag/unflag jobs
    // Members and Executives cannot flag jobs
    if (role === 'member' || role === 'executive') {
      // Log capability violation for audit trail
      try {
        // Extract client metadata from request
        const clientMetadata = extractClientMetadata(req);
        
        await recordAuditLog({
          organizationId: organization_id,
          actorId: userId,
          eventName: "auth.role_violation",
          targetType: "job",
          targetId: id,
          ...clientMetadata,
          metadata: {
            role,
            attempted_action: "flag_job",
            result: "denied",
            reason: "Role does not have flag_job capability",
          },
        });
      } catch (auditError) {
        // Non-fatal: log but don't fail the request
        console.warn("Audit log failed for role violation:", auditError);
      }

      const { response: errorResponse, errorId } = createErrorResponse({
        message: "You do not have permission to flag jobs for review",
        internalMessage: `User ${userId} (role: ${role}) attempted to flag job ${id}`,
        code: "AUTH_ROLE_FORBIDDEN",
        requestId,
        statusCode: 403,
      });
      res.setHeader('X-Error-ID', errorId);
      logErrorForSupport(403, "AUTH_ROLE_FORBIDDEN", requestId, organization_id, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/jobs/:id/flag');
      return res.status(403).json(errorResponse);
    }

    // Verify job exists and belongs to organization
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, client_name, organization_id")
      .eq("id", id)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Job not found",
        internalMessage: `Job ${id} not found or access denied`,
        code: "JOB_NOT_FOUND",
        requestId,
        statusCode: 404,
      });
      res.setHeader('X-Error-ID', errorId);
      return res.status(404).json(errorResponse);
    }

    // Update review flag
    const updateData: any = {
      review_flag: flagged === true || flagged === 'true',
    };

    // Set flagged_at timestamp when flagging, clear when unflagging
    if (updateData.review_flag) {
      updateData.flagged_at = new Date().toISOString();
    } else {
      updateData.flagged_at = null;
    }

    const { data: updatedJob, error: updateError } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organization_id)
      .select("id, review_flag, flagged_at")
      .single();

    if (updateError) {
      console.error("Flag update failed:", updateError);
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Failed to update review flag",
        internalMessage: `Failed to update review flag for job ${id}: ${updateError.message}`,
        code: "JOB_FLAG_UPDATE_FAILED",
        requestId,
        statusCode: 500,
      });
      res.setHeader('X-Error-ID', errorId);
      logErrorForSupport(500, "JOB_FLAG_UPDATE_FAILED", requestId, organization_id, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/jobs/:id/flag');
      return res.status(500).json(errorResponse);
    }

    // Log audit event with comprehensive review context
    try {
      const { data: jobData } = await supabase
        .from("jobs")
        .select("client_name, risk_score, risk_level, status")
        .eq("id", id)
        .single()

      // Extract client metadata from request
      const clientMetadata = extractClientMetadata(req);
      
      await recordAuditLog({
        organizationId: organization_id,
        actorId: userId,
        eventName: updateData.review_flag ? "job.flagged_for_review" : "job.unflagged",
        targetType: "job",
        targetId: id,
        ...clientMetadata,
        metadata: {
          flagged: updateData.review_flag,
          flagged_at: updateData.flagged_at,
          job_name: jobData?.client_name,
          risk_score: jobData?.risk_score,
          risk_level: jobData?.risk_level,
          job_status: jobData?.status,
          flag_reason: req.body.flag_reason || "Manual flag",
          review_owner_role: req.body.review_owner_role || "safety_lead",
          review_due_at: req.body.review_due_at,
        },
      });
    } catch (auditError) {
      // Non-fatal: log but don't fail the request
      console.warn("Audit log failed for flag action:", auditError);
    }

    // Emit realtime event (push signal)
    await emitJobEvent(organization_id, "job.flagged", id, userId);

    res.json({
      id: updatedJob.id,
      review_flag: updatedJob.review_flag,
      flagged_at: updatedJob.flagged_at,
      request_id: requestId,
    });
  } catch (err: any) {
    console.error("Flag job failed:", err);
    const { response: errorResponse, errorId } = createErrorResponse({
      message: "Failed to flag job for review",
      internalMessage: `Unexpected error flagging job: ${err?.message || String(err)}`,
      code: "JOB_FLAG_ERROR",
      requestId: authReq.requestId || 'unknown',
      statusCode: 500,
    });
    res.setHeader('X-Error-ID', errorId);
    logErrorForSupport(500, "JOB_FLAG_ERROR", authReq.requestId || 'unknown', authReq.user?.organization_id, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/jobs/:id/flag');
    res.status(500).json(errorResponse);
  }
});

// DELETE /api/jobs/:id
// Hard deletes a job (admin-only, strict eligibility checks)
jobsRouter.delete("/:id", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { id: userId, organization_id, role } = authReq.user;
    const jobId = authReq.params.id;

    // Only owners can delete jobs (requireWriteAccess already blocks auditors/executives)
    if (role !== "owner") {
      const requestId = (authReq as RequestWithId).requestId || 'unknown';
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Only organization owners can delete jobs",
        internalMessage: `Delete attempt by user with role=${role}, required=owner`,
        code: "AUTH_ROLE_FORBIDDEN",
        requestId,
        statusCode: 403,
        required_role: "owner",
        current_role: role || "unknown",
      });
      
      // Set error ID in response header
      res.setHeader('X-Error-ID', errorId);
      
      logErrorForSupport(403, "AUTH_ROLE_FORBIDDEN", requestId, organization_id, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, '/api/jobs/:id');
      
      return res.status(403).json(errorResponse);
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

    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
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
      ...clientMetadata,
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

// POST /api/jobs/:id/proof-pack
// Generates a proof pack PDF (Insurance, Audit, Incident, or Compliance)
jobsRouter.post("/:id/proof-pack", authenticate, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id, id: userId } = authReq.user;
    const { id: jobId } = req.params;
    const { pack_type } = req.body;

    if (!pack_type || !['insurance', 'audit', 'incident', 'compliance'].includes(pack_type)) {
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Invalid pack type. Must be one of: insurance, audit, incident, compliance",
        internalMessage: `Invalid pack_type: ${pack_type}`,
        code: "VALIDATION_ERROR",
        requestId,
        statusCode: 400,
      });
      res.setHeader('X-Error-ID', errorId);
      return res.status(400).json(errorResponse);
    }

    // Build job report data
    let reportData;
    try {
      reportData = await buildJobReport(organization_id, jobId);
    } catch (err: any) {
      if (err?.message === "Job not found") {
        return res.status(404).json({ message: "Job not found" });
      }
      throw err;
    }

    if (!reportData?.job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Build photos array from reportData.documents: fetch photo docs, download storage objects, preserve description/created_at/category
    const photoDocuments = (reportData.documents ?? []).filter(
      (doc: any) => doc.type === "photo" && doc.file_path
    );
    const photos = (
      await Promise.all(
        photoDocuments.map(async (document: any) => {
          try {
            const bucket = document.source_bucket === "evidence" ? "evidence" : "documents";
            const { data: fileData } = await supabase.storage
              .from(bucket)
              .download(document.file_path);

            if (!fileData) {
              return null;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            return {
              name: document.name,
              description: document.description,
              created_at: document.created_at,
              buffer: Buffer.from(arrayBuffer),
              category: document.category ?? undefined,
            };
          } catch (error) {
            console.warn("Failed to include photo in proof-pack PDF", error);
            return null;
          }
        })
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    // For now, use the existing PDF generation
    // TODO: Create pack-specific PDF templates
    const { generateRiskSnapshotPDF } = await import("../utils/pdf");
    const pdfBuffer = await generateRiskSnapshotPDF(
      reportData.job,
      reportData.risk_score,
      reportData.mitigations || [],
      reportData.organization ?? { id: organization_id, name: reportData.job?.client_name ?? "Organization" },
      photos,
      reportData.audit || [],
      undefined // reportRunId - not used by this proof-pack route (no report_run created here)
    );

    const pdfBase64 = pdfBuffer.toString("base64");

    // Log audit event
    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: `proof_pack.${pack_type}_generated`,
      targetType: "proof_pack",
      targetId: jobId,
      ...clientMetadata,
      metadata: {
        pack_type,
        job_id: jobId,
      },
    });

    res.json({
      data: {
        id: null,
        pdf_url: "",
        pdf_base64: pdfBase64,
        hash: "",
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Proof pack generation failed:", err);
    const { response: errorResponse, errorId } = createErrorResponse({
      message: "Failed to generate proof pack PDF",
      internalMessage: err?.message || String(err),
      code: "PROOF_PACK_GENERATION_FAILED",
      requestId,
      statusCode: 500,
    });
    res.setHeader('X-Error-ID', errorId);
    res.status(500).json(errorResponse);
  }
});

// GET /api/jobs/:id/signoffs
// Returns all sign-offs for a job
jobsRouter.get("/:id/signoffs", authenticate, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id } = authReq.user;
    const { id: jobId } = req.params;

    const { data, error } = await supabase
      .from("job_signoffs")
      .select("*")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (err: any) {
    console.error("Sign-offs fetch failed:", err);
    const { response: errorResponse, errorId } = createErrorResponse({
      message: "Failed to fetch sign-offs",
      internalMessage: err?.message || String(err),
      code: "SIGNOFFS_FETCH_FAILED",
      requestId,
      statusCode: 500,
    });
    res.setHeader('X-Error-ID', errorId);
    res.status(500).json(errorResponse);
  }
});

// POST /api/jobs/:id/signoffs
// Creates a new sign-off for a job
// Note: Auditors cannot sign (read-only access)
jobsRouter.post("/:id/signoffs", authenticate, requireWriteAccess, async (req: express.Request, res: express.Response) => {
  const authReq = req as AuthenticatedRequest & RequestWithId;
  const requestId = authReq.requestId || 'unknown';
  try {
    const { organization_id, id: userId } = authReq.user;
    const { id: jobId } = req.params;
    const { signoff_type, comments } = req.body;

    if (!signoff_type || !['safety_approval', 'completion', 'compliance', 'owner_approval'].includes(signoff_type)) {
      const { response: errorResponse, errorId } = createErrorResponse({
        message: "Invalid sign-off type",
        internalMessage: `Invalid signoff_type: ${signoff_type}`,
        code: "VALIDATION_ERROR",
        requestId,
        statusCode: 400,
      });
      res.setHeader('X-Error-ID', errorId);
      return res.status(400).json(errorResponse);
    }

    // Get user info
    const { data: userData } = await supabase
      .from("users")
      .select("full_name, email, role")
      .eq("id", userId)
      .single();

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's role in organization
    const { data: memberData } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .single();

    const signerRole = memberData?.role || userData.role || 'member';

    const { data, error } = await supabase
      .from("job_signoffs")
      .insert({
        job_id: jobId,
        organization_id,
        signer_id: userId,
        signer_role: signerRole,
        signer_name: userData.full_name || userData.email || 'Unknown',
        signer_email: userData.email,
        signoff_type,
        status: 'signed',
        signed_at: new Date().toISOString(),
        comments,
        signature_data: {
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) throw error;

    // Extract client metadata from request
    const clientMetadata = extractClientMetadata(req);
    
    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "job.signoff_created",
      targetType: "signoff",
      targetId: data.id,
      ...clientMetadata,
      metadata: {
        job_id: jobId,
        signoff_type,
        signer_role: signerRole,
      },
    });

    res.json({ data });
  } catch (err: any) {
    console.error("Sign-off creation failed:", err);
    const { response: errorResponse, errorId } = createErrorResponse({
      message: "Failed to create sign-off",
      internalMessage: err?.message || String(err),
      code: "SIGNOFF_CREATION_FAILED",
      requestId,
      statusCode: 500,
    });
    res.setHeader('X-Error-ID', errorId);
    res.status(500).json(errorResponse);
  }
});

