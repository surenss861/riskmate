import express from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../middleware/limits";

export const analyticsRouter = express.Router();

type MitigationItem = {
  id: string;
  job_id: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
};

type JobRecord = {
  id: string;
  risk_score: number | null;
  created_at: string;
};

type DocumentRecord = {
  id: string;
  job_id: string;
  created_at: string;
};

const MAX_FETCH_LIMIT = 10000;

const parseRangeDays = (value?: string | string[]) => {
  if (!value) return 30;
  const str = Array.isArray(value) ? value[0] : value;
  const match = str.match(/(\d+)/);
  if (!match) return 30;
  const days = parseInt(match[1], 10);
  if (Number.isNaN(days) || days <= 0) return 30;
  return Math.min(days, 180);
};

const toDateKey = (value: string) => value.slice(0, 10);

analyticsRouter.get(
  "/mitigations",
  authenticate as unknown as express.RequestHandler,
  requireFeature("analytics") as unknown as express.RequestHandler,
  (async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const orgId =
        (authReq.query.org_id as string | undefined) || authReq.user.organization_id;
      if (!orgId) {
        return res.status(400).json({ message: "Missing organization id" });
      }

      const rangeDays = parseRangeDays(authReq.query.range as string | undefined);
      const crewId = authReq.query.crew_id
        ? String(authReq.query.crew_id)
        : undefined;

      const sinceDate = new Date();
      sinceDate.setHours(0, 0, 0, 0);
      sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
      const sinceIso = sinceDate.toISOString();

      const { data: jobs, error: jobsError } = await supabase
        .from<JobRecord>("jobs")
        .select("id, risk_score, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceIso)
        .limit(MAX_FETCH_LIMIT);

      if (jobsError) {
        throw jobsError;
      }

      const jobIds = (jobs || []).map((job) => job.id);

      const [mitigationsResponse, documentsResponse] = await Promise.all([
        jobIds.length
          ? supabase
              .from<MitigationItem>("mitigation_items")
              .select("id, job_id, created_at, completed_at, completed_by")
              .in("job_id", jobIds)
              .order("created_at", { ascending: true })
              .limit(MAX_FETCH_LIMIT)
          : Promise.resolve({ data: [] as MitigationItem[], error: null }),
        jobIds.length
          ? supabase
              .from<DocumentRecord>("documents")
              .select("id, job_id, created_at")
              .in("job_id", jobIds)
              .order("created_at", { ascending: true })
              .limit(MAX_FETCH_LIMIT)
          : Promise.resolve({ data: [] as DocumentRecord[], error: null }),
      ]);

      if (mitigationsResponse.error) {
        throw mitigationsResponse.error;
      }

      if (documentsResponse.error) {
        throw documentsResponse.error;
      }

      const mitigations = (mitigationsResponse.data || []).filter((item) => {
        if (!crewId) return true;
        return item.completed_by === crewId;
      });

      const documents = documentsResponse.data || [];

      const totalMitigations = mitigations.length;
      const completedMitigations = mitigations.filter(
        (item) => item.completed_at
      );

      const completionRate =
        totalMitigations === 0
          ? 0
          : completedMitigations.length / totalMitigations;

      const avgTimeToCloseHours =
        completedMitigations.length === 0
          ? 0
          : completedMitigations.reduce((acc, item) => {
              const createdAt = new Date(item.created_at).getTime();
              const completedAt = new Date(item.completed_at as string).getTime();
              const diffHours = (completedAt - createdAt) / (1000 * 60 * 60);
              return acc + Math.max(diffHours, 0);
            }, 0) / completedMitigations.length;

      const highRiskJobs = (jobs || []).filter((job) => {
        if (job.risk_score === null || job.risk_score === undefined) {
          return false;
        }
        return job.risk_score > 75;
      }).length;

      const evidenceCount = documents.length;

      const jobEvidenceMap = documents.reduce<Record<string, string>>((acc, doc) => {
        if (!acc[doc.job_id] || new Date(doc.created_at) < new Date(acc[doc.job_id])) {
          acc[doc.job_id] = doc.created_at;
        }
        return acc;
      }, {});

      const jobsWithEvidence = Object.keys(jobEvidenceMap).length;
      const jobsWithoutEvidence = Math.max(jobIds.length - jobsWithEvidence, 0);

      const avgTimeToFirstEvidenceHours =
        jobsWithEvidence === 0
          ? 0
          : Object.entries(jobEvidenceMap).reduce((acc, [jobId, firstEvidence]) => {
              const job = jobs?.find((item) => item.id === jobId);
              if (!job) return acc;
              const jobCreated = new Date(job.created_at).getTime();
              const evidenceCreated = new Date(firstEvidence).getTime();
              const diffHours = (evidenceCreated - jobCreated) / (1000 * 60 * 60);
              return acc + Math.max(diffHours, 0);
            }, 0) / jobsWithEvidence;

      // Trend (daily)
      const trend: { date: string; completion_rate: number }[] = [];
      const dateCursor = new Date(sinceDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      while (dateCursor <= today) {
        const dateKey = dateCursor.toISOString().slice(0, 10);
        const itemsForDay = mitigations.filter(
          (item) => toDateKey(item.created_at) === dateKey
        );
        const dayCompleted = itemsForDay.filter((item) => {
          if (!item.completed_at) return false;
          return toDateKey(item.completed_at) === dateKey;
        });

        const dayRate =
          itemsForDay.length === 0
            ? 0
            : dayCompleted.length / itemsForDay.length;

        trend.push({
          date: dateKey,
          completion_rate: Number(dayRate.toFixed(3)),
        });

        dateCursor.setDate(dateCursor.getDate() + 1);
      }

      res.json({
        org_id: orgId,
        range_days: rangeDays,
        completion_rate: Number(completionRate.toFixed(3)),
        avg_time_to_close_hours: Number(avgTimeToCloseHours.toFixed(2)),
        high_risk_jobs: highRiskJobs,
        evidence_count: evidenceCount,
        jobs_with_evidence: jobsWithEvidence,
        jobs_without_evidence: jobsWithoutEvidence,
        avg_time_to_first_evidence_hours: Number(avgTimeToFirstEvidenceHours.toFixed(2)),
        trend,
      });
    } catch (error: any) {
      console.error("Analytics metrics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics metrics" });
    }
  }
);

