import { type EmailTemplate, e, formatDate, layout } from "./base";

export interface JobAssignedEmailInput {
  userName: string;
  assignedByName: string;
  job: {
    id?: string;
    title?: string | null;
    client_name?: string | null;
    location?: string | null;
    due_date?: string | null;
    risk_level?: string | null;
  };
}

export function JobAssignedEmail(input: JobAssignedEmailInput): EmailTemplate {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.job.title || input.job.client_name || "Untitled job";
  const risk = input.job.risk_level || "unknown";
  const html = layout({
    title: "You were assigned to a job",
    intro: `Hi ${input.userName}, ${input.assignedByName} assigned a job to you.`,
    bodyHtml: `
      <div style="padding:16px;border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;">
        <p style="margin:0 0 8px;"><strong>Title:</strong> ${e(jobTitle)}</p>
        <p style="margin:0 0 8px;"><strong>Client:</strong> ${e(input.job.client_name || "Not set")}</p>
        <p style="margin:0 0 8px;"><strong>Location:</strong> ${e(input.job.location || "Not set")}</p>
        <p style="margin:0 0 8px;"><strong>Due date:</strong> ${e(formatDate(input.job.due_date))}</p>
        <p style="margin:0;"><strong>Risk:</strong> <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#0c4a6e;">${e(risk)}</span></p>
      </div>
    `,
    ctaLabel: "View Job Details →",
    ctaUrl: `${frontendUrl}/jobs/${input.job.id || ""}`,
  });

  return {
    subject: `Job assigned: ${jobTitle}`,
    html,
    text: `Hi ${input.userName}, ${input.assignedByName} assigned you to ${jobTitle}.`,
  };
}
