import { supabase } from "../lib/supabaseClient";
import {
  notifyWeeklySummary,
  sendDeadlineNotification,
} from "../services/notifications";

export async function runWeeklySummaryJob() {
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name");

  if (error) {
    console.error("Weekly summary job failed to load organizations:", error);
    return;
  }

  if (!organizations) return;

  for (const org of organizations) {
    try {
      const message = await buildSummaryMessage(org.id);
      await notifyWeeklySummary({
        organizationId: org.id,
        message,
      });
    } catch (err) {
      console.error(`Weekly summary failed for org ${org.id}:`, err);
    }
  }
}

async function buildSummaryMessage(organizationId: string) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, client_name, risk_score, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", oneWeekAgo.toISOString());

  const jobIds = (jobs || []).map((job) => job.id);
  if (jobIds.length === 0) {
    return "Last week: 0 work records logged, 0 flagged high-risk, controls completion 0%.";
  }

  const { data: controls } = await supabase
    .from("mitigation_items") // Table name unchanged (database schema)
    .select("id, done")
    .gte("created_at", oneWeekAgo.toISOString())
    .in("job_id", jobIds);

  const totalJobs = jobs?.length ?? 0;
  const highRiskJobs =
    jobs?.filter((job) => (job.risk_score ?? 0) >= 75).length ?? 0;
  const totalControls = controls?.length ?? 0;
  const completed = controls?.filter((item) => item.done).length ?? 0;
  const completionRate =
    totalControls === 0 ? 0 : Math.round((completed / totalControls) * 100);

  return `Last week: ${totalJobs} work records logged, ${highRiskJobs} flagged high-risk, controls completion ${completionRate}%.`;
}

/** Notify job owners about deadlines in the next 24 hours. Run daily (e.g. cron). */
export async function runDeadlineCheck() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, client_name, due_date, created_by")
    .not("due_date", "is", null)
    .gte("due_date", now.toISOString())
    .lte("due_date", in24h.toISOString());

  if (error) {
    console.error("Deadline check failed to load jobs:", error);
    return;
  }

  if (!jobs?.length) return;

  for (const job of jobs) {
    const due = job.due_date ? new Date(job.due_date) : null;
    const createdBy = job.created_by;
    if (!due || !createdBy) continue;
    const hoursRemaining = (due.getTime() - now.getTime()) / (60 * 60 * 1000);
    try {
      await sendDeadlineNotification(
        createdBy,
        job.id,
        hoursRemaining,
        job.client_name ?? undefined
      );
    } catch (err) {
      console.error(`Deadline notification failed for job ${job.id}:`, err);
    }
  }
}

