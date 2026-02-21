import { type EmailTemplate, e, layout } from "./base";

export interface TaskCompletedEmailInput {
  userName: string;
  taskTitle: string;
  jobTitle: string;
  taskId: string;
}

export function TaskCompletedEmail(input: TaskCompletedEmailInput): EmailTemplate {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.jobTitle || "Job";
  const html = layout({
    title: "Task completed",
    intro: `Hi ${input.userName}, a task you created has been completed.`,
    bodyHtml: `
      <p style="margin:0 0 8px;"><strong>Task:</strong> ${e(input.taskTitle)}</p>
      <p style="margin:0;"><strong>Job:</strong> ${e(jobTitle)}</p>
    `,
    ctaLabel: "View Task →",
    ctaUrl: `${frontendUrl}/tasks/${input.taskId}`,
  });

  return {
    subject: `Task completed: ${input.taskTitle}`,
    html,
    text: `'${input.taskTitle}' has been completed.`,
  };
}
