import { supabase } from "../lib/supabaseClient";
import { notifyWeeklySummary } from "../services/notifications";

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

  const { data: mitigations } = await supabase
    .from("mitigation_items")
    .select("id, done")
    .gte("created_at", oneWeekAgo.toISOString())
    .in(
      "job_id",
      (jobs || []).map((job) => job.id)
    );

  const totalJobs = jobs?.length ?? 0;
  const highRiskJobs =
    jobs?.filter((job) => (job.risk_score ?? 0) >= 75).length ?? 0;
  const totalMitigations = mitigations?.length ?? 0;
  const completed = mitigations?.filter((item) => item.done).length ?? 0;
  const completionRate =
    totalMitigations === 0 ? 0 : Math.round((completed / totalMitigations) * 100);

  return `Last week: ${totalJobs} jobs logged, ${highRiskJobs} flagged high-risk, mitigation completion ${completionRate}%.`;
}

