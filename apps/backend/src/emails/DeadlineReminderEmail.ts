import { type EmailTemplate, e, formatDate, layout } from "./base";

export interface DeadlineReminderEmailInput {
  userName: string;
  job: {
    id?: string;
    title?: string | null;
    client_name?: string | null;
    due_date?: string | null;
  };
  hoursRemaining: number;
}

export function DeadlineReminderEmail(input: DeadlineReminderEmailInput): EmailTemplate {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.job.title || input.job.client_name || "Untitled job";
  const html = layout({
    title: "Deadline reminder",
    intro: `Hi ${input.userName}, a due date is approaching.`,
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Job:</strong> ${e(jobTitle)}</p>
      <p style="margin:0 0 8px;"><strong>Client:</strong> ${e(input.job.client_name || "Not set")}</p>
      <p style="margin:0 0 8px;"><strong>Due:</strong> ${e(formatDate(input.job.due_date))}</p>
      <p style="margin:0;color:#b45309;"><strong>${Math.max(0, Math.round(input.hoursRemaining))} hours remaining</strong></p>
    `,
    ctaLabel: "View Job →",
    ctaUrl: `${frontendUrl}/jobs/${input.job.id || ""}`,
  });

  return {
    subject: `Deadline reminder: ${jobTitle}`,
    html,
    text: `${jobTitle} is due soon (${Math.round(input.hoursRemaining)}h remaining).`,
  };
}
