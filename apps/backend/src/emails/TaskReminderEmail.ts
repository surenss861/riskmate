import { type EmailTemplate, e, formatDate, layout } from "./base";

export interface TaskReminderEmailInput {
  userName: string;
  taskTitle: string;
  jobTitle: string;
  dueDate: string | null;
  isOverdue: boolean;
  hoursRemaining?: number;
  jobId?: string;
  taskId?: string;
}

export function TaskReminderEmail(input: TaskReminderEmailInput): EmailTemplate {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.jobTitle || "Job";
  const title = input.isOverdue ? "Task overdue" : "Task due soon";
  const intro = input.isOverdue
    ? `Hi ${input.userName}, a task is overdue.`
    : `Hi ${input.userName}, a task is due within 24 hours.`;
  const dueText = input.isOverdue
    ? "This task is past its due date."
    : input.hoursRemaining != null
      ? `${Math.max(0, Math.round(input.hoursRemaining))} hours remaining`
      : formatDate(input.dueDate);
  const html = layout({
    title,
    intro,
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Task:</strong> ${e(input.taskTitle)}</p>
      <p style="margin:0 0 8px;"><strong>Job:</strong> ${e(jobTitle)}</p>
      <p style="margin:0 0 8px;"><strong>Due:</strong> ${e(formatDate(input.dueDate))}</p>
      <p style="margin:0;color:#b45309;"><strong>${e(dueText)}</strong></p>
    `,
    ctaLabel: "View Task →",
    ctaUrl:
      input.jobId && input.taskId
        ? `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`
        : frontendUrl,
  });

  return {
    subject: input.isOverdue ? `Overdue: ${input.taskTitle}` : `Due soon: ${input.taskTitle}`,
    html,
    text: input.isOverdue
      ? `'${input.taskTitle}' on '${jobTitle}' is overdue.`
      : `'${input.taskTitle}' on '${jobTitle}' is due soon.`,
  };
}
