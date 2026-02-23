import React from "react";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";
import { formatDate } from "./base";

export interface TaskReminderEmailInput {
  userName: string;
  taskTitle: string;
  jobTitle: string;
  dueDate: string | null;
  isOverdue: boolean;
  hoursRemaining?: number;
  jobId?: string;
  taskId?: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function TaskReminderEmailComponent({
  input,
}: {
  input: TaskReminderEmailInput;
}) {
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
  const ctaUrl =
    input.jobId && input.taskId
      ? `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`
      : frontendUrl;

  return (
    <EmailLayout
      title={title}
      intro={intro}
      ctaLabel="View Task →"
      ctaUrl={ctaUrl}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Task:</strong> {input.taskTitle}
      </Text>
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Job:</strong> {jobTitle}
      </Text>
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Due:</strong> {formatDate(input.dueDate)}
      </Text>
      <Text style={{ margin: 0, color: "#b45309" }}>
        <strong>{dueText}</strong>
      </Text>
    </EmailLayout>
  );
}

export async function TaskReminderEmail(
  input: TaskReminderEmailInput
): Promise<EmailTemplate> {
  const jobTitle = input.jobTitle || "Job";
  const html = await render(
    React.createElement(TaskReminderEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: input.isOverdue
      ? `Overdue: ${input.taskTitle}`
      : `Due soon: ${input.taskTitle}`,
    html,
    text:
      text ||
      (input.isOverdue
        ? `'${input.taskTitle}' on '${jobTitle}' is overdue.`
        : `'${input.taskTitle}' on '${jobTitle}' is due soon.`),
  };
}
