import React from "react";
import { Text } from "@react-email/components";
import { render, toPlainText } from "@react-email/render";
import { EmailLayout } from "./EmailLayout";

export interface TaskCompletedEmailInput {
  userName: string;
  taskTitle: string;
  jobTitle: string;
  taskId: string;
  jobId: string;
  managePreferencesUrl?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function TaskCompletedEmailComponent({
  input,
}: {
  input: TaskCompletedEmailInput;
}) {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.riskmate.dev";
  const jobTitle = input.jobTitle || "Job";
  const ctaUrl = input.jobId
    ? `${frontendUrl}/jobs/${input.jobId}/tasks?highlight=${input.taskId}`
    : `${frontendUrl}/tasks/${input.taskId}`;

  return (
    <EmailLayout
      title="Task completed"
      intro={`Hi ${input.userName}, a task you created has been completed.`}
      ctaLabel="View Task →"
      ctaUrl={ctaUrl}
      managePreferencesUrl={input.managePreferencesUrl}
    >
      <Text style={{ margin: "0 0 8px" }}>
        <strong>Task:</strong> {input.taskTitle}
      </Text>
      <Text style={{ margin: 0 }}>
        <strong>Job:</strong> {jobTitle}
      </Text>
    </EmailLayout>
  );
}

export async function TaskCompletedEmail(
  input: TaskCompletedEmailInput
): Promise<EmailTemplate> {
  const html = await render(
    React.createElement(TaskCompletedEmailComponent, { input })
  );
  const text = toPlainText(html);
  return {
    subject: `Task completed: ${input.taskTitle}`,
    html,
    text: text || `'${input.taskTitle}' has been completed.`,
  };
}
